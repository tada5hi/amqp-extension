import {Options} from "amqplib";
import {ConsumeOptions} from "../consume";
import {PublishOptions} from "../publish";

export type ExchangeType = 'fanout' | 'direct' | 'topic' | 'match' | string;

export type Config = {
    alias?: string,
    connection: Options.Connect | string,
    exchange: {
        name: string,
        type: ExchangeType,
        options?: Options.AssertExchange
    },
    publish?: PublishOptions,
    consume?: ConsumeOptions
};
