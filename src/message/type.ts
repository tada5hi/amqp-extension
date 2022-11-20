/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Channel, Connection, MessageFields, MessageProperties, Options,
} from 'amqplib';

export interface MessageOptions {
    /**
     * Routing key for message broker.
     */
    routingKey?: string;
    /**
     * Override default publish options.
     */
    publish?: Options.Publish;
}

export type Message = {
    /**
     * Routing information for amqp library.
     * This property will be removed, before it is passed to the message queue.
     */
    options?: MessageOptions;

    /**
     *
     * Default: <generated uuid>
     */
    id: string;

    /**
     * Event- or Command-name.
     */
    type: string;

    /**
     * Metadata object to provide details for the message broker.
     *
     * Default: {}
     */
    metadata: Record<string, any>;

    /**
     * The message data.
     *
     * Default: {}
     */
    data: Record<string, any>;
};

export type BuildMessageContext =
    Pick<Message, 'type'> &
    Partial<Pick<Message, 'id' | 'options' | 'data' | 'metadata'>>;

export type MessageContext = {
    channel: Channel,
    connection: Connection,
    messageFields?: MessageFields,
    messageProperties?: MessageProperties
};
