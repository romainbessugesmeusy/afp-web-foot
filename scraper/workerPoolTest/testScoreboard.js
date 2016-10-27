var pool = require('workerpool').pool(require('../v2/workrs'));

pool.exec('scoreboard', ['demo'], function(result){
    console.info(result);
});