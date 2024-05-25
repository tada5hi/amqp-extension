import { createMerger, hasOwnProperty } from 'smob';
import { isExchangeOptions } from './exchange';

export function removeKeysFromOptions<
    T extends Record<string, any>,
    K extends(
        keyof T)[],
    >(
    options: T,
    keys: K,
) : Omit<T, K[number]> {
    for (let i = 0; i < keys.length; i++) {
        if (hasOwnProperty(options, keys[i])) {
            delete options[keys[i]];
        }
    }

    return options as Omit<T, K[number]>;
}

export async function wait(ms: number) {
    return new Promise<void>((resolve) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
}

const mergeOptions = createMerger({
    priority: 'left',
    inPlace: false,
    clone: true,
    array: true,
    arrayDistinct: true,
    strategy(target, key, value) {
        if (key !== 'exchange') {
            return undefined;
        }

        if (
            !isExchangeOptions(target[key]) ||
            !isExchangeOptions(value)
        ) {
            return undefined;
        }

        return target;
    },
});

export {
    mergeOptions,
};
