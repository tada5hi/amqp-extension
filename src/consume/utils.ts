import type { Options } from 'amqplib';
import type { ConsumeOptions } from '../type';
import { removeKeysFromOptions } from '../utils';

export function buildDriverConsumeOptions(
    options: ConsumeOptions,
) : Options.Consume {
    return removeKeysFromOptions(
        { ...options },
        [
            'alias',
            'exchange',
            'queueName',
            'requeueOnFailure',
            'prefetchCount',
        ],
    );
}
