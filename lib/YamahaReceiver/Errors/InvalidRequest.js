"use strict";

class InvalidRequest extends Error {
    constructor() {
        super('The client got an invalid request error response');
        //something
    }
}

module.exports = InvalidRequest;
