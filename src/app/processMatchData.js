var $ = require('jquery');
var setMatchWinner = require('./setMatchWinner');


module.exports = function (data) {

    if(data.away.goals < 0 && data.home.goals < 0){
        delete data.away.goals;
        delete data.home.goals;
    }
    data.hasEvents = (data.events.length > 0);
    data.hasPlayers = (data.home.players.length + data.away.players.length > 0);
    data.hasInfos = (data.stadium || data.referees.length > 0);
    data.playerHash = {};

    setMatchWinner(data);

    ['home', 'away'].forEach(function (side) {
        data[side].players.forEach(function (line) {
            if (line && Array.isArray(line.players)) {
                line.players.forEach(function (player) {
                    data.playerHash[player.id] = player;
                });
            }
        });
        data[side].subs.forEach(function (sub) {
            data.playerHash[sub.id] = sub;
        });
    });

    data.events.forEach(function (event) {
        if (Array.isArray(event.players)) {
            event.players = event.players.map(function (playerId) {
                if(typeof data.playerHash[playerId] === 'undefined'){
                    console.warn('undefined player', playerId);
                }
                return data.playerHash[playerId];
            });
        }
    });

    console.info('processedMatchData', data);
    return data;
};