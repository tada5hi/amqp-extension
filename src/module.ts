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
import type { Exchange } from './exchange';
import { ExchangeType } from './exchange';
import type { PublishContext, PublishOptions } from './publish';
import { assertTopology, planTopology } from './queue/utils';
import type { ClientContext, Connection } from './type';
import { mergeOptions } from './utils';

/**
 * Resolve once the channel is set up, reject when a setup function fails
 * (e.g. the broker rejects a declaration).
 */
function ready(channel: ChannelWrapper) : Promise<void> {
    return new Promise((resolve, reject) => {
        // ponytail: the listener stays, so setup errors after a reconnect are swallowed instead of crashing the process
        channel.on('error', reject);
        channel.waitForConnect().then(resolve);
    });
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
        await this.connection.close();
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

        const options = ctx.options ? mergeOptions(ctx.options, this.consumeOptions) : this.consumeOptions;
        const topology = planTopology(this.exchange, ctx.from, options, true);

        const channel = this.connection.createChannel({
            setup: async (ch: Channel) => {
                const queue = await assertTopology(ch, topology) as string;

                if (typeof options.prefetchCount === 'number') {
                    await ch.prefetch(options.prefetchCount);
                }

                await ch.consume(queue, (message) => handleMessage(message, ch, ctx.handlers, options), options);
            },
        });

        try {
            await ready(channel);
        } catch (e) {
            await channel.close().catch(() => undefined);
            throw e;
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

        const options = ctx.options ? mergeOptions(ctx.options, this.publishOptions) : this.publishOptions;
        const topology = planTopology(this.exchange, ctx.to, options);

        let content : Buffer;
        if (Buffer.isBuffer(ctx.data)) {
            content = ctx.data;
        } else {
            content = Buffer.from(typeof ctx.data === 'string' ? ctx.data : JSON.stringify(ctx.data), 'utf-8');
        }

        // ponytail: one channel per publish (self-healing, no shared state), reuse channels when throughput matters
        const channel = this.connection.createChannel({ setup: (ch: Channel) => assertTopology(ch, topology) });

        try {
            await ready(channel);

            return await channel.publish(this.exchange.name || '', ctx.to, content, options);
        } finally {
            await channel.close().catch(() => undefined);
        }
    }
}
