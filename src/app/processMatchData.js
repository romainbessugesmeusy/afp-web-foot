var $ = require('jquery');

module.exports = function (data) {

    data.hasEvents = (data.events.length > 0);
    data.hasPlayers = (data.home.players.length + data.away.players.length > 0);
    data.hasInfos = (data.stadium || data.referees.length > 0);

    data.events.forEach(function (event) {
        if (Array.isArray(event.players)) {
            event.players = event.players.map(function (playerId) {
                var player = {};
                $(data[event.side].players).each(function (i, line) {
                    $(line.players).each(function (j, p) {
                        if (p.id === playerId) {
                            player = p;
                        }
                    })
                });
                return player;
            });
        }
    });
    return data;
};