import {
    Key, ParseOptions, TokensToRegexpOptions, pathToRegexp,
} from 'path-to-regexp';

function decodeParam(val: unknown) {
    if (typeof val !== 'string' || val.length === 0) {
        return val;
    }

    return decodeURIComponent(val);
}

export class RPCServerLayer {
    protected path : string | undefined;

    protected pathRaw : string;

    protected params: Record<string, any> | undefined;

    protected handle : CallableFunction;

    protected regexp : RegExp;

    protected regexpOptions : TokensToRegexpOptions & ParseOptions;

    protected keys : Key[] = [];

    constructor(
        path: string,
        options: TokensToRegexpOptions & ParseOptions,
        fn: CallableFunction,
    ) {
        this.pathRaw = path;
        this.handle = fn;
        this.regexpOptions = options;
        this.regexp = pathToRegexp(path, this.keys, options);
    }

    handleError(error, req, res, next) : void {
        if (this.handle.length !== 4) {
            next(error);
            return;
        }

        try {
            this.handle(error, req, res, next);
        } catch (e) {
            next(error);
        }
    }

    handleRequest(req, res, next) {
        if (this.handle.length > 3) {
            next();
            return;
        }

        try {
            this.handle(req, res, next);
        } catch (e) {
            next(e);
        }
    }

    exec(path: string | null) : boolean {
        let match : RegExpExecArray;

        // set fast path flags
        const fastStar = this.pathRaw === '*';
        const fastSlash = this.pathRaw === '/' && this.regexpOptions.end === false;

        if (path !== null) {
            if (fastSlash) {
                this.params = {};
                this.path = '';

                return true;
            }

            if (fastStar) {
                this.params = { 0: decodeParam(path) };
                this.path = path;
            }

            match = this.regexp.exec(path);
        }

        if (!match) {
            this.params = undefined;
            this.path = undefined;
            return false;
        }

        this.params = {};
        this.path = match[0] as string;

        for (let i = 1; i < match.length; i++) {
            const key = this.keys[i - 1];
            const prop = key.name;
            const val = decodeParam(match[i]);

            if (val !== undefined || !(Object.prototype.hasOwnProperty.call(this.params, prop))) {
                this.params[prop] = val;
            }
        }

        return true;
    }
}
