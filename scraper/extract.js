var request = require('request');
var fs = require('fs');
var path = require('path');
var async = require('async');
var extend = require('extend');
var xml2js = require('xml2js');

module.exports = function (options) {

    var fileExists = function (filename, existCb, notExistCb) {

        fs.stat(filename, function (err) {
            if (err != null && err.code === 'ENOENT') {
                return notExistCb();
            }
            existCb();
        });
    };

    var download = function (resource, filename, callback) {

        var uri = (resource.indexOf('http') !== 0) ? apiUri(resource) : resource;

        fileExists(filename, callback, function () {

            var req = request(uri);
            req.pause();
            req.on('error', function (err) {
                console.error('Error downloading ',uri);
                console.error(err);
                callback(err);
            });
            req.on('response', function (res) {
                if (res.statusCode === 200) {
                    req.pipe(fs.createWriteStream(filename));
                    req.resume();
                } else {
                    callback({statusCode: res.statusCode})
                }
            }).on('close', function () {
                callback(null, true);
            });
        })
    };

    var uriParams = function (resource, params) {
        return resource.replace(/:\w+/g, function (param) {
            return params[param.substring(1)] || options[param.substring(1)];
        });
    };

    var apiUri = function (resource) {
        return options.root + resource;
    };

    var fetch = function (resource, params, callback) {

        resource = uriParams(resource, params);
        var cacheFilename = path.join(__dirname, '../dist/data/cache/' + resource.replace(/\//g, '_') + '.json');
        fileExists(cacheFilename, function () {
            fs.readFile(cacheFilename, 'utf8', function (err, data) {
                if (err) return callback(err);
                callback(null, JSON.parse(data));
            });
        }, function () {
            request(apiUri(resource), function (error, response, body) {
                var jsonData;
                try {
                    jsonData = JSON.parse(body);
                } catch (err) {
                    return callback(err);
                }

                fs.writeFile(cacheFilename, body, function (err) {
                    if (err)  return callback(err, jsonData);
                    callback(null, jsonData);
                });
            });
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
                extend(match.Home, matchDetail.Home);
                extend(match.Away, matchDetail.Away);
                match.Attendance = matchDetail.Attendance;
                match.Arbitres = matchDetail.Arbitres;
                match.Periods = matchDetail.Periods;
                match.Events = matchDetail.Events;
                match.Tabs = matchDetail.Tabs;
                eachMatchCb();
            });
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
            var parser = new xml2js.Parser({trim: true, attrkey: 'props', charkey: 'text'});
            var filename = path.join(
                __dirname,
                '../dist/data/comments/' + getEvenementMetaData(evenement, 'EDFTP') + '/xml/fr/comments/commentslive-fr-' + match.Id + '.xml'
            );

            fileExists(filename, function () {
                fs.readFile(filename, 'utf8', function (err, data) {
                    parser.parseString(data, function (err, result) {
                        if (err) {
                            console.error('Error Parsing', filename);
                            console.error(err);
                        } else {
                            //console.info('parsing comments form match', match.Id);
                            match.Comments = result.comments.comment;
                        }
                        matchCommentCb();
                    });
                });
            }, matchCommentCb);
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

    function getPhaseEquipes(evenement, phase) {
        return function (phaseEquipesCb) {
            fetch('xcequipes/:lang/:evt/:phase', {evt: evenement.id, phase: phase.PhaseId}, function (err, equipes) {
                phase.Equipes = equipes.Equipes;
                async.parallel([getTeamsLogo(phase)], phaseEquipesCb)
            })
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
                        getPhaseEquipes(evenement, phase)
                    ], eachPhaseDone);
                }, eachPhasesCb);
            });
        }
    }

    function getFaceshot(player, cb) {
        download(
            uriParams('aaheadshot/:id', {id: player.Id}),
            path.join(__dirname, '../dist/data/players', player.Id + '.jpg'),
            function (err) {
                if (!err) {
                    player.Faceshot = true;
                }
                cb();
            }
        );
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
                        uri = uriParams('http://bdsports.afp.com/spa-xc/images/team/:id.png', {id: equipe.Id});
                        break;
                    case 'CENAT':
                        uri = uriParams('http://bdsports.afp.com/spa-xc/images/flag.3/64/:iso.png', {iso: equipe.PaysIso});
                        break;
                    default:
                        console.warn('Unknown team type: ' + equipe.TeamType);
                        equipe.logo = false;
                        return cb();
                }

                download(uri, path.join(__dirname, '../dist/data/teams', equipe.Id + '.png'), function (err) {
                        if (!err) {
                            equipe.logo = true;
                        }
                        cb();
                    }
                );

            }, eachEquipeCb);
        }
    }

    function getEquipeStaff(evenement, equipe) {
        return function (eachEquipeCb) {
            fetch('xcequipestaff/:lang/:evtId/:id', {
                evtId: evenement.id,
                id: equipe.TeamId
            }, function (err, teamStaff) {
                extend(equipe, teamStaff);
                async.parallel([getPlayersFaceshots(equipe)], eachEquipeCb);
            });
        }
    }

    function getEvenementStatistiques(evenement) {
        return function (evenementStatCb) {
            fetch('xcstatistiques/:lang/:id', {id: evenement.id}, function (err, stats) {
                evenement.statistiques = stats.Statistiques;
                async.forEach(evenement.statistiques, function (equipe, eachEquipeDone) {
                    async.parallel([getEquipeStaff(evenement, equipe)], eachEquipeDone);
                }, evenementStatCb);
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