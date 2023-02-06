'use strict'

const Homey = require('homey')
const axios = require('axios')
const xml2js = require('xml2js')
const YamahaReceiverClient = require('../../lib/YamahaReceiver/YamahaReceiverClient')
const Log = require('../../lib/Log')
const { XMLMinifier } = require('../../lib/XMLMinifier')
const minifier = XMLMinifier()

class YamahaReceiverDriver extends Homey.Driver {
  onInit (data) {
    this.log('YamahaReceiverDriver has been inited')
  }

  onPair (session) {
    const discoveryStrategy = this.getDiscoveryStrategy()

    let defaultIP = '192.168.1.2',
      defaultZone = 'Main_Zone',
      pairingDevice = null

    // this method is run when Homey.emit('list_devices') is run on the front-end
    // which happens when you use the template `list_devices`

    session.setHandler('list_devices', async (data) => {
      if (pairingDevice !== null) {
        return [pairingDevice]
      } else {
        const discoveryResults = discoveryStrategy.getDiscoveryResults()

        let existingDevices = this.getDevices()

        Promise.all(Object.values(discoveryResults).map(discoveryResult => {
          return this.getDeviceByDiscoveryResult(discoveryResult)
        })).then((devices) => {
          devices = devices.filter(item => {
            return item !== null && existingDevices.filter(existingDevice => {
              return item.id === existingDevice.getData().id
            }).length === 0
          })

          if (devices.length === 0) {
            session.showView('search_device')
          } else {
            return devices
          }
        }).catch(error => {
          Log.captureException(error)
          this.error(error)
        })
      }
    })

    session.setHandler('validate_data', async (data) => {
      // Continue to next view
      session.showView('loading')

      let urlBase = 'http://' + data.ipAddress + ':80',
        controlURL = '/YamahaRemoteControl/ctrl',
        descriptionUrl = '/YamahaRemoteControl/desc.xml',
        client = new YamahaReceiverClient(urlBase, controlURL)

      if (data.validate === false) {
        pairingDevice = {
          id: data.ipAddress,
          name: 'Yamaha AV Receiver [' + data.ipAddress + ']',
          data: {
            id: data.ipAddress,
            driver: 'receiver',
          },
          settings: {
            urlBase: urlBase,
            controlURL: controlURL
          },
        }

        session.showView('list_devices')
      } else {
        client.getNetworkName().then(name => {
          return this.getDeviceModelNameByServiceDescription(urlBase + descriptionUrl).then(modelName => {
            if (modelName !== null) {
              name = name + ' - ' + modelName
            }

            pairingDevice = {
              id: data.ipAddress,
              name: name,
              data: {
                id: data.ipAddress,
                driver: 'receiver',
              },
              settings: {
                urlBase: urlBase,
                controlURL: controlURL
              },
            }

            session.showView('list_devices')
          })
        }).catch(error => {
          Log.captureException(error)
          session.showView('search_device')
          session.emit('error', error)
        })
      }
    })

    // session.on('get_device', (data, callback) => {
    //     callback(null, pairingDevice);
    // });

    session.setHandler('disconnect', async (data) => {
      this.log('Yamaha receiver app - User aborted pairing, or pairing is finished')
    })
  }

  settings (device_data, newSettingsObj, oldSettingsObj, changedKeysArr, callback) {
    device_data.ipAddress = newSettingsObj.ipAddress
    device_data.zone = newSettingsObj.zone

    try {
      changedKeysArr.forEach(function (key) {
        switch (key) {
          case 'ipAddress':
            this.log('Yamaha - IP address changed to ' + newSettingsObj.ipAddress)
            // FIXME: check if IP is valid, otherwise return callback with an error
            break
          case 'zone':
            this.log('Yamaha - Zone changed to ' + newSettingsObj.zone)
            break
        }
      })
      callback(null, true)
    } catch (error) {
      Log.captureException(error)
      callback(error)
    }
  }

  getDeviceModelNameByServiceDescription (serviceDescriptionUrl) {
    return new Promise((resolve, reject) => {
      axios.get(serviceDescriptionUrl).then(data => {
        Log.addBreadcrumb(
          'pairing',
          'Got service description XML response',
          {
            ssdpXML: minifier.minify(data.data)
          }
        )

        xml2js.parseStringPromise(data.data)
          .then(result => {
            if (
              typeof result.Unit_Description !== 'undefined'
              && typeof result.Unit_Description['$'] !== 'undefined'
              && typeof result.Unit_Description['$'].Unit_Name !== 'undefined'
            ) {
              resolve(result.Unit_Description['$'].Unit_Name)
            } else {
              resolve(null)
            }
          }).catch(error => {
          resolve(null)
        })
      }).catch(error => {
        resolve(null)
      })
    })
  }

