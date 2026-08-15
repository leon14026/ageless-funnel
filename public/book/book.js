/**
 * Book chapter page renderer.
 * Reads /data/book-chapters.json, finds the chapter from <body data-chapter="N">,
 * and renders the Bengali title + 1-2 YouTube embeds (blank URL = "coming soon"),
 * plus a soft CTA back to the main program.
 */
(function () {
    'use strict';

    var DATA_URL = '/data/book-chapters.json';
    var FUNNEL_URL = 'https://agelessbytulee.com/';

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // Pull an 11-char YouTube id from watch?v=, youtu.be/, /embed/, or /shorts/ URLs.
    function youTubeId(url) {
        var u = String(url || '').trim();
        if (!u) return '';
        var m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/);
        if (m) return m[1];
        if (/^[A-Za-z0-9_-]{11}$/.test(u)) return u; // bare id
        return '';
    }

    function videoBlock(url) {
        var id = youTubeId(url);
        if (!id) {
            return '' +
                '<div class="book-video"><div class="book-soon">' +
                '<div class="book-soon-icon">🎬</div>' +
                '<div class="book-soon-title">শীঘ্রই আসছে</div>' +
                '<div class="book-soon-sub">এই ভিডিওটি খুব শীঘ্রই যুক্ত করা হবে।</div>' +
                '</div></div>';
        }
        var src = 'https://www.youtube-nocookie.com/embed/' + id + '?rel=0';
        return '' +
            '<div class="book-video"><div class="book-video-frame">' +
            '<iframe src="' + src + '" title="Ageless by Tulee video" loading="lazy" ' +
            'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
            'allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>' +
            '</div></div>';
    }

    function render(chapter) {
        var videos = (chapter.videos && chapter.videos.length) ? chapter.videos : ['', ''];
        var app = document.getElementById('book-app');
        app.innerHTML = '' +
            '<div class="book-brand">' +
            '<img src="/images/Logo_without_text.png" alt="Ageless by Tulee">' +
            '<span>Ageless by Tulee</span>' +
            '</div>' +
            '<span class="book-eyebrow">অধ্যায় ' + esc(chapter.n) + '</span>' +
            '<h1 class="book-title">' + esc(chapter.title) + '</h1>' +
            '<div class="book-videos">' + videos.map(videoBlock).join('') + '</div>' +
            '<div class="book-cta"><a href="' + FUNNEL_URL + '">সম্পূর্ণ প্রোগ্রামটি দেখুন →</a></div>' +
            '<div class="book-footer">© Ageless by Tulee</div>';
        document.title = 'অধ্যায় ' + chapter.n + ' · ' + chapter.title + ' | Ageless by Tulee';
    }

    function fail(msg) {
        var app = document.getElementById('book-app');
        if (app) app.innerHTML = '<div class="book-error">' + esc(msg) + '</div>';
    }

    document.addEventListener('DOMContentLoaded', function () {
        var n = parseInt(document.body.getAttribute('data-chapter'), 10);
        if (!n) { fail('Chapter not found.'); return; }

        fetch(DATA_URL, { cache: 'no-cache' })
            .then(function (r) { if (!r.ok) throw new Error('load'); return r.json(); })
            .then(function (data) {
                var list = (data && data.chapters) || [];
                var chapter = list.filter(function (c) { return c.n === n; })[0];
                if (!chapter) { fail('Chapter not found.'); return; }
                render(chapter);
            })
            .catch(function () { fail('এই পৃষ্ঠাটি লোড করা যায়নি। একটু পরে আবার চেষ্টা করুন।'); });
    });
})();
