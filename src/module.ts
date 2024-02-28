/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Connection, ConsumeMessage } from 'amqplib';
import { connect } from 'amqplib';
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
import type { ConsumeOptions } from './type';

export class Client {
    protected connection: Connection | undefined;

    protected config : Config;

    constructor(options: ConfigInput) {
        this.config = buildConfig(options);
    }

    async useConnection() : Promise<Connection> {
        if (typeof this.connection !== 'undefined') {
            return this.connection;
        }

        this.connection = await connect(this.config.connection);
        return this.connection;
    }

    async consume(
        options: ConsumeOptions,
        handlers: ConsumeHandlers,
    ) : Promise<void> {
        const connection = await this.useConnection();
        const channel = await connection.createChannel();

        options = merge(options, this.config.consume);

        const exchangeOptions = merge(
            options.exchange || {},
            this.config.exchange,
        ) as ExchangeOptions;

        let queueName : string = options.queueName || this.config.publish.queueName || '';

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

        const handleMessage = async (message: ConsumeMessage | null) => {
            if (!message) {
                return;
            }

            const handler = handlers[message.properties.type] ||
                handlers[ConsumeHandlerAnyKey];

            const requeueOnFailure : boolean = this.config.consume.requeueOnFailure ?? false;

            if (typeof handler === 'undefined') {
                channel.reject(message, requeueOnFailure);
                return;
            }

            try {
                await handler(message, channel);

                channel.ack(message);
            } catch (e) {
                channel.reject(message, requeueOnFailure);
            }
        };

        await channel.consume(
            queueName,
            (message) => handleMessage(message),
            buildDriverConsumeOptions(options),
        );
    }

    async publish(options: PublishOptionsExtended) {
        let buffer : Buffer;

        if (Buffer.isBuffer(options.content)) {
            buffer = options.content;
        } else if (typeof options.content === 'string') {
            buffer = Buffer.from(options.content, 'utf-8');
        } else {
            buffer = Buffer.from(JSON.stringify(options.content), 'utf-8');
        }

        const connection = await this.useConnection();
        const channel = await connection.createChannel();

        options = merge(
            options,
            this.config.publish || {},
        );

        const exchangeOptions = merge(
            {},
            options.exchange || {},
            this.config.exchange,
        ) as ExchangeOptions;

        if (!isDefaultExchange(exchangeOptions.type)) {
            await channel.assertExchange(
                exchangeOptions.name,
                exchangeOptions.type,
                buildDriverExchangeOptions({
                    durable: true,
                    ...exchangeOptions,
                }),
            );
        }

        if (typeof options.messageId === 'undefined') {
            options.messageId = options.id || v4();
        }

        if (!isDefaultExchange(exchangeOptions.type)) {
            if (typeof exchangeOptions.routingKey === 'undefined') {
                throw new Error('The routingKey can not be empty if a non default exchange is selected.');
            }

            channel.publish(
                this.config.exchange.name,
                exchangeOptions.routingKey,
                buffer,
                buildDriverPublishOptions({
                    persistent: true,
                    ...options,
                }),
            );

            return;
        }

        // publish to default exchange
        const queueName : string | undefined = options.queueName ||
            this.config.publish.queueName;

        if (typeof queueName === 'undefined' || queueName === '') {
            throw new Error('The queue name can not be empty if a non default exchange is selected.');
        }

        await channel.assertQueue(queueName, {
            durable: true,
        });

        channel.sendToQueue(queueName, buffer, buildDriverPublishOptions({
            persistent: true,
            ...options,
        }));
    }
}
