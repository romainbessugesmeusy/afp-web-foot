var request = require('request');
var fs = require('fs');
var path = require('path');
var async = require('async');
var extend = require('extend');
var moment = require('moment');
var parseCommentFile = require('./lib/parseCommentFile');
var downloadFile = require('./lib/downloadFile');
var fileExists = require('./lib/fileExists');

module.exports = function (options) {

    var fetch = require('./lib/fetch')(options);

    function getEvenementInfos(evenement) {
        return function (evenementInfosCb) {
            fetch('aaevenementinfo/:lang/:id', {id: evenement.id}, function (err, evenementInfos) {
                extend(evenement, evenementInfos);
                evenementInfosCb()
            }, function (data) {
                return new Date(data.DateFin) >= new Date();
            });
        }
    }

    function getMatchDetail(match) {
        return function (eachMatchCb) {
            fetch('xcmatchdetail/:lang/:id', {id: match.Id}, function (err, matchDetail) {
                if (err) {
                    console.error({id: match.Id}, err);
                    return eachMatchCb();
                }
                extend(match.Home, matchDetail.Home);
                extend(match.Away, matchDetail.Away);
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
            var filename = path.join(
                __dirname,
                '../dist/data/comments/' + getEvenementMetaData(evenement, 'EDFTP') + '/xml/fr/comments/commentslive-fr-' + match.Id + '.xml'
            );

            parseCommentFile(filename, function (comments) {
                if (comments) {
                    match.Comments = comments;
                }
                matchCommentCb();
            });
        }
    }


    function getPhaseMatches(evenement, phase) {
        return function (matchesPhaseCb) {
            fetch('xcmatchesphase/:lang/:id', {
                id: phase.PhaseId
            }, function (err, matches) {
                if (err) console.error(err);
                phase.matches = matches.Matches;
                async.forEach(phase.matches, function (match, eachMatchCb) {
                    async.parallel([
                        getMatchDetail(match),
                        getMatchComments(evenement, match)
                    ], eachMatchCb)
                }, matchesPhaseCb);
            }, function () {
                return phase.IsCurrent;
            });
        }
    }

    function isMatchOutdated(match) {
        return (moment(match.Date).diff(new Date()) < 0 && match.StatusCode !== 'EMFIN');
    }

    function isEvenementCurrent(evenement) {
        var now = new Date();
        return (new Date(evenement.DateDeb) < now && new Date(evenement.DateFin) > now);
    }

    function getPhaseTopScorers(evenement, phase) {
        return function (topScorersCb) {
            fetch('xcclassementbuteurs/:lang/:evtId/:id', {
                id: phase.PhaseId,
                evtId: evenement.id
            }, function (err, topScorers) {
                phase.TopScorers = topScorers.TopScorers;
                topScorersCb();
            });
        }
    }

    function getPhaseEquipes(evenement, phase) {
        return function (phaseEquipesCb) {
            fetch('xcequipes/:lang/:evt/:phase', {evt: evenement.id, phase: phase.PhaseId}, function (err, equipes) {
                phase.Equipes = equipes.Equipes;
                getTeamsLogo(phase)(phaseEquipesCb);
            })
        }
    }

    function getClassementGroupes(evenement, phase) {
        return function (classementGroupesCb) {
            async.forEach(phase.Groupes, function (groupe, cb) {
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
            fetch('xcphases/:lang/:id', {id: evenement.id}, function (err, phasesJson) {
                evenement.phases = phasesJson.Phases;
                async.forEach(evenement.phases, function (phase, eachPhaseDone) {
                    async.parallel([
                        getPhaseMatches(evenement, phase),
                        getPhaseTopScorers(evenement, phase),
                        getPhaseEquipes(evenement, phase),
                        getClassementGroupes(evenement, phase)
                    ], eachPhaseDone);
                }, eachPhasesCb);
            }, function () {
                return isEvenementCurrent(evenement);
            });
        }
    }

    function getFaceshot(player, cb) {
        var uri = options.root + 'aaheadshot/' + player.Id;
        var filename = path.join(__dirname, '../dist/data/players/faceshots', player.Id + '.jpg');
        downloadFile(uri, filename, function (err) {
            if (!err) player.Faceshot = true;
            cb();
        });
    }

    function getPlayersFaceshots(equipe) {
        return function (cb) {
            async.forEach(equipe.Staff, getFaceshot, cb);
        }
    }

    function getTeamsLogo(phase) {
        return function (eachEquipeCb) {
            async.forEach(phase.Equipes, function (equipe, cb) {
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
            fetch('xcequipestaff/:lang/:evtId/:id', {
                evtId: evenement.id,
                id: equipe.Id
            }, function (err, teamStaff) {
                extend(equipe, teamStaff);
                getPlayersFaceshots(equipe)(eachEquipeCb);
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
            fetch('xcequipes/:lang/:evt/0', {evt: evenement.id}, function (err, data) {
                evenement.Equipes = data.Equipes;
                async.forEach(evenement.Equipes, function (equipe, eachEquipeDone) {
                    getEquipeStaff(evenement, equipe)(eachEquipeDone);
                }, equipesCb);
            });
        }
    }

    return function extract(cb) {
        var evenements = [];
        console.info('EXTRACT', new Date());
        async.forEach(options.evts, function eachEvenement(evtId, eachEvenementDone) {
            var evenement = {id: evtId};
            evenements.push(evenement);
            async.series([
                getEvenementEquipes(evenement),
                getEvenementInfos(evenement),
                getPhases(evenement),
                getEvenementStatistiques(evenement)
            ], eachEvenementDone);
        }, function () {
            console.info('EXTRACT FINISHED', new Date());
            cb(evenements);
        });
    }
};