var request = require('request');
var fs = require('fs');
var path = require('path');
var async = require('async');
var extend = require('extend');
var XmlStream = require('xml-stream');
var moment = require('moment');

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

        fileExists(filename, function () {
            callback(null, true)
        }, function () {
            var req = request(uri);
            req.pause();
            req.on('error', function (err) {
                console.error('Error downloading ', uri);
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

    var unlinkAndFetchRemote = function (filename, resource, params, callback, invalidateFn) {
        console.info('invalidating:', filename);
        fs.unlink(filename, function () {
            fetch(resource, params, callback, invalidateFn);
        });
    };

    var fetch = function (resource, params, callback, invalidateFn) {
        resource = uriParams(resource, params);
        var cacheFilename = path.join(__dirname, '../dist/data/cache/' + resource.replace(/\//g, '_') + '.json');
        fileExists(cacheFilename, function () {
            fs.readFile(cacheFilename, 'utf8', function (readFileError, data) {
                if (readFileError) {
                    console.error(readFileError);
                    return unlinkAndFetchRemote(cacheFilename, resource, params, callback, invalidateFn);
                }
                var json;
                try {
                    json = JSON.parse(data);
                    if (typeof invalidateFn !== 'function' || invalidateFn(json) === false) {
                        return callback(null, json);
                    } else {
                        console.warn('data invalidated');
                        return unlinkAndFetchRemote(cacheFilename, resource, params, callback);
                    }
                } catch (jsonParseError) {
                    console.error(jsonParseError);
                    unlinkAndFetchRemote(cacheFilename, resource, params, callback, invalidateFn);
                }

            });
        }, function () {
            console.info('downloading:', resource);
            request(apiUri(resource), function (error, response, body) {
                var jsonData;
                try {
                    jsonData = JSON.parse(body);
                } catch (err) {
                    console.error(err);
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


    function parseCommentFile(filename, cb) {
        var comments = [];
        var stream = fs.createReadStream(filename);
        var cbCalled = false;

        var end = function (err) {
            if (err && err.code !== 'ENOENT') {
                console.warn(err.message);
            }
            if (!cbCalled) {
                cb(comments);
                cbCalled = true;
            }
        };

        stream.on('error', end);
        stream.on('readable', function () {
            try {
                var xml = new XmlStream(stream, 'utf8');
                xml.preserve('comments', false);
                xml.collect('comment');
                xml.on('error', end);
                xml.on('end', end);
                xml.on('endElement: comments', function (item) {
                    comments = item.$children.map(function (comment) {
                        return {
                            props: comment.$,
                            text: comment.$text
                        }
                    });
                    end();
                });
            } catch (err) {
                end(err);
            }
        });
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
            }, function (matches) {
                var invalidate = false;

                matches.Matches.forEach(function (match) {
                    if (isMatchOutdated(match)) {
                        invalidate = true;
                    }
                });

                return invalidate;
            });
        }
    }

    function isMatchOutdated(match) {
        return (moment(match.Date).diff(new Date()) < 0 && match.StatusCode === 'EMNCO');
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
        var uri = uriParams('aaheadshot/:id', {id: player.Id});
        var filename = path.join(__dirname, '../dist/data/players', player.Id + '.jpg');
        download(uri, filename, function (err) {
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
                id: equipe.TeamId
            }, function (err, teamStaff) {
                extend(equipe, teamStaff);
                getPlayersFaceshots(equipe)(eachEquipeCb);
            });
        }
    }

    function getEvenementStatistiques(evenement) {
        return function (evenementStatCb) {
            fetch('xcstatistiques/:lang/:id', {id: evenement.id}, function (err, stats) {
                evenement.statistiques = stats.Statistiques;
                async.forEach(evenement.statistiques, function (equipe, eachEquipeDone) {
                    getEquipeStaff(evenement, equipe)(eachEquipeDone);
                }, evenementStatCb);
            });
        }
    }

    return function extract(cb) {
        var evenements = [];
        console.info('EXTRACT', new Date());
        async.forEach(options.evts, function eachEvenement(evtId, eachEvenementDone) {
            var evenement = {id: evtId};
            evenements.push(evenement);
            async.parallel([
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