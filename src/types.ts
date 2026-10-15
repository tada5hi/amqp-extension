import type { connect } from 'amqp-connection-manager';
import type { Options } from 'amqplib';
import type { ConsumeOptions } from './consume';
import type { Exchange } from './exchange';
import type { PublishOptions } from './publish';

export type Connection = ReturnType<typeof connect>;
export type ConnectionOptions = Options.Connect | string;

export type ClientContext = {
    connection?: Connection,
    connectionOptions?: ConnectionOptions,
    exchange?: Exchange,
    publishOptions?: PublishOptions,
    consumeOptions?: ConsumeOptions,
};
