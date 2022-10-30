export type RPCClientRequestResolve<T> = (data: T) => void;
export type RPCClientRequestReject = (error: Error) => void;

export type RPCClientRequest<T> = {
    timeout: ReturnType<typeof setTimeout>,
    resolve: RPCClientRequestResolve<T>,
    reject: RPCClientRequestReject,
};
