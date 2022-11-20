import {clearConnections, getConnections} from "../../src";

describe('src/connection', () => {
    it('should get/clear connections', async () => {
        let connections = getConnections();
        let connectionKeys = Object.keys(connections);

        expect(connectionKeys).toBeDefined();
        expect(connectionKeys.length).toEqual(0);

        await clearConnections();

        connections = getConnections()
        connectionKeys = Object.keys(connections);

        expect(connectionKeys.length).toEqual(0);
    });
})
