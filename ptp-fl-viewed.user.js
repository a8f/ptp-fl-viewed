// ==UserScript==
// @name     PTP FL Viewed
// @version  0.11
// @include  /https://passthepopcorn\.me/torrents\.php\?(page=\d*&)?action=advanced.*&freetorrent=1.*/
// @namespace http://airstrafe.net
// @grant       GM.setValue
// @grant       GM.getValue
// ==/UserScript==

let jQuery = $ = unsafeWindow.jQuery;

$('#content').append('<center><button type="button" style="width: 200px;height 30px;margin-top: 12px;" class="catch-up-btn">Catch Up</button></center>');
$('#torrents-movie-view').prepend('<center><button type="button" style="width: 200px;height 30px;margin-bottom: 12px;" class="catch-up-btn">Catch Up</button></center>');
$('#userinfo_minor').append('<li class="user-info-bar__item"><a class="user-info-bar__link" href="#" onclick="return false;" id="nav_clear_seen">Clear seen</a></li>');
document.getElementById('nav_clear_seen').addEventListener('click', clearSavedTorrents);

(async () => {
    let saved = await getSavedMovies();
    let movies = updateMovies(saved);
    if (movies['seenAll']) {
        window.location.href = $('.pagination__link--next').attr('href');
    }
    let buttons = document.getElementsByClassName('catch-up-btn');
    for (let i = 0; i < buttons.length; i++) {
        buttons[i].addEventListener('click', function() {
            catchUpPage(saved, movies['page']);
        });
    }
})();


async function getSavedMovies() {
    let saved = await GM.getValue('saved', '');
    try {
        return cleanOldTorrents(JSON.parse(saved));
    } catch(e) {
        return new Object();
    }
}

async function clearSavedTorrents() {
    await GM.setValue('saved', '');
    location.reload();
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

// Hide movies that have only freeleeches which are already saved
// Returns dict with key:values of:
// 'page': array of the movies on the page
// 'seenAll': true if there are no visible movies on the page
function updateMovies(saved) {
    let movies = $('#torrents-movie-view div tbody');
    let hoursLeftRe = /\d+h/;
    let minsLeftRe = /\d+m/;
    let daysLeftRe = /\d+d/;
    let now = (new Date().getTime()).toString();
    // Expiry date for torrents without any time listed
    let defaultExpires = new Date();
    defaultExpires.setDate(defaultExpires.getDate() + 1);
    let pageMovies = {};
    let seenAll = true;
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
            let missingTimestamp = true;
            let minsLeft = flText.match(minsLeftRe);
            let expires = new Date();
            if (minsLeft && minsLeft.length === 0) {
                missingTimestamp = false;
                expires.setMinutes(expires.getMinutes() + parseInt(minsLeft[0].substring(0, minsLeft[0].length - 1)));
            }
            let hoursLeft = flText.match(hoursLeftRe);
            if (hoursLeft && hoursLeft.length > 0) {
                missingTimestamp = false;
                expires.setHours(expires.getHours() + parseInt(hoursLeft[0].substring(0, hoursLeft[0].length - 1)));  
            }
            let daysLeft = flText.match(daysLeftRe);
            if (daysLeft && daysLeft.length > 0) {
                missingTimestamp = false;
                expires.setDate(expires.getDate() + parseInt(daysLeft[0].substring(0, daysLeft[0].length - 1)));  
            }
            movieTorrents.push({'expires': missingTimestamp ? defaultExpires.getTime().toString() : expires.getTime().toString(), 'id': torrentId});
        }
        pageMovies[movieId] = movieTorrents;
        if (unseenFl) {
            seenAll = false;
        } else {
            $(movies[i]).hide();
        }
    }
    return {'page': pageMovies, 'seenAll': seenAll};
}