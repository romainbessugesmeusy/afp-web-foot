var fs = require('fs');
var path = require('path');

module.exports = function(options){
    return function load(files) {
        var prop;
        for (prop in files) {
            if (files.hasOwnProperty(prop)) {
                fs.writeFile(path.join(__dirname, '../dist/data/' + prop + '.json'), JSON.stringify(files[prop]));
            }
        }
    }
};