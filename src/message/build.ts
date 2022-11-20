/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { v4 } from 'uuid';
import { BuildMessageContext, Message } from './type';

export function buildMessage(
    context: BuildMessageContext,
) : Message {
    return {
        id: context.id ?? v4(),
        type: context.type,
        options: context.options ?? {},
        data: context.data ?? {},
        metadata: context.metadata ?? {},
    };
}
