"use strict";

class AccessError extends Error {
    constructor() {
        super('The client got an access error response');
        //something
    }
}

module.exports = AccessError;
