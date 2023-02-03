import { Options } from 'amqplib';
import { removeKeysFromOptions } from '../utils';
import { PublishOptionsExtended } from './type';

export function buildDriverPublishOptions(
    options: PublishOptionsExtended,
) : Options.Publish {
    return removeKeysFromOptions(
        { ...options },
        [
            'alias',
            'exchange',
            'queueName',
            'data',
            'id',
        ],
    );
}
