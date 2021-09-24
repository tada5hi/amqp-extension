import {Replies} from "amqplib";
import {Config, getConfig} from "../config";
import {createChannel} from "../utils";
import {ConsumeQueueCallback} from "./type";
import Empty = Replies.Empty;

/* istanbul ignore next */
export async function consumeQueue(
    cb: ConsumeQueueCallback,
    key?: string | Config,
    routingKey: string | string[] = []
) {
    const config : Config = getConfig(key);
    const {channel, connection} = await createChannel(config);

    const assertionQueue = await channel.assertQueue('', {
        durable: false,
        autoDelete: true
    });

    const routingKeys : string[] = Array.isArray(routingKey) ? routingKey : [routingKey];

    const promises : Promise<Replies.Empty>[] = routingKeys.map(routKey => {
        return channel.bindQueue(assertionQueue.queue, config.exchange.name, routKey) as unknown as Promise<Empty>;
    });

    await Promise.all(promises);

    await channel.consume(assertionQueue.queue, (msg => cb(msg, {channel: channel, connection: connection})));
}
