/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { matchesInstanceof } from '@ebec/core';
import type { AmqpExtensionError } from './base';
import type { BrokerError } from './broker';
import type { ClientError } from './client';
import {
    AMQP_EXTENSION_ERROR_MARKER,
    BROKER_ERROR_MARKER,
    CLIENT_ERROR_MARKER,
    SERIALIZATION_ERROR_MARKER,
    TOPOLOGY_ERROR_MARKER,
} from './constants';
import type { SerializationError } from './serialization';
import type { TopologyError } from './topology';

// Unlike instanceof, the guards also match an error that crossed a boundary as JSON
// (toJSON() keeps the marker chain as strings). ponytail: such a plain object has the
// fields but not the methods of the class it is narrowed to.

export function isAmqpExtensionError(input: unknown) : input is AmqpExtensionError {
    return matchesInstanceof(input, AMQP_EXTENSION_ERROR_MARKER);
}

export function isTopologyError(input: unknown) : input is TopologyError {
    return matchesInstanceof(input, TOPOLOGY_ERROR_MARKER);
}

export function isClientError(input: unknown) : input is ClientError {
    return matchesInstanceof(input, CLIENT_ERROR_MARKER);
}

export function isBrokerError(input: unknown) : input is BrokerError {
    return matchesInstanceof(input, BROKER_ERROR_MARKER);
}

export function isSerializationError(input: unknown) : input is SerializationError {
    return matchesInstanceof(input, SERIALIZATION_ERROR_MARKER);
}
