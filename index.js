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

// Character used to separate aspect from metric, like for 'mem/active'.
const aspectSeparator = '/'

// Dictionary of requested metrics as read from input text, including notes from parsing.
// Contains:
// - aspects: object of aspect names to include; value of property is not used
// - isDefaultAspect: boolean for input text requests only the default metric value, like 'mem'
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
 * requestQuery object. Expects requestText with space-separated items in the
 * form '<metric>|<metric>/<aspect> ...', like:
 *
 *    cpuLoad mem/used mem/active
 *
 * If no aspect provided, uses 'defaultAspects' for that metric.
 */
function buildRequestMetrics(requestText) {
    const requestList = requestText.split(' ')
    
    for (let item of requestList) {
        let metric, aspect
        let newRequest = {}

        // Create a newRequest for the item; determine if has an explicit aspect.
        const aspectIndex = item.indexOf(aspectSeparator)
        if (aspectIndex >= 0) {
            metric = item.slice(0, aspectIndex)
            aspect = item.slice(aspectIndex + 1, item.length)
            newRequest.isDefaultAspect = false
        } else {
            metric = item
            aspect = defaultAspects[item]
            if (!aspect) {
                console.warn(`No default aspect for metric: ${item}`)
                continue
            }
            newRequest.isDefaultAspect = true
        }

        // Add the new request to the global 'requestMetrics'. Uses an 'aspects' object
        // to collect the unique aspects.
        let requestObject = requestMetrics[metric]
        if (!requestObject) {
            requestObject = newRequest
            requestObject.aspects = {}
            requestMetrics[metric] = newRequest
        }
        requestObject.aspects[aspect] = null
    }
    console.debug(`requestMetrics: ${JSON.stringify(requestMetrics)}`)

    // Build the global 'requestQuery' object from the collected aspects for each metric.
    for (let metric in requestMetrics) {
        let queryText = ''
        for (let aspect in requestMetrics[metric].aspects) {
            if (queryText) {
                queryText = queryText + ', '
                // can't use default aspect if more than one aspect for metric
                requestMetrics[metric].isDefaultAspect = false
            }
            queryText = queryText + aspect
        }
        requestQuery[metric] = queryText
    }
    console.debug(`requestQuery: ${JSON.stringify(requestQuery)}`)
}

async function publishMetrics() {
    const values = await si.get(requestQuery)
    console.debug(`values: ${JSON.stringify(values)}`)
    let message = {}
    message.short_uuid = shortUuid

    for (let metric in values) {
        const metricValues = values[metric]
        for (let aspect in metricValues) {
            // Don't use aspect in property name if request uses default aspect, like 'mem'.
            // There will be only a single aspect for this metric.
            if (requestMetrics[metric].isDefaultAspect) {
                message[metric] = metricValues[aspect]
            } else {
                message[`${metric}/${aspect}`] = metricValues[aspect]
            }
        }
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

