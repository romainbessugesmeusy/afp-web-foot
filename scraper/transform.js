var async = require('async');
var extend = require('extend');
var moment = require('moment');
var setMatchWinner = require('../src/app/setMatchWinner');
var unique = require('array-unique');
var extractScoreboardTeamInfo = require('./lib/extractScoreboardTeamInfo');

function eachMatches(evenements, callback) {
    evenements.forEach(function (evenement) {
        evenement.phases.forEach(function (phase) {
            phase.matches.forEach(function (match) {
                callback(evenement, phase, match);
            })
        });
    });
}

function getAllMatchDates(evenements) {
    var dates = {};
    eachMatches(evenements, function (evenement, phase, match) {
        var day = match.Date.substring(0, 10);
        var time = match.Date.substr(11, 5);

        if (typeof dates[day] === 'undefined') {
            dates[day] = []
        }

        var scoreboardMatch = {
            id: match.Id,
            date: match.Date,
            time: match.Minute,
            competition: evenement.id,
            phase: phase.PhaseCompetCode,
            group: match.GroupId,
            status: match.StatusCode,
            home: extractScoreboardTeamInfo(match.Home),
            away: extractScoreboardTeamInfo(match.Away),
            now: new Date()
        };

        setMatchWinner(scoreboardMatch);
        dates[day].push(scoreboardMatch);
    });
    return dates;
}

function getEvenementsScoreboard(evenements) {
    var competitions = {};
    evenements.forEach(function (evenement) {
        competitions[evenement.id] = {
            id: evenement.id,
            label: evenement.Label,
            country: evenement.CountryIso
        };
    });

    return competitions;
}

