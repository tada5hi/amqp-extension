import {ConsumeMessage} from "amqplib";
import {Message, MessageContext} from "../message";
import {ConsumeMessageHandlers} from "./type";

/* istanbul ignore next */
export async function handleConsumeMessage(
    message: ConsumeMessage,
    context: MessageContext,
    handlers: ConsumeMessageHandlers = {}
) {
    const content : Message = JSON.parse(message.content.toString('utf-8'));
    const handler = handlers[content.type] ?? handlers.$any;

    context.messageFields = message.fields;
    context.messageProperties = message.properties;

    return handler ? await handler(content, context) : Promise.resolve(true);
}
