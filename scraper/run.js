var options = {
    root: 'http://bdsports.afp.com:80/bdsapi/api/',
    lang: 1,
    evts: [5365, 4571]
};

var extract = require('./extract')(options);
var transform = require('./transform')(options);
var load = require('./load')(options);

extract(transform(load));