var events = [];

var fs = require('fs');
var async = require('async');
var path = require('path');

var teams = {};
var players = {};

var writer = require('../writer');
var fetch = require('./fetch');
var download = require('../lib/downloadFile');

var dump = require('../lib/dump');
var unique = require('array-unique');

var teamIds = [];
var playerIds = [];

function run(runCb) {
    async.each(events, function (key, clientCb) {
        var parts = key.split('_');
        var eventId = parts[0];
        var lang = parts[1];
        fetch('aaevenementinfo/:lang/:id', {id: eventId, lang: lang}, function (eventErr, eventInfo) {
            fetch('xcphases/:lang/:id', {id: eventId, lang: lang}, function (err, phasesData) {
                async.each(phasesData.Phases, function (phase, phaseCb) {
                    fetch('xcequipes/:lang/:event/:phase', {
                        lang: lang,
                        event: eventId,
                        phase: phase.PhaseId
                    }, function (err, equipesData) {
                        if (typeof equipesData === 'undefined') {
                            console.error(err);
                            process.exit();
                        }
                        async.eachLimit(equipesData.Equipes, 5, function (equipe, equipeCb) {
                            teamIds.push(parseInt(equipe.Id));
                            var k = equipe.Id + '_' + lang;
                            if (typeof teams[k] === 'undefined') {
                                teams[k] = {
                                    id: equipe.Id,
                                    name: equipe.NomAffichable,
                                    type: equipe.TeamType,
                                    country: equipe.PaysIso,
                                    staffMap: {},
                                    competitions: {}
                                };
                            }

                            if (typeof teams[k].competitions[eventId] === 'undefined') {
                                teams[k].competitions[eventId] = {
                                    id: eventId,
                                    label: eventInfo.Label,
                                    type: eventInfo.TypeEvenement,
                                    startDate: new Date(eventInfo.DateDeb),
                                    endDate: new Date(eventInfo.DateFin),
                                    staff: []
                                };
                            }

                            fetch('xcequipestaff/:lang/:event/:team', {
                                lang: lang,
                                event: eventId,
                                team: equipe.Id
                            }, function (err, staffData) {
                                if (err || typeof staffData === 'undefined') {
                                    return equipeCb();
                                }
                                async.eachLimit(staffData.Staff, 5, function (member, staffMemberCb) {

                                    players[member.Id] = {
                                        id: member.Id,
                                        name: member.NomCourt,
                                        position: member.PositionCode,
                                        fullname: member.NomLong,
                                        number: member.Bib,
                                        height: member.Taille,
                                        weight: member.Poids,
                                        birthDate: member.DateDeNaissance,
                                        representCountry: member.PaysRepresenteIso,
                                        birthCountry: member.PaysNaissanceIso,
                                        city: member.VilleNom,
                                        faceshot: true
                                    };

                                    teams[k].staffMap[member.Id] = players[member.Id];
                                    teams[k].competitions[eventId].staff.push(member.Id);
                                    playerIds.push(member.Id);
                                    staffMemberCb();
                                }, equipeCb);
                            }, fetch.CACHE);
                        }, phaseCb);
                    }, fetch.CACHE);
                }, clientCb);
            }, fetch.CACHE);
        });
    }, function () {
        console.info('PLAYERS DONE');
        async.forEachOf(teams, function (team, idAndLang, teamCb) {
            for (var eventId in team.competitions) {
                if (team.competitions.hasOwnProperty(eventId)) {
                    team.competitions[eventId].staff = unique(team.competitions[eventId].staff);
                }
            }
            writer('teams/' + idAndLang, team, teamCb);
        }, function () {
            teamIds = unique.immutable(teamIds);
            async.series([
                function (downloadFaceshotsCb) {
                    async.eachLimit(playerIds, 20, function (playerId, playerCb) {
                        getFaceshot(players[member.Id], playerCb);
                    }, downloadFaceshotsCb);
                },
                function (downloadTeamLogosCb) {
                    async.eachLimit(teamIds, 20, function (teamId, teamLogoCb) {
                        getTeamLogo(teamId, teamLogoCb);
                    }, downloadTeamLogosCb);
                }
            ], runCb)

        });
    });
}

var createOptions = require('./createOptions');

function start() {
    console.info('Update players and team');
    return new Promise(function (resolve) {
        createOptions(function (options) {
            for (var clientId in options.clients) {
                if (options.clients.hasOwnProperty(clientId)) {
                    options.clients[clientId].evts.forEach(function (eventId) {
                        events.push(eventId + '_' + options.clients[clientId].lang);
                    });
                }
            }
            events = unique(events).sort();
            run(resolve);
        });
    })
}


function getFaceshot(player, cb) {
    var uri = 'http://bdsports.afp.com/bdsapi/api/aaheadshot/' + player.id;
    var filename = path.join(__dirname, '../../dist/data/players/faceshots', player.id + '.jpg');
    download(uri, filename, cb);
}

function getTeamLogo(teamId, cb) {
    var uri = 'http://bdsports.afp.com/SPA-IMAGES/team/' + teamId + '.png';
    var filename = path.join(__dirname, '../../dist/data/teams/logos', teamId + '.png');
    download(uri, filename, cb);
}

if (process.argv[1].indexOf('workers') === -1) {
    start();
}

module.exports = start;