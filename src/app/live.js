var socket = io(':5000');
var hb = require('../gen/partials');
var $ = require('jquery');
var debounce =  require('debounce');

// require the partials to be used in the views & the views
var partials = require('../gen/partials').partials;
var views = require('../gen/views');
var processMatchData = require('./processMatchData');
var ctx = window.appCtx;
var playSound = function () {
    var audio = $('#notificationSound').get(0);
    audio.volume = 0.5;
    try {
        audio.pause();
        audio.currentTime = 0;
        audio.play();
    } catch (err) {
        console.error(err);
    }
};

var dPlaySound = debounce(playSound, 1000, true);

socket.on('match', function (data) {
    console.info('match', data);
    dPlaySound();
    var partial = data.status === 'EMNCO' ? 'upcomingMatch' : 'pastMatch';
    $('[data-match-id=' + data.id + ']').replaceWith(hb.partials[partial](data));
    $('[data-livematch-id=' + data.id + ']').replaceWith(hb.partials.liveMatch(data));

    if (ctx.currentMatchId === data.id && ctx.currentPage.attr('id') === 'match' && ctx.lang === data.lang) {
        reloadMatch(data.id);
    }
});

socket.on('comments', function (payload) {
    console.info('comments', payload);
    if (ctx.currentMatchId === payload.matchId && ctx.currentPage.attr('id') === 'match' && payload.lang === ctx.lang) {
        reloadMatch(matchId);
    }
});

socket.on('scoreboard', function (data) {
    console.info('scoreboard', data);
    //dPlaySound()
});

socket.on('event', function (data) {
    console.info('event', data);
    //dPlaySound();
});


function reloadMatch(matchId) {
    $.getJSON('/data/matches/' + matchId + '_' + window.langId + '.json?c=' + Date.now(), function (data) {
        var match = processMatchData(data);
        var $shadow = $('<div>').append(views.match(match));
        var $match = ctx.currentPage;
        window.requestAnimationFrame(function () {

            function patch(selector) {
                var matchEl = $match.find(selector);
                var shadowEl = $shadow.find(selector);
                if (matchEl.html() != shadowEl.html()) {
                    matchEl.replaceWith(shadowEl);
                    console.info('patched', selector);
                }
            }

            patch('#liveMatch > header');
            patch('#matchTabs .infosWrapper > .periods');
            patch('#matchTabs .infosWrapper > .referees');
            patch('#matchTabs .infosWrapper > .stadium');
            patch('#events .eventsWrapper');
            patch('#composition .compositionWrapper .team.home');
            patch('#composition .compositionWrapper .team.away');
        });
    });
}
window.dPlaySound = dPlaySound;
window.reloadMatch = reloadMatch;