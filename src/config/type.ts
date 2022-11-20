/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Options } from 'amqplib';
import { ConsumeOptions } from '../consume';
import { PublishOptions } from '../publish';

export type ExchangeType = 'fanout' | 'direct' | 'topic' | 'match' | string;

export type Config = {
    alias?: string,
    connection: Options.Connect | string,
    exchange: {
        name: string,
        type: ExchangeType,
        options?: Options.AssertExchange
    },
    publish?: PublishOptions,
    consume?: ConsumeOptions
};
