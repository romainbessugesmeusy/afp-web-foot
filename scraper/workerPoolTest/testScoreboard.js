var pool = require('workerpool').pool(__dirname  + '/../v2/workers');

pool.exec('scoreboard', ['demo'], function(result){
    console.info(result);
});