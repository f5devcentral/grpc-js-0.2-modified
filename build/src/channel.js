"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const http2 = require("http2");
const tls_1 = require("tls");
const url = require("url");
const call_credentials_1 = require("./call-credentials");
const call_credentials_filter_1 = require("./call-credentials-filter");
const call_stream_1 = require("./call-stream");
const compression_filter_1 = require("./compression-filter");
const constants_1 = require("./constants");
const deadline_filter_1 = require("./deadline-filter");
const filter_stack_1 = require("./filter-stack");
const metadata_status_filter_1 = require("./metadata-status-filter");
const { version: clientVersion } = require('../../package.json');
const IDLE_TIMEOUT_MS = 300000;
const MIN_CONNECT_TIMEOUT_MS = 20000;
const INITIAL_BACKOFF_MS = 1000;
const BACKOFF_MULTIPLIER = 1.6;
const MAX_BACKOFF_MS = 120000;
const BACKOFF_JITTER = 0.2;
const { HTTP2_HEADER_AUTHORITY, HTTP2_HEADER_CONTENT_TYPE, HTTP2_HEADER_METHOD, HTTP2_HEADER_PATH, HTTP2_HEADER_SCHEME, HTTP2_HEADER_TE, HTTP2_HEADER_USER_AGENT } = http2.constants;
var ConnectivityState;
(function (ConnectivityState) {
    ConnectivityState[ConnectivityState["CONNECTING"] = 0] = "CONNECTING";
    ConnectivityState[ConnectivityState["READY"] = 1] = "READY";
    ConnectivityState[ConnectivityState["TRANSIENT_FAILURE"] = 2] = "TRANSIENT_FAILURE";
    ConnectivityState[ConnectivityState["IDLE"] = 3] = "IDLE";
    ConnectivityState[ConnectivityState["SHUTDOWN"] = 4] = "SHUTDOWN";
})(ConnectivityState = exports.ConnectivityState || (exports.ConnectivityState = {}));
function uniformRandom(min, max) {
    return Math.random() * (max - min) + min;
}
class Http2Channel extends events_1.EventEmitter {
    constructor(address, credentials, options) {
        super();
        this.credentials = credentials;
        this.options = options;
        this.connectivityState = ConnectivityState.IDLE;
        // Helper Promise object only used in the implementation of connect().
        this.connecting = null;
        /* For now, we have up to one subchannel, which will exist as long as we are
         * connecting or trying to connect */
        this.subChannel = null;
        this.subChannelConnectCallback = () => { };
        this.subChannelCloseCallback = () => { };
        this.currentBackoff = INITIAL_BACKOFF_MS;
        if (credentials.getSecureContext() === null) {
            this.target = new url.URL(`http://${address}`);
        }
        else {
            this.target = new url.URL(`https://${address}`);
        }
        // TODO(murgatroid99): Add more centralized handling of channel options
        if (this.options['grpc.default_authority']) {
            this.defaultAuthority = this.options['grpc.default_authority'];
        }
        else {
            this.defaultAuthority = this.target.host;
        }
        this.filterStackFactory = new filter_stack_1.FilterStackFactory([
            new call_credentials_filter_1.CallCredentialsFilterFactory(this), new deadline_filter_1.DeadlineFilterFactory(this),
            new metadata_status_filter_1.MetadataStatusFilterFactory(this), new compression_filter_1.CompressionFilterFactory(this)
        ]);
        this.currentBackoffDeadline = new Date();
        /* The only purpose of these lines is to ensure that this.backoffTimerId has
         * a value of type NodeJS.Timer. */
        this.backoffTimerId = setTimeout(() => { }, 0);
        clearTimeout(this.backoffTimerId);
        // Build user-agent string.
        this.userAgent = [
            options['grpc.primary_user_agent'], `grpc-node-js/${clientVersion}`,
            options['grpc.secondary_user_agent']
        ].filter(e => e).join(' '); // remove falsey values first
    }
    handleStateChange(oldState, newState) {
        const now = new Date();
        switch (newState) {
            case ConnectivityState.CONNECTING:
                if (oldState === ConnectivityState.IDLE) {
                    this.currentBackoff = INITIAL_BACKOFF_MS;
                    this.currentBackoffDeadline =
                        new Date(now.getTime() + INITIAL_BACKOFF_MS);
                }
                else if (oldState === ConnectivityState.TRANSIENT_FAILURE) {
                    this.currentBackoff = Math.min(this.currentBackoff * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);
                    const jitterMagnitude = BACKOFF_JITTER * this.currentBackoff;
                    this.currentBackoffDeadline = new Date(now.getTime() + this.currentBackoff +
                        uniformRandom(-jitterMagnitude, jitterMagnitude));
                }
                this.startConnecting();
                break;
            case ConnectivityState.READY:
                this.emit('connect');
                break;
            case ConnectivityState.TRANSIENT_FAILURE:
                this.subChannel = null;
                this.backoffTimerId = setTimeout(() => {
                    this.transitionToState([ConnectivityState.TRANSIENT_FAILURE], ConnectivityState.CONNECTING);
                }, this.currentBackoffDeadline.getTime() - now.getTime());
                break;
            case ConnectivityState.IDLE:
            case ConnectivityState.SHUTDOWN:
                if (this.subChannel) {
                    // this.subChannel.close();
                    this.subChannel.emit('close');
                    this.subChannel.removeListener('connect', this.subChannelConnectCallback);
                    this.subChannel.removeListener('close', this.subChannelCloseCallback);
                    this.subChannel = null;
                    this.emit('shutdown');
                    clearTimeout(this.backoffTimerId);
                }
                break;
            default:
                throw new Error('This should never happen');
        }
    }
    // Transition from any of a set of oldStates to a specific newState
    transitionToState(oldStates, newState) {
        if (oldStates.indexOf(this.connectivityState) > -1) {
            const oldState = this.connectivityState;
            this.connectivityState = newState;
            this.handleStateChange(oldState, newState);
            this.emit('connectivityStateChanged', newState);
        }
    }
    startConnecting() {
        let subChannel;
        const secureContext = this.credentials.getSecureContext();
        if (secureContext === null) {
            subChannel = http2.connect(this.target);
        }
        else {
            const connectionOptions = {
                secureContext,
            };
            // If provided, the value of grpc.ssl_target_name_override should be used
            // to override the target hostname when checking server identity.
            // This option is used for testing only.
            if (this.options['grpc.ssl_target_name_override']) {
                const sslTargetNameOverride = this.options['grpc.ssl_target_name_override'];
                connectionOptions.checkServerIdentity =
                    (host, cert) => {
                        return tls_1.checkServerIdentity(sslTargetNameOverride, cert);
                    };
                connectionOptions.servername = sslTargetNameOverride;
            }
            subChannel = http2.connect(this.target, connectionOptions);
        }
        this.subChannel = subChannel;
        const now = new Date();
        const connectionTimeout = Math.max(this.currentBackoffDeadline.getTime() - now.getTime(), MIN_CONNECT_TIMEOUT_MS);
        const connectionTimerId = setTimeout(() => {
            // This should trigger the 'close' event, which will send us back to
            // TRANSIENT_FAILURE
            //subChannel.close();
            subChannel.emit('close');
        }, connectionTimeout);
        this.subChannelConnectCallback = () => {
            // Connection succeeded
            clearTimeout(connectionTimerId);
            this.transitionToState([ConnectivityState.CONNECTING], ConnectivityState.READY);
        };
        subChannel.once('connect', this.subChannelConnectCallback);
        this.subChannelCloseCallback = () => {
            // Connection failed
            clearTimeout(connectionTimerId);
            /* TODO(murgatroid99): verify that this works for
             * CONNECTING->TRANSITIVE_FAILURE see nodejs/node#16645 */
            this.transitionToState([ConnectivityState.CONNECTING, ConnectivityState.READY], ConnectivityState.TRANSIENT_FAILURE);
        };
        subChannel.once('close', this.subChannelCloseCallback);
        subChannel.once('error', this.subChannelCloseCallback);
    }
    startHttp2Stream(authority, methodName, stream, metadata) {
        const finalMetadata = stream.filterStack.sendMetadata(Promise.resolve(metadata.clone()));
        Promise.all([finalMetadata, this.connect()])
            .then(([metadataValue]) => {
            const headers = metadataValue.toHttp2Headers();
            headers[HTTP2_HEADER_AUTHORITY] = authority;
            headers[HTTP2_HEADER_USER_AGENT] = this.userAgent;
            headers[HTTP2_HEADER_CONTENT_TYPE] = 'application/grpc';
            headers[HTTP2_HEADER_METHOD] = 'POST';
            headers[HTTP2_HEADER_PATH] = methodName;
            headers[HTTP2_HEADER_TE] = 'trailers';
            if (this.connectivityState === ConnectivityState.READY) {
                const session = this.subChannel;
                let http2Stream = session.request(headers);
                /* This is a very ad-hoc reference counting scheme. This should be
                 * handled by a subchannel class */
                //session.ref();
                if (!session.streamCount) {
                    session.streamCount = 0;
                }
                session.streamCount += 1;
                http2Stream.on('close', () => {
                    if (!session.streamCount) {
                        session.streamCount = 0;
                    }
                    session.streamCount -= 1;
                    if (session.streamCount <= 0) {
                        //session.unref();
                    }
                });
                stream.attachHttp2Stream(http2Stream);
            }
            else {
                /* In this case, we lost the connection while finalizing
                 * metadata. That should be very unusual */
                setImmediate(() => {
                    this.startHttp2Stream(authority, methodName, stream, metadata);
                });
            }
        })
            .catch((error) => {
            // We assume the error code isn't 0 (Status.OK)
            stream.cancelWithStatus(error.code || constants_1.Status.UNKNOWN, `Getting metadata from plugin failed with error: ${error.message}`);
        });
    }
    createStream(methodName, metadata, options) {
        if (this.connectivityState === ConnectivityState.SHUTDOWN) {
            throw new Error('Channel has been shut down');
        }
        const finalOptions = {
            deadline: options.deadline === undefined ? Infinity : options.deadline,
            credentials: options.credentials || call_credentials_1.CallCredentials.createEmpty(),
            flags: options.flags || 0,
            host: options.host || this.defaultAuthority
        };
        const stream = new call_stream_1.Http2CallStream(methodName, finalOptions, this.filterStackFactory);
        this.startHttp2Stream(finalOptions.host, methodName, stream, metadata);
        return stream;
    }
    /**
     * Attempts to connect, returning a Promise that resolves when the connection
     * is successful, or rejects if the channel is shut down.
     */
    connect() {
        if (this.connectivityState === ConnectivityState.READY) {
            return Promise.resolve();
        }
        else if (this.connectivityState === ConnectivityState.SHUTDOWN) {
            return Promise.reject(new Error('Channel has been shut down'));
        }
        else {
            // In effect, this.connecting is only assigned upon the first attempt to
            // transition from IDLE to CONNECTING, so this condition could have also
            // been (connectivityState === IDLE).
            if (!this.connecting) {
                this.connecting = new Promise((resolve, reject) => {
                    this.transitionToState([ConnectivityState.IDLE], ConnectivityState.CONNECTING);
                    const onConnect = () => {
                        this.connecting = null;
                        this.removeListener('shutdown', onShutdown);
                        resolve();
                    };
                    const onShutdown = () => {
                        this.connecting = null;
                        this.removeListener('connect', onConnect);
                        reject(new Error('Channel has been shut down'));
                    };
                    this.once('connect', onConnect);
                    this.once('shutdown', onShutdown);
                });
            }
            return this.connecting;
        }
    }
    getConnectivityState() {
        return this.connectivityState;
    }
    close() {
        if (this.connectivityState === ConnectivityState.SHUTDOWN) {
            throw new Error('Channel has been shut down');
        }
        this.transitionToState([
            ConnectivityState.CONNECTING, ConnectivityState.READY,
            ConnectivityState.TRANSIENT_FAILURE, ConnectivityState.IDLE
        ], ConnectivityState.SHUTDOWN);
    }
}
exports.Http2Channel = Http2Channel;
//# sourceMappingURL=channel.js.map
