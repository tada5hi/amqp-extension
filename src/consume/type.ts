/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Channel, ConsumeMessage, Options } from 'amqplib';
import type { ConsumeHandlerAnyKey } from './constants';

export {
    ConsumeMessage,
};

export type ConsumeMessageHandler = (message: ConsumeMessage, channel: Channel) => Promise<void> | void;

export type ConsumeHandlers = {
    [ConsumeHandlerAnyKey]?: ConsumeMessageHandler,
} & {
    [key:string] : ConsumeMessageHandler
};

export type ConsumeOptions = Options.Consume & {
    /**
     * Default: false
     */
    requeueOnFailure?: boolean;

    /**
     * Default: undefined
     */
    prefetchCount?: number,

    /**
     * Options for asserting the named queue of the default exchange,
     * e.g. { arguments: { 'x-single-active-consumer': true } }.
     * Publisher and consumer must pass the same options.
     *
     * Default: { durable: true }
     */
    queueOptions?: Options.AssertQueue
};

export type ConsumeContext = {
    from: string,
    options?: ConsumeOptions,
    handlers: ConsumeHandlers
};
