'use strict';

const axios = require('axios');
const xml2js = require('xml2js');

let endpoint = 'http://192.168.1.8:8080/MediaRenderer/desc.xml';
let device = {
        id: '1',
        name: 'Yamaha amplifier []',
        data: {
            driver: "receiver",
        },
        settings: {
            ipAddress: '',
            zone: 'Main_Zone'
        },
    };
axios.get(endpoint).then(data => {
    xml2js.parseStringPromise(data.data)
        .then(result => {
            if (typeof result.root['yamaha:X_device'] !== "undefined") {
                let yamahaDevice = result.root['yamaha:X_device'][0],
                    baseURI = yamahaDevice['yamaha:X_URLBase'][0],
                    serviceList = yamahaDevice['yamaha:X_serviceList'][0],
                    xmlDevices = result.root.device,
                    xmlDevice = xmlDevices[0],
                    friendlyName = xmlDevice.friendlyName[0],
                    modelName = xmlDevice.modelName[0];

                device.name = friendlyName + ' - ' + modelName + ' [' + ']';

                console.log(serviceList);
            }
        });
}).catch(error => {
    console.error(error);
});