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
const zlib = require("zlib");
const filter_1 = require("./filter");
class CompressionHandler {
    /**
     * @param message Raw uncompressed message bytes
     * @param compress Indicates whether the message should be compressed
     * @return Framed message, compressed if applicable
     */
    writeMessage(message, compress) {
        return __awaiter(this, void 0, void 0, function* () {
            let messageBuffer = message;
            if (compress) {
                messageBuffer = yield this.compressMessage(messageBuffer);
            }
            let output = Buffer.allocUnsafe(messageBuffer.length + 5);
            output.writeUInt8(compress ? 1 : 0, 0);
            output.writeUInt32BE(messageBuffer.length, 1);
            messageBuffer.copy(output, 5);
            return output;
        });
    }
    /**
     * @param data Framed message, possibly compressed
     * @return Uncompressed message
     */
    readMessage(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const compressed = data.readUInt8(1) === 1;
            let messageBuffer = data.slice(5);
            if (compressed) {
                messageBuffer = yield this.decompressMessage(messageBuffer);
            }
            return messageBuffer;
        });
    }
}
class IdentityHandler extends CompressionHandler {
    compressMessage(message) {
        return __awaiter(this, void 0, void 0, function* () {
            return message;
        });
    }
    writeMessage(message, compress) {
        return __awaiter(this, void 0, void 0, function* () {
            let output = Buffer.allocUnsafe(message.length + 5);
            /* With "identity" compression, messages should always be marked as
             * uncompressed */
            output.writeUInt8(0, 0);
            output.writeUInt32BE(message.length, 1);
            message.copy(output, 5);
            return output;
        });
    }
    decompressMessage(message) {
        return Promise.reject(new Error('Received compressed message but "grpc-encoding" header was identity'));
    }
}
class DeflateHandler extends CompressionHandler {
    compressMessage(message) {
        return new Promise((resolve, reject) => {
            zlib.deflate(message, (err, output) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(output);
                }
            });
        });
    }
    decompressMessage(message) {
        return new Promise((resolve, reject) => {
            zlib.inflate(message, (err, output) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(output);
                }
            });
        });
    }
}
class GzipHandler extends CompressionHandler {
    compressMessage(message) {
        return new Promise((resolve, reject) => {
            zlib.gzip(message, (err, output) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(output);
                }
            });
        });
    }
    decompressMessage(message) {
        return new Promise((resolve, reject) => {
            zlib.unzip(message, (err, output) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(output);
                }
            });
        });
    }
}
class UnknownHandler extends CompressionHandler {
    constructor(compressionName) {
        super();
        this.compressionName = compressionName;
    }
    compressMessage(message) {
        return Promise.reject(new Error(`Received message compressed wth unsupported compression method ${this.compressionName}`));
    }
    decompressMessage(message) {
        // This should be unreachable
        return Promise.reject(new Error(`Compression method not supported: ${this.compressionName}`));
    }
}
function getCompressionHandler(compressionName) {
    switch (compressionName) {
        case 'identity':
            return new IdentityHandler();
        case 'deflate':
            return new DeflateHandler();
        case 'gzip':
            return new GzipHandler();
        default:
            return new UnknownHandler(compressionName);
    }
}
class CompressionFilter extends filter_1.BaseFilter {
    constructor() {
        super(...arguments);
        this.sendCompression = new IdentityHandler();
        this.receiveCompression = new IdentityHandler();
    }
    sendMetadata(metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            const headers = yield metadata;
            headers.set('grpc-encoding', 'identity');
            headers.set('grpc-accept-encoding', 'identity,deflate,gzip');
            return headers;
        });
    }
    receiveMetadata(metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            const headers = yield metadata;
            let receiveEncoding = headers.get('grpc-encoding');
            if (receiveEncoding.length > 0) {
                const encoding = receiveEncoding[0];
                if (typeof encoding === 'string') {
                    this.receiveCompression = getCompressionHandler(encoding);
                }
            }
            headers.remove('grpc-encoding');
            headers.remove('grpc-accept-encoding');
            return headers;
        });
    }
    sendMessage(message) {
        return __awaiter(this, void 0, void 0, function* () {
            /* This filter is special. The input message is the bare message bytes,
             * and the output is a framed and possibly compressed message. For this
             * reason, this filter should be at the bottom of the filter stack */
            const resolvedMessage = yield message;
            const compress = resolvedMessage.flags === undefined ?
                false :
                (resolvedMessage.flags & 2 /* NoCompress */) === 0;
            return {
                message: yield this.sendCompression.writeMessage(resolvedMessage.message, compress),
                flags: resolvedMessage.flags
            };
        });
    }
    receiveMessage(message) {
        return __awaiter(this, void 0, void 0, function* () {
            /* This filter is also special. The input message is framed and possibly
             * compressed, and the output message is deframed and uncompressed. So
             * this is another reason that this filter should be at the bottom of the
             * filter stack. */
            return yield this.receiveCompression.readMessage(yield message);
        });
    }
}
exports.CompressionFilter = CompressionFilter;
class CompressionFilterFactory {
    constructor(channel) {
        this.channel = channel;
    }
    createFilter(callStream) {
        return new CompressionFilter();
    }
}
exports.CompressionFilterFactory = CompressionFilterFactory;
//# sourceMappingURL=compression-filter.js.map