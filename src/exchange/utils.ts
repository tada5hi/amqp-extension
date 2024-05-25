import type { Options } from 'amqplib';
import { isObject } from 'smob';
import { removeKeysFromOptions } from '../utils';
import { ExchangeType } from './constants';
import type { ExchangeOptions } from './type';

export function isDefaultExchange(exchange?: `${ExchangeType}`) : exchange is ExchangeType.DIRECT {
    return typeof exchange === 'undefined' || exchange === ExchangeType.DIRECT;
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

export function isExchangeOptions(input: unknown) : input is ExchangeOptions {
    return isObject(input) &&
        typeof input.type === 'string';
}
