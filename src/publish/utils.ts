/* istanbul ignore next */
import {Options} from "amqplib";
import {Config, getConfig} from "../config";
import {Message} from "../message";
import {createChannel} from "../utils";
import {PublishOptions} from "./type";

export async function publishMessage(
    message: Message,
    options?: PublishOptions
) {
    let {options: MessageOptions, ...messagePayload} = message;

    const buffer: Buffer = Buffer.from(JSON.stringify(messagePayload));

    options ??= {};
    const config: Config = getConfig(options.alias);
    const {channel} = await createChannel(config);

    const publishOptions: Options.Publish = {
        ...(config.publish?.options ?? {}),
        ...(MessageOptions.publish ?? {})
    }

    channel.publish(config.exchange.name, MessageOptions.routingKey, buffer, publishOptions);
}
