import {Options} from "amqplib";
import {Config} from "../config";
import {MessageContext, Message} from "../message";

export type ConsumeHandler = (message: Message, context: MessageContext) => Promise<void>;
export type ConsumeHandlers = Record<'$any' | string, ConsumeHandler>;

export type ConsumeOptions = {
    /**
     * Queue routing key(s).
     */
    routingKey?: string | string[],

    /**
     * Config key or object.
     */
    alias?: string | Config,
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
    options?: Options.AssertQueue;

    /**
     * Default: false
     */
    requeueOnFailure?: boolean;
}
