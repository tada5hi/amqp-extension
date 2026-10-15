/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ChannelWrapper } from 'amqp-connection-manager';
import { connect } from 'amqp-connection-manager';
import type { Channel } from 'amqplib';
import type {
    ConsumeContext,
    ConsumeHandlers,
    ConsumeOptions,
    Consumer,
    HandleMessageContext,
} from './consume';
import { handleMessage } from './consume/utils';
import { ClientError, SerializationError } from './errors';
import { toError } from './errors/utils';
import type { Exchange } from './exchange';
import { ExchangeType } from './exchange';
import type { PublishContext, PublishOptions, RepublishOptions } from './publish';
import { assertTopology, planTopology } from './queue/utils';
import type { ClientContext, Connection } from './types';
import { mergeOptions } from './utils';

// connections closed through Client.close(), shared by of() siblings
const closed = new WeakSet<Connection>();

const noop = () => undefined;

/**
 * Wrap a setup function, so a broker rejection during it (e.g. 403/406) closes only this channel:
 * without an 'error' listener on the raw channel, amqplib rethrows it and tears down the whole connection.
 * Only during setup: a channel error afterwards must still recycle the connection, because
 * amqp-connection-manager never recovers a channel-only close, so consumers would silently die.
 */
function guard(setup: (channel: Channel) => Promise<unknown>) {
    return async (channel: Channel) => {
        channel.on('error', noop);

        try {
            await setup(channel);
        } finally {
            channel.off('error', noop);
        }
    };
}

/**
 * Reject when the broker rejects a setup function (an error with an AMQP reply code)
 * or the channel is closed (client.close()).
 * Errors without a reply code (connection dropped mid-setup) are transient:
 * the setup runs again on reconnect, so keep waiting.
 */
function failure(channel: ChannelWrapper) : Promise<never> {
    const promise = new Promise<never>((_resolve, reject) => {
        // ponytail: the listener stays, so setup errors after a reconnect are swallowed instead of crashing the process
        channel.on('error', (err: Error & { code?: unknown }) => {
            if (typeof err.code === 'number') {
                reject(err);
            }
        });
        channel.once('close', () => reject(ClientError.channelClosed()));
    });

    // it may reject long after the call settled (e.g. close()), which is not an unhandled rejection
    promise.catch(noop);

    return promise;
}

export class Client {
    public readonly connection: Connection;

    protected publishOptions : PublishOptions;

    protected consumeOptions : ConsumeOptions;

    protected exchange: Exchange;

    constructor(ctx: ClientContext) {
        this.connection = ctx.connection ?? connect(ctx.connectionOptions, ctx.connectionManagerOptions);
        this.publishOptions = ctx.publishOptions || {};
        this.consumeOptions = ctx.consumeOptions || {};
        this.exchange = ctx.exchange || {
            type: ExchangeType.DIRECT,
            name: '',
        };
    }

    of(exchange: Exchange) : Client {
        return new Client({
            connection: this.connection,
            publishOptions: this.publishOptions,
            consumeOptions: this.consumeOptions,
            exchange,
        });
    }

    /**
     * Close the (shared) connection and all its channels.
     */
    async close() : Promise<void> {
        closed.add(this.connection);
        await this.connection.close();
    }

    /**
     * `await using client = new Client(...)` closes the client when the scope ends.
     * Like close(), it closes the shared connection, so use it on the root client, not on of() siblings.
     */
    async [Symbol.asyncDispose]() : Promise<void> {
        await this.close();
    }

    protected assertOpen() : void {
        if (closed.has(this.connection)) {
            throw ClientError.closed();
        }
    }

    async consume(ctx: ConsumeContext) : Promise<Consumer>;

    async consume(from: string, handlers: ConsumeHandlers): Promise<Consumer>;

    async consume(from: string, options: ConsumeOptions, handlers: ConsumeHandlers): Promise<Consumer>;

