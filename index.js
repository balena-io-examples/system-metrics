import log from 'loglevel'
import mqtt from 'async-mqtt'
import si from 'systeminformation'
// just for debugging with util.inspect, etc.
//import util from 'util'

log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info')

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
    'mem': 'active',
    'networkStats': 'tx_bytes, rx_bytes'
}

// Character used to separate details from metric, like for 'mem/active'. A detail
// may be an aspect or a function parameter in parentheses.
const detailSeparator = '/'

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
                log.info(`Connected to mqtt://${process.env.MQTT_ADDRESS}`)
            }
            break
        } catch(e) {
            log.warn("Cannot connect to local MQTT:", e)
            if (count < maxTries) {
                log.info(`Retry in ${delay} seconds`)
                await new Promise(r => setTimeout(r, delay * 1000))
            } else {
                log.warn(`Retries exhausted`)
                mqttClient = null  // indicates connection failed
            }
        }
    } while(count < maxTries)
}

/**
 * Parses provided requestText into requestMetrics object and then builds
 * requestQuery object. Expects requestText with comma-separated items in the
 * form '<metric>|<metric>/<aspect>|<metric>/(funcParam), ...', like:
 *
 *    cpuLoad, mem/used, mem/active, mem/(main)
 *
 * If no aspect provided, uses 'defaultAspects' entry for that metric. Generally,
 * function parameters are optional.
 */
function buildRequestMetrics(requestText) {
    const requestList = requestText.split(',').map(x => x.trim())
    
    for (let item of requestList) {
        let metric, detail, funcParam
        // By default, a request is for an explicitly specified aspect-type detail,
        // like 'mem/used'.
        let newRequest = { isDefaultAspect: false, isFuncParam: false }

        // Create a newRequest for the item; determine if has an explicit aspect
        // or function parameter.
        const detailIndex = item.indexOf(detailSeparator)
        if (detailIndex >= 0) {
            metric = item.slice(0, detailIndex)
            detail = item.slice(detailIndex + 1, item.length)
            log.debug(`detail: ${detail}`)
            if (detail[0] == '(' && detail[detail.length - 1] == ')') {
                // trim off the parentheses
                detail = detail.slice(1, detail.length - 1)
                newRequest.isFuncParam = true
            }
        } else {
            metric = item
            detail = defaultAspects[item]
            if (!detail) {
                log.warn(`No default aspect for metric: ${item}`)
                continue
            }
            newRequest.isDefaultAspect = true
        }

        // Add the new request to the global 'requestMetrics'. Uses 'aspects' and
        // 'funcParams' objects to collect the unique elements of each type.
        let requestObject = requestMetrics[metric]
        if (!requestObject) {
            requestObject = newRequest
            requestObject.aspects = {}
            requestObject.funcParams = {}
            requestMetrics[metric] = newRequest
        }
        if (newRequest.isFuncParam) {
            requestObject.funcParams[detail] = null
        } else {
            requestObject.aspects[detail] = null
        }
    }
    log.debug(`requestMetrics: ${JSON.stringify(requestMetrics)}`)

    // Build the global 'requestQuery' object from the collected function parameters
    // and aspects for each metric.
    for (let metric in requestMetrics) {
        // First build function parameters, enclosed in parentheses
        let paramText = ''
        for (let funcParam in requestMetrics[metric].funcParams) {
            if (paramText) {
                paramText = paramText + ', '
            } else {
                paramText = '('
            }
            paramText = paramText + funcParam
        }
        if (paramText) {
            paramText = paramText + ')'
        }

        let queryText = ''
        for (let aspect in requestMetrics[metric].aspects) {
            if (queryText) {
                queryText = queryText + ', '
                // can't use default aspect if more than one aspect for metric
                requestMetrics[metric].isDefaultAspect = false
            }
            queryText = queryText + aspect
        }
        
        requestQuery[metric] = paramText
        if (paramText && queryText) {
            requestQuery[metric] = requestQuery[metric] + ' '
        }
        requestQuery[metric] = requestQuery[metric] + queryText
    }
    log.debug(`requestQuery: ${JSON.stringify(requestQuery)}`)
}

/** Collects metrics and publishes them along with device UUID to MQTT. */
async function publishMetrics() {
    const values = await si.get(requestQuery)
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
        log.debug(`Published msg: ${messageText}`)
    } else {
        log.warn("Can't publish; not connected")
    }
}

async function start() {
    try {
        await connectMqtt()

        let requestText = process.env.METRICS_REQUEST
        if (!requestText) {
            requestText = 'currentLoad, cpuTemperature, mem'
        }
        log.info(`Request text: ${requestText}`)
        buildRequestMetrics(requestText)

        // Reading interval may be supplied in millis or in seconds
        let readingInterval = process.env.READING_INTERVAL_MS
        if (!readingInterval) {
            if (process.env.READING_INTERVAL_SEC) {
                readingInterval = process.env.READING_INTERVAL_SEC * 1000
            }
            if (!readingInterval) {
                readingInterval = 10000
            }
        }
        log.info(`Reading interval: ${readingInterval} ms`)
        if (mqttClient) {
            // Delay before initial publish to allow other services to register
            // MQTT listeners. Publishing at startup is useful when the reading
            // interval is long -- minutes or hours.
            log.debug(`Delay 10 seconds before initial publish`)
            await new Promise(r => setTimeout(r, 10000))
            publishMetrics()
            setInterval(publishMetrics, readingInterval)
        }
    } catch(e) {
        log.error(e)
    }
}

start()

