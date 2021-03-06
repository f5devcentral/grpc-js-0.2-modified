"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const client_1 = require("./client");
const metadata_1 = require("./metadata");
function getDefaultValues(metadata, options) {
    return { metadata: metadata || new metadata_1.Metadata(), options: options || {} };
}
/**
 * Map with short names for each of the requester maker functions. Used in
 * makeClientConstructor
 * @private
 */
const requesterFuncs = {
    unary: client_1.Client.prototype.makeUnaryRequest,
    server_stream: client_1.Client.prototype.makeServerStreamRequest,
    client_stream: client_1.Client.prototype.makeClientStreamRequest,
    bidi: client_1.Client.prototype.makeBidiStreamRequest
};
/**
 * Creates a constructor for a client with the given methods, as specified in
 * the methods argument. The resulting class will have an instance method for
 * each method in the service, which is a partial application of one of the
 * [Client]{@link grpc.Client} request methods, depending on `requestSerialize`
 * and `responseSerialize`, with the `method`, `serialize`, and `deserialize`
 * arguments predefined.
 * @param methods An object mapping method names to
 *     method attributes
 * @param serviceName The fully qualified name of the service
 * @param classOptions An options object.
 * @return New client constructor, which is a subclass of
 *     {@link grpc.Client}, and has the same arguments as that constructor.
 */
function makeClientConstructor(methods, serviceName, classOptions) {
    if (!classOptions) {
        classOptions = {};
    }
    class ServiceClientImpl extends client_1.Client {
    }
    _.each(methods, (attrs, name) => {
        let methodType;
        // TODO(murgatroid99): Verify that we don't need this anymore
        if (_.startsWith(name, '$')) {
            throw new Error('Method names cannot start with $');
        }
        if (attrs.requestStream) {
            if (attrs.responseStream) {
                methodType = 'bidi';
            }
            else {
                methodType = 'client_stream';
            }
        }
        else {
            if (attrs.responseStream) {
                methodType = 'server_stream';
            }
            else {
                methodType = 'unary';
            }
        }
        const serialize = attrs.requestSerialize;
        const deserialize = attrs.responseDeserialize;
        const methodFunc = _.partial(requesterFuncs[methodType], attrs.path, serialize, deserialize);
        ServiceClientImpl.prototype[name] = methodFunc;
        // Associate all provided attributes with the method
        _.assign(ServiceClientImpl.prototype[name], attrs);
        if (attrs.originalName) {
            ServiceClientImpl.prototype[attrs.originalName] =
                ServiceClientImpl.prototype[name];
        }
    });
    ServiceClientImpl.service = methods;
    return ServiceClientImpl;
}
exports.makeClientConstructor = makeClientConstructor;
/**
 * Load a gRPC package definition as a gRPC object hierarchy.
 * @param packageDef The package definition object.
 * @return The resulting gRPC object.
 */
function loadPackageDefinition(packageDef) {
    const result = {};
    for (const serviceFqn in packageDef) {
        if (packageDef.hasOwnProperty(serviceFqn)) {
            const service = packageDef[serviceFqn];
            const nameComponents = serviceFqn.split('.');
            const serviceName = nameComponents[nameComponents.length - 1];
            let current = result;
            for (const packageName of nameComponents.slice(0, -1)) {
                if (!current[packageName]) {
                    current[packageName] = {};
                }
                current = current[packageName];
            }
            current[serviceName] = makeClientConstructor(service, serviceName, {});
        }
    }
    return result;
}
exports.loadPackageDefinition = loadPackageDefinition;
//# sourceMappingURL=make-client.js.map