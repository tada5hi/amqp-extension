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
    HANDLER_MISSING = 'HANDLER_MISSING',
    ATTEMPTS_EXHAUSTED = 'ATTEMPTS_EXHAUSTED',
    BROKER_REJECTED = 'BROKER_REJECTED',
    SERIALIZATION_FAILED = 'SERIALIZATION_FAILED',
}

// Symbol.for markers, shared by every copy of the library (see check.ts)
export const AMQP_EXTENSION_ERROR_MARKER = Symbol.for('amqp-extension/AmqpExtensionError');
export const TOPOLOGY_ERROR_MARKER = Symbol.for('amqp-extension/TopologyError');
export const CLIENT_ERROR_MARKER = Symbol.for('amqp-extension/ClientError');
export const BROKER_ERROR_MARKER = Symbol.for('amqp-extension/BrokerError');
export const SERIALIZATION_ERROR_MARKER = Symbol.for('amqp-extension/SerializationError');
