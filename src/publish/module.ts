/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/* istanbul ignore next */
import { merge } from 'smob';
import { v4 } from 'uuid';
import { getConfig } from '../config';
import { useConnection } from '../connection';
import { ExchangeOptions, buildDriverExchangeOptions, isDefaultExchange } from '../exchange';
import { PublishOptionsExtended } from './type';
import { buildDriverPublishOptions } from './utils';

/* istanbul ignore next */
export async function publish(options: PublishOptionsExtended) {
    let buffer : Buffer;

    if (Buffer.isBuffer(options.content)) {
        buffer = options.content;
    } else if (typeof options.content === 'string') {
        buffer = Buffer.from(options.content, 'utf-8');
    } else {
        buffer = Buffer.from(JSON.stringify(options.content), 'utf-8');
    }

    const config = getConfig(options.alias);
    const connection = await useConnection(config.alias);
    const channel = await connection.createChannel();

    options = merge(
        options,
        config.publish || {},
    );

    const exchangeOptions = merge(
        {},
        options.exchange || {},
        config.exchange,
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
            config.exchange.name,
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
        config.publish.queueName;

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
