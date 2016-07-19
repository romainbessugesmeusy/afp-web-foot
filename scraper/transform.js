var async = require('async');
var extend = require('extend');

module.exports = function (options) {

    function extractScoreboardTeamInfo(team) {
        var obj = {
            name: (team.TeamName === '?') ? null : team.TeamName,
            goals: (team.TeamScore === -1) ? null : team.TeamScore,
            penaltyShootoutScore: team.TeamTabScore,
            cards: {
                yellow: team.TeamNbYellowCards,
                red: team.TeamNbRedCards
            }
        };

        if (obj.penaltyShootoutScore === null || obj.penaltyShootoutScore === -1) {
            delete obj.penaltyShootoutScore;
        }

        if (obj.goals === null) {
            delete obj.goals;
        }

        if (obj.cards.yellow === 0) {
            delete obj.cards.yellow;
        }

        if (obj.cards.red === 0) {
            delete obj.cards.red;
        }

        return obj;
    }

    function eachMatches(evenements, callback) {
        evenements.forEach(function (evenement) {
            evenement.phases.forEach(function (phase) {
                if (typeof phase.matches === 'undefined') {
                    console.error('Phase with undefined matches');
                    console.error(evenement);
                    process.exit();
                }
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
                    phase: phase.PhaseCompetCode,
                    group: match.GroupId,
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

    function getTeamFromEventStats(evenement, teamId) {
        var team = null;
        evenement.statistiques.forEach(function (t) {
            if (t.TeamId === teamId) {
                team = t;
            }
        });
        return team;
    }


    function getTeamDetail(evenement, phase, match, team) {
        if (typeof match[team] === 'undefined' || match[team].TeamId === 0) {
            return {};
        }
        var teamDetail = {
            id: match[team].TeamId,
            name: match[team].TeamName,
            goals: match[team].TeamScore,
            penaltyShootoutGoals: match[team].TeamTabScore
        };

        if (teamDetail.penaltyShootoutGoals < 0 || teamDetail.penaltyShootoutGoals === null) {
            delete teamDetail.penaltyShootoutGoals;
        }

        if(teamDetail.goals > 0){
            teamDetail.scorers = [];
            match.Events.forEach(function(event){
                if(event.TeamId === teamDetail.id && (event.TypeEvtCode === 'VTBUT' || event.TypeEvtCode === 'VTPEN')){
                    teamDetail.scorers.push({
                        time: event.Minute,
                        player: event.PlayerId1,
                        penalty: event.TypeEvtCode === 'VTPEN'
                    })
                }
            });
            teamDetail.scorers.reverse()
        }

        var teamFromStats = getTeamFromEventStats(evenement, match[team].TeamId);

        if (teamFromStats === null) {
            return teamDetail;
        }

        var playersFromStats = {};

        teamFromStats.Staff.forEach(function (player) {
            playersFromStats[player.Id] = player;
        });

        extend(teamDetail, getTeamStaff(match, teamFromStats.Staff, match[team]));

        return teamDetail;
    }

    function getTeamStaff(match, staff, team) {

        var playerEvents=  {};
        var playerEventTypes = ['VTJAU', 'VTBUT', 'VTROU'];

        match.Events.forEach(function(event){
            if(playerEventTypes.indexOf(event.TypeEvtCode) > -1){
                if(typeof playerEvents[event.PlayerId1] === 'undefined'){
                    playerEvents[event.PlayerId1] = [];
                }
                playerEvents[event.PlayerId1].push({type: event.TypeEvtCode, minute: event.Minute});
            }
        });

        var ret = {
            staff: [],
            players: [],
            subs: []
        };

        var playersInCompo = {};
        team.TeamCompo.forEach(function (player) {
            playersInCompo[player.Id] = player;
        });

        function transformPlayerInfo(member) {
            return {
                id: member.Id,
                number: member.Bib,
                name: member.NomCourt,
                fullname: member.NomLong,
                position: member.PositionCode,
                faceshot: member.Faceshot,
                birthDate: member.DateDeNaissance,
                events: playerEvents[member.Id]
            }
        }

        function transformStaffInfo(member) {
            return {
                id: member.Id,
                name: member.NomCourt,
                fullname: member.NomLong,
                position: member.PositionCode,
                faceshot: member.Faceshot,
                birthCountry: member.PaysNaissanceIso,
                birthDate: member.DateDeNaissance,
                representedCountry: member.PaysRepresenteIso,
                data: member
            }
        }

        staff.forEach(function (member) {
            if (typeof playersInCompo[member.Id] === 'undefined' || playersInCompo[member.Id].Line === 0) {
                if (member.PositionCode !== 'PSENT') {
                    ret.subs.push(transformPlayerInfo(member))
                } else {
                    ret.staff.push(transformStaffInfo(member));
                }
            } else {
                var player = transformPlayerInfo(member);
                var playerInCompo = playersInCompo[member.Id];
                if (typeof ret.players[playerInCompo.Line] === 'undefined') {
                    ret.players[playerInCompo.Line] = {
                        line: playerInCompo.PositionCode,
                        players: []
                    }
                }
                ret.players[playerInCompo.Line].players.push(player)
            }
        });

        ret.players.shift();
        ret.players.reverse();
        return ret;

    }

    function getEvenementMetaData(evenement, dataCode) {
        var value = null;
        evenement.ExtData.forEach(function (extData) {
            if (extData.ExtDataCode === dataCode) {
                value = extData.ValTxt;
            }
        });
        return value;
    }

    function getPenaltyShootouts(match) {
        if (!Array.isArray(match.Tabs)) {
            return null;
        }
        var counter = 0;
        var ret = {home: [], away: []};

        match.Tabs.forEach(function (tabEvent) {
            var side = (tabEvent.TeamId === match.Home.TeamId) ? 'home' : 'away';
            var shootout = {
                player: tabEvent.PlayerId,
                number: Math.floor(counter / 2) + 1
            };

            if (tabEvent.TypeEvtCode === 'VTTAX') {
                shootout.missed = tabEvent.ExtTypeEvtCode;
            }

            counter++;
            ret[side].push(shootout);
        });

        if (ret.home.length + ret.away.length === 0) {
            return null;
        }

        return ret;
    }


    function getMatches(matchesFileArray, evenements) {
        return function (eachMatchCb) {
            eachMatches(evenements, function (evenement, phase, match) {
                match.Arbitres = match.Arbitres || [];
                match.Events = match.Events || [];

                var data = {
                    id: match.Id,
                    status: match.StatusCode,
                    competition: {
                        id: evenement.id,
                        date: match.Date,
                        label: evenement.label,
                        country: evenement.CountryIso,
                        code: getEvenementMetaData(evenement, 'EDFTP')
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
                    stadium: {
                        id: match.Stadium.Id,
                        name: match.Stadium.Name,
                        city: match.Stadium.CityName,
                        country: match.Stadium.CountryIso
                    },
                    home: getTeamDetail(evenement, phase, match, 'Home'),
                    away: getTeamDetail(evenement, phase, match, 'Away'),
                    penaltyShootouts: getPenaltyShootouts(match),
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
                    })/*,
                     raw: match*/
                };

                var commentsBeforeKickoff = [];
                var commentEvents = [];
                var commentsAfterMatch = [];
                var commentIsMappedToExistingEvent;

                var beforeKickoff = true;

                data.hasComments = match.Comments.length > 0;

                if (Array.isArray(match.Comments)) {
                    match.Comments.forEach(function (comment) {

                        commentIsMappedToExistingEvent = false;
                        data.events.forEach(function (event) {
                            if (comment.props.time == event.time && comment.props.event == event.type) {
                                commentIsMappedToExistingEvent = true;
                                event.comment = comment;
                            }
                        });

                        var isHourAndMinutes = (comment.props.time.indexOf(':') > -1);
                        var time = parseFloat(String(comment.props.time).replace('+', '.'));

                        if (commentIsMappedToExistingEvent === false) {
                            if (time === 0 || isNaN(time) || isHourAndMinutes) {
                                if (beforeKickoff) {
                                    commentsBeforeKickoff.push(comment);
                                } else {
                                    commentsAfterMatch.push(comment);
                                }
                            } else {
                                beforeKickoff = false;
                                commentEvents.push({
                                    time: comment.props.time,
                                    comment: comment,
                                    side: 'both'
                                });
                            }
                        }
                    });
                }

                data.events = data.events.concat(commentEvents);

                if (commentsBeforeKickoff.length) {
                    data.events.push({
                        time: '-1000',
                        group: 'pre',
                        side: 'both',
                        comments: commentsBeforeKickoff
                    });
                }
                if (commentsAfterMatch.length) {
                    data.events.push({
                        time: '1000',
                        group: 'post',
                        side: 'both',
                        comments: commentsAfterMatch
                    });
                }

                data.events.sort(function (a, b) {
                    var aTime = parseFloat(String(a.time).replace('+', '.'));
                    var bTime = parseFloat(String(b.time).replace('+', '.'));
                    return bTime - aTime;
                });

                data.raw = match;

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
            console.info('TRANSFORM START', new Date());
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
                console.info('TRANSFORM END', new Date());
                transformCb(files);
            });
        }
    }

};