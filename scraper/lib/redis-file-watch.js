var NRP = require('node-redis-pubsub');
var config = {host: '10.3.3.3'};
var nrp = new NRP(config);
module.exports = function (channel, handler) {
    nrp.on(channel, function (filename) {
        console.info('redis watch', channel, filename);
        handler(filename, channel);
    });
}