/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Channel, Connection, Options } from 'amqplib';
import { Config, getConfig } from './config';
import { useConnection } from './connection';

/* istanbul ignore next */
export async function createChannel(key: string | Config) : Promise<{
    channel: Channel,
    connection: Connection
}> {
    const config : Config = getConfig(key);

    const connection : Connection = await useConnection(config.alias);
    const channel : Channel = await connection.createChannel();

    const exchangeOptions : Options.AssertExchange = {
        durable: true,
        ...(config.exchange?.options ?? {}),
    };

    await channel.assertExchange(config.exchange.name, config.exchange.type, exchangeOptions);

    return {
        channel,
        connection,
    };
}
