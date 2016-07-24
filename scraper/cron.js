var options = {
    root: 'http://bdsports.afp.com:80/bdsapi/api/',
    lang: 1,
    evts: [5506, 5507, 6096, 6091, 6101, 5365, 4571, 6100, 6103, 6095]
    //evts: [4571]
};

var extract = require('./extract')(options);
var transform = require('./transform');
var write = require('./writer');

function run() {
    extract(transform(write, function () {
        setTimeout(run, 3 * 60 * 1000);
    }));
}

run();
