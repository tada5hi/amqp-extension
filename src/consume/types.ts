/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    Channel,
    ConsumeMessage,
    Options,
} from 'amqplib';
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

export type ConsumeRetryOptions = {
    /**
     * Delivery attempts before a failing message is dropped (acked, onError gets ATTEMPTS_EXHAUSTED).
     *
     * Default: 5
     */
    maxAttempts?: number,

    /**
     * Base of the exponential backoff in ms, capped at 30s.
     *
     * Default: 1000
     */
    delay?: number,
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
    queue?: string,

    /**
     * Retry a message whose handler threw: re-publish it to the queue it came from with
     * the next attempt in its x-attempt header (after a backoff), then ack the original.
     * Also guards against redeliveries of messages with a messageId: a copy of a message
     * still being handled in this consumer is not run again, and a redelivery of one that
     * is not (the consumer died mid-handling) counts as a failed attempt.
     * Ignored with noAck. A missing handler is not retried.
     *
     * Default: undefined (no retry)
     */
    retry?: ConsumeRetryOptions,

    /**
     * With retry: hold a redelivered copy of a message still being handled until the
     * original settles, instead of acking it right away. Acking it would free the
     * prefetch slot and let the next message of an ordered stream run next to the original.
     *
     * Default: false
     */
    ordered?: boolean,

    /**
     * Called after a message was nacked, retried (or not settled, with noAck) because its handler threw
     * (with that error) or no handler matched (with a ClientError, code HANDLER_MISSING), and after
     * a message was dropped because its retry attempts were exhausted (with a ClientError, code
     * ATTEMPTS_EXHAUSTED, the last handler error as cause).
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

/**
 * What handleMessage needs from the consumer to retry a message.
 *
 * @internal
 */
export type HandleMessageContext = {
    /**
     * Runs of messages still being handled by this consumer, by messageId.
     */
    inFlight: Map<string, Promise<void>>,

    /**
     * Re-publish content to the queue the message came from, resolving once the broker confirmed it.
     */
    republish: (content: Buffer, options: Options.Publish) => Promise<void>,
};
