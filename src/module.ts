/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ChannelWrapper } from 'amqp-connection-manager';
import { connect } from 'amqp-connection-manager';
import type { Channel } from 'amqplib';
import type { ConsumeContext, ConsumeHandlers, ConsumeOptions } from './consume';
import { handleMessage } from './consume/utils';
import { ClientError, SerializationError } from './errors';
import { toError } from './errors/utils';
import type { Exchange } from './exchange';
import { ExchangeType } from './exchange';
import type { PublishContext, PublishOptions } from './publish';
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
        this.connection = ctx.connection ?? connect(ctx.connectionOptions, { reconnectTimeInSeconds: 60 });
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

    async consume(ctx: ConsumeContext) : Promise<void>;

    async consume(from: string, handlers: ConsumeHandlers): Promise<void>;

    async consume(from: string, options: ConsumeOptions, handlers: ConsumeHandlers): Promise<void>;

    async consume(
        _ctxOrFrom: ConsumeContext | string,
        _optionsOrHandlers?: ConsumeOptions | ConsumeHandlers,
        _handlers?: ConsumeHandlers,
    ) : Promise<void> {
        const ctx : ConsumeContext = typeof _ctxOrFrom === 'string' ?
            {
                from: _ctxOrFrom,
                options: _handlers ? _optionsOrHandlers as ConsumeOptions : undefined,
                handlers: _handlers || _optionsOrHandlers as ConsumeHandlers,
            } :
            _ctxOrFrom;

        try {
            this.assertOpen();

            const options = ctx.options ? mergeOptions(ctx.options, this.consumeOptions) : this.consumeOptions;
            const topology = planTopology(this.exchange, ctx.from, options, true);

            const channel = this.connection.createChannel({
                setup: guard(async (ch: Channel) => {
                    const queue = await assertTopology(ch, topology) as string;

                    if (typeof options.prefetchCount === 'number') {
                        await ch.prefetch(options.prefetchCount);
                    }

                    await ch.consume(queue, (message) => handleMessage(message, ch, ctx.handlers, options), options);
                }),
            });

            try {
                await Promise.race([channel.waitForConnect(), failure(channel)]);
            } catch (e) {
                // not awaited: amqplib never settles the close when the connection drops before close-ok
                channel.close().catch(noop);
                throw e;
            }
        } catch (e) {
            throw toError(e);
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
