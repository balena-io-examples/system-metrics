# System Metrics Block

*Collect metrics on device performance*

Utilities like [systeminformation](https://systeminformation.io/) can collect device performance metrics like CPU load, network throughput, and available storage. The System Metrics block uses systeminformation to forward metrics to the balenaBlock ecosystem via MQTT. From there you can graph the data or forward it to the cloud with one of the other available blocks.

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
There is nothing to configure at present. CPU load and temperature are collected every 30 seconds.

## Next Steps
We also have created a docker-compose [script](doc/balenaSense-example/docker-compose.yml) that integrates with the balenaSense application. You should be able to simply push that script like the example above to see the data graphically.

## Publish to DBus (experimental)
Added experimental support for publishing to DBus. This support would be convenient for the Supervisor to collect metrics since it already uses DBus. Presently publishes CPU temperature readings every 10 seconds to the `io.balena.system_metrics.values` interface.

### Setup
The DBus configuration is defined in `conf/system-metrics.conf`. You must manually install this configuration with the steps below:

```
mount -o remount,rw /
# copy conf file to /etc/dbus-1/system.d directory
mount -o remount,ro /
systemctl restart dbus.service
```

After these steps you should see the temperature readings in `dbus-monitor`.

```
dbus-monitor --system interface='io.balena.system_metrics.values'
```