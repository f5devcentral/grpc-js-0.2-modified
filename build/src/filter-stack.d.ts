/// <reference types="node" />
import { CallStream, StatusObject, WriteObject } from './call-stream';
import { Filter, FilterFactory } from './filter';
import { Metadata } from './metadata';
export declare class FilterStack implements Filter {
    private readonly filters;
    constructor(filters: Filter[]);
    sendMetadata(metadata: Promise<Metadata>): any;
    receiveMetadata(metadata: Promise<Metadata>): any;
    sendMessage(message: Promise<WriteObject>): Promise<WriteObject>;
    receiveMessage(message: Promise<Buffer>): Promise<Buffer>;
    receiveTrailers(status: Promise<StatusObject>): Promise<StatusObject>;
}
export declare class FilterStackFactory implements FilterFactory<FilterStack> {
    private readonly factories;
    constructor(factories: Array<FilterFactory<Filter>>);
    createFilter(callStream: CallStream): FilterStack;
}
