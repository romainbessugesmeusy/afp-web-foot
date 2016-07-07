'use strict';

// deps
var $ = require('jquery');
var page = require('page');

// templates and partials
// expose the light runtime for browser
var handlebars = require('handlebars/runtime');
// require the partials to be used in the views
var partials = require('../gen/partials');
// require the views
var views = require('../gen/views');

// DOM
var $page = $('#page');

page('/', function () {

    $.getJSON('/data/scoreboard.json', function (data) {
        var scoreboard = {
            competitions: data.competitions,
            upcomingDateList: [],
            upcomingMatches: {},
            pastDateList: [],
            pastMatches: {}
        };
        var now = new Date().toISOString();
        var nowDate = now.substr(0, 10);
        var nowTime = now.substr(11, 5);

        var matchesByDateAndCompetition = {};

        $.each(data.dates, function (date, matches) {

            if (date > nowDate) {
                scoreboard.upcomingDateList.push(date);
            } else if (date < nowDate) {
                scoreboard.pastDateList.push(date);
            }

            if (typeof matchesByDateAndCompetition[date] === 'undefined') {
                matchesByDateAndCompetition[date] = {};
            }

            $(matches).each(function (i, match) {
                if (typeof matchesByDateAndCompetition[date][match.competition] === 'undefined') {
                    matchesByDateAndCompetition[date][match.competition] = [];
                }

                var winner;

                if (typeof match.home.penaltyShootoutScore !== 'undefined') {
                    winner = (match.home.penaltyShootoutScore > match.away.penaltyShootoutScore) ? 'home' : 'away';
                } else if (typeof match.home.goals !== 'undefined') {
                    winner = (match.home.goals > match.away.goals) ? 'home' : 'away';
                }

                if (winner) {
                    match[winner].winner = true;
                }
                matchesByDateAndCompetition[date][match.competition].push(match);
            });

            $.each(matchesByDateAndCompetition[date], function (competition, matches) {
                matches.sort(function (a, b) {
                    return a.time < b.time;
                });
            });
        });

        scoreboard.upcomingDateList.sort().length = 5;
        scoreboard.pastDateList.sort().reverse().length = 5;

        $(scoreboard.upcomingDateList).each(function (i, date) {
            scoreboard.upcomingMatches[date] = matchesByDateAndCompetition[date];
        });
        $(scoreboard.pastDateList).each(function (i, date) {
            scoreboard.pastMatches[date] = matchesByDateAndCompetition[date];
        });

        $page.empty().append(views.scoreboard(scoreboard));
    });

});

page('/matches/:matchId', function (ctx) {
    $.getJSON('/data/matches/' + ctx.params.matchId + '.json', function (data) {
        data.events.forEach(function (event) {
            event.players = event.players.map(function (playerId) {
                var player;
                data[event.side].players.forEach(function (p) {
                    if (p.id === playerId) {
                        player = p;
                    }
                });
                return player;
            });
        });
        $page.empty().append(views.match(data));
    });
});

page('/competitions', function () {
    $page.empty().append(views.competitions({}));
});

page('/competitions/:competition', function () {
    $page.empty().append(views.competition({}));
});

$page.on('click', '.tabs .sectionNavbar a', function () {
    var $a = $(this);
    $a.closest('nav').find('a').removeClass('active');
    $a.addClass('active');
    $a.closest('.tabs').find('.tab').removeClass('active');
    $a.closest('.tabs').find($a.attr('href')).addClass('active');
    return false;
});

page();