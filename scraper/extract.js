var request = require('request');
var fs = require('fs');
var path = require('path');
var async = require('async');
var extend = require('extend');
var moment = require('moment');
var parseCommentFile = require('./lib/parseCommentFile');
var downloadFile = require('./lib/downloadFile');
var fileExists = require('./lib/fileExists');
var unique = require('array-unique');
var Table = require('cli-table');
var clear = require('clear');
var debounce = require('debounce');
var statusTable = new Table({
    head: ['EventID', 'Step'],
    colWidths: [30, 100]
});

var setEventStatus = function (evtId, message) {
    var i = 0;
    var l = statusTable.length;
    for (; i < l; i++) {
        if (statusTable[i][0] === evtId) {
            statusTable[i][1] = message;
        }
    }

    debouncedWriteStatus();
};

var writeStatus = function () {
    clear();
    process.stdout.write(statusTable.toString() + '\n');
};


var debouncedWriteStatus = debounce(writeStatus, 50);


module.exports = function (options) {

    var fetch = require('./lib/fetch')(options);

    function getEvenementInfos(evenement) {
        return function (evenementInfosCb) {
            setEventStatus(evenement.id, 'getEvenementInfos');
            fetch('aaevenementinfo/:lang/:id', {id: evenement.id}, function (err, evenementInfos) {
                extend(evenement, evenementInfos);
                evenementInfosCb()
            });
        }
    }

    function getMatchDetail(evenement, match) {
        return function (eachMatchCb) {
            setEventStatus(evenement.id, 'getMatchDetail ' + match.Id);
            fetch('xcmatchdetail/:lang/:id', {id: match.Id}, function (err, matchDetail) {
                if (err) {
                    console.error({id: match.Id}, err);
                    return eachMatchCb();
                }
                extend(match.Home, matchDetail.Home);
                extend(match.Away, matchDetail.Away);
                match.StatusCode = matchDetail.StatusCode;
                match.Attendance = matchDetail.Attendance;
                match.Arbitres = matchDetail.Arbitres;
                match.Periods = matchDetail.Periods;
                match.Events = matchDetail.Events;
                match.Tabs = matchDetail.Tabs;
                eachMatchCb();
            }, isMatchOutdated);
        }
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


    function getMatchComments(evenement, match) {
        return function (matchCommentCb) {
            setEventStatus(evenement.id, 'getMatchComments ' + match.Id);
            var filename = path.join(
                __dirname,
                '../dist/data/comments/' + getEvenementMetaData(evenement, 'EDFTP') + '/xml/fr/comments/commentslive-fr-' + match.Id + '.xml'
            );

            parseCommentFile(filename, function (comments) {
                if (comments) {
                    match.Comments = comments;
                }
                setEventStatus(evenement.id, 'getMatchComments ' + match.Id + ' DONE');
                matchCommentCb();
            });
        }
    }


    function getPhaseMatches(evenement, phase) {
        return function (matchesPhaseCb) {
            setEventStatus(evenement.id, 'getPhaseMatches ' + phase.PhaseId);
            fetch('xcmatchesphase/:lang/:id', {
                id: phase.PhaseId
            }, function (err, matches) {
                if (err) console.error(err);
                phase.matches = matches.Matches;
                async.forEach(phase.matches, function (match, eachMatchCb) {
                    async.parallel([
                        getMatchDetail(evenement, match),
                        getMatchComments(evenement, match)
                    ], function () {
                        setEventStatus(evenement.id, 'getPhaseMatches Match Done' + match.Id);
                        async.setImmediate(eachMatchCb);
                    })
                }, function () {
                    setEventStatus(evenement.id, 'getPhaseMatchesDone Phase Done ' + phase.PhaseId );
                    async.setImmediate(matchesPhaseCb);
                });
            });
        }
    }

    function isMatchOutdated(match) {
        return false;
        return (moment(match.Date).diff(new Date()) < 0 && match.StatusCode !== 'EMFIN');
    }

    function isEvenementCurrent(evenement) {
        var now = new Date();
        return (new Date(evenement.DateDeb) < now && new Date(evenement.DateFin) > now);
    }

    function getPhaseTopScorers(evenement, phase) {
        return function (topScorersCb) {
            setEventStatus(evenement.id, 'getPhaseTopScorers ' + phase.PhaseId);
            fetch('xcclassementbuteurs/:lang/:evtId/:id', {
                id: phase.PhaseId,
                evtId: evenement.id
            }, function (err, topScorers) {
                if (err) {
                    return topScorersCb();
                }
                phase.TopScorers = topScorers.TopScorers;
                topScorersCb();
            });
        }
    }

    function getPhaseEquipes(evenement, phase) {
        return function (phaseEquipesCb) {
            setEventStatus(evenement.id, 'getPhaseEquipes ' + phase.PhaseId);
            fetch('xcequipes/:lang/:evt/:phase', {evt: evenement.id, phase: phase.PhaseId}, function (err, equipes) {
                phase.Equipes = equipes.Equipes;
                getTeamsLogo(phase)(phaseEquipesCb);
            })
        }
    }

    function getClassementGroupes(evenement, phase) {
        return function (classementGroupesCb) {
            async.forEachLimit(phase.Groupes, 2, function (groupe, cb) {
                setEventStatus(evenement.id, 'getClassementGroupes phase: ' + phase.PhaseId + ', groupe : ' + groupe.GroupeId);
                fetch('xcclassementgroupe/:lang/:evenementId/:groupeId', {
                    evenementId: evenement.id,
                    groupeId: groupe.GroupeId
                }, function (err, classement) {
                    groupe.Classement = classement;
                    cb();
                });
            }, classementGroupesCb);
        }
    }

    function getPhases(evenement) {
        return function (eachPhasesCb) {
            setEventStatus(evenement.id, 'getPhases');
            fetch('xcphases/:lang/:id', {id: evenement.id}, function (err, phasesJson) {
                evenement.phases = phasesJson.Phases;
                async.forEachLimit(evenement.phases, 2, function (phase, phaseDone) {
                    async.parallel([
                        getPhaseMatches(evenement, phase),
                        getPhaseTopScorers(evenement, phase),
                        getPhaseEquipes(evenement, phase),
                        getClassementGroupes(evenement, phase)
                    ], function(){
                        setEventStatus(evenement.id, 'getPhases phase done ' + phase.PhaseId);
                        phaseDone()
                    });
                }, function(){
                    setEventStatus(evenement.id, 'getPhases all phases done');
                    eachPhasesCb()
                });
            }/*, function () {
             return isEvenementCurrent(evenement);
             }*/);
        }
    }

    function getFaceshot(evenement, player, cb) {
        var uri = options.root + 'aaheadshot/' + player.Id;
        setEventStatus(evenement.id, 'getFaceshot ' + player.Id + ' ' + uri);
        var filename = path.join(__dirname, '../dist/data/players/faceshots', player.Id + '.jpg');
        downloadFile(uri, filename, function (err) {
            if (!err) player.Faceshot = true
        });
        cb();
    }

    function getPlayersFaceshots(evenement, equipe) {
        return function (cb) {
            setEventStatus(evenement.id, 'getPlayersFaceshot', equipe.Id);
            async.forEachLimit(equipe.Staff, 2, function (member, cb) {
                getFaceshot(evenement, member, cb);
            }, cb);
        }
    }

    function getTeamsLogo(phase) {
        return function (eachEquipeCb) {
            async.forEachLimit(phase.Equipes, 2, function (equipe, cb) {
                var uri;
                switch (equipe.TeamType) {
                    case 'CECLU':
                        uri = 'http://bdsports.afp.com/spa-xc/images/team/' + equipe.Id + '.png';
                        break;
                    case 'CENAT':
                        uri = 'http://bdsports.afp.com/spa-xc/images/flag.3/64/' + equipe.PaysIso + '.png';
                        break;
                    default:
                        console.warn('Unknown team type: ' + equipe.TeamType);
                        equipe.logo = false;
                        return cb();
                }

                downloadFile(uri, path.join(__dirname, '../dist/data/teams/logos', equipe.Id + '.png'), function (err) {
                    if (!err) equipe.logo = true;
                    cb();
                });

            }, eachEquipeCb);
        }
    }

    function getEquipeStaff(evenement, equipe) {
        return function (eachEquipeCb) {
            setEventStatus(evenement.id, 'getEquipeStaff ' + equipe.Id);
            fetch('xcequipestaff/:lang/:evtId/:id', {
                evtId: evenement.id,
                id: equipe.Id
            }, function (err, teamStaff) {
                extend(equipe, teamStaff);
                setEventStatus(evenement.id, 'getEquipeStaff OK ' + equipe.Id);
                getPlayersFaceshots(evenement, equipe)(eachEquipeCb);
            }, function (cachedStaff) {
                if (cachedStaff.Staff.length === 0) {
                    //console.warn('team', equipe.TeamId, 'has no staff for event', evenement.id);
                }
                return false;
            });
        }
    }

    function getEvenementStatistiques(evenement) {
        return function (evenementStatCb) {
            fetch('xcstatistiques/:lang/:id', {id: evenement.id}, function (err, stats) {
                evenement.statistiques = stats.Statistiques;
                evenementStatCb();
            });
        }
    }

    function getEvenementEquipes(evenement) {
        return function (equipesCb) {
            setEventStatus(evenement.id, 'getEvenementEquipes');
            fetch('xcequipes/:lang/:evt/0', {evt: evenement.id}, function (err, data) {
                evenement.Equipes = data.Equipes;
                async.forEachLimit(evenement.Equipes, 2, function (equipe, eachEquipeDone) {
                    getEquipeStaff(evenement, equipe)(eachEquipeDone);
                }, equipesCb);
            });
        }
    }

    return function extract(cb) {
        var evenements = [];
        var evenementsIds = [];

        for (var client in options.clients) {
            if (options.clients.hasOwnProperty(client)) {
                evenementsIds = evenementsIds.concat(options.clients[client].evts);
            }
        }

        async.forEachLimit(evenementsIds, 2, function eachEvenement(evtId, eachEvenementDone) {
            statusTable.push([evtId, 'start']);
            var evenement = {id: evtId};
            evenements.push(evenement);
            async.series([
                getEvenementEquipes(evenement),
                getEvenementInfos(evenement),
                getPhases(evenement),
                getEvenementStatistiques(evenement)
            ], function () {
                setEventStatus(evtId, 'done');
                eachEvenementDone();
            });
        }, function () {
            console.info('EXTRACT FINISHED', new Date());
            cb(evenements);
        });
    }
};

writeStatus();