/// <reference types="node" />
import * as http2 from 'http2';
import { Duplex } from 'stream';
import { CallCredentials } from './call-credentials';
import { Status } from './constants';
import { EmitterAugmentation1 } from './events';
import { Filter } from './filter';
import { FilterStackFactory } from './filter-stack';
import { Metadata } from './metadata';
import { ObjectDuplex } from './object-stream';
export declare type Deadline = Date | number;
export interface CallStreamOptions {
    deadline: Deadline;
    credentials: CallCredentials;
    flags: number;
    host: string;
}
export declare type CallOptions = Partial<CallStreamOptions>;
export interface StatusObject {
    code: Status;
    details: string;
    metadata: Metadata;
}
export declare const enum WriteFlags {
    BufferHint = 1,
    NoCompress = 2,
    WriteThrough = 4,
}
export interface WriteObject {
    message: Buffer;
    flags?: number;
}
/**
 * This interface represents a duplex stream associated with a single gRPC call.
 */
export declare type CallStream = {
    cancelWithStatus(status: Status, details: string): void;
    getPeer(): string;
    getDeadline(): Deadline;
    getCredentials(): CallCredentials;
    getStatus(): StatusObject | null;
    getMethod(): string;
    getHost(): string;
} & EmitterAugmentation1<'metadata', Metadata> & EmitterAugmentation1<'status', StatusObject> & ObjectDuplex<WriteObject, Buffer>;
export declare class Http2CallStream extends Duplex implements CallStream {
    private readonly methodName;
    private readonly options;
    filterStack: Filter;
    private statusEmitted;
    private http2Stream;
    private pendingRead;
    private pendingWrite;
    private pendingWriteCallback;
    private pendingFinalCallback;
    private readState;
    private readCompressFlag;
    private readPartialSize;
    private readSizeRemaining;
    private readMessageSize;
    private readPartialMessage;
    private readMessageRemaining;
    private isReadFilterPending;
    private canPush;
    private unpushedReadMessages;
    private unfilteredReadMessages;
    private mappedStatusCode;
    private handlingHeaders;
    private handlingTrailers;
    private finalStatus;
    constructor(methodName: string, options: CallStreamOptions, filterStackFactory: FilterStackFactory);
    /**
     * On first call, emits a 'status' event with the given StatusObject.
     * Subsequent calls are no-ops.
     * @param status The status of the call.
     */
    private endCall(status);
    private handleFilterError(error);
    private handleFilteredRead(message);
    private filterReceivedMessage(framedMessage);
    private tryPush(messageBytes);
    private handleTrailers(headers);
    attachHttp2Stream(stream: http2.ClientHttp2Stream): void;
    private destroyHttp2Stream();
    cancelWithStatus(status: Status, details: string): void;
    getDeadline(): Deadline;
    getCredentials(): CallCredentials;
    getStatus(): StatusObject | null;
    getPeer(): string;
    getMethod(): string;
    getHost(): string;
    _read(size: number): void;
    _write(chunk: WriteObject, encoding: string, cb: Function): void;
    _final(cb: Function): void;
}
