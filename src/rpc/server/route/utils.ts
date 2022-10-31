/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { checkInstance } from '../../../utils/check-instance';
import { RPCServerRoute } from './module';

export function isRPCServerRouteInstance(input: unknown) : input is RPCServerRoute {
    return checkInstance(input, 'RPCServerRoute');
}
