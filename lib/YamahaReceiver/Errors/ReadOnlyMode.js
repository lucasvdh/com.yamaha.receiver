"use strict";

class ReadOnlyMode extends Error {
    constructor() {
        super('The client got a read only mode error response');
        //something
    }
}

module.exports = ReadOnlyMode;
