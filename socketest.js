var io = require('socket.io')(5000);
var client = require('socket.io-client');
var socket = client.connect('http://localhost:5000');

// console.log(socket.id); // undefined
//
// socket.on('connect', function(){
//     console.log(socket.id); // 'G5p5...'
// });

socket.emit('ferret', 'slkfgjqsd', function (data) {
    console.log(data); // data will be 'woot'
});

// server:
 io.on('connection', function (socket) {
   socket.on('ferret', function (name, fn) {
     fn('woot ' +  name);
   });
 });