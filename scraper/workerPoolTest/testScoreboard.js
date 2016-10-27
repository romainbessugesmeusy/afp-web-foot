var pool = require('workerpool').pool(__dirname  + '/../v2/workers');

pool.exec('scoreboard', ['gdn'], function(result){
    console.info(result);
});