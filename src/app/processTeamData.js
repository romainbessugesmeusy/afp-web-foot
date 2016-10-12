module.exports = function processTeamData(data) {

    var competitionsToRemove = [];

    for (var eventId in data.competitions) {
        if (!data.competitions.hasOwnProperty(eventId)) {
            continue;
        }

        if (window.config.evts.indexOf(parseInt(eventId)) === -1) {
            competitionsToRemove.push(eventId);
            continue;
        }


        var competition = data.competitions[eventId];
        competition.staff = competition.staff.map(function (playerId) {
            return data.staffMap[playerId];
        });

        var now = new Date();
        competition.isCurrent = new Date(competition.startDate) < now && new Date(competition.endDate) > now;
    }

    competitionsToRemove.forEach(function (id) {
        delete data.competitions[id];
    });
    return data;
};