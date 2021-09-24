import {Options} from "amqplib";
import {Config, getConfig} from "../config";
import {Message} from "../message";
import {createChannel} from "../utils";

/* istanbul ignore next */
export async function publishMessage(
    message: Message,
    key?: string | Config
) {
    let { options, ...payload } = message;

    const buffer : Buffer = Buffer.from(JSON.stringify(payload));

    const config : Config = getConfig(key);
    const {channel} = await createChannel(config);

    const publishOptions : Options.Publish = {
        ...(config.publish?.options ?? {}),
        ...(options.publish ?? {})
    }

    channel.publish(config.exchange.name, options.routingKey, buffer, publishOptions);
}
