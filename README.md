# System Metrics Block

*Collect metrics on device performance*

Utilities like [systeminformation](https://systeminformation.io/) can collect device performance metrics like CPU load, network throughput, and available storage. The System Metrics block uses systeminformation to forward metrics to the balenaBlock ecosystem via MQTT. From there you can graph the data or forward it to the cloud with one of the other available blocks.

Alternatively, when available resources are constrained, the block may be run as a standalone service. See the MQTT_ADDRESS variable in the Configuration section below.

## Getting Started

We will use a docker-compose [example script](doc/simple-example/docker-compose.yml) that uses the system metrics block to collect CPU load and temperature and available memory, and then forwards it to a separate MQTT broker container. First create a multi-container fleet in balenaCloud and provision a device with balenaOS. See the [online docs](https://www.balena.io/docs/learn/getting-started/raspberrypi3/nodejs/) for details.

Next push the docker-compose script to the balena builders, substituting your fleet's name for `<myFleet>` in the commands below.

```
    git clone https://github.com/balena-io-examples/system-metrics.git
    cd system-metrics/doc/simple-example
    balena push <myFleet>
```

You should see data flowing to the MQTT broker like the log output below.

```
Published msg: {'short_uuid': 04166f8, "currentLoad":0.8995528642244212,"cpuTemperature":32.9,"mem":4762161152}
Published msg: {'short_uuid': 04166f8, "currentLoad":0.5756115873115185,"cpuTemperature":32.9,"mem":4762664960}
```

## Configuration
Environment variables you may configure are listed in the sections below. Variables may be defined as balena **Fleet** variables or **Device** variables.

### METRICS_REQUEST

List of metrics to collect, comma separated. A `metric` is a function name from the systeminformation project, for example [cpuTemperature](https://systeminformation.io/cpu.html). Defaults to `currentLoad, cpuTemperature, mem`. Each metric must be specified in one of these forms:

| Form | Example | Notes |
| ---- | ------- | ----- |
| metric/aspect| `cpuTemperature/max` |An `aspect` is a particular result object for the metric as shown in the documentation.|
| metric |`cpuTemperature` |Uses the default aspect; for cpuTemperature this aspect is `main`. See [list](https://github.com/balena-io-examples/system-metrics/blob/d865284dffd83dc6b917ea78dc24c022cb432851/index.js#L15) of metrics with a default aspect.|
| metric/(function parameter)| `networkStats/(wlp0s20f3)` |Some systeminformation metric functions accept parameters to qualify the source of reported data. In the example, `wlp0s20f3` is the WiFi interface. The function parameter applies to all requested aspects for the metric.|

### READING_INTERVAL_SEC

Interval between metrics readings, in seconds. Defaults to `10`. The container also initially waits 10 seconds before the first reading.

Alternatively, you may define the reading interval in milliseconds with the variable `READING_INTERVAL_MS`.

### LOG_LEVEL

Runtime logging level, one of `error`, `warn`, `info`, `debug`, `trace`; defaults to `info`.

### MQTT_ADDRESS

This variable is required for services to find the MQTT broker. Usually it is defined in the `docker-compose.yml` file, like in the [example](doc/simple-example/docker-compose.yml), so you don't need to explicitly define it for a fleet. However, you also may run System Metrics as a standalone block that outputs to the system log. In this case either don't define MQTT_ADDRESS in your `docker-compose.yml`, or override it to be blank for the fleet or device.

## Next Steps
We also have created a docker-compose [script](doc/balenaSense-example/docker-compose.yml) that integrates with the balenaSense application. You should be able to simply push that script like the example above to see the data graphically.