/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * Options of the named, durable queue asserted for the default exchange.
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
