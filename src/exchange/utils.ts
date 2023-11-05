import type { Options } from 'amqplib';
import { removeKeysFromOptions } from '../utils';
import { ExchangeType } from './constants';
import type { ExchangeOptions } from './type';

export function isDefaultExchange(exchange?: `${ExchangeType}`) {
    return typeof exchange === 'undefined' || exchange === ExchangeType.DEFAULT;
}

export function buildDriverExchangeOptions(
    options: ExchangeOptions,
) : Options.AssertExchange {
    return removeKeysFromOptions(
        { ...options },
        [
            'name',
            'type',
            'routingKey',
        ],
    );
}
