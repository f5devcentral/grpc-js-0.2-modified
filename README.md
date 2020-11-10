# This is a modified version of grpc-js version 0.2

changes were made for this version to make it work in node 8.11.1

official support version is 9.x+ as you can see below

changes that were made by magneto team:

- file: channel.js
```sh
line 156 //subChannel.close(); *commented out
line 157 subChannel.emit('close'); *added
```
```sh
line 105 // this.subChannel.close(); *commented out
line 106 this.subChannel.emit('close'); *added
```
```sh
line 191 //session.ref(); *commented out
```
```sh
line 202 //session.unref(); *commented out
```
                
    
# Pure JavaScript gRPC Client

**Note: This is an alpha-level release. Some APIs may not yet be present and there may be bugs. Please report any that you encounter**

## Installation

Node 9.x or greater is required.

original package npm link: 
https://www.npmjs.com/package/@grpc/grpc-js/v/0.2.0

original package npm download link: 

```sh
npm install @grpc/grpc-js@0.2.0
```

## Features

 - Unary and streaming calls
 - Cancellation
 - Deadlines
 - TLS channel credentials
 - Call credentials (for auth)
 - Simple reconnection

This library does not directly handle `.proto` files. To use `.proto` files with this library we recommend using the `@grpc/proto-loader` package.
