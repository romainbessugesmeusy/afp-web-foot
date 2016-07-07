var async = require('async');
var extend = require('extend');

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

    function eachMatches(evenements, callback) {
        evenements.forEach(function (evenement) {
            evenement.phases.forEach(function (phase) {
                phase.matches.forEach(function (match) {
                    callback(evenement, phase, match);
                })
            });
        });
    }

    function getAllMatchDates(dates, evenements) {
        return function (allMatchDatesCb) {
            eachMatches(evenements, function (evenement, phase, match) {
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

    function getTeamDetail(match, team) {
        if (typeof match[team] === 'undefined') {
            return null;
        }
        var teamDetail = {
            id: match[team].TeamId,
            players: match[team].TeamCompo.map(function (player) {
                return {
                    id: player.Id,
                    number: player.Bib,
                    position: player.Index + ',' + player.Line,
                    name: player.LongName || player.LomgName,
                    role: player.PositionCode
                }
            }),
            name: match[team].TeamName,
            goals: match[team].TeamScore,
            penaltyShootoutGoals: match[team].TeamTabScore
        };

        if (teamDetail.penaltyShootoutGoals < 0) {
            delete teamDetail.penaltyShootoutGoals;
        }
        return teamDetail;
    }

    function getMatches(matchesFileArray, evenements) {
        return function (eachMatchCb) {
            eachMatches(evenements, function (evenement, phase, match) {
                var data = {
                    id: match.Id,
                    competition: {
                        id: evenement.id,
                        date: match.Date,
                        label: evenement.label,
                        country: evenement.CountryIso
                    },
                    phase: {
                        type: phase.PhaseCompetCode
                    },
                    referees: match.Arbitres.map(function (arbitre) {
                        return {
                            role: arbitre.PositionCode,
                            country: arbitre.CountryIso,
                            name: arbitre.LomgName || arbitre.LongName
                        }
                    }),
                    stadium: match.Stadium.Id,
                    home: getTeamDetail(match, 'Home'),
                    away: getTeamDetail(match, 'Away'),
                    events: match.Events.map(function (evt) {
                        var event = {
                            time: evt.Minute,
                            period: evt.PeriodCode,
                            players: [],
                            type: evt.TypeEvtCode,
                            side: (evt.TeamId === match.Home.TeamId) ? 'home' : 'away'
                        };

                        if (evt.PlayerId1) {
                            event.players.push(evt.PlayerId1);
                        }
                        if (evt.PlayerId2) {
                            event.players.push(evt.PlayerId2);
                        }
                        if (evt.PlayerId3) {
                            event.players.push(evt.PlayerId2);
                        }

                        return event;
                    }),
                    raw: match
                };

                matchesFileArray.push({
                    name: 'matches/' + match.Id,
                    data: data
                })
            });
            eachMatchCb();
        }
    }

    return function transform(transformCb) {
        return function (evenements) {
            var files = {
                scoreboard: {
                    dates: {},
                    competitions: {}
                },
                matches: []
            };
            async.parallel([
                getAllMatchDates(files.scoreboard.dates, evenements),
                getEvenementsScoreboard(files.scoreboard.competitions, evenements),
                getMatches(files.matches, evenements)
            ], function () {
                transformCb(files);
            });
        }
    }

};