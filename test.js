'use strict';

// const InputEnum = require('./lib/YamahaReceiver/enums/InputEnum');
//
// console.log(Object.values(InputEnum).map(value => {
//     return {
//         id: value,
//         name: value
//     };
// }))

// let client = new YamahaReceiverClient('192.168.1.8', 'Main_Zone');
//
// let percentileVolume = 25,
//     decibelVolume = (((100 - (percentileVolume + 19.5)) * 10) * -1);
//
// console.log(client.decibelToPercentile(decibelVolume));
// console.log(client.percentileToDecibel(percentileVolume));
//
// client.setVolume(percentileVolume).then(state => {
//     console.log(state);
// });

// decibel -500
// percentage = 30.5

const xml2js = require('xml2js');

let xml = '<?xml version="1.0"?>\n' +
    '<root\n' +
    '  xmlns="urn:schemas-upnp-org:device-1-0"\n' +
    '  xmlns:ms="urn:microsoft-com:wmc-1-0"\n' +
    '  xmlns:pnpx="http://schemas.microsoft.com/windows/pnpx/2005/11"\n' +
    '  xmlns:df="http://schemas.microsoft.com/windows/2008/09/devicefoundation"\n' +
    '  xmlns:yamaha="urn:schemas-yamaha-com:device-1-0">\n' +
    '    <yamaha:X_device>\n' +
    '        <yamaha:X_URLBase>http://192.168.1.8:80/</yamaha:X_URLBase>\n' +
    '        <yamaha:X_serviceList>\n' +
    '            <yamaha:X_service>\n' +
    '                <yamaha:X_specType>urn:schemas-yamaha-com:service:X_YamahaRemoteControl:1</yamaha:X_specType>\n' +
    '                <yamaha:X_controlURL>/YamahaRemoteControl/ctrl</yamaha:X_controlURL>\n' +
    '                <yamaha:X_unitDescURL>/YamahaRemoteControl/desc.xml</yamaha:X_unitDescURL>\n' +
    '            </yamaha:X_service>\n' +
    '        </yamaha:X_serviceList>\n' +
    '    </yamaha:X_device>\n' +
    '    <specVersion>\n' +
    '        <major>1</major>\n' +
    '        <minor>0</minor>\n' +
    '    </specVersion>\n' +
    '    <device\n' +
    '\t  ms:X_MS_SupportsWMDRM="true">\n' +
    '        <dlna:X_DLNADOC xmlns:dlna="urn:schemas-dlna-org:device-1-0">DMR-1.50</dlna:X_DLNADOC>\n' +
    '        <pnpx:X_compatibleId>MS_DigitalMediaDeviceClass_DMR_V001\n' +
    '\t\t\t\t</pnpx:X_compatibleId>\n' +
    '        <pnpx:X_deviceCategory>MediaDevices Multimedia.DMR MediaDevice.DMC\n' +
    '\t\t\t\t</pnpx:X_deviceCategory>\n' +
    '        <pnpx:X_hardwareId>VEN_0033&amp;DEV_0006&amp;REV_01\n' +
    '\t\t\t\t</pnpx:X_hardwareId>\n' +
    '        <df:X_deviceCategory>Multimedia.DMR\n' +
    '\t\t\t\t</df:X_deviceCategory>\n' +
    '        <deviceType>urn:schemas-upnp-org:device:MediaRenderer:1</deviceType>\n' +
    '        <friendlyName>YAMAHA</friendlyName>\n' +
    '        <manufacturer>Yamaha Corporation</manufacturer>\n' +
    '        <manufacturerURL>http://www.yamaha.com/</manufacturerURL>\n' +
    '        <modelDescription>AV Receiver</modelDescription>\n' +
    '        <modelName>HTR-4067</modelName>\n' +
    '        <modelNumber>4067</modelNumber>\n' +
    '        <modelURL>http://www.yamaha.com/</modelURL>\n' +
    '        <serialNumber>03129AD3</serialNumber>\n' +
    '        <UDN>uuid:5f9ec1b3-ed59-1900-4530-00a0deb631d7</UDN>\n' +
    '        <UPC>123810928305</UPC>\n' +
    '        <iconList>\n' +
    '            <icon>\n' +
    '                <mimetype>image/jpeg</mimetype>\n' +
    '                <width>48</width>\n' +
    '                <height>48</height>\n' +
    '                <depth>24</depth>\n' +
    '                <url>/BCO_device_sm_icon.jpg</url>\n' +
    '            </icon>\n' +
    '            <icon>\n' +
    '                <mimetype>image/jpeg</mimetype>\n' +
    '                <width>120</width>\n' +
    '                <height>120</height>\n' +
    '                <depth>24</depth>\n' +
    '                <url>/BCO_device_lrg_icon.jpg</url>\n' +
    '            </icon>\n' +
    '            <icon>\n' +
    '                <mimetype>image/png</mimetype>\n' +
    '                <width>48</width>\n' +
    '                <height>48</height>\n' +
    '                <depth>24</depth>\n' +
    '                <url>/BCO_device_sm_icon.png</url>\n' +
    '            </icon>\n' +
    '            <icon>\n' +
    '                <mimetype>image/png</mimetype>\n' +
    '                <width>120</width>\n' +
    '                <height>120</height>\n' +
    '                <depth>24</depth>\n' +
    '                <url>/BCO_device_lrg_icon.png</url>\n' +
    '            </icon>\n' +
    '        </iconList>\n' +
    '        <serviceList>\n' +
    '            <service>\n' +
    '                <serviceType>urn:schemas-upnp-org:service:RenderingControl:1</serviceType>\n' +
    '                <serviceId>urn:upnp-org:serviceId:RenderingControl</serviceId>\n' +
    '                <SCPDURL>/RenderingControl/desc.xml</SCPDURL>\n' +
    '                <controlURL>/RenderingControl/ctrl</controlURL>\n' +
    '                <eventSubURL>/RenderingControl/evt</eventSubURL>\n' +
    '            </service>\n' +
    '            <service>\n' +
    '                <serviceType>urn:schemas-upnp-org:service:ConnectionManager:1</serviceType>\n' +
    '                <serviceId>urn:upnp-org:serviceId:ConnectionManager</serviceId>\n' +
    '                <SCPDURL>/ConnectionManager/desc.xml</SCPDURL>\n' +
    '                <controlURL>/ConnectionManager/ctrl</controlURL>\n' +
    '                <eventSubURL>/ConnectionManager/evt</eventSubURL>\n' +
    '            </service>\n' +
    '            <service>\n' +
    '                <serviceType>urn:schemas-upnp-org:service:AVTransport:1</serviceType>\n' +
    '                <serviceId>urn:upnp-org:serviceId:AVTransport</serviceId>\n' +
    '                <SCPDURL>/AVTransport/desc.xml</SCPDURL>\n' +
    '                <controlURL>/AVTransport/ctrl</controlURL>\n' +
    '                <eventSubURL>/AVTransport/evt</eventSubURL>\n' +
    '            </service>\n' +
    '        </serviceList>\n' +
    '        <presentationURL>http://192.168.1.8/</presentationURL>\n' +
    '    </device>\n' +
    '</root>';

xml2js.parseStringPromise(xml)
    .then(result => {
        let device = result.root.device[0],
            friendlyName = device.friendlyName[0],
            modelName = device.modelName[0];

        let name = friendlyName + ' - ' + modelName + ' [' + '192.168.1.8' + ']';
        console.log(name, result.root['yamaha:X_device']);
    });