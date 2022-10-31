/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export function bufferFromData(
    data: any,
) : Buffer {
    return Buffer.from(JSON.stringify(data));
}

export function bufferToData<T>(
    buffer: Buffer,
) : T {
    const str = buffer.toString('utf-8');
    const data = JSON.parse(str);

    return data as T;
}
