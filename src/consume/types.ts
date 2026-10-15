/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Channel, ConsumeMessage, Options } from 'amqplib';
import type { QueueOptions } from '../queue';
import type { ConsumeHandlerAnyKey } from './constants';

export type {
    ConsumeMessage,
};

export type ConsumeMessageHandler = (message: ConsumeMessage, channel: Channel) => Promise<void> | void;

export type ConsumeHandlers = {
    [ConsumeHandlerAnyKey]?: ConsumeMessageHandler,
} & {
    [key:string] : ConsumeMessageHandler
};

export type ConsumeOptions = Options.Consume & QueueOptions & {
    /**
     * Default: false
     */
    requeueOnFailure?: boolean;

    /**
     * Default: undefined
     */
    prefetchCount?: number,

    /**
     * Named exchanges only: consume through this durable, named queue instead of
     * an exclusive, temporary one. Once declared by a consume, it keeps messages while
     * no consumer runs, and consumers sharing it split the messages. An empty name
     * throws. Ignored on the default exchange.
     *
     * Default: undefined
     */
    queue?: string
};

export type ConsumeContext = {
    from: string,
    options?: ConsumeOptions,
    handlers: ConsumeHandlers
};
