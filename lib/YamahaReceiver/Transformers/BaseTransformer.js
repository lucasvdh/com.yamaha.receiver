'use strict';

const Entities = new (require('html-entities').XmlEntities)();

class BaseTransformer {

    constructor(zone) {
        this.zone = zone;
    }

    getZoneResult(result) {
        if (typeof result['YAMAHA_AV'] === "undefined" || result['YAMAHA_AV'] === null) {
            throw new Error('Yamaha result not found');
        } else if (typeof result['YAMAHA_AV'][this.zone] === "undefined" || result['YAMAHA_AV'][this.zone] === null) {
            throw new Error('Zone result not found');
        } else if (typeof result['YAMAHA_AV'][this.zone][0] === "undefined" || result['YAMAHA_AV'][this.zone][0] === null) {
            throw new Error('Zone result first child not found');
        }

        return result['YAMAHA_AV'][this.zone][0];
    }

    getAttributeFromXMLArray(array, name) {
        if (typeof name === "array") {
            for (let i in name) {
                let result = this.getAttributeFromXMLArray(array, name[i]);

                if (result !== null) {
                    return result;
                }

                return null;
            }
        } else if (name.indexOf('.') !== -1) {
            let value = array,
                parts = name.split('.');

            for (let i in parts) {
                let part = parts[i];

                if (this.attributeExistsXMLArray(value, part)) {
                    value = this.getAttributeFromXMLArray(value, part);
                } else {
                    return null;
                }
            }

            return Entities.decode(value);
        } else {
            if (this.attributeExistsXMLArray(array, name)) {
                if (typeof array[name][0] === "string") {
                    return Entities.decode(array[name][0]);
                }

                return array[name][0];
            }
        }

        return null;
    }

    getStrictAttributeFromXMLArray(array, name) {
        if (typeof name === "array") {
            for (let i in name) {
                let result = this.getStrictAttributeFromXMLArray(array, name[i]);

                if (result !== null) {
                    return result;
                }

                return null;
            }
        } else if (name.indexOf('.') !== -1) {
            let value = array,
                parts = name.split('.');

            for (let i in parts) {
                let part = parts[i];

                if (this.attributeExistsXMLArray(value, part)) {
                    value = this.getStrictAttributeFromXMLArray(value, part);
                } else {
                    throw new Error(name + ' result not found');
                }
            }

            if (typeof value === "string") {
                return Entities.decode(value);
            }
            return value;
        } else {
            if (this.attributeExistsXMLArray(array, name)) {
                if (typeof array[name][0] === "string") {
                    return Entities.decode(array[name][0]);
                }

                return array[name][0];
            }
        }

        throw new Error(name + ' result not found');
    }

    attributeExistsXMLArray(array, name) {
        return typeof array !== "undefined"
            && typeof array[name] !== "undefined"
            && typeof array[name][0] !== "undefined";
    }

}


module.exports = BaseTransformer;