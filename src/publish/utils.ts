/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/* istanbul ignore next */
import { Options } from 'amqplib';
import { Config, getConfig } from '../config';
import { Message } from '../message';
import { createChannel } from '../utils';
import { PublishOptions } from './type';

/* istanbul ignore next */
export async function publishMessage(
    message: Message,
    options?: PublishOptions,
) {
    const { options: messageOptions, ...messagePayload } = message;

    const buffer: Buffer = Buffer.from(JSON.stringify(messagePayload));

    options ??= {};
    const config: Config = getConfig(options.alias);
    const { channel } = await createChannel(config);

    const publishOptions: Options.Publish = {
        ...(config.publish?.options ?? {}),
        ...(messageOptions.publish ?? {}),
        ...(options.options ?? {}),
    };

    channel.publish(config.exchange.name, messageOptions.routingKey, buffer, publishOptions);
}
