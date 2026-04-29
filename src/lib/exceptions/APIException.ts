import Exception from './Exception.js';

export interface APIExceptionOptions {
    httpStatusCode?: number;
    type?: string;
    param?: string | null;
    code?: string | number;
    data?: any;
}

export default class APIException extends Exception {

    type?: string;
    param?: string | null;
    code?: string | number;

    /**
     * 构造异常
     * 
     * @param {[number, string]} exception 异常
     */
    constructor(exception: (string | number)[], errmsg?: string, options: APIExceptionOptions = {}) {
        super(exception, errmsg);
        this.httpStatusCode = options.httpStatusCode;
        this.type = options.type;
        this.param = options.param;
        this.code = options.code;
        if (options.data !== undefined) this.data = options.data;
    }

}