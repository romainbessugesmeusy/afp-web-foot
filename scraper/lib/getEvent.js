var fs = require('fs');
/**
 * Charge le contenu du fichier JSON et le passe au callback
 * Attention, il faut que le fichier existe
 * @param id
 * @param lang
 * @param cb
 */
module.exports = function getEvent(id, lang, cb) {
    fs.readFile(__dirname + '/../../dist/data/competitions/' + id + '_' + lang + '.json', 'utf8', function (err, content) {
        if (err) {
            return cb(err);
        }
        cb(null, JSON.parse(content));
    });
};
