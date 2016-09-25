var event = {id: process.argv[2]};
var lang = process.argv[3] || '1';

var async = require('async');
var extend = require('extend');
var util = require('util');

var fetch = require('./fetch');
var extractScoreboardTeamInfo = require('../lib/extractScoreboardTeamInfo');
var createLightMatch = require('../lib/createLightMatch');
var setMatchWinner = require('../../src/app/setMatchWinner');
var writer = require('../writer');


if (typeof event.id === 'undefined') {
    process.stdout.print(JSON.stringify({
        error: 1,
        args: process.argv
    }));
    process.exit();
}

function getEquipes(cb) {
    fetch('xcequipes/:lang/:id/0', {id: event.id, lang: lang}, function (err, data) {
        event.Equipes = data.Equipes;
        cb();
    });
}

function getEvenementInfos(cb) {
    fetch('aaevenementinfo/:lang/:id', {id: event.id, lang: lang}, function (err, evenementInfos) {
        extend(event, evenementInfos);
        cb();
    });
}

function getPhases(cb) {
    fetch('xcphases/:lang/:id', {id: event.id, lang: lang}, function (err, phasesJson) {
        if (err) {
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
    });
}

function getPhaseMatches(phase, cb) {
    fetch('xcmatchesphase/:lang/:id', {id: phase.PhaseId, lang: lang}, function (err, matches) {
        phase.matches = matches.Matches;
        cb();
    }, true);
}

function getClassementGroupe(groupe, cb) {
    fetch('xcclassementgroupe/:lang/:evenementId/:groupeId', {
        evenementId: event.id,
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


    competition.phases = event.Phases.map(function eachPhase(phase) {
        var p = {
            format: phase.PhaseCompetCode,
            type: phase.TypePhaseCode
        };

        p.topScorers = [];
        phase.classementButeurs.forEach(function (topScorer, i) {
            p.topScorers.push({
                pos: i + 1,
                playerId: topScorer.PlayerId,
                teamId: topScorer.TeamId,
                goals: topScorer.NbGoals,
                name: topScorer.PlayerNomCourt
            });
        });

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
                var m = createLightMatch(event.id, phase.PhaseCompetCode, match);
                competition.matches.push(m);
            });
        } else {
            console.warn('phase.matches is undefined', event.id);
        }
        p.rankings = {};

        var hasRankings = false;
        phase.Groupes.forEach(function eachGroupClassement(groupe) {
            if (groupe.Classement.Classements.length) {
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

        competition.matches.sort(function (a, b) {
            var lA = competition.groups[a.group].label, lB = competition.groups[b.group].label;
            if (lA && lB) {
                var compare = lB.localeCompare(lA);
                return (compare === 0) ? (b.date < a.date ? -1 : 1) : compare;
            }
            return a.group - b.group;
        });

        return p;
    });

    competition.teams = event.Equipes.map(function eachEquipe(equipe) {
        return {
            name: equipe.NomAffichable,
            country: equipe.PaysIso,
            id: equipe.Id
        };
    });

    return competition;

}

function run() {
    async.parallel([
        getEvenementInfos,
        getEquipes,
        getPhases
    ], function () {
        var competition = processCompetition();
        writer('competitions/' + competition.id + '_' + lang, competition, function () {
            process.exit();
        });
    });
}

run();