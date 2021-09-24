import {Channel, Connection, ConsumeMessage, MessageFields, MessageProperties} from "amqplib";
import {Message} from "../message";

export type ConsumeMessageContext = {
    channel: Channel,
    connection: Connection,
    messageFields?: MessageFields,
    messageProperties?: MessageProperties
};
export type ConsumeQueueCallback = (message: ConsumeMessage, context: ConsumeMessageContext) => void;

export type ConsumeMessageHandler = (message: Message, context: ConsumeMessageContext) => Promise<void>;
export type ConsumeMessageHandlers = Record<'$any' | string, ConsumeMessageHandler>;
