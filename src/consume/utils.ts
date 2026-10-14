import { isObject } from 'smob';
import type { ConsumeHandlers } from './type';

export function isConsumeHandlers(input: unknown) : input is ConsumeHandlers {
    if (!isObject(input)) {
        return false;
    }

    return Object.values(input)
        .every((value) => typeof value === 'function');
}
