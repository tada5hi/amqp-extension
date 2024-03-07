/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import process from 'node:process';
import type { Channel, Connection, ConsumeMessage } from 'amqplib';
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
import { wait } from './utils';

type Consumer = {
    options: ConsumeOptions,
    handlers: ConsumeHandlers,
};

export class Client {
    protected connection: Connection | undefined;

    protected config : Config;

    protected reconnectAttempts: number;

    protected consumers : Consumer[];

    constructor(options: ConfigInput) {
        this.config = buildConfig(options);
        this.reconnectAttempts = 0;
        this.consumers = [];

        process.once('SIGINT', async () => {
            if (this.connection) {
                await this.connection.close();
            }
        });
    }

    protected async createConnection() : Promise<Connection> {
        let connection : Connection;

        try {
            connection = await connect(this.config.connection);
            this.reconnectAttempts = 0;
        } catch (e) {
            if (this.reconnectAttempts < this.config.reconnectAttempts) {
                this.reconnectAttempts++;

                await wait(this.config.reconnectTimeout);

                return this.createConnection();
            }

            throw e;
        }

        return connection;
    }

    async useConnection() : Promise<Connection> {
        if (typeof this.connection !== 'undefined') {
            return this.connection;
        }

        const connection = await this.createConnection();
        const handleDisconnect = async (err?: Error | null) => {
            if (!err) return;

            this.connection = await this.createConnection();

            await this.recreateConsumers();
        };

        connection.once('close', handleDisconnect);
        connection.once('error', handleDisconnect);

        this.connection = connection;

        return this.connection;
    }

    protected async recreateConsumers() {
        for (let i = 0; i < this.consumers.length; i++) {
            await this.createConsumer(this.consumers[i].options, this.consumers[i].handlers);
        }
    }

    protected async createConsumer(
        options: ConsumeOptions,
        handlers: ConsumeHandlers,
    ) : Promise<Channel> {
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

        return channel;
    }

    async consume(
        options: ConsumeOptions,
        handlers: ConsumeHandlers,
    ) : Promise<void> {
        await this.createConsumer(options, handlers);

        this.consumers.push({
            options,
            handlers,
        });
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

            return channel.publish(
                this.config.exchange.name,
                exchangeOptions.routingKey,
                buffer,
                buildDriverPublishOptions({
                    persistent: true,
                    ...options,
                }),
            );
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

        return channel.sendToQueue(queueName, buffer, buildDriverPublishOptions({
            persistent: true,
            ...options,
        }));
    }
}
