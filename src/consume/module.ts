/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Options, Replies } from 'amqplib';
import { Config, getConfig } from '../config';
import { createChannel } from '../utils';
import { ConsumeHandlers, ConsumeOptions } from './type';
import { ConsumeHandlerAnyKey } from './static';

/* istanbul ignore next */
export async function consumeQueue(
    options: ConsumeOptions,
    handlers: ConsumeHandlers,
) : Promise<void> {
    const config : Config = getConfig(options.alias);
    const { channel } = await createChannel(config);

    const queueName : string = options.queueName ?? '';

    const assertionQueue = await channel.assertQueue(queueName, {
        durable: false,
        autoDelete: true,
    });

    if (typeof options.routingKey !== 'undefined') {
        const routingKeys: string[] = Array.isArray(options.routingKey) ? options.routingKey : [options.routingKey];

        const promises: Promise<Replies.Empty>[] = routingKeys
            .map((routKey) => channel.bindQueue(assertionQueue.queue, config.exchange.name, routKey) as unknown as Promise<Replies.Empty>);

        await Promise.all(promises);
    }

    const consumeOptions : Options.Consume = {
        ...(config.consume?.options ?? {}),
        ...(options.options ?? {}),
    };

    await channel.prefetch(1);

    await channel.consume(assertionQueue.queue, ((async (message) => {
        if (!message) {
            return;
        }

        const { type, contentType, messageId } = message.properties;
        const handler = handlers[type] ?? handlers[ConsumeHandlerAnyKey];

        let { content } = message;
        if (contentType) {
            switch (contentType.toLowerCase()) {
                case 'application/json':
                    content = JSON.parse(message.content.toString('utf-8'));
            }
        }

        const requeueOnFailure : boolean = config.consume?.requeueOnFailure ?? false;

        if (typeof handler === 'undefined') {
            channel.reject(message, requeueOnFailure);
            return;
        }

        try {
            await handler({
                id: messageId,
                type,
                data: content,
                metadata: {
                    ...message.properties,
                    ...message.fields,
                },
            }, channel);

            channel.ack(message);
        } catch (e) {
            channel.reject(message, requeueOnFailure);
        }
    })), consumeOptions);
}
