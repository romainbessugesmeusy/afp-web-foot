var request = require('request');
var fs = require('fs');
var path = require('path');
var async = require('async');
var extend = require('extend');

var listeEvenementFoot = [
    {"Id": 5101, "Label": "Coupe du monde 2018 : Qualifications Zone Asie"},
    {"Id": 5039, "Label": "Coupe du monde 2018 : Qualifications CONCACAF"},
    {"Id": 5187, "Label": "CAN 2017 : Qualifications"},
    {"Id": 5405, "Label": "Coupe du monde 2018 : Qualifications Zone OFC"},
    {"Id": 5399, "Label": "Tunisie : Ligue 1 (2015/2016)"},
    {"Id": 5389, "Label": "Coupe du monde 2018 : Qualifications Zone Afrique"},
    {"Id": 5390, "Label": "Coupe du monde 2018 : Qualifications Zone Amérique du sud"},
    {"Id": 5821, "Label": "Matches amicaux de football 2016"},
    {"Id": 4571, "Label": "Euro 2016"},
    {"Id": 5507, "Label": "Norvège : Tippeligaen (2016)"},
    {"Id": 5506, "Label": "Suède : Allsvenskan (2016)"},
    {"Id": 6074, "Label": "Euro 2016 (IP)"},
    {"Id": 6092, "Label": "Copa America 2016 (IP)"},
    {"Id": 5822, "Label": "Copa America 2016"},
    {"Id": 6097, "Label": "Etats-Unis : MLS (2016)"},
    {"Id": 6100, "Label": "Ligue des Champions (2016/2017)"},
    {"Id": 6101, "Label": "Ligue Europa (2016/2017)"},
    {"Id": 6091, "Label": "France : Ligue 1 (2016/2017)"},
    {"Id": 6098, "Label": "Angleterre : Premiership (2016/2017)"},
    {"Id": 6096, "Label": "Danemark : ALKA Superliga (2016/2017)"},
    {"Id": 6099, "Label": "Autriche : Bundesliga (2016/2017)"},
    {"Id": 6103, "Label": "Suisse : Super League (2016/2017)"},
    {"Id": 6108, "Label": "Allemagne : Bundesliga (2016/2017)"},
    {"Id": 6094, "Label": "France : Ligue 2 (2016/2017)"},
    {"Id": 6095, "Label": "Belgique : Jupiler League (2016/2017)"},
    {"Id": 5853, "Label": "Football dames"},
    {"Id": 5852, "Label": "Football messieurs"},
    {"Id": 6105, "Label": "Angleterre : Championship (2016/2017)"},
    {"Id": 6102, "Label": "Pays-Bas : Eredivisie (2016/2017)"},
    {"Id": 6104, "Label": "Ecosse : Premier League (2016/2017)"},
    {"Id": 6106, "Label": "Coupe de la Ligue anglaise (2016/2017)"},
    {"Id": 5392, "Label": "Coupe du monde 2018 : Qualifications Zone Europe"},
    {"Id": 6024, "Label": "Coupe des confédérations 2017"}];

var defaults = {
    root: 'http://bdsports.afp.com:80/bdsapi/api/',
    lang: 1,
    evts: listeEvenementFoot.map(function (evenement) {
        return evenement.Id;
    })
};


var fetch = function (resource, params, callback) {

    resource = resource.replace(/:\w+/g, function (param) {
        return params[param.substring(1)] || defaults[param.substring(1)];
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
            console.info('loading uncached resource', defaults.root + resource);
            request(defaults.root + resource, function (error, response, body) {
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
            });
            matchesPhaseCb();
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
        fetch('xcequipestaff/:lang/:evtId/:id', {evtId: evenement.id, id: equipe.TeamId}, function (err, teamStaff) {
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

function extract(cb) {
    var evenements = [];
    async.forEach(defaults.evts, function eachEvenement(evtId, eachEvenementDone) {
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
                label: evenement.Label,
                country: evenement.CountryIso
            };
        });
        evenementsCb();
    }
}

function transform(transformCb) {
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

function load(files) {
    var prop;
    for (prop in files) {
        if (files.hasOwnProperty(prop)) {
            fs.writeFile(path.join(__dirname, '../dist/data/' + prop + '.json'), JSON.stringify(files[prop]));
        }
    }
}

extract(transform(load));