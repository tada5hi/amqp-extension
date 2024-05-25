/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Options } from 'amqplib';
import type { ConsumeOptions } from '../consume';
import type { Exchange } from '../exchange';
import type { PublishOptions } from '../publish';

export type Config = {
    reconnectAttempts: number,
    reconnectTimeout: number,
    connection: Options.Connect | string,
    exchange: Exchange,
    publish: PublishOptions,
    consume: ConsumeOptions
};

export type ConfigInput = Partial<Exclude<Config, 'connection'>> &
Pick<Config, 'connection'>;
