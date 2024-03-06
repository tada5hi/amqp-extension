import { hasOwnProperty } from 'smob';

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
