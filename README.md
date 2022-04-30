# System Metrics Block

*Collect metrics on device performance*

Utilities like [systeminformation](https://systeminformation.io/) can collect device performance metrics like CPU load, network throughput, and available storage. The System Metrics block uses systeminformation to forward metrics to the balenaBlock ecosystem via MQTT. From there you can graph the data or forward it to the cloud with one of the other available blocks.

## Setup and configuration

Running this project is as simple as deploying it to a balenaCloud application. You can do it in just one click by using the button below:

[![deploy button](https://balena.io/deploy.svg)](https://dashboard.balena-cloud.com/deploy?repoUrl=https://github.com/balena-io-examples/system-metrics&defaultDeviceType=raspberry-pi)

### Provision your device

![sdcard](https://raw.githubusercontent.com/balena-io-examples/system-metrics/master/doc/images/sdcard.gif)

Once your application has been created you'll need to add a device to it:

1. Add a device to the application by clicking the `add device` button
2. Download the OS and flash it to your SD card with [balenaEtcher](https://balena.io/etcher)
3. Power up your device and check it's online in the dashboard!

The system-metrics application will start downloading as soon as your device appears in the dashboard.

## Getting Started

We will use a docker-compose [example script](doc/simple-example/docker-compose.yml) that uses the metrics block to collect CPU load and temperature, and then forwards it to a spearate MQTT broker container. First create a multi-container fleet in balenaCloud and provision a device with balenaOS. See the [online docs](https://www.balena.io/docs/learn/getting-started/raspberrypi3/nodejs/) for details.

Next push the docker-compose script to the balena builders, substituting your fleet's name for `<myFleet>` in the commands below.

```
    git clone https://github.com/balena-io-examples/system-metrics.git
    cd system-metrics/doc/simple-example
    balena push <myFleet>
```

You should see data flowing to the MQTT broker like the log output below.

```
Published msg: {'short_uuid': 04166f8, 'CPU': 0, 'Temp': 31}
Published msg: {'short_uuid': 04166f8, 'CPU': 1, 'Temp': 32}
```

## Configuration
Environment variables you may configure are listed below. Variables may be defined as balena **Fleet** variables or **Device** variables. Presently the metrics collection interval is 2.5 seconds.

**METRICS_REQUEST**,  default `currentLoad cpuTemperature mem` 

Requests the default aspect for each provided metric. Metric names use the function name from the systeminformation project, for example [cpuTemperature](https://systeminformation.io/cpu.html).

Presently the only available metrics are as listed for the default value. The `mem` metric value is the *active* memory for the device: used memory less cache and buffers.


## Next Steps
We also have created a docker-compose [script](doc/balenaSense-example/docker-compose.yml) that integrates with the balenaSense application. You should be able to simply push that script like the example above to see the data graphically.