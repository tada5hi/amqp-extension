import {Channel, Connection, MessageFields, MessageProperties, Options} from "amqplib";

export interface MessageOptions {
    routingKey?: string;
    publish?: Options.Publish;
}

export type Message = {
    /**
     * Routing information for amqp library.
     * This property will be deleted before it will be passed to the message queue.
     */
    options?: MessageOptions;

    /**
     *
     * Default: generated uuid
     */
    id: string;

    /**
     * event or command name.
     *
     */
    type: string;

    /**
     * Store metadata for routing
     *
     * Default: {}
     */
    metadata?: Record<string, any>;

    /**
     * Store actual data.
     *
     * Default: {}
     */
    data?: Record<string, any>;
};

export type MessageContext = {
    channel: Channel,
    connection: Connection,
    messageFields?: MessageFields,
    messageProperties?: MessageProperties
};

export type BuildMessageContext =
    Pick<Message, 'type'> &
    Partial<Pick<Message, 'id' | 'options' | 'data' | 'metadata'>>;
