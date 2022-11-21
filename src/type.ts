import { Options } from 'amqplib';
import { InputConfig } from './config';
import { ExchangeOptions } from './exchange';

type CommonOptions = {
    /**
     * Config key or object.
     */
    alias?: string | InputConfig;

    /**
     * Exchange
     *
     * default: undefined
     */
    exchange?: Partial<ExchangeOptions>,

    /**
     * Queue name.
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
