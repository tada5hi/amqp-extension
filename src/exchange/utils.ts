import { isObject } from 'smob';
import { ExchangeType } from './constants';
import type { Exchange } from './type';

export function isDefaultExchange(
    input?: `${ExchangeType}`,
) : input is ExchangeType.DIRECT {
    return typeof input === 'undefined' || input === ExchangeType.DIRECT;
}

export function isExchange(input: unknown) : input is Exchange {
    return isObject(input) &&
        typeof input.type === 'string';
}
