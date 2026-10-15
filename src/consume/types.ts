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
     * Called after a message was nacked (or not settled, with noAck) because its handler threw
     * (with that error) or no handler matched (with a ClientError, code HANDLER_MISSING).
     * Its own errors are swallowed.
     */
    onError?: (error: unknown, message: ConsumeMessage) => Promise<void> | void,
};

/**
 * Resolved by consume(). `await using consumer = await client.consume(...)` cancels it when the scope ends.
 */
export type Consumer = {
    /**
     * Stop receiving messages, wait for the handlers still running (their messages are settled),
     * then close the channel. Never rejects; calling it again returns the same promise.
     */
    cancel(): Promise<void>,
    [Symbol.asyncDispose](): Promise<void>,
};

export type ConsumeContext = {
    from: string,
    options?: ConsumeOptions,
    handlers: ConsumeHandlers
};
