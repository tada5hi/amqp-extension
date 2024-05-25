import { isObject } from 'smob';
import type { ConsumeHandlers } from './type';

export function isConsumeHandlers(input: unknown) : input is ConsumeHandlers {
    if (!isObject(input)) {
        return false;
    }

    const keys = Object.keys(input);
    for (let i = 0; i < keys.length; i++) {
        if (typeof input[keys[i]] !== 'function') {
            return false;
        }
    }

    return true;
}
