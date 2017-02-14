var io = require('socket.io')(5000);
io.on('connection', function (socket) {
    socket.on('broadcast', function (event, payload, fn) {
        io.emit(event, payload);
        fn(io.engine.clientsCount);
    });
});