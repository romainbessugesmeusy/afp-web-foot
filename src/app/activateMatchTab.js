var $ = require('jquery')
module.exports = function activateMatchTab(id) {
    return function () {
        window.requestAnimationFrame(function () {
            $('#liveMatch').attr('data-tab', id);
            $('.sectionNavbar a').removeClass('active');
            $('.tab').removeClass('active');
            $('a[data-target="' + id + '"]').addClass('active');
            $('#' + id).addClass('active');
        });
    }
}