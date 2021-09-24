import {buildMessage, Message} from "../../src";

describe('src/message/*.ts', () => {
    const exampleMessage : Message = {
        id: '1',
        type: 'thingsHappened',
        options: {
            routingKey: 'event'
        },
        data: {
            id: 1
        },
        metadata: {}
    };

    it('should build message', () => {
        const message : Message = buildMessage(exampleMessage);
        expect(message).toEqual(exampleMessage);
    });
});
