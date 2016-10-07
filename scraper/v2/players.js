var options = require('../options');
var async = require('async');
var path = require('path');

var events = [];
var teams = {};
var players = {};

var writer = require('../writer');
var fetch = require('./fetch');
var download = require('../lib/downloadFile');

async.eachOf(options.clients, function (client, clientId, clientCb) {
    async.each(client.evts, function (eventId, evtCb) {
        if (events.indexOf(eventId) > -1) {
            return evtCb();
        }
        fetch('xcphases/:lang/:id', {id: eventId, lang: 1}, function (err, phasesData) {
            async.each(phasesData.Phases, function (phase, phaseCb) {
                fetch('xcequipes/:lang/:event/:phase', {
                    lang: 1,
                    event: eventId,
                    phase: phase.PhaseId
                }, function (err, equipesData) {
                    async.each(equipesData.Equipes, function (equipe, equipeCb) {
                        fetch('xcequipestaff/:lang/:event/:team', {
                            lang: 1,
                            event: eventId,
                            team: equipe.Id
                        }, function (err, staffData) {

                            async.eachLimit(staffData.Staff, 30, function (member, staffMemberCb) {

                                //if(players[member.Id]){
                                //    return staffMemberCb();
                                //}

                                players[member.Id] = {
                                    id: member.Id,
                                    name: member.NomCourt,
                                    fullname: member.NomLong,
                                    number: member.Bib,
                                    height: member.Taille,
                                    weight: member.Poids,
                                    birthDate: member.DateDeNaissance,
                                    representCountry: member.PaysRepresenteIso,
                                    birthCountry: member.PaysNaissanceIso,
                                    city: member.VilleNom
                                };

                                getFaceshot(players[member.Id], function () {
                                    writer('players/' + member.Id, players[member.Id], staffMemberCb);
                                });

                            }, equipeCb);
                        }, true);
                    }, phaseCb);
                }, true);
            }, evtCb);
        });


    }, clientCb);
}, function () {

});

function getFaceshot(player, cb) {
    var uri = options.root + 'aaheadshot/' + player.id;
    var filename = path.join(__dirname, '../../dist/data/players/faceshots', player.id + '.jpg');
    download(uri, filename, function (err) {
        if (!err) player.faceshot = true;
        cb();
    });
}