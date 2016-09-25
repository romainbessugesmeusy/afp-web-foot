var $ = require('jquery');

module.exports = function (appCtx) {
    return function (page, callNext) {
        return function (ctx, next) {
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