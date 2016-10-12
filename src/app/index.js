'use strict';

// deps
var $ = require('jquery');
var page = require('page');

// templates and partials
// expose the light runtime for browser
var handlebars = require('handlebars/runtime');
// require the partials to be used in the views & the views
var partials = require('../gen/partials').partials;
var views = require('../gen/views');
// DOM
var $page = $('#page'); // useless ?
var $pages = {
    match: $('#match'),
    scoreboard: $('#scoreboard'),
    team: $('#team'),
    teams: $('#teams'),
    competition: $('#competition'),
    competitions: $('#competitions'),
    player: $('#player')
};

var appCtx = window.appCtx = {
    currentPage: '',
    scoreboard: {
        upcomingDate: null,
        pastDate: null
    },
    competition: {
        day: null,
        month: null,
        country: null
    },
    data: {
        scoreboard: null,
        match: {},
        team: {},
        competition: {},
        player: {}
    }
};

var processScoreboardData = require('./processScoreboardData');
var processMatchData = require('./processMatchData');
var processCompetitionData = require('./processCompetitionData');
var processCompetitionsData = require('./processCompetitionsData');
var processTeamData = require('./processTeamData');
var processPlayerData = require('./processPlayerData');
var activateMatchTab = require('./activateMatchTab');
var pageScroll = require('./pageScroll').bind();

var handleDateParams = require('./handleDateParams')(appCtx);
var listenToUserEvents = require('./listenToUserEvents')(appCtx);
var showPage = require('./showPage')(appCtx);

var live = require('./live');
var moment = require('moment');
require('moment/locale/fr');
require('moment/locale/es');
require('moment/locale/en-gb');


$('body').on('keyup', '.filter > input', function () {
    var styleEl = $('#filterRules');
    if (this.value === '') {
        styleEl.text('');
        return;
    }

    var target = $(this).closest('.filter').data().target;
    var rule = target + ' > *:not([data-search*="' + this.value.toUpperCase() + '"]) { display: none }';
    styleEl.text(rule);
}).append('<style id="filterRules"></style>');

var _timer;
var _message;
var _started;
var b = function (message) {
    if (_started) {
        bs();
    }
    _timer = new Date();
    _message = message;
    _started = true;
};

var bs = function () {
    _started = false;
    console.log(_message, new Date() - _timer, 'ms');
};
//
// SCOREBOARD
//
page('/', function (ctx, next) {
    // scoreboard data already processed, next
    // when live data will be there, we'll need to test a 'lastRefreshDate' value
    if (appCtx.data.scoreboard) {
        return next();
    }
    b('scoreboard getJSON');
    $.getJSON('/data/scoreboard.json?c=' + Date.now(), function (data) {
        b('scoreboard process');
        appCtx.data.scoreboard = processScoreboardData(data);
        b('scoreboard markup');
        var markup = views.scoreboard(appCtx.data.scoreboard);
        b('scoreboard append');
        $pages.scoreboard.get(0).innerHTML = markup;
        bs();
        next();
    });

}, handleDateParams, showPage($pages.scoreboard));
//
// SCOREBOARD EXIT (reset date params in context)
page.exit('/', function (ctx, next) {
    delete appCtx.scoreboard.upcomingDate;
    delete appCtx.scoreboard.pastDate;
    next();
});

//
// INDIVIDUAL MATCH
//

page('/matches/:matchId/*', function (ctx, next) {
    b('match getJSON');
    $.getJSON('/data/matches/' + ctx.params.matchId + '_' + window.langId + '.json?c=' + Date.now(), function (data) {
        b('match process');
        var match = processMatchData(data);
        appCtx.currentMatchId = parseInt(ctx.params.matchId);
        b('match markup');
        var markup = views.match(match);
        b('match append');
        $pages.match.get(0).innerHTML = markup;
        bs();
        next()
    }).fail(function () {
        page('/')
    });
}, showPage($pages.match, true));

//
// MATCH TABS (called after the individual match route)
//
page('/matches/:matchId/', activateMatchTab('infos'));
page('/matches/:matchId/evenements', activateMatchTab('events'));
page('/matches/:matchId/tirs-au-but', activateMatchTab('penaltyShootouts'));
page('/matches/:matchId/composition', activateMatchTab('composition'));
page('/matches/:matchId/infos', activateMatchTab('infos'));

