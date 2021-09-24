import {Options, Replies} from "amqplib";
import {Config, getConfig} from "../config";
import {MessageContext, Message} from "../message";
import {createChannel} from "../utils";
import {ConsumeMessageHandlers, ConsumeQueueOptions} from "./type";
import Empty = Replies.Empty;

/* istanbul ignore next */
export async function consumeQueue(
    options: ConsumeQueueOptions,
    handlers: ConsumeMessageHandlers
) : Promise<void> {
    const config : Config = getConfig(options.key);
    const {channel, connection} = await createChannel(config);

    const queueName : string = options.name ?? '';
    const queueOptions : Options.AssertQueue = {
        durable: false,
        autoDelete: true,
        ...(options.options ?? {})
    }

    const assertionQueue = await channel.assertQueue(queueName, queueOptions);

    if(typeof options.routingKey !== 'undefined') {
        const routingKeys: string[] = Array.isArray(options.routingKey) ? options.routingKey : [options.routingKey];

        const promises: Promise<Replies.Empty>[] = routingKeys.map(routKey => {
            return channel.bindQueue(assertionQueue.queue, config.exchange.name, routKey) as unknown as Promise<Empty>;
        });

        await Promise.all(promises);
    }

    await channel.consume(assertionQueue.queue, ((async (message) => {
        if(!message) {
            return;
        }

        const content : Message = JSON.parse(message.content.toString('utf-8'));
        const handler = handlers[content.type] ?? handlers.$any;

        const context : MessageContext = {
            channel: channel,
            connection: connection,
            messageFields: message.fields,
            messageProperties: message.properties
        }

        if(typeof handler === 'undefined') {
            channel.ack(message);
        }

        try {
            await handler(content, context);
            await channel.ack(message);
        } catch (e) {
            const requeueOnFailure : boolean = config.consume?.requeueOnFailure ?? false;
            await channel.reject(message, requeueOnFailure);
        }
    })));
}
