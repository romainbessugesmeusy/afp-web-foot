var options = require('./options');
var extract = require('./extract')(options);
var transform = require('./transform');
var write = require('./writer');

function run() {
    extract(transform(write, function () {
        setTimeout(run, 3 * 60 * 1000);
    }));
}

run();
