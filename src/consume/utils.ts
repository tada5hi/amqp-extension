import { Options, Replies } from 'amqplib';
import { Config, getConfig } from '../config';
import { Message, MessageContext } from '../message';
import { createChannel } from '../utils';
import { ConsumeHandlers, ConsumeOptions } from './type';
import { ConsumeHandlerAnyKey } from './static';

/* istanbul ignore next */
export async function consumeQueue(
    options: ConsumeOptions,
    handlers: ConsumeHandlers,
) : Promise<void> {
    const config : Config = getConfig(options.alias);
    const { channel, connection } = await createChannel(config);

    const queueName : string = options.name ?? '';

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

    await channel.consume(assertionQueue.queue, ((async (message) => {
        if (!message) {
            return;
        }

        const content : Message = JSON.parse(message.content.toString('utf-8'));
        const handler = handlers[content.type] ?? handlers[ConsumeHandlerAnyKey];

        const context : MessageContext = {
            channel,
            connection,
            messageFields: message.fields,
            messageProperties: message.properties,
        };

        const requeueOnFailure : boolean = config.consume?.requeueOnFailure ?? false;

        if (typeof handler === 'undefined') {
            channel.reject(message, requeueOnFailure);
            return;
        }

        try {
            await handler(content, context);
            channel.ack(message);
        } catch (e) {
            channel.reject(message, requeueOnFailure);
        }
    })), consumeOptions);
}
