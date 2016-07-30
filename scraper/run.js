var options = {
    root: 'http://bdsports.afp.com:80/bdsapi/api/',
    lang: 1,
    evts: [
        5506, 5507, 6096,
        6091, 6101, 5365,
        4571, 6100, 6103,
        6095, 6149, 6094,
        6046, 6147, 5405,
        5101, 5390, 5389,
        5039, 5392, 6099,
        6104, 6141, 6102,
        6145, 6142
    ]
    //evts: [4571]
};

var extract = require('./extract')(options);
var transform = require('./transform');
var write = require('./writer');

extract(transform(write));