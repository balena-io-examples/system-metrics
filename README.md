# System Metrics Block

*Collect metrics on device performance*

Utilities like [systeminformation](https://systeminformation.io/) can collect device performance metrics like CPU load, network throughput, and available storage. The System Metrics block uses systeminformation to forward metrics to the balenaBlock ecosystem via MQTT. From there you can graph the data or forward it to the cloud with one of the other available blocks.

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

List of metrics to collect, comma separated. Defaults to `currentLoad, cpuTemperature, mem`. Each metric must be specified in one of two forms:

| Form | Example | Notes |
| ---- | ------- | ----- |
| metric/aspect| `cpuTemperature/max` ||
| metric |`cpuTemperature` |Uses the default aspect; for cpuTemperature this aspect is `main`|

A `metric` is a function name from the systeminformation project, for example [cpuTemperature](https://systeminformation.io/cpu.html). An `aspect` is a particular result object for the metric as shown in the documentation.

Not all systeminformation metrics have a default value.

### READING_INTERVAL_MS

Interval between metrics readings, in milliseconds. Defaults to `10000`.


## Next Steps
We also have created a docker-compose [script](doc/balenaSense-example/docker-compose.yml) that integrates with the balenaSense application. You should be able to simply push that script like the example above to see the data graphically.