//
// COMPETITIONS DASHBOARD
//
page('/competitions', function (ctx, next) {

    b('competitions getJSON');
    $.getJSON('/data/competitions.json?c=' + Date.now(), function (data) {
        b('competitions process');
        var competitions = processCompetitionsData(data);
        b('competitions markup');
        var markup = views.competitions(data);
        b('competitions append');
        $pages.competitions.get('0').innerHTML = markup;
        next();
    });

}, showPage($pages.competitions));

//
// INDIVIDUAL COMPETITION
//
page('/competitions/:competitionId', function (ctx, next) {

    b('competition getJSON');
    $.getJSON('/data/competitions/' + ctx.params.competitionId + '_' + window.langId + '.json?c=' + Date.now(), function (data) {
        b('competition process');
        var competition = processCompetitionData(data);
        b('competition markup');
        var markup = views.competition(competition);
        b('competition append');
        $pages.competition.get(0).innerHTML = views.competition(competition);
        bs();
        appCtx.currentCompetitionId = competition.id;
        next();
    });
}, handleCompetitionParams, showPage($pages.competition));

var deparam = require('./deparam');

function handleCompetitionParams(ctx, next) {
    var params = (ctx.querystring) ? deparam(ctx.querystring) : {};
    var $aDayOfCompetition = $('a[data-param="day"].nearest');
    var $aPhase = $('a[data-param="phase"].nearest');
    // take the first links to get the defaults
    params.day = params.day || $aDayOfCompetition.attr('data-value');
    params.phase = params.phase || $aPhase.attr('data-value');
    params.country = params.country || $('a[data-param="country"]:eq(0)').attr('data-value');

    // in the same rendering frame
    // we activate the tab and link for both

    window.requestAnimationFrame(function () {

        if (appCtx.competition.phase !== params.phase) {
            $('a[data-param="phase"]').removeClass('active');
            $('.calendarWrapper').find('.wrapper[data-phase]').removeClass('active');
            $('a[data-param="phase"][data-value="' + params.phase + '"]').addClass('active');
            $('.wrapper[data-phase="' + params.phase + '"]').addClass('active');
            // store in order to preserve browser repaints
            appCtx.competition.phase = params.phase;
        }

        if (appCtx.competition.day !== params.day) {
            $('a[data-param="day"]').removeClass('active');
            $('.calendarWrapper').find('.wrapper[data-day]').removeClass('active');
            $('a[data-param="day"][data-value="' + params.day + '"]').addClass('active');
            $('.wrapper[data-day="' + params.day + '"]').addClass('active');
            // store in order to preserve browser repaints
            appCtx.competition.day = params.day;
        }
        next();
    });
}
//
// INDIVIDUAL TEAM
//
page('/teams/:teamId', function (ctx, next) {
    $.getJSON('/data/teams/' + ctx.params.teamId + '_' + window.langId + '.json?c=' + Date.now(), function (data) {
        var team = processTeamData(data);
        console.info('processedTeamData', team);
        $pages.team.empty().append(views.team(team));
        next();
    });
}, handleParams, showPage($pages.team));

function handleParams(ctx, next) {
    var defaultValue = $('a.current[data-param=competition]').eq(0).attr('data-value');

    var params = (ctx.querystring) ? deparam(ctx.querystring) : {competition: defaultValue};
    for (var k in params) {
        if (params.hasOwnProperty(k)) {
            $('.sectionNavbar a').removeClass('active');
            $('.sectionNavbar a[data-param=' + k + '][data-value=' + params[k] + ']').addClass('active');
            $('.tab').removeClass('active');
            $('.tab[data-' + k + '="' + params[k] + '"]').addClass('active');
        }
    }
    next();

}

page('/players/:playerId', function (ctx, next) {
    $.getJSON('/data/players/' + ctx.params.playerId + '.json', function (data) {
        var markup = processPlayerData(data);
        $pages.player.get('0').innerHTML = views.player(markup);
        next();
    });

}, showPage($pages.player));

$.getJSON('/data/config.json', function (config) {
    $.getJSON('/data/locale/' + config.locale + '.json?c=' + Date.now(), function (translations) {
        window.translations = translations;
        window.langId = config.lang;
        window.locale = config.locale;
        window.moment = moment;
        window.config = config;

        moment.locale(config.locale);
        $('body > header').append(partials.mainMenu());
        page();
    });
});
