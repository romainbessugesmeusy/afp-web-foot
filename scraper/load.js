var fs = require('fs');
var path = require('path');

module.exports = function (options) {
    return function load(files) {
        var prop;
        for (prop in files) {
            if (files.hasOwnProperty(prop)) {
                if (Array.isArray(files[prop])) {
                    files[prop].forEach(function (file) {
                        fs.writeFile(path.join(__dirname, '../dist/data/' + file.name + '.json'), JSON.stringify(file.data));
                    });
                } else {
                    fs.writeFile(path.join(__dirname, '../dist/data/' + prop + '.json'), JSON.stringify(files[prop]));
                }
            }
        }
    }
};