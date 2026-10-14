/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Options } from 'amqplib';
import type { QueueOptions } from './type';

export function buildAssertQueueOptions(options: QueueOptions = {}): Options.AssertQueue {
    const output: Options.AssertQueue = { durable: true };

    if (options.singleActiveConsumer) {
        output.arguments = { 'x-single-active-consumer': true };
    }

    return output;
}
