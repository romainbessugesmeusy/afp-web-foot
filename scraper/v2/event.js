var async = require('async');
var extend = require('extend');
var util = require('util');

var fetch = require('./fetch');
var extractScoreboardTeamInfo = require('../lib/extractScoreboardTeamInfo');
var createLightMatch = require('../lib/createLightMatch');
var setMatchWinner = require('../../src/app/setMatchWinner');
var writer = require('../writer');


function run(eventId, lang) {

    console.info('$$ EVENT', eventId, 'LANG', lang);

    var event = {id: eventId};

    function getEquipes(cb) {
        fetch('xcequipes/:lang/:id/0', {id: event.id, lang: lang}, function (err, data) {
            event.Equipes = data ? data.Equipes : [];
            cb();
        }, true);
    }

    function getEvenementInfos(cb) {
        fetch('aaevenementinfo/:lang/:id', {id: event.id, lang: lang}, function (err, evenementInfos) {
            extend(event, evenementInfos);
            cb();
        }, true);
    }

    function getPhases(cb) {
        fetch('xcphases/:lang/:id', {id: event.id, lang: lang}, function (err, phasesJson) {
            if (err || typeof phasesJson === 'undefined') {
                console.error(err);
                return cb();
            }
            event.Phases = phasesJson.Phases;
            async.each(event.Phases, function (phase, phaseCb) {
                async.parallel([
                    function (phaseMatchesCb) {
                        getPhaseMatches(phase, phaseMatchesCb);
                    },
                    function (classementButeursCb) {
                        getClassementButeurs(phase, classementButeursCb)
                    },
                    function (classementGroupeCb) {
                        async.each(phase.Groupes, function (groupe, groupeCb) {
                            getClassementGroupe(groupe, groupeCb);
                        }, classementGroupeCb);
                    }
                ], phaseCb);
            }, cb)
        }, true);
    }

    function getClassementButeurs(phase, cb) {
        fetch('xcclassementbuteurs/:lang/:event/:phase', {
            event: event.id,
            lang: lang,
            phase: phase.PhaseCompetCode
        }, function (err, classementButeursJson) {
            if (err) {
                console.error(err);
                return cb();
            }
            phase.classementButeurs = classementButeursJson.TopScorers;
            return cb();
        }, true);
    }

    function getPhaseMatches(phase, cb) {
        var today = new Date();
        fetch('xcmatchesphase/:lang/:id', {id: phase.PhaseId, lang: lang}, function (err, matches) {
            if (err) {
                return cb();
            }
            phase.matches = matches.Matches;
            async.forEach(phase.matches, function (m, matchCb) {
                var matchDate = new Date(m.Date);
                if (matchDate.toDateString() !== today.toDateString()) {
                    return matchCb();
                } else {
                    fetch('xclivematch/:lang/:id', {id: m.Id, lang: lang, event: eventId}, function (err, match) {
                        m.Minute = match.Minute;
                        m.StatusCode = match.StatusCode;
                        ['Home', 'Away'].forEach(function (side) {
                            m[side].TeamNbYellowCards = match[side].TeamNbYellowCards;
                            m[side].TeamNbRedCards = match[side].TeamNbRedCards;
                            m[side].TeamScore = match[side].TeamScore;
                            m[side].TeamTabScore = match[side].TeamTabScore;
                        });
                        return matchCb();
                    }, true);
                }
            }, cb);
        }, true);
    }

    function getClassementGroupe(groupe, cb) {
        fetch('xcclassementgroupe/:lang/:evenementId/:groupeId', {
            evenementId: event.id,
            lang: lang,
            groupeId: groupe.GroupeId
        }, function (err, classement) {
            groupe.Classement = classement;
            cb();
        }, true);
    }

    function processCompetition() {

        var competition = {
            id: event.id,
            label: event.Label,
            country: event.CountryIso,
            gender: event.GenderCode,
            startDate: event.DateDeb,
            endDate: event.DateFin,
            type: event.TypeEvenement,
            matches: [],
            groups: {}
        };

        if (event.Phases) {
            competition.phases = event.Phases.map(function eachPhase(phase) {
                var p = {
                    format: phase.PhaseCompetCode,
                    type: phase.TypePhaseCode
                };

                p.topScorers = [];
                phase.classementButeurs = phase.classementButeurs || [];
                phase.classementButeurs.forEach(function (topScorer, i) {
                    p.topScorers.push({
                        pos: i + 1,
                        playerId: topScorer.PlayerId,
                        teamId: topScorer.TeamId,
                        goals: topScorer.NbGoals,
                        name: topScorer.PlayerNomCourt
                    });
                });

                // limite des buteurs à 20
                if (p.topScorers.length > 20) {
                    p.topScorers.length = 20;
                }

                phase.Groupes.forEach(function eachGroup(group) {
                    competition.groups[group.GroupeId] = {
                        id: group.GroupeId,
                        label: group.GroupeLabel,
                        name: group.GroupeNom,
                        isClass: group.IsClass
                    };
                });

                if (Array.isArray(phase.matches)) {
                    phase.matches.forEach(function eachMatch(match) {
                        var m = createLightMatch(competition, phase.PhaseCompetCode, match);
                        competition.matches.push(m);
                    });
                } else {
                    console.warn('phase.matches is undefined', event.id);
                }
                p.rankings = {};

                var hasRankings = false;
                phase.Groupes.forEach(function eachGroupClassement(groupe) {
                    if (groupe.Classement && groupe.Classement.Classements && groupe.Classement.Classements.length) {
                        hasRankings = true;
                        var props = {};
                        groupe.Classement.Colonnes.forEach(function (colonne) {
                            props[colonne.DataTypeId] = colonne.DataTypeCode;
                        });
                        p.rankings[groupe.GroupeId] = {
                            rows: [],
                            cols: groupe.Classement.Colonnes.map(function (col) {
                                return {
                                    abbr: col.DataTypeAbrev,
                                    code: col.DataTypeCode,
                                    title: col.DataTypeLabel
                                }
                            })
                        };

                        p.rankings[groupe.GroupeId].rows = groupe.Classement.Classements[0].Classement.map(function (team) {
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

                var now = new Date();
                competition.matches.forEach(function (m) {
                    if (m.status === 'EMENC' || m.status === 'EMPAU') {
                        m.now = now;
                    }
                });

                competition.matches.sort(function (a, b) {
                    var lA = competition.groups[a.group].label,
                        lB = competition.groups[b.group].label,
                        dA = new Date(a.date),
                        dB = new Date(b.date);

                    if (lA && lB) {
                        var sortByGroupLabel = lB.localeCompare(lA);
                        return (sortByGroupLabel === 0) ? dA - dB : sortByGroupLabel;
                    }

                    var sortByGroupId = a.group - b.group;

                    return (sortByGroupId === 0) ? dA - dB : sortByGroupId;
                });

                return p;
            });
        }
        competition.teams = event.Equipes.map(function eachEquipe(equipe) {
            return {
                name: equipe.NomAffichable,
                country: equipe.PaysIso,
                id: equipe.Id
            };
        });

        return competition;

    }

    return new Promise(function (resolve) {
        async.parallel([
            getEvenementInfos,
            getEquipes,
            getPhases
        ], function () {
            var competition = processCompetition();
            console.info('event done', competition.id, lang);
            writer('competitions/' + competition.id + '_' + lang, competition, function () {
                resolve();
            });
        });
    });
}

if (process.argv.length > 2) {
    run(process.argv[2], process.argv[4] || 1);
}

module.exports = run;