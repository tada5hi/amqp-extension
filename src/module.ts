/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { connect } from 'amqp-connection-manager';
import type { Channel, ConsumeMessage } from 'amqplib';
import process from 'node:process';
import type { PublishContext, PublishOptions } from './publish';
import type {
    ClientContext,
    Connection,

} from './type';
import type { ConsumeContext, ConsumeHandlers, ConsumeOptions } from './consume';
import { ConsumeHandlerAnyKey, isConsumeHandlers } from './consume';
import type { Exchange } from './exchange';
import {
    ExchangeType, isDefaultExchange,
} from './exchange';
import { mergeOptions } from './utils';

export class Client {
    public readonly connection: Connection;

    protected publishOptions : PublishOptions;

    protected consumeOptions : ConsumeOptions;

    protected exchange: Exchange;

    constructor(ctx: ClientContext) {
        if (ctx.connection) {
            this.connection = ctx.connection;
        } else {
            this.connection = connect(ctx.connectionOptions, {
                reconnectTimeInSeconds: 60,
            });

            process.once('SIGINT', async () => {
                if (this.connection) {
                    await this.connection.close();
                }
            });
        }

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

    async consume(ctx: ConsumeContext) : Promise<void>;

    async consume(from: string, handlers: ConsumeHandlers): Promise<void>;

    async consume(from: string, options: ConsumeOptions, handlers: ConsumeHandlers): Promise<void>;

    async consume(
        _ctxOrFrom: ConsumeContext | string,
        _optionsOrHandlers?: ConsumeOptions | ConsumeHandlers,
        _handlers?: ConsumeHandlers,
    ) : Promise<void> {
        let from : string;
        let handlers: ConsumeHandlers;
        let options: ConsumeOptions;

        if (typeof _ctxOrFrom === 'string') {
            from = _ctxOrFrom;

            if (isConsumeHandlers(_optionsOrHandlers)) {
                handlers = _optionsOrHandlers;
                options = this.consumeOptions;
            } else {
                handlers = _handlers as ConsumeHandlers;
                options = mergeOptions(_optionsOrHandlers as ConsumeOptions, this.consumeOptions);
            }
        } else {
            from = _ctxOrFrom.from;
            handlers = _ctxOrFrom.handlers;

            if (_ctxOrFrom.options) {
                options = mergeOptions(_ctxOrFrom.options, this.consumeOptions);
            } else {
                options = this.consumeOptions;
            }
        }

        const requeueOnFailure = options.requeueOnFailure ?? false;
        const handleMessage = async (message: ConsumeMessage | null) => {
            if (!message) {
                return;
            }

            const handler = handlers[message.properties.type] ||
                handlers[ConsumeHandlerAnyKey];

            if (typeof handler === 'undefined') {
                channel.nack(message, undefined, requeueOnFailure);
                return;
            }

            try {
                await handler(message, channel);

                channel.ack(message);
            } catch (e) {
                channel.nack(message, undefined, requeueOnFailure);
            }
        };

        const channel = this.connection.createChannel({
            setup: async (channel: Channel) => {
                let queueName = from;
                if (isDefaultExchange(this.exchange.type)) {
                    if (queueName === '') {
                        throw new Error('The queue name can not be empty if the default exchange is selected.');
                    }

                    await channel.assertQueue(queueName, {
                        durable: true,
                    });
                } else {
                    await channel.assertExchange(
                        this.exchange.name || '',
                        this.exchange.type,
                        this.exchange.options,
                    );

                    const assertionQueue = await channel.assertQueue(
                        '',
                        {
                            durable: false,
                            autoDelete: true,
                            exclusive: true,
                        },
                    );

                    await channel.bindQueue(
                        assertionQueue.queue,
                        this.exchange.name || '',
                        from || '',
                    );

                    queueName = assertionQueue.queue;
                }

                if (typeof options.prefetchCount === 'number') {
                    await channel.prefetch(options.prefetchCount);
                }

                await channel.consume(
                    queueName,
                    (message) => handleMessage(message),
                    options,
                );
            },
        });

        return channel.waitForConnect();
    }

    async publish(ctx: PublishContext) : Promise<boolean>;

    async publish(to: string, data: any) : Promise<boolean>;

    async publish(to: string, data: any, options: PublishOptions): Promise<boolean>;

    async publish(
        _toOrCtx: PublishContext | string,
        _data?: any,
        _options?: PublishOptions,
    ) : Promise<boolean> {
        let buffer : Buffer;

        let to : string;
        let data : any;
        let options : PublishOptions;
        if (typeof _toOrCtx === 'string') {
            to = _toOrCtx;
            data = _data;

            if (_options) {
                options = mergeOptions(_options, this.publishOptions);
            } else {
                options = this.publishOptions;
            }
        } else {
            to = _toOrCtx.to;
            data = _toOrCtx.data;

            if (_toOrCtx.options) {
                options = mergeOptions(_toOrCtx.options, this.publishOptions);
            } else {
                options = this.publishOptions;
            }
        }

        if (Buffer.isBuffer(data)) {
            buffer = data;
        } else if (typeof data === 'string') {
            buffer = Buffer.from(data, 'utf-8');
        } else {
            buffer = Buffer.from(JSON.stringify(data), 'utf-8');
        }

        const { connection } = this;
        const channel = connection.createChannel({
            setup: async (channel: Channel) => {
                if (isDefaultExchange(this.exchange.type)) {
                    if (!to) {
                        throw new Error('The queue name can not be empty if the default exchange is selected.');
                    }

                    await channel.assertQueue(to, {
                        durable: true,
                    });

                    return;
                }

                if (!this.exchange.name) {
                    throw new SyntaxError('A non default exchange requires a name.');
                }

                await channel.assertExchange(
                    this.exchange.name,
                    this.exchange.type,
                    this.exchange.options,
                );
            },
        });

        if (!to) {
            throw new SyntaxError('The publish operation requires a destination.');
        }

        const published = await channel.publish(
            this.exchange.name || '',
            to,
            buffer,
            options,
        );

        await channel.close();

        return published;
    }
}
