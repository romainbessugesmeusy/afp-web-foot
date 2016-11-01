var events = [];

var fs = require('fs');
var async = require('async');
var path = require('path');
var http = require('http');

var teams = {};
var players = {};

var writer = require('../writer');
var fetch = require('./fetch');
var fileExists = require('../lib/fileExists');
//var download = require('../lib/downloadFile');

var request = require('request');
var download = function (url, dest, cb) {
    fileExists(dest, cb, function () {
        var file = fs.createWriteStream(dest);
        http.get(url, function (response) {
            response.pipe(file);
            file.on('finish', function () {
                console.info('wrote', url, dest);
                file.close(cb);  // close() is async, call cb after close completes.
            });
        }).on('error', function (err) { // Handle errors
            fs.unlink(dest); // Delete the file async. (But we don't check the result)
            if (cb) cb(err.message);
        });
    });
};

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
                                    if (playerIds.indexOf(parseInt(member.Id)) === -1) {
                                        playerIds.push(parseInt(member.Id));
                                    }
                                    staffMemberCb();
                                }, equipeCb);
                            }, cachePolicy);
                        }, phaseCb);
                    }, cachePolicy);
                }, clientCb);
            }, cachePolicy);
        });
    }, function () {
        console.info('Data extracted');
        async.parallel(tasks, runCb)
    });
}

function createPlayerFiles(cb) {
    console.info('Creating player files');
    async.forEachOf(players, function (player, id, playerCb) {
        writer('players/' + id, player, playerCb);
    }, cb)
}

function downloadFaceshots(cb) {
    console.info('Downloading Players\' faceshots');
    console.info('Before dedup', playerIds.length);
    playerIds = unique(playerIds);
    console.info('After', playerIds.length);
    async.eachLimit(playerIds, 20, function (playerId, playerCb) {
        getFaceshot(players[playerId], playerCb);
    }, cb);
}
function createTeamFiles(cb) {
    console.info('Creating team files');
    async.forEachOf(teams, function (team, idAndLang, teamCb) {
        for (var eventId in team.competitions) {
            if (team.competitions.hasOwnProperty(eventId)) {
                team.competitions[eventId].staff = unique(team.competitions[eventId].staff);
            }
        }
        writer('teams/' + idAndLang, team, teamCb);
    }, cb)
}
function downloadTeamLogos(cb) {

    console.info('Downloading Teams\' logos');
    teamIds = unique.immutable(teamIds);
    async.eachLimit(teamIds, 20, function (teamId, teamLogoCb) {
        getTeamLogo(teamId, teamLogoCb);
    }, cb);
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

function opt(option) {
    return process.argv.indexOf('--' + option) > -1
}
var tasks = [];
var cachePolicy = fetch.INVALIDATE;

if (process.argv[1].indexOf('workers') === -1) {
    if (opt('players')) {
        tasks.push(createPlayerFiles);
    }
    if (opt('teams')) {
        tasks.push(createTeamFiles);
    }
    if (opt('faceshots')) {
        tasks.push(downloadFaceshots);
    }
    if (opt('logos')) {
        tasks.push(downloadTeamLogos);
    }
    if (opt('cache')) {
        cachePolicy = fetch.CACHE;
    }
    start();
}

module.exports = start;