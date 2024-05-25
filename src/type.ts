import type { connect } from 'amqp-connection-manager';
import type { Options } from 'amqplib';
import type { ExchangeOptions } from './exchange';

export type Connection = ReturnType<typeof connect>;

export type CommonOptions = {
    /**
     * Exchange
     *
     * default: undefined
     */
    exchange?: ExchangeOptions,

    /**
     * Queue name aka routing key.
     *
     * default: ''
     */
    queueName?: string;
};

export type PublishOptions = CommonOptions & Options.Publish;

export type ConsumeOptions = CommonOptions & Options.Consume & {
    /**
     * Default: false
     */
    requeueOnFailure?: boolean;

    /**
     * Default: undefined
     */
    prefetchCount?: number
};
