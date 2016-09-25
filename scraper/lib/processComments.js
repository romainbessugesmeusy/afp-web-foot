module.exports = function processComments(data, match){

        var commentEvents = [];

    data.hasComments = match.Comments.length > 0;

    var groups = [{start: 0, comments: []}];
    var groupIndex = 0;
    var lastCommentTime;
    var inGroup = true;


    function timeDuringPlay(time) {
        time = String(time);
        var isHourAndMinutes = (time.indexOf(':') > -1);
        var floatVal = getTimeAsFloat(time);
        return (!isNaN(floatVal) && !isHourAndMinutes && floatVal !== 0);
    }

    function getTimeAsFloat(time) {
        time = String(time);
        return parseFloat(time.replace('+', '.'));
    }

    function commentIsDuringPlay(comment, lastCommentTime, nextCommentTime) {

        if (timeDuringPlay(comment.props.time)) {
            return true;
        }

        lastCommentTime = getTimeAsFloat(lastCommentTime);
        nextCommentTime = getTimeAsFloat(nextCommentTime);

        if (lastCommentTime >= 45 && nextCommentTime <= 46) {
            return false;
        }

        if (lastCommentTime >= 90 && nextCommentTime <= 91) {
            return false;
        }

        return timeDuringPlay(lastCommentTime) && timeDuringPlay(nextCommentTime);
    }

    function mapCommentToEvent(comment) {
        var mapped = false;
        data.events.forEach(function (evt) {
            if (evt.time === comment.props.time && comment.props.event == evt.type) {
                evt.comment = comment;
                mapped = true;
            }
        });
        return mapped;
    }


    if (Array.isArray(match.Comments)) {

        var nextCommentTime;
        var j;
        match.Comments.forEach(function (comment, i) {

            nextCommentTime = null;

            for (j = i + 1; j < match.Comments.length; j++) {
                if (match.Comments[j].props.time) {
                    nextCommentTime = match.Comments[j].props.time;
                    break;
                }
            }

            if (commentIsDuringPlay(comment, lastCommentTime, nextCommentTime)) {
                if (inGroup) {
                    groupIndex++;
                }
                inGroup = false;
                lastCommentTime = comment.props.time ? comment.props.time : lastCommentTime;
                if (!mapCommentToEvent(comment)) {
                    commentEvents.push({
                        time: lastCommentTime,
                        comment: comment,
                        side: 'both',
                        type: comment.props.event
                    });
                }
            } else {
                inGroup = true;
                if (typeof groups[groupIndex] === 'undefined') {
                    groups[groupIndex] = {
                        after: lastCommentTime,
                        comments: []
                    }
                }

                groups[groupIndex].comments.push(comment);
            }
        });

    }

    data.events = data.events.concat(commentEvents);

    groups.forEach(function (group) {

        if (group.comments.length === 0) {
            return;
        }

        data.events.push({
            time: group.after ? parseFloat(String(group.after).replace('+', '.')) + 0.1 : '-1000',
            group: 'pre',
            side: 'both',
            comments: group.comments
        });
    });
    data.commentGroups = groups;
    data.events.sort(function (a, b) {
        var aTime = parseFloat(String(a.time).replace('+', '.'));
        var bTime = parseFloat(String(b.time).replace('+', '.'));
        return bTime - aTime;
    });
};