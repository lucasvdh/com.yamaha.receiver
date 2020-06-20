"use strict";

class InvalidParameter extends Error {
    constructor() {
        super('The client got an invalid parameter error response');
        //something
    }
}

module.exports = InvalidParameter;
