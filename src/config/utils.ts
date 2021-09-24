import {Config} from "./type";

export const DEFAULT_KEY : string = 'default';

const configMap: Map<string, Config> = new Map<string, Config>();

export function setConfig(key: string | Config, value?: Config) : Config {
    if(typeof key === 'string') {
        if(typeof value === 'undefined') {
            throw new Error(`A config must be defined for the alias: ${key}`);
        }

        value.alias = key;

        configMap.set(key, value);

        return value;
    } else {
        key.alias ??= DEFAULT_KEY;
        configMap.set(key.alias, key);

        return key;
    }
}

export function getConfig(key?: string | Config) : Config {
    key ??= DEFAULT_KEY;

    if(typeof key === 'string') {
        const data : Config | undefined = configMap.get(key);
        if(typeof data === 'undefined') {
            throw new Error(`A config must be defined for the alias: ${key}`);
        }

        return data;
    }

    const config : Config = key;
    config.alias ??= DEFAULT_KEY;

    setConfig(config);

    return config;
}
