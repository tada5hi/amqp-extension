/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type BrokerReply = {
    replyCode: number,
    classId?: number,
    methodId?: number,
};

/**
 * An amqplib error for a broker rejection (code = AMQP reply code).
 */
export type AmqpReplyError = Error & {
    code: number,
    classId?: number,
    methodId?: number,
};
