var NRP = require('node-redis-pubsub');
var config = {host: '10.3.3.3'};

var nrp = new NRP(config); // This is the NRP client

module.exports = function (channel, handler) {
    nrp.on(channel, handler)
};