/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { checkInstance } from '../../../utils/check-instance';
import { RPCServerLayer } from './module';

export function isRPCServerLayerInstance(input: unknown) : input is RPCServerLayer {
    return checkInstance(input, 'RPCServerLayer');
}
