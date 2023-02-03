/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Config, ConfigInput } from './type';
import { extendConfig, getConfigKey } from './utils';

const instances : Record<string, Config> = {};

export function setConfig(key: string | ConfigInput, value?: ConfigInput) : Config {
    if (typeof key === 'string') {
        if (typeof value === 'undefined') {
            throw new Error(`A config must be defined for the alias: ${key}`);
        }

        value.alias = key;

        instances[key] = extendConfig(value);

        return instances[key];
    }

    key.alias = getConfigKey(key.alias);

    instances[key.alias] = extendConfig(key);

    return instances[key.alias];
}

export function hasConfig(key?: string) {
    key = getConfigKey(key);

    return Object.prototype.hasOwnProperty.call(instances, key);
}

export function getConfig(key?: string | ConfigInput) : Config {
    if (typeof key === 'string' || typeof key === 'undefined') {
        key = getConfigKey(key);
        const data = instances[key];

        if (typeof data === 'undefined') {
            throw new Error(`A config must be defined for the alias: ${key}`);
        }

        return data;
    }

    const config : Config = extendConfig(key);

    setConfig(config);

    return config;
}
