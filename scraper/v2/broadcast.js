var socket = require('socket.io-client').connect('http://localhost:5000');

module.exports = function broadcast(event, payload) {
    socket.emit('broadcast', event, payload, function (ret) {
        console.info('dispatch event', event, 'to', ret, 'connected users');
    });
};