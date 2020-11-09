/// <reference types="node" />
import { SecureContext } from 'tls';
import { CallCredentials } from './call-credentials';
/**
 * A class that contains credentials for communicating over a channel, as well
 * as a set of per-call credentials, which are applied to every method call made
 * over a channel initialized with an instance of this class.
 */
export declare abstract class ChannelCredentials {
    protected callCredentials: CallCredentials;
    protected constructor(callCredentials?: CallCredentials);
    /**
     * Returns a copy of this object with the included set of per-call credentials
     * expanded to include callCredentials.
     * @param callCredentials A CallCredentials object to associate with this
     * instance.
     */
    abstract compose(callCredentials: CallCredentials): ChannelCredentials;
    /**
     * Gets the set of per-call credentials associated with this instance.
     */
    getCallCredentials(): CallCredentials;
    /**
     * Gets a SecureContext object generated from input parameters if this
     * instance was created with createSsl, or null if this instance was created
     * with createInsecure.
     */
    abstract getSecureContext(): SecureContext | null;
    /**
     * Return a new ChannelCredentials instance with a given set of credentials.
     * The resulting instance can be used to construct a Channel that communicates
     * over TLS.
     * @param rootCerts The root certificate data.
     * @param privateKey The client certificate private key, if available.
     * @param certChain The client certificate key chain, if available.
     */
    static createSsl(rootCerts?: Buffer | null, privateKey?: Buffer | null, certChain?: Buffer | null): ChannelCredentials;
    /**
     * Return a new ChannelCredentials instance with no credentials.
     */
    static createInsecure(): ChannelCredentials;
}