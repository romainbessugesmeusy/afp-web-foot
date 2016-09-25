var setMatchWinner = require('../../src/app/setMatchWinner');
var extractScoreboardTeamInfo = require('./extractScoreboardTeamInfo');

module.exports = function createLightMatch(eventId, phaseCode, match) {
    var m = {
        id: match.Id,
        date: match.Date,
        time: match.Minute,
        competition: eventId,
        phase: phaseCode,
        group: match.GroupId,
        status: match.StatusCode,
        dayOfCompetition: match.Journee,
        home: extractScoreboardTeamInfo(match.Home),
        away: extractScoreboardTeamInfo(match.Away)
    };

    setMatchWinner(m);
    return m;
};