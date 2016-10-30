var $ = require('jquery');
var analyticsLoader = require('./analytics');


module.exports = function (appCtx) {
    var analytics = analyticsLoader(appCtx.analyticsWriteKey);
    return function (page, callNext) {
        return function (ctx, next) {
            analytics.page();
            if (appCtx.currentPage !== page) {
                window.requestAnimationFrame(function () {
                    $('#page').find('> .page').hide();
                    $('#filterRules').empty();
                    page.show();
                    // todo loss of scroll position
                    window.scrollTo(0, 0);
                    $('[data-height-of]').each(function(){
                        var h = $($(this).attr('data-height-of')).height();
                        $(this).css('height', h);
                    })
                });
                appCtx.currentPage = page;
            }
            if (callNext) {
                next();
            }
        }
    }
};