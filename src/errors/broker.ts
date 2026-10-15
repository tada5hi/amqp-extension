/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ErrorInput } from '@ebec/core';
import { hasInstanceof, markInstanceof } from '@ebec/core';
import { AmqpExtensionError } from './base';
import { BROKER_ERROR_MARKER, ErrorCode } from './constants';
import type { AmqpReplyError, BrokerReply } from './types';

/**
 * The broker rejected an operation, e.g. 406 PRECONDITION_FAILED or 403 ACCESS_REFUSED.
 */
export class BrokerError extends AmqpExtensionError {
    static override [Symbol.hasInstance](input: unknown) : boolean {
        return hasInstanceof(input, BROKER_ERROR_MARKER);
    }

    readonly replyCode: number;

    readonly classId?: number;

    readonly methodId?: number;

    constructor(input: ErrorInput, reply: BrokerReply) {
        super(input);

        this.replyCode = reply.replyCode;
        this.classId = reply.classId;
        this.methodId = reply.methodId;

        markInstanceof(this, BROKER_ERROR_MARKER);
    }

    override toJSON() {
        return {
            ...super.toJSON(),
            replyCode: this.replyCode,
            classId: this.classId,
            methodId: this.methodId,
        };
    }

    static fromAmqp(err: AmqpReplyError) {
        return new BrokerError(
            {
                code: ErrorCode.BROKER_REJECTED,
                message: err.message,
                cause: err,
            },
            {
                replyCode: err.code,
                classId: err.classId,
                methodId: err.methodId,
            },
        );
    }
}
