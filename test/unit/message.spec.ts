import {buildMessage, BuildMessageContext, Message} from "../../src";

describe('src/message/*.ts', () => {
    const exampleMessage : BuildMessageContext = {
        id: '1',
        type: 'thingsHappened',
        options: {
            routingKey: 'event'
        }
    };

    it('should build message', () => {
        let message : Message = buildMessage(exampleMessage);
        expect(message).toEqual({...exampleMessage, data: {}, metadata: {}});

        message = buildMessage({...exampleMessage, data: {id: 1}});
        expect(message).toEqual({...exampleMessage, data: {id: 1}, metadata: {}});

        message = buildMessage({...exampleMessage, metadata: {foo: 'bar'}});
        expect(message).toEqual({...exampleMessage, data: {}, metadata: {foo: 'bar'}});
    });
});
