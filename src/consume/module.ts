/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ConsumeMessage } from 'amqplib';
import { merge } from 'smob';
import { getConfig } from '../config';
import { useConnection } from '../connection';
import { ExchangeOptions, buildDriverExchangeOptions, isDefaultExchange } from '../exchange';
import { ConsumeOptions } from '../type';
import { ConsumeHandlers } from './type';
import { ConsumeHandlerAnyKey } from './static';
import { buildDriverConsumeOptions } from './utils';

/* istanbul ignore next */
export async function consume(
    options: ConsumeOptions,
    handlers: ConsumeHandlers,
) : Promise<void> {
    const config = getConfig(options.alias);
    const connection = await useConnection(config.alias);
    const channel = await connection.createChannel();

    options = merge(options, config.consume);

    const exchangeOptions = merge(
        options.exchange || {},
        config.exchange,
    ) as ExchangeOptions;

    let queueName : string = options.queueName || config.publish.queueName || '';

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
            config.exchange.name,
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

        const requeueOnFailure : boolean = config.consume.requeueOnFailure ?? false;

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
