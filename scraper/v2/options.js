var options = require('../options.json');
var unique = require('array-unique');
var combinations = [];
var langs = [];
var events = [];

function parseKey(key) {
    var parts = key.split('_');
    return {id: parseInt(parts[0]), lang: parts[1]}
}

for (var clientId in options.clients) {
    //noinspection JSUnfilteredForInLoop
    var client = options.clients[clientId];
    client.evts.forEach(function (evt, i) {
        client.evts[i] = parseInt(evt);
        langs.push(client.lang);
        events.push(parseInt(evt));
        combinations.push(evt + '_' + client.lang);
    });
}

unique(langs);
unique(events);
combinations = unique.immutable(combinations).map(parseKey);

module.exports = {
    clients: options.clients,
    events: events,
    combinations: combinations,
    langs: langs,
    eventForSportAndCode: function (sport, code) {
        for (var eventId in options.events) {
            console.info('eventForSportAndCode', {sport: sport, code: code}, options.events[eventId]);
            if (options.events[eventId].discipline === sport && options.events[eventId].codeFTP === code) {
                return options.events[eventId].eventId;
            }
        }
    },
    langsForEvent: function (event) {
        return combinations.filter(function (combination) {
            return combination.id === parseInt(event)
        }).map(function (comb) {
            return comb.lang;
        });
    },
    langIdForLocale: function (locale) {
        var map = {
            fr: 1,
            en: 2,
            es: 3
        };
        return map[locale];
    },
    clientsForEvent: function (event, lang) {
        var clients = [];
        for (var clientId in options.clients) {
            var client = options[clientId];
            if (client.evts.indexOf(event) > -1 && client.lang === lang) {
                clients.push(clientId);
            }
        }
        return clients;
    }
};

// console.dir(module.exports);