var async = require('async');

module.exports = function (options) {

    function extractScoreboardTeamInfo(team) {
        var obj = {
            name: team.TeamName,
            goals: team.TeamScore,
            penaltyShootoutScore: team.TeamTabScore,
            cards: {
                yellow: team.TeamNbYellowCards,
                red: team.TeamNbRedCards
            }
        };

        if (obj.penaltyShootoutScore === null) {
            delete obj.penaltyShootoutScore;
        }

        if (obj.goals === null) {
            delete obj.goals;
        }

        if (obj.cards.yellow + obj.cards.red === 0) {
            delete obj.cards;
        }

        return obj;
    }

    function getAllMatchDates(dates, evenements) {
        return function (allMatchDatesCb) {
            evenements.forEach(function (evenement) {
                evenement.phases.forEach(function (phase) {
                    phase.matches.forEach(function (match) {

                        var day = match.Date.substring(0, 10);
                        var time = match.Date.substr(11, 5);

                        if (typeof dates[day] === 'undefined') {
                            dates[day] = []
                        }
                        dates[day].push({
                            id: match.Id,
                            time: time,
                            competition: evenement.id,
                            home: extractScoreboardTeamInfo(match.Home),
                            away: extractScoreboardTeamInfo(match.Away)
                        });
                    });
                })
            });
            allMatchDatesCb();
        }
    }

    function getEvenementsScoreboard(processed, raw) {
        return function (evenementsCb) {
            raw.forEach(function (evenement) {
                processed[evenement.id] = {
                    id: evenement.id,
                    label: evenement.Label,
                    country: evenement.CountryIso
                };
            });
            evenementsCb();
        }
    }

    return function transform(transformCb) {
        return function (evenements) {
            var files = {
                scoreboard: {
                    dates: {},
                    competitions: {}
                }
            };
            async.parallel([
                getAllMatchDates(files.scoreboard.dates, evenements),
                getEvenementsScoreboard(files.scoreboard.competitions, evenements)
            ], function () {
                transformCb(files);
            });
        }
    }

};