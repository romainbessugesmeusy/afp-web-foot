var util = require('util');
module.exports = function () {
    for (var i = 0; i < arguments.length; i++) {
        process.stdout.write(util.inspect(arguments[i], {showHidden: false, depth: 32, colors: true}));
        process.stdout.write('\t');
    }
    process.stdout.write('\n');
};