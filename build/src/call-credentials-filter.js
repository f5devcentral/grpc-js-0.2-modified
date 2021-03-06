"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const filter_1 = require("./filter");
class CallCredentialsFilter extends filter_1.BaseFilter {
    constructor(credentials, host, path) {
        super();
        this.credentials = credentials;
        this.host = host;
        this.path = path;
        const splitPath = path.split('/');
        let serviceName = '';
        /* The standard path format is "/{serviceName}/{methodName}", so if we split
         * by '/', the first item should be empty and the second should be the
         * service name */
        if (splitPath.length >= 2) {
            serviceName = splitPath[1];
        }
        /* Currently, call credentials are only allowed on HTTPS connections, so we
         * can assume that the scheme is "https" */
        this.serviceUrl = `https://${host}/${serviceName}`;
    }
    sendMetadata(metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            const credsMetadata = this.credentials.generateMetadata({ service_url: this.serviceUrl });
            const resultMetadata = yield metadata;
            resultMetadata.merge(yield credsMetadata);
            return resultMetadata;
        });
    }
}
exports.CallCredentialsFilter = CallCredentialsFilter;
class CallCredentialsFilterFactory {
    constructor(channel) {
        this.credentials = channel.credentials.getCallCredentials();
    }
    createFilter(callStream) {
        return new CallCredentialsFilter(this.credentials.compose(callStream.getCredentials()), callStream.getHost(), callStream.getMethod());
    }
}
exports.CallCredentialsFilterFactory = CallCredentialsFilterFactory;
//# sourceMappingURL=call-credentials-filter.js.map