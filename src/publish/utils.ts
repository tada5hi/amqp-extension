/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/* istanbul ignore next */
import { Options } from 'amqplib';
import { Config, getConfig } from '../config';
import { createChannel } from '../utils';
import { PublishMessage } from './type';

/* istanbul ignore next */
export async function publishMessage(message: PublishMessage) {
    let buffer = message.data;

    if (!Buffer.isBuffer(buffer)) {
        buffer = Buffer.from(buffer);
    }

    const config: Config = getConfig(message.alias);
    const { channel } = await createChannel(config);

    const publishOptions: Options.Publish = {
        ...(config.publish?.options ?? {}),
        ...(message.metadata ?? {}),
    };

    if (message.id) {
        publishOptions.messageId = message.id;
    }

    if (message.type) {
        publishOptions.type = message.type;
    }

    let { routingKey } = message;

    if (
        typeof routingKey === 'undefined' &&
        typeof config.consume !== 'undefined' &&
        typeof config.consume.routingKey !== 'undefined'
    ) {
        routingKey = Array.isArray(config.consume.routingKey) ?
            [...config.consume.routingKey].shift() :
            config.consume.routingKey;
    }

    if (typeof config.exchange !== 'undefined') {
        channel.publish(config.exchange.name, routingKey || '', buffer, publishOptions);
    }

    // publish to nameless exchange

    let queueName : string | undefined;

    if (
        typeof config.publish !== 'undefined' &&
        typeof config.publish.queueName !== 'undefined'
    ) {
        queueName = config.publish.queueName;
    }

    if (typeof message.queueName !== 'undefined') {
        queueName = message.queueName;
    }

    if (typeof queueName === 'undefined') {
        // todo: throw error
    }

    channel.sendToQueue(queueName, buffer, publishOptions);
}
