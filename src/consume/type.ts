import {ConsumeMessage} from "amqplib";
import {Message, MessageContext} from "../message";

export type ConsumeQueueCallback = (message: ConsumeMessage, context: MessageContext) => void;

export type ConsumeMessageHandler = (message: Message, context: MessageContext) => Promise<void>;
export type ConsumeMessageHandlers = Record<'$any' | string, ConsumeMessageHandler>;
