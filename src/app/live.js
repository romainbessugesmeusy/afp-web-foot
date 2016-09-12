var socket = io(':5000');
var hb = require('../gen/partials');
var $ = require('jquery');
var audio = new Audio('sound.mp3');
socket.on('match', function (data) {
    console.info(data);
    audio.play();
    var partial = data.status === 'EMNCO' ? 'upcomingMatch' : 'pastMatch';
    $('[data-match-id=' + data.id + ']').replaceWith(hb.partials[partial](data));
    $('[data-livematch-id=' + data.id + ']').replaceWith(hb.partials.liveMatch(data));
});