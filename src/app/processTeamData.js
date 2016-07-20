var moment = require('moment');

var setMatchWinner = require('./setMatchWinner');

module.exports = function processTeamData(data) {

    data.competitions.forEach(function (competition) {
        competition.matches.forEach(function (match) {
            if (match.status === 'EMNCO') {
                match.time = moment(match.date).format('DD MMM')
            } else {
                setMatchWinner(match);
            }
        });
    });
    return data;
};