var request = require('request');
var fs = require('fs');
var path = require('path');
var async = require('async');
var extend = require('extend');

module.exports = function (options) {


    var fetch = function (resource, params, callback) {

        resource = resource.replace(/:\w+/g, function (param) {
            return params[param.substring(1)] || options[param.substring(1)];
        });

        var cacheFilename = path.join(__dirname, 'cache/' + resource.replace(/\//g, '_') + '.json');

        fs.stat(cacheFilename, function (err) {
            if (err === null) {
                fs.readFile(cacheFilename, 'utf8', function (err, data) {
                    if (err) {
                        return callback(err);
                    }

                    callback(null, JSON.parse(data));
                });
            } else if (err.code == 'ENOENT') {
                console.info('loading uncached resource', options.root + resource);
                request(options.root + resource, function (error, response, body) {
                    var jsonData;
                    try {
                        jsonData = JSON.parse(body);
                    } catch (err) {
                        return callback(err);
                    }

                    fs.writeFile(cacheFilename, body, function (err) {
                        if (err) {
                            return callback(err);
                        }
                        callback(null, jsonData);
                    });
                });
            } else {
                return callback(err);
            }
        });
    };

    function getEvenementInfos(evenement) {
        return function (evenementInfosCb) {
            fetch('aaevenementinfo/:lang/:id', {id: evenement.id}, function (err, evenementInfos) {
                extend(evenement, evenementInfos);
                evenementInfosCb()
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
                extend(match, matchDetail);
                eachMatchCb();
            });
        }
    }

    function getPhaseMatches(phase) {
        return function (matchesPhaseCb) {
            fetch('xcmatchesphase/:lang/:id', {
                id: phase.PhaseId
            }, function (err, matches) {
                phase.matches = matches.Matches;
                async.forEach(phase.matches, function (match, eachMatchCb) {
                    async.parallel([getMatchDetail(match)], eachMatchCb)
                }, matchesPhaseCb);
            });
        }
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

    function getPhases(evenement) {
        return function (eachPhasesCb) {
            fetch('xcphases/:lang/:id', {id: evenement.id}, function (err, phasesJson) {
                evenement.phases = phasesJson.Phases;
                async.forEach(evenement.phases, function (phase, eachPhaseDone) {
                    async.parallel([getPhaseMatches(phase), getPhaseTopScorers(evenement, phase)], eachPhaseDone);
                }, function () {
                    eachPhasesCb();
                });
            });
        }
    }

    function getEquipeStaff(evenement, equipe) {
        return function (eachEquipeCb) {
            fetch('xcequipestaff/:lang/:evtId/:id', {
                evtId: evenement.id,
                id: equipe.TeamId
            }, function (err, teamStaff) {
                extend(equipe, teamStaff);
                eachEquipeCb();
            });
        }
    }

    function getEvenementStatistiques(evenement) {
        return function (evenementStatCb) {
            fetch('xcstatistiques/:lang/:id', {id: evenement.id}, function (err, stats) {
                evenement.statistiques = stats.Statistiques;
                async.forEach(evenement.statistiques, function (equipe, eachEquipeDone) {
                    async.parallel([getEquipeStaff(evenement, equipe)], eachEquipeDone);
                });
                evenementStatCb();
            });
        }
    }

    return function extract(cb) {
        var evenements = [];
        async.forEach(options.evts, function eachEvenement(evtId, eachEvenementDone) {
            var evenement = {id: evtId};
            evenements.push(evenement);
            async.parallel([
                getEvenementInfos(evenement),
                getPhases(evenement),
                getEvenementStatistiques(evenement)
            ], eachEvenementDone);
        }, function () {
            cb(evenements);
        });
    }
};