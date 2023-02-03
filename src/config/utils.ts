/*
 * Copyright (c) 2022-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ExchangeType } from '../exchange';
import { Config, ConfigInput } from './type';

export function getConfigKey(alias?: string) {
    return alias || 'default';
}

export function extendConfig(input: ConfigInput) : Config {
    return {
        alias: getConfigKey(input.alias),
        connection: input.connection,
        publish: input.publish || {},
        consume: input.consume || {},
        exchange: input.exchange || {
            name: '',
            type: ExchangeType.DEFAULT,
        },
    };
}
