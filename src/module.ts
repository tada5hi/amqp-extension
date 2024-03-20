/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { connect } from 'amqp-connection-manager';
import type { Channel, ConsumeMessage } from 'amqplib';
import process from 'node:process';
import { merge } from 'smob';
import { v4 } from 'uuid';
import type { Config, ConfigInput } from './config';
import { buildConfig } from './config';
import type { ConsumeHandlers } from './consume';
import { ConsumeHandlerAnyKey, buildDriverConsumeOptions } from './consume';
import type { ExchangeOptions } from './exchange';
import { buildDriverExchangeOptions, isDefaultExchange } from './exchange';
import type { PublishOptionsExtended } from './publish';
import { buildDriverPublishOptions } from './publish';
import type { Connection, ConsumeOptions } from './type';

export class Client {
    protected connection: Connection | undefined;

    protected config : Config;

    constructor(options: ConfigInput) {
        this.config = buildConfig(options);

        process.once('SIGINT', async () => {
            if (this.connection) {
                await this.connection.close();
            }
        });
    }

    useConnection() : Connection {
        if (typeof this.connection !== 'undefined') {
            return this.connection;
        }

        this.connection = connect(this.config.connection, {
            reconnectTimeInSeconds: this.config.reconnectTimeout,
        });

        return this.connection;
    }

    async consume(
        options: ConsumeOptions,
        handlers: ConsumeHandlers,
    ) : Promise<void> {
        options = merge(options, this.config.consume);

        const exchangeOptions = merge(
            options.exchange || {},
            this.config.exchange,
        ) as ExchangeOptions;

        let queueName : string = options.queueName || this.config.publish.queueName || '';

        const requeueOnFailure : boolean = this.config.consume.requeueOnFailure ?? false;

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
                channel.nack(message);
            }
        };

        const connection = this.useConnection();
        const channel = connection.createChannel({
            setup: async (channel: Channel) => {
                if (isDefaultExchange(exchangeOptions.type)) {
                    if (queueName === '') {
                        throw new Error('The queue name can not be empty if a non default exchange is selected.');
                    }

                    await channel.assertQueue(queueName, {
                        durable: true,
                    });
                } else {
                    await channel.assertExchange(
                        exchangeOptions.name,
                        exchangeOptions.type,
                        buildDriverExchangeOptions({
                            durable: true,
                            ...exchangeOptions,
                        }),
                    );

                    const assertionQueue = await channel.assertQueue('', {
                        durable: false,
                        autoDelete: true,
                        exclusive: true,
                    });

                    if (typeof exchangeOptions.routingKey === 'undefined') {
                        throw new Error('The routingKey can not be empty if a non default exchange is selected.');
                    }

                    await channel.bindQueue(
                        assertionQueue.queue,
                        this.config.exchange.name,
                        exchangeOptions.routingKey,
                    );

                    queueName = assertionQueue.queue;
                }

                if (typeof options.prefetchCount !== 'undefined') {
                    await channel.prefetch(options.prefetchCount);
                }

                await channel.consume(
                    queueName,
                    (message) => handleMessage(message),
                    buildDriverConsumeOptions(options),
                );
            },
        });

        return channel.waitForConnect();
    }

    async publish(options: PublishOptionsExtended) : Promise<boolean> {
        let buffer : Buffer;

        if (Buffer.isBuffer(options.content)) {
            buffer = options.content;
        } else if (typeof options.content === 'string') {
            buffer = Buffer.from(options.content, 'utf-8');
        } else {
            buffer = Buffer.from(JSON.stringify(options.content), 'utf-8');
        }

        options = merge(
            options,
            this.config.publish || {},
        );

        if (typeof options.messageId === 'undefined') {
            options.messageId = options.id || v4();
        }

        const exchangeOptions = merge(
            {},
            options.exchange || {},
            this.config.exchange,
        ) as ExchangeOptions;

        // publish to default exchange
        const queueName : string | undefined = options.queueName ||
            this.config.publish.queueName;

        const connection = this.useConnection();
        const channel = connection.createChannel({
            setup: async (channel: Channel) => {
                if (!isDefaultExchange(exchangeOptions.type)) {
                    await channel.assertExchange(
                        exchangeOptions.name,
                        exchangeOptions.type,
                        buildDriverExchangeOptions({
                            durable: true,
                            ...exchangeOptions,
                        }),
                    );

                    return;
                }

                if (typeof queueName === 'undefined' || queueName === '') {
                    throw new Error('The queue name can not be empty if a non default exchange is selected.');
                }

                await channel.assertQueue(queueName, {
                    durable: true,
                });
            },
        });

        if (!isDefaultExchange(exchangeOptions.type)) {
            if (typeof exchangeOptions.routingKey === 'undefined') {
                throw new Error('The routingKey can not be empty if a non default exchange is selected.');
            }

            const published = await channel.publish(
                this.config.exchange.name,
                exchangeOptions.routingKey,
                buffer,
                buildDriverPublishOptions({
                    persistent: true,
                    ...options,
                }),
            );

            await channel.close();

            return published;
        }

        if (typeof queueName === 'undefined' || queueName === '') {
            throw new Error('The queue name can not be empty if a non default exchange is selected.');
        }

        const published = await channel.sendToQueue(queueName, buffer, buildDriverPublishOptions({
            persistent: true,
            ...options,
        }));

        await channel.close();

        return published;
    }
}
