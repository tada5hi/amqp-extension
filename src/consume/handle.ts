import {ConsumeMessage} from "amqplib";
import {Message} from "../message";
import {ConsumeMessageHandlers, ConsumeMessageContext} from "./type";

/* istanbul ignore next */
export async function handleConsumeMessage(
    message: ConsumeMessage,
    context: ConsumeMessageContext,
    handlers: ConsumeMessageHandlers = {}
) {
    const content : Message = JSON.parse(message.content.toString('utf-8'));
    const handler = handlers[content.type] ?? handlers.$any;

    context.messageFields = message.fields;
    context.messageProperties = message.properties;

    return handler ? await handler(content, context) : Promise.resolve(true);
}
