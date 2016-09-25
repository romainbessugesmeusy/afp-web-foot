var socket = io(':5000');
var hb = require('../gen/partials');
var $ = require('jquery');
var audio = new Audio('sound.mp3');

var playSound = function () {
    try {
        //audio.play();
    } catch (err) {
        console.err(err);
    }
}
socket.on('match', function (data) {
    console.info(data);
    playSound();
    var partial = data.status === 'EMNCO' ? 'upcomingMatch' : 'pastMatch';
    $('[data-match-id=' + data.id + ']').replaceWith(hb.partials[partial](data));
    $('[data-livematch-id=' + data.id + ']').replaceWith(hb.partials.liveMatch(data));
});

socket.on('scoreboard', function (data) {
    console.info(data);
    playSound()
});

socket.on('event', function (data) {
    console.info(data);
    playSound();
});