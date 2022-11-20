/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Config } from './type';
import { getConfigKey } from './utils';

const instances : Record<string, Config> = {};

export function setConfig(key: string | Config, value?: Config) : Config {
    if (typeof key === 'string') {
        if (typeof value === 'undefined') {
            throw new Error(`A config must be defined for the alias: ${key}`);
        }

        value.alias = key;

        instances[key] = value;

        return value;
    }

    key.alias = getConfigKey(key.alias);

    instances[key.alias] = key;

    return key;
}

export function hasConfig(key?: string) {
    key = getConfigKey(key);

    return Object.prototype.hasOwnProperty.call(instances, key);
}

export function getConfig(key?: string | Config) : Config {
    if (typeof key === 'string' || typeof key === 'undefined') {
        key = getConfigKey(key);
        const data = instances[key];
        if (typeof data === 'undefined') {
            throw new Error(`A config must be defined for the alias: ${key}`);
        }

        return data;
    }

    const config : Config = key;
    config.alias = getConfigKey(config.alias);

    setConfig(config);

    return config;
}
