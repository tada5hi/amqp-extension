/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Options } from 'amqplib';
import type { Exchange, ExchangeOptions } from '../exchange';

/**
 * Options of the named, durable queue asserted for the default exchange,
 * accepted flat on both ConsumeOptions and PublishOptions.
 * Publisher and consumer must pass the same options: a broker rejects
 * re-declaring a queue with different arguments.
 */
export type QueueOptions = {
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
