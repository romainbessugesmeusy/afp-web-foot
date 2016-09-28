module.exports = {
    root: 'http://bdsports.afp.com:80/bdsapi/api/',
    clients: {
        light: {
            lang: 1,
            locale: 'fr',
            evts: [6100]
        },
        demo: {
            lang: 1,
            locale: 'fr',
            evts: [
                5506, 5507, 6096,
                6091, 6101, 5365,
                4571, 6100, 6103,
                6095, 6149, 6094,
                6147, 5405, 5101,
                5390, 5389, 5039,
                5392, 6099, 6104,
                6141, 6102, 6145,
                6142, 6105
            ]
        },
        demo2: {
            lang: 2,
            locale: 'en',
            evts: [5392, 6105]
        }
    }
};
