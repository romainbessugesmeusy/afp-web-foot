var XmlStream = require('xml-stream');
var fs = require('fs');
var path = require('path');
var filename = path.join(__dirname, 'dist/data/codifications.fr.xml');
var translationFilename = path.join(__dirname, 'dist/data/locale/fr.json');
var stream = fs.createReadStream(filename);
var extend = require('extend');
var translations = {};

stream.on('readable', function () {
    var xml = new XmlStream(stream, 'utf8');
    xml.collect('type');
    xml.collect('constant');
    xml.on('end', function () {
        console.info(translations);
        fs.readFile(translationFilename, 'utf8', function(json){
            var translationsInFile = JSON.parse(json) || {};
            extend(translationsInFile, translations);
            fs.writeFile(translationFilename, JSON.stringify(translationsInFile, null, 2), function(){
                console.info('OK');
                process.exit();
            });
        });
    });
    xml.on('endElement: afpdb', function (data) {
        data.body.discipline.type.forEach(function (type) {
            type.constant.forEach(function (constant) {
                translations['const.' + constant.$.code] = constant.$.name;
            });
        });
    });
});