function getTeamFromEventStats(evenement, teamId) {
    var team = null;
    evenement.Equipes.forEach(function (t) {
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
        penaltyShootoutGoals: match[team].TeamTabScore,
        qualified: match[team].TeamStatusCode === 'PAWIN'
    };

    if (teamDetail.penaltyShootoutGoals < 0 || teamDetail.penaltyShootoutGoals === null) {
        delete teamDetail.penaltyShootoutGoals;
    }

    if (teamDetail.goals > 0) {
        teamDetail.scorers = [];
        match.Events.forEach(function (event) {
            console.info(event.TypeEvtCode);
            if(event.TypeEvtCode === 'VTCSC'){
                console.info(event, teamDetail.id);
            }
            if (event.TeamId === teamDetail.id && ['VTBUT', 'VTPEN', 'VTCSC'].indexOf(event.TypeEvtCode) > -1) {
                teamDetail.scorers.push({
                    time: event.Minute,
                    player: event.PlayerId1,
                    penalty: event.TypeEvtCode === 'VTPEN',
                    og: event.TypeEvtCode === 'VTCSC'
                });
            }
        });
        teamDetail.scorers.reverse()
    }


    var teamFromStats = getTeamFromEventStats(evenement, match[team].TeamId);

    if (teamFromStats === null) {
        return teamDetail;
    }

    extend(teamDetail, getTeamStaff(match, teamFromStats.Staff, match[team]));

    teamFromStats = null;

    return teamDetail;
}

function getTeamStaff(match, staff, team) {

    var playerEvents = {};
    var playerEventTypes = ['VTJAU', 'VTBUT', 'VTROU'];
    match.Events.forEach(function (event) {
        if (playerEventTypes.indexOf(event.TypeEvtCode) > -1) {
            if (typeof playerEvents[event.PlayerId1] === 'undefined') {
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

    function transformPlayerInfoFromCompo(player) {
        return {
            id: player.Id,
            name: player.ShortName,
            fullname: player.LomgName || player.LongName,
            number: player.Bib,
            position: player.PositionCode,
            events: []
        }
    }

    var foundPlayerIdsInStaff = [];
    var staffPositionCodes = ['PSENT', 'PSADJ', 'PSPRE', 'PSMAN'];

    staff.forEach(function (member) {
        foundPlayerIdsInStaff.push(member.Id);
        if (typeof playersInCompo[member.Id] === 'undefined' || playersInCompo[member.Id].Line === 0) {
            if (staffPositionCodes.indexOf(member.PositionCode) === -1) {
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

    team.TeamCompo.forEach(function (teamPlayer) {
        if (foundPlayerIdsInStaff.indexOf(teamPlayer.Id) === -1) {
            if (teamPlayer.Line === 0) {
                if (teamPlayer.PositionCode !== 'PSENT') {
                    ret.subs.push(transformPlayerInfoFromCompo(teamPlayer));
                } else {
                    ret.staff.push(transformPlayerInfoFromCompo(teamPlayer));
                }
            } else {
                if (typeof ret.players[teamPlayer.Line] === 'undefined') {
                    ret.players[teamPlayer.Line] = {
                        line: teamPlayer.PositionCode,
                        players: []
                    }
                }
                ret.players[teamPlayer.Line].players.push(transformPlayerInfoFromCompo(teamPlayer))
            }
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
    var ret = {home: [], away: []};

    match.Tabs.forEach(function (tabEvent) {
        var side = (tabEvent.TeamId === match.Home.TeamId) ? 'home' : 'away';
        var shootout = {
            player: tabEvent.PlayerId,
            number: tabEvent.Order
        };

        if (tabEvent.TypeEvtCode === 'VTTAX') {
            shootout.missed = tabEvent.ExtTypeEvtCode;
        }
        ret[side].push(shootout);
    });

    if (ret.home.length + ret.away.length === 0) {
        return null;
    }

    return ret;
}


function getMatches(evenements, write) {
    return function (eachMatchCb) {
        eachMatches(evenements, function (evenement, phase, match) {

            //if (new Date(evenement.DateFin) < new Date()) {
            //    return;
            //}

            match.Arbitres = match.Arbitres || [];
            match.Events = match.Events || [];

            var data = {
                now: new Date(),
                id: match.Id,
                status: match.StatusCode,
                time: match.Minute || '0',
                date: match.Date,
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
                periods: match.Periods.map(function (period) {
                    return {
                        code: period.PeriodCode,
                        home: period.HomeRes,
                        away: period.AwayRes,
                        time: period.TotalTime
                    };
                }),
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

            var commentEvents = [];

            data.hasComments = match.Comments.length > 0;

            var groups = [{start: 0, comments: []}];
            var groupIndex = 0;
            var lastCommentTime;
            var inGroup = true;


            function timeDuringPlay(time) {
                time = String(time);
                var isHourAndMinutes = (time.indexOf(':') > -1);
                var floatVal = getTimeAsFloat(time);
                return (!isNaN(floatVal) && !isHourAndMinutes && floatVal !== 0);
            }

            function getTimeAsFloat(time) {
                time = String(time);
                return parseFloat(time.replace('+', '.'));
            }

            function commentIsDuringPlay(comment, lastCommentTime, nextCommentTime) {

                if (timeDuringPlay(comment.props.time)) {
                    return true;
                }

                lastCommentTime = getTimeAsFloat(lastCommentTime);
                nextCommentTime = getTimeAsFloat(nextCommentTime);

                if (lastCommentTime >= 45 && nextCommentTime <= 46) {
                    return false;
                }

                if (lastCommentTime >= 90 && nextCommentTime <= 91) {
                    return false;
                }

                return timeDuringPlay(lastCommentTime) && timeDuringPlay(nextCommentTime);
            }

            function mapCommentToEvent(comment) {
                var mapped = false;
                data.events.forEach(function (evt) {
                    if (evt.time === comment.props.time && comment.props.event == evt.type) {
                        evt.comment = comment;
                        mapped = true;
                    }
                });
                return mapped;
            }


            if (Array.isArray(match.Comments)) {

                var nextCommentTime;
                var j;
                match.Comments.forEach(function (comment, i) {

                    nextCommentTime = null;

                    for (j = i + 1; j < match.Comments.length; j++) {
                        if (match.Comments[j].props.time) {
                            nextCommentTime = match.Comments[j].props.time;
                            break;
                        }
                    }

                    if (commentIsDuringPlay(comment, lastCommentTime, nextCommentTime)) {
                        if (inGroup) {
                            groupIndex++;
                        }
                        inGroup = false;
                        lastCommentTime = comment.props.time ? comment.props.time : lastCommentTime;
                        if (!mapCommentToEvent(comment)) {
                            commentEvents.push({
                                time: lastCommentTime,
                                comment: comment,
                                side: 'both',
                                type: comment.props.event
                            });
                        }
                    } else {
                        inGroup = true;
                        if (typeof groups[groupIndex] === 'undefined') {
                            groups[groupIndex] = {
                                after: lastCommentTime,
                                comments: []
                            }
                        }

                        groups[groupIndex].comments.push(comment);
                    }
                });

            }

            data.events = data.events.concat(commentEvents);

            groups.forEach(function (group) {

                if (group.comments.length === 0) {
                    return;
                }

                data.events.push({
                    time: group.after ? parseFloat(String(group.after).replace('+', '.')) + 0.1 : '-1000',
                    group: 'pre',
                    side: 'both',
                    comments: group.comments
                });
            });
            data.commentGroups = groups;
            data.events.sort(function (a, b) {
                var aTime = parseFloat(String(a.time).replace('+', '.'));
                var bTime = parseFloat(String(b.time).replace('+', '.'));
                return bTime - aTime;
            });

            //data.raw = match;

            write('matches/' + match.Id, data);
        });
        eachMatchCb();
    }
}

function transformScoreboardData(options, evenements, write) {
    return function (scoreboardCb) {
        async.forEachOf(options.clients, function (clientOptions, clientId, cb) {
            var clientEvents = unique(evenements.filter(function (evt) {
                return clientOptions.evts.indexOf(evt.id) !== -1
            }));

            write('clients/' + clientId + '/scoreboard', {
                dates: getAllMatchDates(clientEvents),
                competitions: getEvenementsScoreboard(clientEvents)
            });
            cb();
        }, scoreboardCb);
    }
}

function getCompetitions(options, evenements, write) {
    return function (competitionCb) {
        var competitionList = [];

        evenements.forEach(function (evenement) {
            var competition = {
                id: evenement.id,
                label: evenement.Label,
                country: evenement.CountryIso,
                gender: evenement.GenderCode,
                startDate: evenement.DateDeb,
                endDate: evenement.DateFin,
                type: evenement.TypeEvenement,
                matches: [],
                groups: {}
            };


            competition.phases = evenement.phases.map(function (phase) {
                var p = {
                    format: phase.PhaseCompetCode,
                    type: phase.TypePhaseCode
                };

                phase.Groupes.forEach(function (group) {
                    competition.groups[group.GroupeId] = {
                        id: group.GroupeId,
                        label: group.GroupeLabel,
                        name: group.GroupeNom,
                        isClass: group.IsClass
                    };
                });

                phase.matches.forEach(function (match) {
                    var m = {
                        id: match.Id,
                        date: match.Date,
                        competition: evenement.id,
                        phase: phase.PhaseCompetCode,
                        group: match.GroupId,
                        status: match.StatusCode,
                        dayOfCompetition: match.Journee,
                        home: extractScoreboardTeamInfo(match.Home),
                        away: extractScoreboardTeamInfo(match.Away)
                    };

                    setMatchWinner(m);
                    competition.matches.push(m);
                });

                //console.info('EVENEMENT', evenement.Label, phase.PhaseCompetCode);

                p.rankings = {};

                var hasRankings = false;
                phase.Groupes.forEach(function (groupe) {
                    if (groupe.Classement.Classements.length) {
                        hasRankings = true;
                        var props = {};
                        groupe.Classement.Colonnes.forEach(function (colonne) {
                            props[colonne.DataTypeId] = colonne.DataTypeCode;
                        });
                        p.rankings[groupe.GroupeId] = groupe.Classement.Classements[0].Classement.map(function (team) {
                            var teamRanking = {teamId: team.TeamId};
                            team.Colonnes.forEach(function (col) {
                                teamRanking[props[col.DataTypeId]] = col.Value;
                            });
                            return teamRanking
                        });
                    }
                });

                if (hasRankings === false) {
                    delete p.rankings;
                }

                return p;
            });


            competitionList.push({
                id: evenement.id,
                label: evenement.Label,
                country: evenement.CountryIso,
                gender: evenement.GenderCode,
                startDate: evenement.DateDeb,
                endDate: evenement.DateFin,
                type: evenement.TypeEvenement
            });

            competition.teams = evenement.Equipes.map(function (equipe) {
                return {
                    name: equipe.TeamNom,
                    country: equipe.TeamPaysIso,
                    id: equipe.TeamId
                };
            });

            write('competitions/' + competition.id, competition);
        });

        async.forEachOf(options.clients, function (clientOptions, clientId, cb) {
            var clientCompetitions = unique(competitionList.filter(function (evt) {
                return clientOptions.evts.indexOf(evt.id) !== -1
            }));
            write('clients/' + clientId + '/competitions', clientCompetitions);
            cb();
        }, competitionCb);
    }
}

function getTeams(evenements, write) {
    return function (teamsCb) {
        var matchesByTeamId = {};
        var teams = {};

        evenements.forEach(function (evt) {
            evt.phases.forEach(function (phase) {
                phase.matches.forEach(function (match) {
                    match.EvenementId = evt.Id;
                    if (typeof matchesByTeamId[match.Home.TeamId] === 'undefined') {
                        matchesByTeamId[match.Home.TeamId] = [];
                    }
                    matchesByTeamId[match.Home.TeamId].push(match);
                    if (typeof matchesByTeamId[match.Away.TeamId] === 'undefined') {
                        matchesByTeamId[match.Away.TeamId] = [];
                    }
                    matchesByTeamId[match.Away.TeamId].push(match);
                });
            });

            evt.Equipes.forEach(function (equipe) {

                if (typeof teams[equipe.TeamId] === 'undefined') {
                    teams[equipe.TeamId] = {
                        name: equipe.TeamNom,
                        country: equipe.PaysIso,
                        type: equipe.TeamType,
                        id: equipe.TeamId,
                        staff: [],
                        competitions: []
                    };
                }

                var team = teams[equipe.TeamId];
                var competition = {
                    id: evt.Id,
                    label: evt.Label,
                    matches: []
                };


                team.competitions.push(competition);

                if (Array.isArray(matchesByTeamId[team.id])) {
                    competition.matches = [];

                    matchesByTeamId[team.id].forEach(function (match) {
                        if (evt.id === match.EvenementId) {
                            var m = {
                                id: match.Id,
                                groupId: match.GroupId,
                                date: match.Date,
                                status: match.StatusCode,
                                home: extractScoreboardTeamInfo(match.Home),
                                away: extractScoreboardTeamInfo(match.Away)
                            };
                            setMatchWinner(m);
                            competition.matches.push(m);
                        }
                    });

                    delete matchesByTeamId[team.id];
                }

                //if (team.id === 4656) {
                //    console.info(matchesByTeamId[team.id]);
                //}

                team.staff = equipe.Staff.map(function (member) {
                    return {
                        id: member.Id,
                        fullname: member.NomLong,
                        name: member.NomCourt,
                        position: member.PositionCode,
                        number: member.Bib,
                        height: member.Taille,
                        weight: member.Poids,
                        birthDate: member.DateDeNaissance,
                        country: member.PaysRepresenteIso,
                        birthCountry: member.PaysNaissanceIso,
                        faceshot: member.Faceshot
                    }
                });
            });
        });

        var teamId;
        for (teamId in teams) {
            if (teams.hasOwnProperty(teamId)) {
                write('teams/' + teamId, teams[teamId]);
            }
        }

        teamsCb();
    }
}

function getPlayers(evenements, write) {
    return function (playersCb) {
        var players = {};
        evenements.forEach(function (evenement) {
            evenement.Equipes.forEach(function (equipe) {
                equipe.Staff.forEach(function (member) {
                    if (typeof players[member.Id] === 'undefined') {
                        players[member.Id] = {
                            id: member.Id,
                            name: member.NomCourt,
                            fullname: member.NomLong,
                            number: member.Bib,
                            height: member.Taille,
                            weight: member.Poids,
                            birthDate: member.DateDeNaissance,
                            representCountry: member.PaysRepresenteIso,
                            birthCountry: member.PaysNaissanceIso,
                            city: member.VilleNom,
                            faceshot: member.Faceshot,
                            teams: {},
                            competitions: []
                        }
                    }

                    players[member.Id].teams[equipe.TeamId] = {
                        id: equipe.TeamId,
                        name: equipe.TeamNom,
                        type: equipe.TeamType,
                        country: equipe.PaysIso
                    };

                    players[member.Id].competitions.push({
                        id: evenement.id,
                        label: evenement.Label,
                        startDate: evenement.DateDeb,
                        endDate: evenement.DateFin,
                        country: evenement.CountryIso,
                        type: evenement.TypeEvenement
                    });
                });
            });
        });

        var playerId;
        for (playerId in players) {
            if (players.hasOwnProperty(playerId)) {
                write('players/' + playerId, players[playerId]);
            }
        }
        playersCb();
    }
}

module.exports = function (options) {
    return function transform(write, cb) {
        return function (evenements) {
            console.info('TRANSFORM START', new Date());
            async.parallel([
                transformScoreboardData(options, evenements, write),
                getCompetitions(options, evenements, write),
                getMatches(evenements, write),
                getTeams(evenements, write),
                getPlayers(evenements, write)
            ], function () {
                console.info('TRANSFORM END', new Date());
                evenements.length = 0;
                evenements = null;
                if (global.gc) {
                    global.gc();
                } else {
                    console.log('Garbage collection unavailable.  Pass --expose-gc '
                        + 'when launching node to enable forced garbage collection.');
                }
                if (cb) {
                    cb();
                }
                console.info('memory usage', process.memoryUsage());
            });
        }
    }
};

