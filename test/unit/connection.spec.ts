import {clearConnections, getConnections} from "../../src";

describe('src/connection', () => {
    it('should get/clear connections', () => {
        let connections = getConnections();

        expect(connections).toBeDefined();
        expect(connections.size).toEqual(0);

        clearConnections();

        connections = getConnections()

        expect(connections.size).toEqual(0);
    });
})
