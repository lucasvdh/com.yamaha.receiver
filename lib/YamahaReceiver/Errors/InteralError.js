"use strict";

class InternalError extends Error {
    constructor() {
        super('The client got an interal error response');
        //something
    }
}

module.exports = InternalError;
