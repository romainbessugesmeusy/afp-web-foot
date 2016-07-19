var fs = require('fs');
var path = require('path');

module.exports = function write(filename, data) {
    //console.info('writing', filename);
    filename = path.join(__dirname, '../dist/data/' + filename + '.json');
    fs.writeFile(filename, JSON.stringify(data));
};