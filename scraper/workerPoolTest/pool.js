var pool = require('workerpool').pool(__dirname + '/../v2/workers.js');

pool.exec('match', [6149,189529, 2])
    .then(function (result) {
        console.log('Result: ' + result);
        pool.clear();
    });
