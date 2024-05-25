import type { Options } from 'amqplib';
import type { ExchangeType } from './constants';

export type ExchangeOptions = Options.AssertExchange;
export type Exchange = {
    type: `${ExchangeType}`,
    name?: string,
    options?: ExchangeOptions
};
