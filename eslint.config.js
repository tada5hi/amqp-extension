import config from '@tada5hi/eslint-config';

export default [
    ...await config(),
    { ignores: ['dist/**'] },
    // Preserve the published Node 20/22 runtime floor.
    { rules: { 'unicorn/prefer-error-is-error': 'off' } },
];
