import { createMerger } from 'smob';
import { isExchange } from './exchange';

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
            !isExchange(target[key]) ||
            !isExchange(value)
        ) {
            return undefined;
        }

        return target;
    },
});

export {
    mergeOptions,
};
