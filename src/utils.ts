import { createMerger } from 'smob';

const mergeOptions = createMerger({
    priority: 'left',
    inPlace: false,
    clone: true,
    array: true,
    arrayDistinct: true,
});

export {
    mergeOptions,
};
