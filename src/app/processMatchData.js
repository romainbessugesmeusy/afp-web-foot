var $ = require('jquery');

module.exports = function (data) {
    data.events.forEach(function (event) {
        event.players = event.players.map(function (playerId) {
            var player = {};
            $(data[event.side].players).each(function (i, p) {
                if (p.id === playerId) {
                    player = p;
                }
            });
            return player;
        });
    });

    ['home', 'away'].forEach(function (side) {
        var team = data[side];
        team.positions = [];
        $(team.players).each(function (i, player) {
            var coordinates = player.position.split(',');
            if (player.number && coordinates[1] !== '0') {
                if (typeof team.positions[coordinates[1]] === 'undefined') {
                    team.positions[coordinates[1]] = [];
                }
                team.positions[coordinates[1]].push({
                    index: parseInt(coordinates[0]),
                    player: player
                });
            } else {
                // todo remplaçants
            }
        });


        team.positions = team.positions.map(function (row) {
            row.sort(function (a, b) {
                return a.index - b.index;
            });

            return row.map(function (obj) {
                return obj.player;
            });
        });

        team.positions.reverse();


    });

    console.info(data);
    return data;
};