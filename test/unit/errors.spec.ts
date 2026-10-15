/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { BaseError } from '@ebec/core';
import {
    describe,
    expect,
    it,
} from 'vitest';
import {
    AmqpExtensionError,
    BrokerError,
    ClientError,
    ErrorCode,
    SerializationError,
    TopologyError,
} from '../../src';
import { toError } from '../../src/errors/utils';

describe('src/errors', () => {
    it('should build errors with code, message and class name', () => {
        const error = TopologyError.queueNameEmpty();

        expect(error).toBeInstanceOf(TopologyError);
        expect(error).toBeInstanceOf(AmqpExtensionError);
        expect(error).toBeInstanceOf(BaseError);
        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('TopologyError');
        expect(error.code).toBe(ErrorCode.QUEUE_NAME_EMPTY);
        expect(error.message).toBe('The queue name can not be empty if the default exchange is selected.');
        expect(error.toJSON()).toMatchObject({ name: 'TopologyError', code: 'QUEUE_NAME_EMPTY' });
    });

    it('should keep the existing messages', () => {
        expect(TopologyError.exchangeNameMissing()).toMatchObject({ code: 'EXCHANGE_NAME_MISSING', message: 'A non default exchange requires a name.' });
        expect(TopologyError.destinationMissing()).toMatchObject({ code: 'DESTINATION_MISSING', message: 'The publish operation requires a destination.' });
        expect(ClientError.closed()).toMatchObject({ code: 'CLIENT_CLOSED', message: 'The client is closed.' });
        expect(ClientError.channelClosed()).toMatchObject({ code: 'CHANNEL_CLOSED', message: 'Channel closed' });
        expect(ClientError.timeout()).toMatchObject({ code: 'PUBLISH_TIMEOUT', message: 'The publish operation timed out.' });
        expect(SerializationError.payload()).toMatchObject({ code: 'SERIALIZATION_FAILED', message: 'The message payload could not be serialized.' });
    });

    it('should lift the AMQP reply fields onto a BrokerError', () => {
        const cause = Object.assign(new Error('Operation failed: QueueDeclare; 406 (PRECONDITION-FAILED)'), {
            code: 406,
            classId: 50,
            methodId: 10,
        });
        const error = BrokerError.fromAmqp(cause);

        expect(error).toMatchObject({
            code: 'BROKER_REJECTED',
            message: cause.message,
            replyCode: 406,
            classId: 50,
            methodId: 10,
        });
        expect(error.cause).toBe(cause);
        expect(error.toJSON()).toMatchObject({
            code: 'BROKER_REJECTED',
            replyCode: 406,
            classId: 50,
            methodId: 10,
        });
    });

    describe('toError', () => {
        it('should pass a library error through unchanged', () => {
            const error = ClientError.closed();
            expect(toError(error)).toBe(error);
        });

        it('should wrap an error with a numeric reply code as BrokerError', () => {
            const cause = Object.assign(new Error('403 (ACCESS-REFUSED)'), { code: 403 });
            expect(toError(cause)).toMatchObject({
                constructor: BrokerError,
                replyCode: 403,
                cause,
            });
        });

        it('should map the connection manager timeout and close errors', () => {
            const timeout = new Error('timeout');
            const closed = new Error('Channel closed');

            expect(toError(timeout)).toMatchObject({
                constructor: ClientError,
                code: 'PUBLISH_TIMEOUT',
                cause: timeout,
            });
            expect(toError(closed)).toMatchObject({
                constructor: ClientError,
                code: 'CHANNEL_CLOSED',
                cause: closed,
            });
        });

        it('should wrap anything else in the base class', () => {
            const system = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });

            expect(toError(system)).toMatchObject({
                constructor: AmqpExtensionError,
                message: 'connect ECONNREFUSED',
                cause: system,
            });
            expect(toError('x')).toMatchObject({
                constructor: AmqpExtensionError,
                message: 'x',
                cause: 'x',
            });
        });
    });
});