    async consume(
        _ctxOrFrom: ConsumeContext | string,
        _optionsOrHandlers?: ConsumeOptions | ConsumeHandlers,
        _handlers?: ConsumeHandlers,
    ) : Promise<Consumer> {
        const ctx : ConsumeContext = typeof _ctxOrFrom === 'string' ?
            {
                from: _ctxOrFrom,
                options: _handlers ? _optionsOrHandlers as ConsumeOptions : undefined,
                handlers: _handlers || _optionsOrHandlers as ConsumeHandlers,
            } :
            _ctxOrFrom;

        try {
            this.assertOpen();

            let options = this.consumeOptions;
            if (ctx.options) {
                // smob clones through structuredClone, which throws on functions
                const { onError, ...rest } = ctx.options;
                const { onError: fallback, ...defaults } = this.consumeOptions;
                options = { ...mergeOptions(rest, defaults), onError: onError ?? fallback };
            }

            const topology = planTopology(this.exchange, ctx.from, options, true);

            let cancelled = false;
            // the raw channel and consumer tag of the latest setup run
            let current : { ch: Channel, consumerTag: string } | undefined;
            // the latest setup run, awaited by cancel(): one in progress during a reconnect still registers a consumer
            let running : Promise<void> | undefined;
            const inFlight = new Set<Promise<void>>();
            // with retry: the same runs by messageId, for the redelivery guard; kept across setup runs (reconnects)
            const tracked = new Map<string, Promise<void>>();

            const channel = this.connection.createChannel({
                setup: guard((ch: Channel) => {
                    running = (async () => {
                        if (cancelled) {
                            return;
                        }

                        const queue = await assertTopology(ch, topology) as string;

                        if (typeof options.prefetchCount === 'number') {
                            await ch.prefetch(options.prefetchCount);
                        }

                        const context : HandleMessageContext = {
                            inFlight: tracked,
                            republish: (content, props) => this.republish(queue, content, props),
                        };

                        const { consumerTag } = await ch.consume(queue, (message) => {
                            const handled = handleMessage(message, ch, ctx.handlers, options, context);
                            inFlight.add(handled);
                            // handleMessage never rejects
                            handled.then(() => inFlight.delete(handled));
                        }, options);
                        current = { ch, consumerTag };
                    })();

                    return running;
                }),
            });

            try {
                await Promise.race([channel.waitForConnect(), failure(channel)]);
            } catch (e) {
                // not awaited: amqplib never settles the close when the connection drops before close-ok
                channel.close().catch(noop);
                throw e;
            }

            let cancelling : Promise<void> | undefined;
            const cancel = () => {
                cancelling ??= (async () => {
                    // no setup run after this one: a reconnect does not re-register the consumer
                    cancelled = true;
                    await running?.catch(noop);

                    // basic.cancel: no new deliveries, the channel stays open to settle the in-flight ones
                    // (fails on a closed channel, e.g. after close() or during a reconnect)
                    await current?.ch.cancel(current.consumerTag).catch(noop);

                    // ponytail: a handler that never settles hangs cancel()
                    // (a loop: deliveries that arrived before the cancel took effect add to the set)
                    while (inFlight.size > 0) {
                        await Promise.all(inFlight);
                    }

                    // ponytail: hangs if the connection drops between ChannelClose and CloseOk (amqplib)
                    await channel.close().catch(noop);
                })();

                return cancelling;
            };

            return { cancel, [Symbol.asyncDispose]: cancel };
        } catch (e) {
            throw toError(e);
        }
    }

    /**
     * Re-publish a message for a retry, through the default exchange by queue name:
     * that reaches the queue whatever exchange delivered it, without re-declaring it.
     * Its own channel, not the consume channel: that one may have been reset while
     * the handler ran, and this one waits for the broker's confirm.
     *
     * ponytail: a server-named queue is gone after a reconnect, so a retry of a
     * message from before it is unroutable and dropped by the broker.
     */
    protected async republish(queue: string, content: Buffer, options: RepublishOptions) : Promise<void> {
        this.assertOpen();

        const channel = this.connection.createChannel();

        // bounded, so a broker outage reaches the requeue nack instead of hanging cancel()
        const published = channel.publish('', queue, content, { ...options, timeout: 30_000 });
        published.catch(noop);

        try {
            // failure() also listens for the channel's errors: without a listener, a connection
            // lost while the channel opens surfaces as an unhandled rejection
            await Promise.race([published, failure(channel)]);
        } finally {
            // not awaited, see consume()
            channel.close().catch(noop);
        }
    }

    async publish(ctx: PublishContext) : Promise<boolean>;

    async publish(to: string, data: any) : Promise<boolean>;

    async publish(to: string, data: any, options: PublishOptions): Promise<boolean>;

    async publish(
        _toOrCtx: PublishContext | string,
        _data?: any,
        _options?: PublishOptions,
    ) : Promise<boolean> {
        const ctx : PublishContext = typeof _toOrCtx === 'string' ?
            {
                to: _toOrCtx,
                data: _data,
                options: _options,
            } :
            _toOrCtx;

        try {
            this.assertOpen();

            const options = ctx.options ? mergeOptions(ctx.options, this.publishOptions) : this.publishOptions;
            const topology = planTopology(this.exchange, ctx.to, options);

            let content : Buffer;
            if (Buffer.isBuffer(ctx.data)) {
                content = ctx.data;
            } else if (typeof ctx.data === 'string') {
                content = Buffer.from(ctx.data, 'utf-8');
            } else {
                let json : string | undefined;
                try {
                    json = JSON.stringify(ctx.data);
                } catch (e) {
                    throw SerializationError.payload(e);
                }

                // undefined, functions and symbols serialize to undefined
                if (typeof json === 'undefined') {
                    throw SerializationError.payload();
                }

                content = Buffer.from(json, 'utf-8');
            }

            // ponytail: one channel per publish (self-healing, no shared state), reuse channels when throughput matters
            const channel = this.connection.createChannel({ setup: guard((ch: Channel) => assertTopology(ch, topology)) });

            // queued right away: sent once the setup ran, bounded by options.timeout, rejected by close()
            const published = channel.publish(this.exchange.name || '', ctx.to, content, options);
            published.catch(noop);

            try {
                return await Promise.race([published, failure(channel)]);
            } finally {
                // not awaited, see consume()
                channel.close().catch(noop);
            }
        } catch (e) {
            throw toError(e);
        }
    }
}
