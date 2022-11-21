import { Options } from 'amqplib';
import { ExchangeType } from './constants';

export type ExchangeOptions = {
    name: string,
    type: `${ExchangeType}`,
    routingKey?: string,
} & Options.AssertExchange;
