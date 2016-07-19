var $ = require('jquery');
var paginateNavbar = require('./paginateNavbar');
var deparam = require('./deparam');

module.exports = function(appCtx){

    return function (ctx, next) {

        // Warning ! window.location.search isn't populated as it should
        // /?pastDate=2016-07-01&upcomingDate=2016-07-04
        var params = (ctx.querystring) ? deparam(ctx.querystring) : {};

        // take the first links to get the defaults
        params.upcomingDate = params.upcomingDate || $('a[data-param="upcomingDate"]:eq(0)').attr('data-value');
        params.pastDate = params.pastDate || $('a[data-param="pastDate"]:last-child').attr('data-value');

        var $upcomingMatchesTabs = $('#upcomingMatchesTabs');
        var $pastMatchesTabs = $('#pastMatchesTabs');

        // in the same rendering frame
        // we activate the tab and link for both
        window.requestAnimationFrame(function () {

            if (appCtx.scoreboard.upcomingDate !== params.upcomingDate) {
                $('a[data-param="upcomingDate"]').removeClass('active');
                $upcomingMatchesTabs.find('.tab.date').removeClass('active');
                $('a[data-param="upcomingDate"][data-value="' + params.upcomingDate + '"]').addClass('active').removeClass('prev next');
                $('#upcomingMatches-date-' + params.upcomingDate).addClass('active');
                // store in order to preserve browser repaints
                appCtx.scoreboard.upcomingDate = params.upcomingDate;
                paginateNavbar($upcomingMatchesTabs.find('.sectionNavbar'))
            }

            if (appCtx.scoreboard.pastDate !== params.pastDate) {
                $('a[data-param="pastDate"]').removeClass('active');
                $pastMatchesTabs.find('.tab.date').removeClass('active');
                $('[data-param="pastDate"][data-value="' + params.pastDate + '"]').addClass('active').removeClass('prev next');
                $('#pastMatches-date-' + params.pastDate).addClass('active');
                appCtx.scoreboard.pastDate = params.pastDate;
                paginateNavbar($pastMatchesTabs.find('.sectionNavbar'))
            }

            $('.sectionNavbar').each(function () {
                var $this = $(this);
                $this.find('button.prev').toggleClass('hidden', $this.find('a.prev').length === 0);
                $this.find('button.next').toggleClass('hidden', $this.find('a.next').length === 0);
            });

            next();
        });

    };
}