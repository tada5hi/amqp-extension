import type { Options } from 'amqplib';
import type { ExchangeType } from './constants';

export type ExchangeOptions = {
    name: string,
    type?: `${ExchangeType}`,
    routingKey?: string,
} & Options.AssertExchange;
