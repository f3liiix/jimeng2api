import _ from 'lodash';

import Body from './Body.ts';
import Exception from '../exceptions/Exception.ts';
import APIException from '../exceptions/APIException.ts';
import EX from '../consts/exceptions.ts';
import HTTP_STATUS_CODES from '../http-status-codes.ts';

export default class FailureBody extends Body {
    private errorBody: Record<string, any>;
    
    constructor(error: APIException | Exception | Error, _data?: any) {
        let errcode, errmsg, data = _data, httpStatusCode = HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;
        let type = 'api_error', param = null, code: string | number = 'internal_error';
        if(_.isString(error))
            error = new Exception(EX.SYSTEM_ERROR, error);
        if(error instanceof APIException) {
            ({ errcode, errmsg, data, httpStatusCode } = error);
            type = error.type || inferType(errcode);
            param = error.param || null;
            code = error.code || inferCode(errcode);
            httpStatusCode = httpStatusCode || inferHTTPStatusCode(errcode);
        }
        else if(error instanceof Exception) {
            ({ errcode, errmsg, data, httpStatusCode } = error);
            type = inferType(errcode);
            code = inferCode(errcode);
            httpStatusCode = httpStatusCode || inferHTTPStatusCode(errcode);
        }
        else if(_.isError(error)) {
            ({ errcode, errmsg, data, httpStatusCode } = new Exception(EX.SYSTEM_ERROR, error.message));
        }
        super({
            code: errcode || -1,
            message: errmsg || 'Internal error',
            data,
            statusCode: httpStatusCode
        });
        this.errorBody = {
            error: {
                message: errmsg || 'Internal error',
                type,
                param,
                code,
            }
        };
    }

    toObject() {
        return this.errorBody;
    }

    static isInstance(value) {
        return value instanceof FailureBody;
    }

}

function inferHTTPStatusCode(errcode?: number): number {
    switch (errcode) {
        case -2000:
            return HTTP_STATUS_CODES.BAD_REQUEST;
        case -2002:
            return HTTP_STATUS_CODES.UNAUTHORIZED;
        case -2004:
            return HTTP_STATUS_CODES.REQUEST_ENTITY_TOO_LARGE;
        case -2006:
            return HTTP_STATUS_CODES.FORBIDDEN;
        case -2009:
            return 402;
        case -2001:
        case -2007:
        case -2008:
            return HTTP_STATUS_CODES.BAD_GATEWAY;
        default:
            return HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;
    }
}

function inferType(errcode?: number): string {
    if (errcode === -2000 || errcode === -2004) return 'invalid_request_error';
    if (errcode === -2002) return 'authentication_error';
    if (errcode === -2006) return 'content_policy_error';
    if (errcode === -2009) return 'insufficient_quota';
    return 'api_error';
}

function inferCode(errcode?: number): string | number {
    switch (errcode) {
        case -2000:
            return 'invalid_request';
        case -2002:
            return 'invalid_api_key';
        case -2004:
            return 'payload_too_large';
        case -2006:
            return 'content_filtered';
        case -2009:
            return 'insufficient_quota';
        default:
            return errcode || 'internal_error';
    }
}