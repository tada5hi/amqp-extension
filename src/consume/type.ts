import {Options} from "amqplib";
import {Config} from "../config";
import {MessageContext, Message} from "../message";

export type ConsumeMessageHandler = (message: Message, context: MessageContext) => Promise<void>;
export type ConsumeMessageHandlers = Record<'$any' | string, ConsumeMessageHandler>;

export type ConsumeQueueOptions = {
    /**
     * Queue routing key(s).
     */
    routingKey?: string | string[],

    key?: string | Config,
    /**
     * Queue name
     *
     * Default: ''
     */
    name?: string,
    /**
     * Queue options
     *
     * Default: {
     *     durable: false,
     *     autoDelete: true
     * }
     */
    options?: Options.AssertQueue
}
