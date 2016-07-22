var async = require('async');
var extend = require('extend');


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

function getAllMatchDates(evenements) {
    var dates = {};
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

    if (teamDetail.goals > 0) {
        teamDetail.scorers = [];
        match.Events.forEach(function (event) {
            if (event.TeamId === teamDetail.id && (event.TypeEvtCode === 'VTBUT' || event.TypeEvtCode === 'VTPEN')) {
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

    extend(teamDetail, getTeamStaff(match, teamFromStats.Staff, match[team]));

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

    staff.forEach(function (member) {
        foundPlayerIdsInStaff.push(member.Id);
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


function getMatches(evenements, write) {
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

            var commentEvents = [];

            data.hasComments = match.Comments.length > 0;

            var groups = [{start: 0, comments: []}];
            var groupIndex = 0;
            var lastCommentTime;
            var inGroup = true;


            function commentIsDuringPlay(comment, debug) {
                var isHourAndMinutes = (comment.props.time.indexOf(':') > -1);
                var time = parseFloat(String(comment.props.time).replace('+', '.'));
                //if (debug) {
                //    console.info(comment.props.time, isHourAndMinutes, time, (!isNaN(time) && !isHourAndMinutes && time !== 0))
                //}
                return (!isNaN(time) && !isHourAndMinutes && time !== 0);
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

                if (match.Id === 159002) {
                    data.comments = match.Comments;
                }

                var nextComment;

                match.Comments.forEach(function (comment, i) {

                    nextComment = match.Comments[i + 1];

                    if (commentIsDuringPlay(comment, lastCommentTime, (match.Id === 159002))) {
                        if (inGroup && parseInt(comment.props.time) < 20) {
                            groupIndex++;
                        }
                        inGroup = false;
                        lastCommentTime = comment.props.time;
                        if (match.Id === 159002) {
                            console.info('lastCommentTime', comment.props.time)
                        }
                        if (!mapCommentToEvent(comment)) {
                            commentEvents.push({
                                time: comment.props.time,
                                comment: comment,
                                side: 'both',
                                type: comment.props.event
                            });
                        }
                    } else {
                        inGroup = true;
                        if (typeof groups[groupIndex] === 'undefined') {
                            if (match.Id === 159002) {
                                console.info('newGroup')
                            }

                            groups[groupIndex] = {
                                start: lastCommentTime,
                                comments: []
                            }
                        }

                        groups[groupIndex].comments.push(comment);
                    }
                });

                if (match.Id === 159002) {
                    console.info(groups);
                }

                data.commentGroups = groups;


                //commentEvents.push({
                //    time: comment.props.time,
                //    comment: comment,
                //    side: 'both',
                //    type: comment.props.event
                //});
            }

            data.events = data.events.concat(commentEvents);
            /*
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
             }*/

            var secondPeriodStartIndex = -1;
            var firstPeriodFinishIndex = -1;

            data.events.forEach(function (evt, i) {
                if (evt.type === 'VTD2M') {
                    secondPeriodStartIndex = i;
                }

                if (evt.type === 'VTF1M') {
                    firstPeriodFinishIndex = i;
                }
            });

            //if (commentsDuringHalfTime.length) {
            //    console.info(commentsDuringHalfTime.length, match.Id, firstPeriodFinishIndex, secondPeriodStartIndex);
            //}

            //data.commentsDuringHalfTime = commentsDuringHalfTime;

            data.events.sort(function (a, b) {
                var aTime = parseFloat(String(a.time).replace('+', '.'));
                var bTime = parseFloat(String(b.time).replace('+', '.'));
                return bTime - aTime;
            });

            data.raw = match;

            write('matches/' + match.Id, data);
        });
        eachMatchCb();
    }
}

function transformScoreboardData(evenements, write) {
    return function (scoreboardCb) {
        write('scoreboard', {
            dates: getAllMatchDates(evenements),
            competitions: getEvenementsScoreboard(evenements)
        });
        scoreboardCb();
    }
}

function getCompetitions(evenements, write) {
    return function (competitionCb) {
        var competitionList = [];

        evenements.forEach(function (evenement) {
            var competition = {
                id: evenement.id,
                label: evenement.Label,
                country: evenement.CountryIso
            };

            competition.phases = evenement.phases.map(function (phase) {
                var p = {
                    format: phase.PhaseCompetCode,
                    type: phase.TypePhaseCode
                };

                // saison régulière
                if (p.format === "TPSAR") {
                    var props = {};
                    phase.Groupes[0].Classement.Colonnes.forEach(function (colonne) {
                        props[colonne.DataTypeId] = colonne.DataTypeCode;
                    });

                    if (typeof phase.Groupes[0].Classement.Classements[0] === 'undefined') {
                        console.info('no ranking for evt', evenement.Label);
                        return;
                    }

                    p.rankings = phase.Groupes[0].Classement.Classements[0].Classement.map(function (team) {
                        var teamRanking = {
                            teamId: team.TeamId
                        };

                        team.Colonnes.forEach(function (col) {
                            teamRanking[props[col.DataTypeId]] = col.Value;
                        });

                        return teamRanking
                    });
                }

                return p;
            });

            competition.rawPhases = evenement.phases;

            competitionList.push({
                id: evenement.id,
                label: evenement.Label,
                country: evenement.CountryIso
            });

            competition.teams = evenement.statistiques.map(function (equipe) {
                return {
                    name: equipe.TeamNom,
                    country: equipe.TeamPaysIso,
                    id: equipe.TeamId
                };
            });

            write('competitions/' + competition.id, competition);
        });

        write('competitions', competitionList);
        competitionCb();
    }
}

function getTeams(evenements, write) {
    return function (teamsCb) {
        var matchesByTeamId = {};
        var teams = {};

        evenements.forEach(function (evt) {
            evt.phases.forEach(function (phase) {
                phase.matches.forEach(function (match) {
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
            evt.statistiques.forEach(function (equipe) {


                if (typeof teams[equipe.TeamId] === 'undefined') {
                    teams[equipe.TeamId] = {
                        name: equipe.TeamNom,
                        country: equipe.TeamPaysIso,
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
                    competition.matches = matchesByTeamId[team.id].map(function (match) {
                        return {
                            id: match.Id,
                            groupId: match.GroupId,
                            date: match.Date,
                            status: match.StatusCode,
                            home: extractScoreboardTeamInfo(match.Home),
                            away: extractScoreboardTeamInfo(match.Away)
                        }
                    });
                }

                //if (team.id === 4656) {
                //    console.info(matchesByTeamId[team.id]);
                //}

                var teamStaff = equipe.Staff.map(function (member) {
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

                team.staff = teamStaff; // todo ask AFP
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

module.exports = function transform(write) {
    return function (evenements) {
        console.info('TRANSFORM START', new Date());
        async.parallel([
            transformScoreboardData(evenements, write),
            getMatches(evenements, write),
            getCompetitions(evenements, write),
            getTeams(evenements, write)
        ], function () {
            console.info('TRANSFORM END', new Date());
        });
    }
};

