var options = require('./options');
var extract = require('./extract')(options);
var transform = require('./transform');
var write = require('./writer');

extract(transform(write));