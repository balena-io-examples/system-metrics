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

async function getCpuUsage() {
    const raw = await si.currentLoad()
    return Math.round(raw.currentLoad)
}

export async function getCpuTemp() {
    const raw = await si.cpuTemperature();
    return Math.round(raw.main);
}

async function publishMetrics() {
    const svLoad = await getCpuUsage()
    const svTemp = await getCpuTemp()
    //await client.publish('sensors', "{'short_uuid': '97c8b8b', 'currentLoad': 10.0}");
    const message = `{"short_uuid": "${shortUuid}", "CPU": ${svLoad}, "Temp": ${svTemp}}`

    if (mqttClient) {
        mqttClient.publish('sensors', message)
        console.log(`Published msg: ${message}`)
    } else {
        console.log("Can't publish; not connected")
    }
}

async function start() {
    try {
        await connectMqtt()
        
        if (mqttClient) {
            setInterval(publishMetrics, 2500)
        }
    } catch(e) {
        console.error(e)
    }
}

start()

