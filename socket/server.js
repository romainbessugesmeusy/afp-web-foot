var io = require('socket.io')(5000);
io.on('connection', function (socket) {
    console.info('user connected');
    socket.on('disconnect', function () {
        console.log('user disconnected');
    });
});

module.exports = function broadcast(event, payload) {
    io.emit(event, payload);
};
