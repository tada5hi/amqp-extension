/*
 * Copyright (c) 2022-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ExchangeType } from '../exchange';
import type { Config, ConfigInput } from './type';

export function buildConfig(input: ConfigInput) : Config {
    return {
        reconnectAttempts: 10,
        reconnectTimeout: 1000,
        connection: input.connection,
        publish: input.publish || {},
        consume: input.consume || {},
        exchange: input.exchange || {
            name: '',
            type: ExchangeType.DEFAULT,
        },
    };
}
