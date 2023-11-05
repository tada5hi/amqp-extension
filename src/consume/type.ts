/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    Channel, ConsumeMessage,
} from 'amqplib';
import type { ConsumeHandlerAnyKey } from './static';

export {
    ConsumeMessage,
};

export type ConsumeMessageHandler = (message: ConsumeMessage, channel: Channel) => Promise<void>;
export type ConsumeHandlerAnyKeyType = typeof ConsumeHandlerAnyKey;

export type ConsumeHandlers = Record<ConsumeHandlerAnyKeyType | string, ConsumeMessageHandler>;
