/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Response } from 'routup';

const BodySymbol = Symbol.for('ResBody');

export function useResponseBody(res: Response) : Buffer | undefined {
    if (BodySymbol in res) {
        return (res as any)[BodySymbol];
    }

    return undefined;
}

export function setResponseBody(res: Response, body: Buffer) {
    (res as any)[BodySymbol] = body;
}
