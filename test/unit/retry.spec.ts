/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ConsumeMessage, Options } from 'amqplib';
import { describe, expect, it } from 'vitest';
import { 
    ATTEMPT_HEADER, 
    resolveAttempt, 
    resolveRetryDelay, 
    retryMessage, 
} from '../../src/consume/retry';

describe('src/consume/retry', () => {
    it('treats a message without x-attempt as attempt 1', () => {
        expect(resolveAttempt({ headers: {} })).toBe(1);
        expect(resolveAttempt({ headers: undefined })).toBe(1);
    });

    it('ignores a non-integer x-attempt (old publishers, junk)', () => {
        expect(resolveAttempt({ headers: { 'x-attempt': 'x' } })).toBe(1);
        expect(resolveAttempt({ headers: { 'x-attempt': '3' } })).toBe(1);
        expect(resolveAttempt({ headers: { 'x-attempt': 0 } })).toBe(1);
        expect(resolveAttempt({ headers: { 'x-attempt': -2 } })).toBe(1);
        expect(resolveAttempt({ headers: { 'x-attempt': 2.5 } })).toBe(1);
        expect(resolveAttempt({ headers: { 'x-attempt': NaN } })).toBe(1);
    });

    it('reads x-attempt', () => {
        expect(resolveAttempt({ headers: { 'x-attempt': 3 } })).toBe(3);
    });

    it('backs off exponentially, capped at 30s', () => {
        expect(resolveRetryDelay(2, 1000)).toBe(1000);
        expect(resolveRetryDelay(3, 1000)).toBe(2000);
        expect(resolveRetryDelay(20, 1000)).toBe(30_000);
    });

    describe('retryMessage', () => {
        const createMessage = (properties: Partial<ConsumeMessage['properties']>) => ({
            content: Buffer.from('{"metadata":{"attempt":4}}'),
            fields: { redelivered: false },
            properties: { headers: {}, ...properties },
        }) as ConsumeMessage;

        const createPublisher = () => {
            const published: { content: Buffer, options: Options.Publish }[] = [];
            return {
                published,
                publish: async (content: Buffer, options: Options.Publish) => { published.push({ content, options }); },
            };
        };

        it('re-publishes the content with the next attempt, keeping the properties', async () => {
            const { published, publish } = createPublisher();
            const message = createMessage({
                type: 'run',
                messageId: 'm1',
                deliveryMode: 2,
                headers: { foo: 'bar', [ATTEMPT_HEADER]: 2 },
            });

            await expect(retryMessage(message, publish, { delay: 0 })).resolves.toBe(true);

            expect(published).toHaveLength(1);
            expect(published[0]!.content).toBe(message.content);
            expect(published[0]!.options).toMatchObject({
                type: 'run',
                messageId: 'm1',
                deliveryMode: 2,
                headers: { foo: 'bar', [ATTEMPT_HEADER]: 3 },
            });
        });

        it('counts a body attempt counter of an old publisher as nothing (attempt 1)', async () => {
            const { published, publish } = createPublisher();

            await retryMessage(createMessage({}), publish, { delay: 0 });

            expect(published[0]!.options.headers).toEqual({ [ATTEMPT_HEADER]: 2 });
        });

        it('drops the user-id, which the broker checks against the re-publishing connection', async () => {
            const { published, publish } = createPublisher();

            await retryMessage(createMessage({ userId: 'someone-else' }), publish, { delay: 0 });

            expect(published[0]!.options).not.toHaveProperty('userId');
        });

        it('returns false without re-publishing once the attempts are exhausted', async () => {
            const { published, publish } = createPublisher();

            await expect(retryMessage(createMessage({ headers: { [ATTEMPT_HEADER]: 5 } }), publish, {})).resolves.toBe(false);
            await expect(retryMessage(createMessage({ headers: { [ATTEMPT_HEADER]: 2 } }), publish, { maxAttempts: 2 })).resolves.toBe(false);
            expect(published).toEqual([]);
        });

        it('waits for the backoff before re-publishing', async () => {
            const { published, publish } = createPublisher();

            const retried = retryMessage(createMessage({}), publish, { delay: 20 });
            await new Promise((resolve) => { setTimeout(resolve, 5); });
            expect(published).toEqual([]);

            await retried;
            expect(published).toHaveLength(1);
        });
    });
});
