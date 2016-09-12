var socket = io(':5000');
var hb = require('../gen/partials');
var $ = require('jquery');

socket.on('match', function (data) {
    var partial = data.status === 'EMNCO' ? 'upcomingMatch' : 'pastMatch';
    $('[data-match-id=' + data.id + ']').replaceWith(hb.partials[partial](data));
});