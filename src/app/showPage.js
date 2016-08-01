var $ = require('jquery');

module.exports = function (appCtx) {
    return function (page, callNext) {
        return function (ctx, next) {
            if (appCtx.currentPage !== page) {
                window.requestAnimationFrame(function () {
                    $('#page').find('> .page').hide();
                    page.show();
                    window.scrollTo(0, 0);
                });
                appCtx.currentPage = page;
            }
            if (callNext) {
                next();
            }
        }
    }
};