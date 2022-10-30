export type RPCServerHandler = (req: any, res: any) => any;

export type RPCServerRequest = {
    path: string,
    method: string,
    params?: unknown
    next?: CallableFunction
};

export type RPCServerResponse = {
    respond: (data: any) => void
};
