import { ExchangeType } from './constants';

export function isDefaultExchange(
    input?: `${ExchangeType}`,
) : input is ExchangeType.DIRECT {
    return typeof input === 'undefined' || input === ExchangeType.DIRECT;
}
