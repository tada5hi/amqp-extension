import {Config, getConfig} from "../config";
import {Message} from "../message";
import {createChannel} from "../utils";

/* istanbul ignore next */
export async function publishMessage(
    data: Message,
    key?: string | Config
) {
    const { options, ...payload } = data;

    const buffer : Buffer = Buffer.from(JSON.stringify(payload));

    const config : Config = getConfig(key);
    const {channel} = await createChannel(config);

    channel.publish(config.exchange.name, options.routingKey, buffer, options.publish ?? {});
}
