import mqtt from 'async-mqtt'
import si from 'systeminformation'
// just for debugging with util.inspect, etc.
//import util from 'util'

// async wrapper for MQTT client
let mqttClient = null

// A device must have a UUID, but allow none for local testing.
const shortUuid = process.env.BALENA_DEVICE_UUID
        ? process.env.BALENA_DEVICE_UUID.slice(0, Math.min(process.env.BALENA_DEVICE_UUID.length, 7))
        : 'xxxxxxx'

// Dictionary of the aspect of a metric to use as the single default value to collect
const defaultAspects = {
    'cpuTemperature': 'main',
    'currentLoad': 'currentLoad',
    'mem': 'active'
}

// Dictionary of requested metrics as read from input text, including notes from parsing.
// Contains:
// - queryText: actual text for systeminformation
// - isDefaultAspect: boolean for input text requests only the default metric value
let requestMetrics = {}

// Dictionary of request entries as expected by systeminformation.get().
// Derived from requestMetrics.
let requestQuery = {}

/**
 * Connects to local MQTT topic. Retries twice if can't connect.
 *
 * If success, 'mqttClient' is not null.
 */
async function connectMqtt() {
    let count = 0
    const maxTries = 3
    const delay = 5
    do { 
        try {
            count++
            if (!mqttClient) {
                mqttClient = await mqtt.connectAsync(`mqtt://${process.env.MQTT_ADDRESS}`)
                console.log(`Connected to mqtt://${process.env.MQTT_ADDRESS}`)
            }
            break
        } catch(e) {
            console.warn("Cannot connect to local MQTT:", e)
            if (count < maxTries) {
                console.log(`Retry in ${delay} seconds`)
                await new Promise(r => setTimeout(r, delay * 1000))
            } else {
                console.warn(`Retries exhausted`)
                mqttClient = null  // indicates connection failed
            }
        }
    } while(count < maxTries)
}

/**
 * Parses provided requestText into requestMetrics object and then builds
 * requestQuery object.
 */
function buildRequestMetrics(requestText) {
    const requestList = requestText.split(' ')
    
    for (let metric of requestList) {
        let requestObject = {}
        requestObject.queryText = defaultAspects[metric]
        requestObject.isDefaultAspect = true

        if (requestObject.queryText) {
            requestMetrics[metric] = requestObject
        } else {
            console.warn(`Metric name not understood: ${metric}`)
        }
    }
    console.debug(`requestMetrics: ${JSON.stringify(requestMetrics)}`)

    for (let metric in requestMetrics) {
        requestQuery[metric] = requestMetrics[metric].queryText
    }
    console.debug(`requestQuery: ${JSON.stringify(requestQuery)}`)
}

async function publishMetrics() {
    const values = await si.get(requestQuery)
    let message = {}
    message.short_uuid = shortUuid

    // Assumes all metrics are defaults
    for (let metric in values) {
        let key = defaultAspects[metric]
        message[metric] = values[metric][key]
    }

    if (mqttClient) {
        const messageText = JSON.stringify(message)
        mqttClient.publish('sensors', messageText)
        console.log(`Published msg: ${messageText}`)
    } else {
        console.log("Can't publish; not connected")
    }
}

async function start() {
    try {
        await connectMqtt()

        let requestText = process.env.METRICS_REQUEST
        if (!requestText) {
            requestText = 'currentLoad cpuTemperature mem'
        }
        buildRequestMetrics(requestText)
        
        if (mqttClient) {
            setInterval(publishMetrics, 2500)
        }
    } catch(e) {
        console.error(e)
    }
}

start()

