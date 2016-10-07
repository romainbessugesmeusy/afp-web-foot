module.exports = function sortMatchesByDate(a, b) {
    return new Date(a.date) - new Date(b.date);
};