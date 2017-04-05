var NRP = require('node-redis-pubsub');
var config = {host: '10.3.3.3'};
var nrp = new NRP(config);
module.exports = nrp.on;