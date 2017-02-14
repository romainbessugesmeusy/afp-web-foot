var options = require('./options');
var exec = require('../lib/exec');

exec.scoreboards({clients: Object.keys(options.clients)});