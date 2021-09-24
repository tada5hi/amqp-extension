import {v4} from "uuid";
import {BuildMessageContext, Message} from "./type";

export function buildMessage(
    context: BuildMessageContext
) : Message {
    return {
        id: context.id ?? v4(),
        type: context.type,
        options: context.options ?? {},
        data: context.data ?? {},
        metadata: context.metadata ?? {}
    };
}
