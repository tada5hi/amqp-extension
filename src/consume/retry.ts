/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ConsumeMessage } from 'amqplib';
import type { RepublishOptions } from '../publish';
import type { ConsumeRetryOptions } from './types';

/**
 * The 1-based delivery attempt of a re-published message.
 */
export const ATTEMPT_HEADER = 'x-attempt';

/**
 * The attempt a message is on. A missing or invalid header (a first delivery, an
 * older publisher counting elsewhere) is attempt 1: at worst a message is retried
 * more often, never dropped early.
 */
export function resolveAttempt(properties: { headers?: Record<string, unknown> }) : number {
    const value = properties.headers?.[ATTEMPT_HEADER];

    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 ? value : 1;
}

/**
 * Delay before the given attempt: base, doubled per attempt, capped at 30s.
 */
export function resolveRetryDelay(attempt: number, base: number) : number {
    return Math.min(base * 2 ** (attempt - 2), 30_000);
}

/**
 * Re-publish a message with the next attempt in its x-attempt header, after the backoff.
 * Resolves false (without re-publishing) once the attempts are exhausted.
 * Rejects when the re-publish fails.
 *
 * ponytail: the backoff holds the prefetch slot, fine for seconds;
 * move to TTL + dead-letter-exchange delay queues for longer delays.
 */
export async function retryMessage(
    message: ConsumeMessage,
    publish: (content: Buffer, options: RepublishOptions) => Promise<void>,
    options: ConsumeRetryOptions,
) : Promise<boolean> {
    const attempt = resolveAttempt(message.properties) + 1;
    if (attempt > (options.maxAttempts ?? 5)) {
        return false;
    }

    await new Promise((resolve) => {
        setTimeout(resolve, resolveRetryDelay(attempt, options.delay ?? 1000));
    });

    const properties : RepublishOptions = {
        ...message.properties,
        headers: { ...message.properties.headers, [ATTEMPT_HEADER]: attempt },
    };
    // the broker rejects a user-id that is not the re-publishing connection's user
    delete properties.userId;

    await publish(message.content, properties);

    return true;
}
