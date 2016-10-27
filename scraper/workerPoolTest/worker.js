var workerUtils = require('node-worker-pool/nodeWorkerUtils');
var Promise = require('promise')
/**
 * Executed once when the worker pool first starts
 * (before any messages are received)
 */
var initData;
function onInitialize(data) {
    initData = data;
}

/**
 * Executed each time a message is received from the worker pool.
 * Returns the response to the message (response must always be an object)
 */
function onMessage(data) {
    return Promise.resolve({
        initData: initData,
        receivedData: data
    });
}

if (require.main === module) {
    try {
        workerUtils.startWorker(onInitialize, onMessage);
    } catch (e) {
        workerUtils.respondWithError(e);
    }
}
