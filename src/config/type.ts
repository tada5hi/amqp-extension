import {Options} from "amqplib";

export type ExchangeType = 'fanout' | 'direct' | 'topic' | 'match' | string;

export type Config = {
    alias?: string,
    connection: Options.Connect | string,
    exchange: {
        name: string,
        type: ExchangeType,
        options?: Options.AssertExchange
    },
    publish?: {
        options?: Options.Publish
    }
};
