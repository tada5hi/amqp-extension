import type { Options } from 'amqplib';
import { removeKeysFromOptions } from '../utils';
import type { PublishOptionsExtended } from './type';

export function buildDriverPublishOptions(
    options: PublishOptionsExtended,
) : Options.Publish {
    return removeKeysFromOptions(
        { ...options },
        [
            'alias',
            'exchange',
            'queueName',
            'content',
            'id',
        ],
    );
}
