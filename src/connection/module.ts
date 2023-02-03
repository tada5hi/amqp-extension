/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import RabbitMQ, { Connection, Options } from 'amqplib';
import { ConfigInput, getConfig, getConfigKey } from '../config';

const instances: Record<string, Connection> = {};

export async function clearConnections() : Promise<void> {
    const keys = Object.keys(instances);
    for (let i = 0; i < keys.length; i++) {
        await instances[keys[i]].close();

        delete instances[keys[i]];
    }
}

export function hasConnection(key?: string) : boolean {
    key = getConfigKey(key);

    return Object.prototype.hasOwnProperty.call(instances, key);
}

export function getConnections() : Record<string, Connection> {
    return instances;
}

/* istanbul ignore next */
export async function useConnection(
    key: string | ConfigInput,
) : Promise<Connection> {
    const config = getConfig(key);

    if (Object.prototype.hasOwnProperty.call(instances, config.alias)) {
        return instances[config.alias];
    }

    const connection = await createConnection(config.connection);

    instances[config.alias] = connection;

    return connection;
}

/* istanbul ignore next */
export async function createConnection(config: Options.Connect | string) {
    return RabbitMQ.connect(config);
}
