/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Options } from 'amqplib';
import type { Exchange, ExchangeOptions } from '../exchange';

/**
 * Options of a named, durable queue, accepted flat on both ConsumeOptions and PublishOptions.
 * They map to queue arguments (x-*) and are not validated client-side:
 * the broker rejects an invalid combination with a BrokerError.
 * Publisher and consumer must pass the same options: a broker rejects
 * re-declaring a queue with different arguments.
 */
export type QueueOptions = {
    /**
     * Queue type (x-queue-type).
     *
     * Default: the broker's default (classic)
     */
    queueType?: 'classic' | 'quorum',

    /**
     * Drop or dead-letter a message after this many failed deliveries
     * (x-delivery-limit). Quorum queues only. Counts requeued deliveries, so it needs
     * requeueOnFailure: true (or a redelivery after a disconnect).
     */
    deliveryLimit?: number,

    /**
     * Exchange that rejected or expired messages are republished to (x-dead-letter-exchange).
     */
    deadLetterExchange?: string,

    /**
     * Routing key for dead-lettered messages, instead of their original one
     * (x-dead-letter-routing-key).
     */
    deadLetterRoutingKey?: string,

    /**
     * Expire messages after this many milliseconds in the queue (x-message-ttl).
     */
    messageTtl?: number,

    /**
     * Maximum number of ready messages; the oldest are dropped or dead-lettered
     * beyond it (x-max-length).
     */
    maxLength?: number,

    /**
     * Deliver to one consumer at a time, in publish order, failing over to
     * another consumer when it goes away (x-single-active-consumer).
     *
     * Default: false
     */
    singleActiveConsumer?: boolean,
};

/**
 * What must exist on the broker before publishing or consuming.
 *
 * @internal
 */
export type Topology = {
    exchange?: {
        name: string,
        type: Exchange['type'],
        options?: ExchangeOptions
    },
    // name '' = server-named queue
    queue?: { name: string, options: Options.AssertQueue },
    // routing key binding the queue to the exchange
    bind?: string,
};
