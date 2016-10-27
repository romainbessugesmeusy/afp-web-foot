var fs = require('fs');
var exec = require('./exec')(function (event) {
    console.info(event);
});

function parseJSON(string, debug) {
    var json;
    try {
        json = JSON.parse(string);
    } catch (err) {
        //var errorMessage = debug || 'could not parse JSON';
        //errorMessage += '\n> ' + string;
        //console.error(errorMessage);
    }
    return json;

}


var eventsHash = {};


/**
 * Charge le contenu du fichier JSON et le passe au callback
 * Attention, il faut que le fichier existe
 * @param id
 * @param lang
 * @param cb
 */
module.exports = function getEvent(id, lang, cb) {
    var key = id + '_' + lang;
    //if (typeof eventsHash[key] === 'undefined') {
        fs.readFile(__dirname + '/../../dist/data/competitions/' + id + '_' + lang + '.json', 'utf8', function (err, content) {
            var json = parseJSON(content, 'getEvent(' + id + ',' + lang + ')\n Err:' + err + ')');
            if (err || typeof json === 'undefined') {
                return exec.event(id, lang, function () {
                    getEvent(id, lang, cb);
                });
            }
            eventsHash[key] = json;
            cb(json);
        });
    //} else {
    //    return cb(eventsHash[key]);
    //}
};

module.exports.invalidate = function (key) {
    delete eventsHash[key]
};
