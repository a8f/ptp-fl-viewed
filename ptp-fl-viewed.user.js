// ==UserScript==
// @name     PTP FL Viewed
// @version  0.1
// @include /https://passthepopcorn\.me/torrents\.php\?action=advanced.*&freetorrent=1.*/
// @namespace http://airstrafe.net
// @grant       GM.setValue
// @grant       GM.getValue
// ==/UserScript==

let jQuery = $ = unsafeWindow.jQuery;

$('#content').append('<center><button type="button" style="width: 200px;height 30px;margin-top: 12px;" class="catch-up-btn">Catch Up</button></center>');
$('#torrents-movie-view').prepend('<center><button type="button" style="width: 200px;height 30px;margin-bottom: 12px;" class="catch-up-btn">Catch Up</button></center>');

(async () => {
    let saved = await getSavedMovies();
    let pageMovies = updateMovies(saved);
    let buttons = document.getElementsByClassName('catch-up-btn');
    for (let i = 0; i < buttons.length; i++) {
        buttons[i].addEventListener('click', function() {
            catchUpPage(saved, pageMovies);
        });
    }
})();


async function getSavedMovies() {
    let saved = await GM.getValue('saved', '');
    try {
        saved = cleanOldTorrents(JSON.parse(saved));
    } catch(e) {
        return new Object();
    }
    return saved;
}

function catchUpPage(saved, pageMovies) {
    Object.keys(pageMovies).forEach(function(k) {
        saved[k] = pageMovies[k];
    });
    (async() => {
        await GM.setValue('saved', JSON.stringify(saved));
        location.reload();
    })();
}

function cleanOldTorrents(saved) {
    let now = new Date().getTime();
    for (var k in saved) {
        for (let i = 0; i < saved[k].length; i++) {
            if (saved[k][i]['expires'] <= now) {
                delete saved[k][i];
            }
        }
        saved[k] = saved[k].filter(function(e) { return e != null; });
        if (saved[k].length === 0) {
            delete saved[k];
        }
    }
    return saved;
}

// Hide movies that have only torrents in saved
// Returns movies on the page and their torrents
function updateMovies(saved) {
    let movies = $('#torrents-movie-view div tbody');
    let hoursLeftRe = /\d+h/;
    let minsLeftRe = /\d+m/;
    let daysLeftRe = /\d+d/;
    let now = (new Date().getTime()).toString();
    let pageMovies = {};
    // Iterate over movies
    for (let i = 0; i < movies.length; i++) {
        let torrents = $(movies[i]).children();
        if (torrents.length === 0) {
            return [];
        }
        let movieId = $(torrents[0]).find('a').first().attr('href');
        movieId = movieId.substring(movieId.indexOf('id=') + 3);
        let movieTorrents = [];
        let unseenFl = !(movieId in saved); // Whether or not there are unseen torrents for this movie
        // Iterate over torrents for this movie
        for (let j = 0; j < torrents.length; j++) {
            let torrent = $(torrents[j]).find('a').last();
            if (!$(torrent).find('.torrent-info__download-modifier--free').length) {
                continue;
            }
            let torrentLink = $(torrent).attr('href');
            let torrentId = torrentLink.substring(torrentLink.indexOf('torrentid=') + 10);
            if (!unseenFl) {
                let newTorrent = true;
                for (let k = 0; k < saved[movieId].length; k++) {
                    if (saved[movieId][k]['id'] === torrentId) {
                        newTorrent = false;
                        break;
                    }
                }
                if (newTorrent) {
                    unseenFl = true;
                }
            }
            let flText = $(torrent).find('span.torrent-info__download-modifier--free').text();
            let minsLeft = flText.match(minsLeftRe);
            let expires = new Date();
            if (minsLeft && minsLeft.length === 0) {
                expires.setMinutes(expires.getMinutes() + parseInt(minsLeft[0].substring(0, minsLeft[0].length - 1)));
            }
            let hoursLeft = flText.match(hoursLeftRe);
            if (hoursLeft && hoursLeft.length > 0) {
                expires.setHours(expires.getHours() + parseInt(hoursLeft[0].substring(0, hoursLeft[0].length - 1)));  
            }
            let daysLeft = flText.match(daysLeftRe);
            if (daysLeft && daysLeft.length > 0) {
                expires.setDays(expires.getDays() + parseInt(daysLeft[0].substring(0, daysLeft[0].length - 1)));  
            }
            movieTorrents.push({'expires': expires.getTime().toString(), 'id': torrentId});
        }
        pageMovies[movieId] = movieTorrents;
        if (!unseenFl) {
            $(movies[i]).hide();
        }
    }
    return pageMovies;
}