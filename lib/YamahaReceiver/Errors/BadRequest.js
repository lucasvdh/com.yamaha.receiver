"use strict";

const Homey = require('homey');

class BadRequest extends Error {
    constructor() {
        super(Homey.__('error.badRequest'));
    }
}

module.exports = BadRequest;
