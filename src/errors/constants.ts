/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export enum ErrorCode {
    QUEUE_NAME_EMPTY = 'QUEUE_NAME_EMPTY',
    EXCHANGE_NAME_MISSING = 'EXCHANGE_NAME_MISSING',
    DESTINATION_MISSING = 'DESTINATION_MISSING',
    CLIENT_CLOSED = 'CLIENT_CLOSED',
    CHANNEL_CLOSED = 'CHANNEL_CLOSED',
    PUBLISH_TIMEOUT = 'PUBLISH_TIMEOUT',
    BROKER_REJECTED = 'BROKER_REJECTED',
    SERIALIZATION_FAILED = 'SERIALIZATION_FAILED',
}
