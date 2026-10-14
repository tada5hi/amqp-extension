/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Options } from 'amqplib';

export type PublishOptions = Options.Publish & {
    /**
     * Options for asserting the named queue of the default exchange.
     * Must match the consumer's queueOptions.
     *
     * Default: { durable: true }
     */
    queueOptions?: Options.AssertQueue
};
export type PublishContext = {
    to: string,
    data: any,
    options?: PublishOptions,
};
