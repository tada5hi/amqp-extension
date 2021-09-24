import {Config, DEFAULT_KEY, getConfig, setConfig} from "../../src";

describe('src/config/*.ts', () => {
    const data : Config = {
        alias: DEFAULT_KEY,
        exchange: {
            name: 'test',
            type: 'direct'
        },
        connection: 'connection'
    };

    const testData : Config = {
        ...data,
        alias: 'test',
        connection: 'test'
    };

    it('should set config', () => {
        let config = setConfig(data);
        expect(config).toEqual(data);

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
