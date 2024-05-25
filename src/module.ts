/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { connect } from 'amqp-connection-manager';
import type { Channel, ConsumeMessage } from 'amqplib';
import process from 'node:process';
import type { Connection, ConsumeOptions } from './type';
import type { Config, ConfigInput } from './config';
import { buildConfig } from './config';
import type { ConsumeHandlers } from './consume';
import { ConsumeHandlerAnyKey, buildDriverConsumeOptions } from './consume';
import { ExchangeType, buildDriverExchangeOptions, isDefaultExchange } from './exchange';
import type { PublishOptionsExtended } from './publish';
import { buildDriverPublishOptions } from './publish';
import { mergeOptions } from './utils';

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
        const consumeOptions = mergeOptions(
            options,
            {
                exchange: this.config.exchange || {},
            },
            this.config.consume,
        );

        const requeueOnFailure = consumeOptions.requeueOnFailure ?? false;
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

        const connection = this.useConnection();
        const channel = connection.createChannel({
            setup: async (channel: Channel) => {
                let queueName = consumeOptions.queueName || consumeOptions.exchange.routingKey || '';
                if (isDefaultExchange(consumeOptions.exchange.type)) {
                    if (queueName === '') {
                        throw new Error('The queue name can not be empty if the default exchange is selected.');
                    }

                    await channel.assertQueue(queueName, {
                        durable: true,
                    });
                } else {
                    await channel.assertExchange(
                        consumeOptions.exchange.name,
                        consumeOptions.exchange.type || ExchangeType.TOPIC,
                        buildDriverExchangeOptions({
                            durable: true,
                            ...consumeOptions.exchange,
                        }),
                    );

                    const assertionQueue = await channel.assertQueue('', {
                        durable: false,
                        autoDelete: true,
                        exclusive: true,
                    });

                    await channel.bindQueue(
                        assertionQueue.queue,
                        consumeOptions.exchange.name,
                        consumeOptions.exchange.routingKey || '',
                    );

                    queueName = assertionQueue.queue;
                }

                if (typeof consumeOptions.prefetchCount === 'number') {
                    await channel.prefetch(consumeOptions.prefetchCount);
                }

                await channel.consume(
                    queueName,
                    (message) => handleMessage(message),
                    buildDriverConsumeOptions(consumeOptions),
                );
            },
        });

        return channel.waitForConnect();
    }

    // publish(to: string, data: any, options);
    async publish(options: PublishOptionsExtended) : Promise<boolean> {
        let buffer : Buffer;

        if (Buffer.isBuffer(options.content)) {
            buffer = options.content;
        } else if (typeof options.content === 'string') {
            buffer = Buffer.from(options.content, 'utf-8');
        } else {
            buffer = Buffer.from(JSON.stringify(options.content), 'utf-8');
        }

        const publishOptions = mergeOptions(
            options,
            {
                exchange: this.config.exchange || {},
            },
            this.config.publish,
        );

        // publish to default exchange
        const queueName = publishOptions.queueName || publishOptions.exchange.routingKey || '';

        const connection = this.useConnection();
        const channel = connection.createChannel({
            setup: async (channel: Channel) => {
                if (isDefaultExchange(publishOptions.exchange.type)) {
                    if (!queueName) {
                        throw new Error('The queue name can not be empty if the default exchange is selected.');
                    }

                    await channel.assertQueue(queueName, {
                        durable: true,
                    });

                    return;
                }

                await channel.assertExchange(
                    publishOptions.exchange.name,
                    publishOptions.exchange.type || ExchangeType.TOPIC,
                    buildDriverExchangeOptions({
                        durable: true,
                        ...publishOptions.exchange,
                    }),
                );
            },
        });

        if (!queueName) {
            throw new Error('The exchange.routingKey/queueName can not be empty.');
        }

        const published = await channel.publish(
            publishOptions.exchange.name || '',
            queueName,
            buffer,
            buildDriverPublishOptions({
                persistent: true,
                ...publishOptions,
            }),
        );

        await channel.close();

        return published;
    }
}
