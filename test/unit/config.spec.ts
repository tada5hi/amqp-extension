import {InputConfig, getConfig, getConfigKey, hasConfig, setConfig, ExchangeType} from "../../src";

describe('src/config/*.ts', () => {
    const data : InputConfig = {
        alias: getConfigKey(),
        exchange: {
            name: 'test',
            type: ExchangeType.DIRECT
        },
        connection: 'connection'
    };

    const testData : InputConfig = {
        ...data,
        alias: 'test',
        connection: 'test'
    };

    it('should set config', () => {
        expect(hasConfig()).toBeFalsy();

        let config = setConfig(data);
        expect(config).toEqual(data);

        expect(hasConfig()).toBeTruthy();

        config = setConfig('test', testData);
        expect(config).toEqual(testData);

        expect(() => setConfig('test', undefined)).toThrow();
    });

    it('should get config', () => {
        let config = getConfig();
        expect(config).toEqual(data);

        config = getConfig('test');
        expect(config).toEqual(testData);

        config = getConfig(data);
        expect(config).toEqual(data);

        expect(() => getConfig('test2')).toThrow();
    });
});