  getDeviceByDiscoveryResult (discoveryResult) {
    Log.addBreadcrumb(
      'ssdp',
      'Found discovery result',
      {
        discoveryResult: discoveryResult
      }
    )

    if (typeof discoveryResult.headers === 'undefined'
      || discoveryResult.headers === null
      || typeof discoveryResult.headers.location === 'undefined'
      || discoveryResult.headers.location === null
    ) {
      Log.captureMessage('Yamaha Receiver discovery result does not contain ssdp details location.')
    }

    let ssdpDetailsLocation = discoveryResult.headers.location,
      defaultDevice = {
        id: discoveryResult.id,
        name: 'Yamaha amplifier [' + discoveryResult.address + ']',
        data: {
          id: discoveryResult.id,
          driver: 'receiver',
        },
        settings: {
          ipAddress: discoveryResult.address,
          zone: 'Main_Zone'
        },
      }

    return new Promise((resolve, reject) => {
      this.getDeviceBySSDPDetailsLocation(ssdpDetailsLocation, defaultDevice).then(device => {
        resolve(device)
      }).catch((error) => {
        if (typeof error === 'string') {
          Log.captureMessage(error, false)
        } else {
          Log.captureException(error, false)
        }
        resolve(null)
      })
    })
  }

  getDeviceBySSDPDetailsLocation (ssdpDetailsLocation, device) {
    return new Promise((resolve, reject) => {
      axios.get(ssdpDetailsLocation).then(data => {
        Log.addBreadcrumb(
          'ssdp',
          'Got SSDP XML response',
          {
            ssdpXML: minifier.minify(data.data)
          }
        )

        xml2js.parseStringPromise(data.data)
          .then(result => {
            if (
              typeof result.root.device === 'undefined'
              || typeof result.root.device[0].modelDescription[0] === 'undefined'
              || result.root.device[0].modelDescription[0] !== 'AV Receiver'
            ) {
              Log.addBreadcrumb(
                'ssdp',
                'Could not verify that this device is an AV Receiver device',
                {
                  device: JSON.stringify(
                    (result.root.device === 'undefined')
                      ? result.root
                      : result.root.device
                  )
                },
                Log.Severity.Warning
              )

              reject('Could not verify that this device is an AV Receiver device')
            } else if (typeof result.root['yamaha:X_device'] === 'undefined') {
              Log.addBreadcrumb(
                'ssdp',
                'yamaha:X_device not found in SSDP XML',
                {},
                Log.Severity.Warning
              )

              reject('The xml does not contain a yamaha:X_device element')
            } else if (typeof result.root['yamaha:X_device'][0]['yamaha:X_URLBase'] === 'undefined') {
              Log.addBreadcrumb(
                'ssdp',
                'yamaha:X_URLBase not found in yamaha:X_device element in SSDP XML',
                {
                  'yamaha:X_device': JSON.stringify(result.root['yamaha:X_device'])
                },
                Log.Severity.Warning
              )

              reject('yamaha:X_URLBase not found in yamaha:X_device element in SSDP XML')
            } else if (
              typeof result.root['yamaha:X_device'][0]['yamaha:X_serviceList'] === 'undefined'
              || typeof result.root['yamaha:X_device'][0]['yamaha:X_serviceList'][0]['yamaha:X_service'] === 'undefined'
            ) {
              Log.addBreadcrumb(
                'ssdp',
                'yamaha:X_serviceList not found in yamaha:X_device element in SSDP XML',
                {
                  'yamaha:X_device': JSON.stringify(result.root['yamaha:X_device'])
                },
                Log.Severity.Warning
              )

              reject('yamaha:X_serviceList not found in yamaha:X_device element in SSDP XML')
            } else {
              let controlURL = null

              device.settings.urlBase = result.root['yamaha:X_device'][0]['yamaha:X_URLBase'][0]

              for (let i in result.root['yamaha:X_device'][0]['yamaha:X_serviceList'][0]['yamaha:X_service']) {
                let service = result.root['yamaha:X_device'][0]['yamaha:X_serviceList'][0]['yamaha:X_service'][i]

                if (
                  typeof service['yamaha:X_specType'] !== 'undefined'
                  && typeof service['yamaha:X_specType'][0] !== 'undefined'
                  && service['yamaha:X_specType'][0] === 'urn:schemas-yamaha-com:service:X_YamahaRemoteControl:1'
                ) {
                  Log.addBreadcrumb(
                    'ssdp',
                    'Found a YamahaRemoteControl service in the yamaha:X_serviceList element in SSDP XML',
                    {
                      specType: service['yamaha:X_specType'][0],
                      controlURL: service['yamaha:X_controlURL'][0]
                    },
                    Log.Severity.Info
                  )

                  controlURL = service['yamaha:X_controlURL'][0]
                }
              }

              if (
                typeof result.root.device !== 'undefined'
                && typeof result.root.device[0] !== 'undefined'
                && typeof result.root.device[0].friendlyName !== 'undefined'
                && typeof result.root.device[0].friendlyName[0] !== 'undefined'
                && typeof result.root.device[0].modelName !== 'undefined'
                && typeof result.root.device[0].modelName[0] !== 'undefined'
              ) {
                let xmlDevices = result.root.device,
                  xmlDevice = xmlDevices[0],
                  friendlyName = xmlDevice.friendlyName[0],
                  modelName = xmlDevice.modelName[0]

                device.name = friendlyName + ' - ' + modelName
              }

              if (controlURL === null) {
                reject('Could not find the YamahaRemoteControl service in SSDP XML')
              } else {
                device.settings.controlURL = controlURL

                Log.addBreadcrumb(
                  'ssdp',
                  'Got all necessary information from SSDP resolving device',
                  {
                    device: device
                  },
                  Log.Severity.Info
                )

                resolve(device)
              }
            }
          })
      }).catch(reject)
    })
  }
}

module.exports = YamahaReceiverDriver
