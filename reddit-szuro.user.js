// ==UserScript==
// @name         Reddit-szűrő
// @namespace    https://github.com/peterbrek
// @homepageURL  https://github.com/peterbrek/reddit-szuro
// @updateURL    https://raw.githubusercontent.com/peterbrek/reddit-szuro/main/reddit-szuro.user.js
// @downloadURL  https://raw.githubusercontent.com/peterbrek/reddit-szuro/main/reddit-szuro.user.js
// @version      1.7.0
// @description  Elrejti a Reddit-feedből azokat a posztokat, amelyekben a megadott kulcsszavak szerepelnek.
// @match        https://www.reddit.com/*
// @match        https://old.reddit.com/*
// @match        https://new.reddit.com/*
// @match        https://sh.reddit.com/*
// @match        https://m.reddit.com/*
// @run-at       document-start
// @noframes
// @grant        GM.getValue
// @grant        GM.setValue
// ==/UserScript==

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Beállítások és tárolás
  // ---------------------------------------------------------------------------

  const STORE_KEY = 'redditSzuro.v1';

  const DEFAULT_LIST = [
    '# Politika',
    'trump',
    '-trumpet',
    'putin',
    'putyin',
    '',
    '# Tech-vezérek',
    'elon musk',
    'musk',
    '-muskát',
    '-muskotály',
    '-musket',
    'altman',
    'huang',
    'nvidia ceo',
    'nvidia vezér',
    '',
  ].concat(GTA_LINES()).join('\n');

  function GTA_LINES() {
    return [
      '# Játékok',
      'gta 6',
      'gta6',
      '"gta vi"',
      '"gtavi"',
      'grand theft auto 6',
      '"grand theft auto vi"',
      'r/GTA6',
      'r/GTAVI',
    ];
  }

  // A lista változata. Ha nő, a már elmentett listákon is lefut a frissítés (migrate),
  // a saját sorok megmaradnak.
  const LIST_VERSION = 2;

  const DEFAULTS = {
    list: DEFAULT_LIST, showHidden: false, hidePromos: true, cardMode: false, listVersion: LIST_VERSION,
  };

  const hasGM = typeof GM !== 'undefined' && GM && typeof GM.getValue === 'function';

  function parseStored(raw) {
    if (!raw) return null;
    try {
      const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (obj && typeof obj.list === 'string') {
        return {
          list: obj.list,
          showHidden: !!obj.showHidden,
          hidePromos: obj.hidePromos !== false,
          cardMode: !!obj.cardMode,
          listVersion: obj.listVersion || 1,
        };
      }
    } catch (e) { /* sérült adat: marad az alap */ }
    return null;
  }

  // 1 → 2: az „elon” helyett „elon musk” (az ékezet nélkül „elont” lesz az „elönt”-ből is),
  // az „-elongat” kivétel már nem kell, és bekerülnek a GTA 6-os sorok.
  function migrate(s) {
    if (!s) return { s, changed: false };
    let changed = false;
    if (s.listVersion < 2) {
      let lines = s.list.split(/\r?\n/);
      lines = lines
        .map((l) => (l.trim().toLowerCase() === 'elon' ? 'elon musk' : l))
        .filter((l) => l.trim().toLowerCase() !== '-elongat');
      if (!lines.some((l) => /gta|grand theft auto/i.test(l))) {
        while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
        lines = lines.concat([''], GTA_LINES());
      }
      s = Object.assign({}, s, { list: lines.join('\n'), listVersion: 2 });
      changed = true;
    }
    return { s, changed };
  }

  function loadLocal() {
    try { return parseStored(localStorage.getItem(STORE_KEY)); } catch (e) { return null; }
  }

  async function loadGM() {
    if (!hasGM) return null;
    try { return parseStored(await GM.getValue(STORE_KEY)); } catch (e) { return null; }
  }

  function save() {
    const raw = JSON.stringify({
      list: settings.list,
      showHidden: settings.showHidden,
      hidePromos: settings.hidePromos !== false,
      cardMode: !!settings.cardMode,
      listVersion: settings.listVersion || LIST_VERSION,
    });
    try { localStorage.setItem(STORE_KEY, raw); } catch (e) { /* privát mód */ }
    if (hasGM) { try { GM.setValue(STORE_KEY, raw); } catch (e) { /* nincs GM */ } }
  }

  const local = migrate(loadLocal());
  let settings = local.s || Object.assign({}, DEFAULTS);

  // ---------------------------------------------------------------------------
  // Kulcsszavak értelmezése
  //   trump        -> szó eleje: Trump, Trump's, Trumpról, anti-Trump
  //   "musk"       -> csak pontosan ez a szó (és a birtokos 's)
  //   -trumpet     -> kivétel: ez a szó nem számít találatnak
  //   r/politics   -> az egész subreddit
  //   # ...        -> megjegyzés
  // Kis- és nagybetű, ékezet nem számít.
  // ---------------------------------------------------------------------------

  const WORDCH = '\\p{L}\\p{N}';
  const START = '(?:^|[^' + WORDCH + '])';

  function norm(s) {
    return String(s || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u2018\u2019\u00b4`]/g, "'")
      .toLowerCase();
  }

  function esc(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function entryPattern(src, exact) {
    const parts = src.split(/[\s\-\u2013\u2014]+/).filter(Boolean).map(esc);
    if (!parts.length) return null;
    // A több szóból álló kifejezésben a szavak közt szóköz vagy kötőjel állhat,
    // az első szó után birtokos 's is: "Nvidia's CEO", "Nvidia-vezér".
    let p = parts.join("(?:'s)?[\\s\\-\u2013\u2014]+");
    if (exact) p += "(?:'s)?(?![" + WORDCH + '])';
    return p;
  }

  function parseList(text) {
    const words = [];
    const except = [];
    const subs = [];
    for (let line of String(text || '').split(/\r?\n/)) {
      line = line.trim();
      if (!line || line.startsWith('#')) continue;

      const sub = line.match(/^\/?r\/([A-Za-z0-9_]+)\/?$/i);
      if (sub) { subs.push(sub[1].toLowerCase()); continue; }

      let target = words;
      if (line.startsWith('-')) { target = except; line = line.slice(1).trim(); }

      let exact = false;
      const q = line.match(/^["\u201e\u201c\u201d](.+?)["\u201c\u201d]$/);
      if (q) { exact = true; line = q[1].trim(); }

      const src = norm(line).trim();
      const pattern = src && entryPattern(src, exact);
      if (pattern) target.push({ label: line, pattern });
    }
    return { words, except, subs };
  }

  function buildMatcher(text) {
    const { words, except, subs } = parseList(text);
    const tests = [];
    for (const w of words) {
      try { tests.push({ label: w.label, re: new RegExp(START + '(?:' + w.pattern + ')', 'u') }); } catch (e) { /* hibás sor */ }
    }
    let exRe = null;
    if (except.length) {
      try {
        exRe = new RegExp('(^|[^' + WORDCH + '])(?:' + except.map((e) => e.pattern).join('|') + ')[' + WORDCH + ']*', 'gu');
      } catch (e) { exRe = null; }
    }
    const subSet = new Set(subs);

    return function match(post) {
      if (post.sub && subSet.has(post.sub.toLowerCase())) return 'r/' + post.sub;
      let t = norm(post.text);
      if (exRe) t = t.replace(exRe, '$1 ');
      for (const x of tests) if (x.re.test(t)) return x.label;
      return null;
    };
  }

  let matcher = buildMatcher(settings.list);

  // ---------------------------------------------------------------------------
  // Posztok megkeresése és elrejtése
  // ---------------------------------------------------------------------------

  const POST_SEL = 'shreddit-post, .thing.link';
  const HID = 'rsz-hidden';

  function text(el) {
    return el ? el.textContent || '' : '';
  }

  // A megnyitott poszt saját oldalán (…/comments/<id>/…) magát a posztot nem rejtjük el.
  function openedPostId() {
    const m = location.pathname.match(/\/comments\/([a-z0-9]+)/i);
    return m ? m[1].toLowerCase() : null;
  }

  function isOpenedPost(id, permalink) {
    const open = openedPostId();
    if (!open) return false;
    if (id && id.toLowerCase().replace(/^t3_/, '') === open) return true;
    return !!(permalink && permalink.toLowerCase().indexOf('/comments/' + open + '/') !== -1);
  }

  function readPost(el) {
    if (el.tagName === 'SHREDDIT-POST') {
      if (isOpenedPost(el.getAttribute('id'), el.getAttribute('permalink'))) return null;
      const title = el.getAttribute('post-title') ||
        text(el.querySelector('[slot="title"], a[slot="full-post-link"]'));
      const sub = el.getAttribute('subreddit-name') ||
        (el.getAttribute('subreddit-prefixed-name') || '').replace(/^r\//i, '');
      const flair = Array.from(el.querySelectorAll('shreddit-post-flair')).map(text).join(' ');
      const body = text(el.querySelector('[slot="text-body"]'));
      const href = (el.getAttribute('content-href') || '').split('?')[0];
      // Áthúzott poszt: a beágyazott eredeti címe is számít.
      const inner = Array.from(el.querySelectorAll('shreddit-post'))
        .map((p) => p.getAttribute('post-title') || '').join(' ');
      return { title, sub, text: [title, flair, body, href, inner].join(' \n ') };
    }
    // old.reddit.com
    if (isOpenedPost(el.getAttribute('data-fullname'), el.getAttribute('data-permalink'))) return null;
    const title = text(el.querySelector('a.title'));
    const sub = el.getAttribute('data-subreddit') || '';
    const flair = text(el.querySelector('.linkflairlabel'));
    const href = (el.getAttribute('data-url') || '').split('?')[0];
    return { title, sub, text: [title, flair, href].join(' \n ') };
  }

  // Áthúzott (crosspost) posztoknál a külső kártya dönt.
  function outermost(el) {
    let p = el.parentElement && el.parentElement.closest(POST_SEL);
    while (p) {
      el = p;
      p = el.parentElement && el.parentElement.closest(POST_SEL);
    }
    return el;
  }

  function containerOf(el) {
    if (el.tagName === 'SHREDDIT-POST') return el.closest('article') || el;
    return el;
  }

  function apply(el) {
    const info = readPost(el);
    const box = containerOf(el);
    const hit = info ? matcher(info) : null;
    if (hit) {
      box.classList.add(HID);
      box.setAttribute('data-rsz', hit);
      box.setAttribute('data-rsz-title', (info.sub ? 'r/' + info.sub + ' · ' : '') + (info.title || '').trim());
    } else if (box.classList.contains(HID)) {
      box.classList.remove(HID);
      box.removeAttribute('data-rsz');
      box.removeAttribute('data-rsz-title');
    }
    if (el.tagName === 'SHREDDIT-POST' && box !== el && info && cardModeActive()) renderCard(el, box);
    else removeCard(box);
  }

  // ---------------------------------------------------------------------------
  // Saját posztkártya a kártyanézethez
  // ---------------------------------------------------------------------------

  const CARD_UI_CSS = `
:host { all: initial; position: absolute; inset: 0; z-index: 3; display: block; border-radius: 22px; overflow: hidden; }
* { box-sizing: border-box; }
a, img, video { -webkit-user-drag: none; user-drag: none; }
img, video { pointer-events: none; }
a {
  position: absolute; inset: 0; display: block; overflow: hidden;
  touch-action: none; -webkit-user-select: none; user-select: none;
  color: #fff; text-decoration: none; background: #111;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  -webkit-tap-highlight-color: transparent;
}
.bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
.blank { position: absolute; inset: 0; background: linear-gradient(160deg, hsl(var(--h) 45% 30%), hsl(calc(var(--h) + 50) 40% 10%)); }
.blur .bg { filter: blur(28px) brightness(.8); transform: scale(1.15); }
.top {
  position: absolute; left: 0; right: 0; top: 0;
  padding: 18px 18px 72px;
  background: linear-gradient(rgba(0,0,0,.75), rgba(0,0,0,.35) 60%, rgba(0,0,0,0));
}
.sub { display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
  font-size: 15px; font-weight: 600; opacity: .92; text-shadow: 0 1px 2px rgba(0,0,0,.5); }
.title { margin: 0; font-size: 35px; line-height: 1.12; font-weight: 800; letter-spacing: -.01em;
  text-shadow: 0 2px 6px rgba(0,0,0,.45); overflow-wrap: break-word; hyphens: manual;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 6; overflow: hidden; }
.tag { display: inline-block; padding: 2px 8px; border-radius: 6px; background: #e5484d; font-size: 12px; font-weight: 700; }
.bottom {
  position: absolute; left: 0; right: 0; bottom: 0;
  padding: 72px 18px 18px;
  background: linear-gradient(rgba(0,0,0,0), rgba(0,0,0,.55) 35%, rgba(0,0,0,.88));
}
.text { margin: 0 0 12px; font-size: 14px; line-height: 1.45; text-shadow: 0 1px 2px rgba(0,0,0,.4); }
.textonly .text { font-size: 15px; }
.meta { display: flex; justify-content: flex-end; }
.comments { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px;
  background: rgba(255,255,255,.16); font-size: 15px; font-weight: 600;
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
.comments svg { width: 18px; height: 18px; }
@media (pointer: coarse) { .bottom { padding-bottom: 76px; } }`;

  const COMMENT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3c5 0 9 3.6 9 8s-4 8-9 8c-1.2 0-2.3-.2-3.4-.5L3 20l1.6-4.2C3.6 14.4 3 12.8 3 11c0-4.4 4-8 9-8z"/></svg>';

  function cleanText(t) {
    return String(t || '').replace(/\s+/g, ' ').trim();
  }

  // Legfeljebb `max` karakter (a „…”-tal együtt), lehetőleg szóhatáron vágva.
  const BODY_MAX = 200;
  function shorten(t, max) {
    const chars = Array.from(t);
    if (chars.length <= max) return t;
    let cut = chars.slice(0, max - 1).join('');
    const sp = cut.lastIndexOf(' ');
    if (sp > (max - 1) * 0.6) cut = cut.slice(0, sp);
    return cut.replace(/[\s.,;:!?\-–—]+$/, '') + '…';
  }

  function fromSrcset(ss) {
    if (!ss) return '';
    const items = ss.split(/,\s+/).map((part) => {
      const bits = part.trim().split(/\s+/);
      return { url: bits[0], w: parseInt(bits[1], 10) || 0 };
    }).filter((x) => x.url);
    if (!items.length) return '';
    items.sort((a, b) => a.w - b.w);
    const good = items.find((x) => x.w >= 1000);
    return (good || items[items.length - 1]).url;
  }

  const BAD_IMG = /styles\.redditmedia\.com|redditstatic\.com|\/avatars?\/|communityIcon|snoovatar|emoji|\.svg(\?|$)/i;
  const GOOD_HOST = /(^|\/\/)(preview|i|external-preview|external-i)\.redd\.it\//i;

  // A poszt képe vagy videója. Előnyben a Reddit előnézeti képe (kisebb, mint az eredeti).
  function findMedia(p) {
    const player = p.querySelector('shreddit-player-2, shreddit-player');
    if (player) {
      const src = player.getAttribute('src') || '';
      const poster = player.getAttribute('poster') || player.getAttribute('preview') || '';
      if (src || poster) return { type: 'video', src, poster };
    }
    let best = '';
    let bestArea = -1;
    p.querySelectorAll('img, faceplate-img[src]').forEach((img) => {
      const url = fromSrcset(img.getAttribute('srcset')) || img.currentSrc || img.getAttribute('src') || img.getAttribute('data-src') || '';
      if (!url || url.startsWith('data:') || BAD_IMG.test(url)) return;
      const w = img.naturalWidth || parseInt(img.getAttribute('width'), 10) || 0;
      const h = img.naturalHeight || parseInt(img.getAttribute('height'), 10) || 0;
      const area = w * h;
      if (area && area < 300 * 300) return; // ikon, avatar, apró bélyegkép: kitöltve csak elmosódna
      if (!area && !GOOD_HOST.test(url)) return;
      const score = area || 1;
      if (score > bestArea) { bestArea = score; best = url; }
    });
    if (best) return { type: 'image', src: best };
    const href = p.getAttribute('content-href') || '';
    if (/\.(jpe?g|png|gif|webp)(\?|$)/i.test(href) || /\/\/i\.redd\.it\//i.test(href)) return { type: 'image', src: href };
    return null;
  }

  function isSensitive(p) {
    return ['nsfw', 'spoiler', 'is-nsfw', 'is-spoiler'].some((a) => p.hasAttribute(a) && p.getAttribute(a) !== 'false') ||
      !!p.querySelector('shreddit-blurred-container');
  }

  function formatCount(n) {
    const v = parseInt(n, 10);
    if (!isFinite(v) || v < 0) return '';
    return v.toLocaleString('hu-HU');
  }

  function hueOf(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return h;
  }

  function canPlay(src) {
    if (!src) return false;
    const v = document.createElement('video');
    if (/\.m3u8(\?|$)/i.test(src)) return !!v.canPlayType('application/vnd.apple.mpegurl');
    if (/\.mpd(\?|$)/i.test(src)) return false;
    return true;
  }

  // A videó csak akkor megy, amikor a kártyája látszik.
  let mediaIO = null;
  function watchVideo(v) {
    if (typeof IntersectionObserver === 'undefined') return;
    if (!mediaIO) {
      mediaIO = new IntersectionObserver((entries) => {
        for (const en of entries) {
          const vid = en.target;
          if (en.isIntersecting && en.intersectionRatio >= 0.6) {
            if (!vid.getAttribute('src') && vid.dataset.src) vid.setAttribute('src', vid.dataset.src);
            const pr = vid.play();
            if (pr && pr.catch) pr.catch(() => {});
          } else {
            vid.pause();
          }
        }
      }, { threshold: [0, 0.6] });
    }
    mediaIO.observe(v);
  }

  function removeCard(box) {
    const host = box && box.querySelector(':scope > .rsz-card-host');
    if (!host) return;
    if (host.shadowRoot) {
      host.shadowRoot.querySelectorAll('video').forEach((v) => {
        v.pause();
        if (mediaIO) mediaIO.unobserve(v);
      });
    }
    host.remove();
  }

  function renderCard(p, box) {
    const title = cleanText(p.getAttribute('post-title') || text(p.querySelector('[slot="title"]')));
    const body = shorten(cleanText(text(p.querySelector('[slot="text-body"]'))), BODY_MAX);
    const count = formatCount(p.getAttribute('comment-count'));
    const fullLink = p.querySelector('a[slot="full-post-link"]');
    const permalink = p.getAttribute('permalink') || (fullLink ? fullLink.getAttribute('href') : '') || '';
    const media = findMedia(p);
    const sensitive = isSensitive(p);
    const sub = p.getAttribute('subreddit-name') ||
      (p.getAttribute('subreddit-prefixed-name') || '').replace(/^r\//i, '');
    const sig = JSON.stringify([title, sub, body, count, permalink, media, sensitive]);

    let host = box.querySelector(':scope > .rsz-card-host');
    if (host && host.dataset.sig === sig) return;
    if (host) removeCard(box);

    host = document.createElement('div');
    host.className = 'rsz-card-host';
    host.dataset.sig = sig;
    const root = host.attachShadow({ mode: 'open' });
    root.appendChild(mk('style', { text: CARD_UI_CSS }));

    const a = mk('a', { href: permalink ? new URL(permalink, location.origin).href : '#', 'aria-label': title });
    if (sensitive) a.classList.add('blur');
    if (!media) {
      a.classList.add('textonly');
      const blank = mk('div', { class: 'blank' });
      blank.style.setProperty('--h', String(hueOf(sub || title)));
      a.appendChild(blank);
    } else if (media.type === 'video' && canPlay(media.src) && !sensitive) {
      const v = mk('video', { class: 'bg', muted: '', loop: '', playsinline: '', 'webkit-playsinline': '', preload: 'none' });
      v.muted = true;
      v.dataset.src = media.src;
      if (media.poster) v.setAttribute('poster', media.poster);
      a.appendChild(v);
      watchVideo(v);
    } else {
      const src = media.type === 'video' ? media.poster : media.src;
      if (src) a.appendChild(mk('img', { class: 'bg', src, alt: '', loading: 'lazy', decoding: 'async' }));
      else a.appendChild(mk('div', { class: 'blank' }));
    }

    const top = mk('div', { class: 'top' });
    const subRow = mk('div', { class: 'sub' });
    if (sub) subRow.appendChild(mk('span', { text: 'r/' + sub }));
    if (sensitive) subRow.appendChild(mk('span', { class: 'tag', text: p.hasAttribute('spoiler') || p.hasAttribute('is-spoiler') ? 'Spoiler' : 'NSFW' }));
    if (subRow.firstChild) top.appendChild(subRow);
    top.appendChild(mk('h2', { class: 'title', text: title }));
    a.appendChild(top);

    const bottom = mk('div', { class: 'bottom' });
    if (body) bottom.appendChild(mk('p', { class: 'text', text: body }));
    const meta = mk('div', { class: 'meta' });
    if (count) {
      const c = mk('span', { class: 'comments', 'aria-label': count + ' hozzászólás' });
      c.innerHTML = COMMENT_ICON;
      c.appendChild(document.createTextNode(count));
      meta.appendChild(c);
    }
    bottom.appendChild(meta);
    a.appendChild(bottom);

    root.appendChild(a);
    box.appendChild(host);
  }

  function rescanAll() {
    document.querySelectorAll('.' + HID).forEach((b) => {
      if (!b.matches(POST_SEL) && !b.querySelector(POST_SEL)) {
        b.classList.remove(HID);
        b.removeAttribute('data-rsz');
        b.removeAttribute('data-rsz-title');
      }
    });
    document.querySelectorAll(POST_SEL).forEach((el) => { if (outermost(el) === el) apply(el); });
    scheduleBadge();
  }

  let lastPath = location.pathname;

  const observer = new MutationObserver((mutations) => {
    if (!styleEl || !styleEl.isConnected || location.pathname !== lastPath) {
      lastPath = location.pathname;
      ensureStyle();
    }
    const found = new Set();
    for (const m of mutations) {
      if (m.type === 'attributes') {
        found.add(outermost(m.target));
        continue;
      }
      // Ha egy poszt belsejébe érkezik új tartalom (pl. a szövege később töltődik be).
      const host = m.target.nodeType === 1 ? m.target.closest(POST_SEL) : null;
      if (host) found.add(outermost(host));
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.tagName === 'META') { killSmartBanner(n); continue; }
        if (n.matches(POST_SEL)) found.add(outermost(n));
        if (n.firstElementChild) n.querySelectorAll(POST_SEL).forEach((x) => found.add(outermost(x)));
      }
    }
    if (!found.size) return;
    found.forEach(apply);
    scheduleBadge();
  });

  // ---------------------------------------------------------------------------
  // Stílus
  // ---------------------------------------------------------------------------

  // A két mód közt a stíluslap szövege vált, így nem függünk a Reddit <html> osztályaitól.
  const BASE_CSS = `.rsz-card-host { display: none; }\n`;
  const HIDE_CSS = BASE_CSS + `html .${HID}, html .${HID} + hr { display: none !important; }`;
  const SHOW_CSS = BASE_CSS + `
.${HID} { opacity: .45; outline: 2px dashed #e5484d; outline-offset: -2px; }
.${HID}::before {
  content: "Elrejtve · " attr(data-rsz);
  display: block; padding: 6px 12px;
  font: 600 12px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #e5484d;
}`;

  // A Reddit saját „Get the Reddit app” / „Open in app” elemei. Csak app-reklámot tartalmaznak.
  const PROMO_CSS = `
shreddit-async-loader[paint-group*="xpromo"],
shreddit-async-loader[bundlename*="xpromo"],
shreddit-async-loader[bundlename="top_button"],
shreddit-async-loader[bundlename="app_selector"],
xpromo-bottom-bar, xpromo-app-selector, xpromo-new-app-selector, xpromo-bottom-sheet,
#xpromo-bottom-sheet, .configured-xpromo-bottom-sheet, .configured-xpromo,
.XPromoPopup, .XPromoPopupRpl, .XPromoBottomBar, .XPromoInFeed,
.TopNav__promoButton, .TopNav__useAppButton, #get-app,
slot[name="use-app"], [slot="use-app"] { display: none !important; }
body.scroll-disabled, body.scroll-is-blocked,
body.rpl-scroll-lock:has(.configured-xpromo),
body.rpl-scroll-lock:has(shreddit-async-loader[bundlename="app_selector"]) {
  overflow: auto !important; position: static !important; height: auto !important;
}`;

  // A Safari felső „Megnyitás a Reddit appban” sávja ebből a meta-címkéből készül.
  // Ha elég korán kikerül, a Safari nem mindig rajzolja ki (telepített appnál ritkán sikerül).
  function killSmartBanner(n) {
    if (!settings.hidePromos) return;
    const name = (n.getAttribute('name') || n.getAttribute('property') || '').toLowerCase();
    if (name === 'apple-itunes-app') n.remove();
  }

  // A Reddit ezekből tudja, hogy nemrég bezártad-e az app-ajánlót.
  function quietPromos() {
    if (!settings.hidePromos) return;
    try {
      const now = new Date().toString();
      localStorage.setItem('xpromo-consolidation', now);
      localStorage.setItem('bannerLastClosed', now);
    } catch (e) { /* privát mód */ }
  }

  // Kártyanézet: minden poszt egy képernyőnyi kártya, a lapozás poszttól posztig ugrik.
  // A posztkártyát a szűrő maga rajzolja (cím, kép/videó, szöveg, hozzászólásszám); az eredeti
  // Reddit-poszt láthatatlanul alatta marad, így a végtelen görgetés és a betöltés nem sérül.
  // A reklámposzt is kártya lesz (a Reddit rajzolja), különben a lapozás megakadna előtte.
  const POSTCARD = 'article:has(shreddit-post)';
  const OFF = 'rsz-offpath';
  const TAME = 'rsz-tame';
  const CARD = POSTCARD + ', article:has(shreddit-ad-post), shreddit-feed > shreddit-ad-post';
  const each = (suffix) => CARD.split(', ').map((c) => c + suffix).join(', ');
  const cardCss = () => `
html { scroll-behavior: auto !important; }
.${OFF} { display: none !important; }
/* A lapozást a szűrő maga végzi (lásd: Lapozás), ezért a kártyákon a böngésző saját
   görgetése és nagyítása ki van kapcsolva; a koppintás (a poszt megnyitása) működik. */
.${TAME} { max-width: 100vw !important; overflow-x: clip !important; }
${CARD} { width: auto !important; max-width: none !important; touch-action: none; }
${CARD} {
  box-sizing: border-box !important;
  /* Mindig a ténylegesen látható magasság: a Safari összecsukódó sávjaival együtt változik. */
  height: calc(100svh - var(--rsz-top, 0px) - 16px) !important;
  height: calc(100dvh - var(--rsz-top, 0px) - 16px) !important;
  margin: 8px !important; padding: 16px 4px !important;
  display: flex !important; flex-direction: column !important; justify-content: center !important;
  clip-path: inset(0 round 22px);
  border-radius: 22px !important;
  background: rgba(127,127,127,.08) !important;
  border: 1px solid rgba(127,127,127,.18) !important;
}
${POSTCARD} { position: relative !important; padding: 0 !important; background: #111 !important; border: 0 !important; }
${POSTCARD} > .rsz-card-host { display: block !important; }
${POSTCARD} shreddit-post {
  position: absolute !important; inset: 0 !important; overflow: hidden !important;
  opacity: 0 !important; pointer-events: none !important;
}
${POSTCARD} shreddit-player, ${POSTCARD} shreddit-player-2 { display: none !important; }
${each(' + hr')} { display: none !important; }
${each(' shreddit-ad-post')} { width: 100% !important; }
${CARD} { transition: opacity .15s ease; }
${each('[data-rsz-out]')} { opacity: 0 !important; }`;

  let topPx = 0;

  // Egyszerre egy kártya: amelyik kártyából csak egy kis csík látszik (pl. a következő teteje
  // a Safari átlátszó eszköztára mögött), az elhalványul. A böngésző saját láthatóság-figyelője
  // jelzi, így görgetés közben semmilyen stílus nem íródik át (az iOS-en megakasztaná a lapozást).
  // A képernyő alsó 15%-a nem számít: az ott kilógó kártyacsík (pl. az átlátszó Safari-
  // eszköztár mögött) rejtve marad, húzás közben viszont a beúszó kártya hamar megjelenik.
  let cardIO = null;
  let observed = new WeakSet();

  function watchCards() {
    if (typeof IntersectionObserver === 'undefined') return;
    if (!cardModeActive()) {
      if (cardIO) { cardIO.disconnect(); cardIO = null; }
      document.querySelectorAll('[data-rsz-out]').forEach((e) => e.removeAttribute('data-rsz-out'));
      return;
    }
    if (!cardIO) {
      observed = new WeakSet();
      cardIO = new IntersectionObserver((entries) => {
        for (const en of entries) {
          const out = !en.isIntersecting;
          if (out !== en.target.hasAttribute('data-rsz-out')) en.target.toggleAttribute('data-rsz-out', out);
        }
      }, { threshold: [0], rootMargin: '0px 0px -15% 0px' });
    }
    document.querySelectorAll(CARD).forEach((c) => {
      if (observed.has(c)) return;
      observed.add(c);
      cardIO.observe(c);
    });
  }

  // Kártyanézetben csak a kártyák maradnak: a feed előtt álló elemeket (fejléc, kereső,
  // fülsor, bal oldali menü) elrejtjük. A feed utáni elemekhez nem nyúlunk, mert köztük van
  // a további posztokat betöltő elem és a Reddit felugró ablakai is.
  function markOffpath() {
    const feed = cardModeActive() &&
      (document.querySelector('shreddit-feed') || (document.querySelector(POSTCARD) || {}).parentElement);
    const keep = new Set();
    const tame = new Set();
    const skip = (x) => (ui && x === ui.host) || /^(SCRIPT|STYLE|LINK|META|TEMPLATE|NOSCRIPT)$/.test(x.tagName);
    if (feed && document.body && document.body.contains(feed)) {
      for (let e = feed; e && e !== document.body; e = e.parentElement) {
        for (let sib = e.previousElementSibling; sib; sib = sib.previousElementSibling) {
          if (!skip(sib)) keep.add(sib);
        }
        // A feed utáni elemek maradnak, csak nem lehetnek szélesebbek a képernyőnél
        // (különben az oldal oldalra is elmozdítható lenne).
        for (let sib = e.nextElementSibling; sib; sib = sib.nextElementSibling) {
          if (!skip(sib)) tame.add(sib);
        }
      }
    }
    document.querySelectorAll('.' + TAME).forEach((x) => { if (!tame.has(x)) x.classList.remove(TAME); });
    tame.forEach((x) => { if (!x.classList.contains(TAME)) x.classList.add(TAME); });
    let changed = false;
    document.querySelectorAll('.' + OFF).forEach((x) => {
      if (!keep.has(x)) { x.classList.remove(OFF); changed = true; }
    });
    keep.forEach((x) => {
      if (!x.classList.contains(OFF)) { x.classList.add(OFF); changed = true; }
    });
    return changed;
  }

  // ---------------------------------------------------------------------------
  // Lapozás. Nem a böngésző scroll-snap-jére bízzuk: iOS Safariban az egész oldalas
  // beugró lapozás megbízhatatlan. Húzáskor a lap az ujjat követi, elengedéskor egy
  // határozott húzás vagy pöccintés egy kártyát lép, a rövid húzás visszaugrik.
  // ---------------------------------------------------------------------------

  let anim = 0;
  let pendingFrom = -1;
  let pendingTimer = 0;

  function pageCards() {
    return Array.from(document.querySelectorAll(CARD)).filter((c) => c.offsetHeight > 0);
  }

  function cardY(c) {
    return Math.max(0, Math.round(c.getBoundingClientRect().top + window.scrollY - 8 - topPx));
  }

  function nearestIndex(cards, y) {
    let best = 0;
    let bestD = Infinity;
    cards.forEach((c, i) => {
      const d = Math.abs(cardY(c) - y);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  function maxScroll() {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  function stopAnim() {
    if (anim) cancelAnimationFrame(anim);
    anim = 0;
  }

  function scrollToY(y, dur) {
    stopAnim();
    const from = window.scrollY;
    const to = Math.max(0, Math.min(Math.round(y), maxScroll()));
    const dist = to - from;
    if (!dist) return;
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      window.scrollTo(0, from + dist * e);
      anim = t < 1 ? requestAnimationFrame(step) : 0;
    };
    anim = requestAnimationFrame(step);
  }

  // dir: +1 következő, -1 előző, 0 a legközelebbire vissza; fromY: ahonnan a mozdulat indult.
  function go(dir, fromY) {
    const cards = pageCards();
    if (!cards.length) return;
    const i = nearestIndex(cards, fromY === undefined ? window.scrollY : fromY);
    const j = i + dir;
    if (j < 0) { scrollToY(0, 260); return; }
    if (j >= cards.length) {
      // A végén lejjebb gördülünk, hogy a Reddit betöltse a következő adagot;
      // amint megjönnek az új kártyák, magától az elsőre lapozunk.
      pendingFrom = cards.length;
      clearTimeout(pendingTimer);
      pendingTimer = setTimeout(() => { pendingFrom = -1; }, 10000);
      scrollToY(maxScroll(), 320);
      return;
    }
    scrollToY(cardY(cards[j]), dir ? 320 : 220);
  }

  function checkPending() {
    if (pendingFrom < 0 || !cardModeActive()) return;
    const cards = pageCards();
    if (cards.length > pendingFrom) {
      const k = pendingFrom;
      pendingFrom = -1;
      scrollToY(cardY(cards[k]), 320);
    }
  }

  function fromOurUi(e) {
    return !!(ui && e.composedPath && e.composedPath().includes(ui.host));
  }

  let touch = null;

  document.addEventListener('touchstart', (e) => {
    touch = null;
    if (!cardModeActive() || e.touches.length !== 1 || fromOurUi(e)) return;
    stopAnim();
    const t = e.touches[0];
    touch = { x: t.clientX, y: t.clientY, startY: window.scrollY, moved: false, pts: [{ y: t.clientY, t: e.timeStamp }] };
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!touch) return;
    if (e.touches.length !== 1) { touch = null; go(0); return; }
    if (e.cancelable) e.preventDefault();
    const t = e.touches[0];
    const dy = touch.y - t.clientY;
    if (!touch.moved && Math.abs(dy) < 6 && Math.abs(touch.x - t.clientX) < 6) return;
    touch.moved = true;
    window.scrollTo(0, Math.max(0, Math.min(touch.startY + dy, maxScroll())));
    touch.pts.push({ y: t.clientY, t: e.timeStamp });
    if (touch.pts.length > 5) touch.pts.shift();
  }, { passive: false });

  const endTouch = () => {
    const tt = touch;
    touch = null;
    if (!tt || !tt.moved) return; // koppintás: a kártya linkje nyílik meg
    const a = tt.pts[0];
    const b = tt.pts[tt.pts.length - 1];
    const v = (a.y - b.y) / Math.max(1, b.t - a.t); // px/ms, pozitív = felfelé húzás
    const dy = tt.y - b.y;
    const limit = window.innerHeight * 0.15;
    if (dy > limit || v > 0.35) go(1, tt.startY);
    else if (dy < -limit || v < -0.35) go(-1, tt.startY);
    else go(0, tt.startY);
  };
  document.addEventListener('touchend', endTouch, { passive: true });
  document.addEventListener('touchcancel', endTouch, { passive: true });

  // Egérgörgő / trackpad: egy mozdulat = egy kártya (a lendület miatti utánfutást elnyeljük).
  let wheelSum = 0;
  let wheelLast = 0;
  let wheelLocked = false;
  window.addEventListener('wheel', (e) => {
    if (!cardModeActive() || e.ctrlKey || fromOurUi(e)) return;
    e.preventDefault();
    const now = performance.now();
    const gap = now - wheelLast;
    wheelLast = now;
    if (wheelLocked) {
      if (gap < 220) return;
      wheelLocked = false;
    }
    if (gap > 300) wheelSum = 0;
    wheelSum += e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1);
    if (Math.abs(wheelSum) >= 40) {
      go(wheelSum > 0 ? 1 : -1);
      wheelSum = 0;
      wheelLocked = true;
    }
  }, { passive: false });

  // Billentyűzet: le/fel nyíl, PageDown/PageUp, szóköz (Shifttel vissza).
  window.addEventListener('keydown', (e) => {
    if (!cardModeActive() || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || fromOurUi(e)) return;
    const el = e.composedPath ? e.composedPath()[0] : e.target;
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName || ''))) return;
    let dir = 0;
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) dir = 1;
    else if (e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) dir = -1;
    if (!dir) return;
    e.preventDefault();
    go(dir);
  }, true);

  // A kártyák a Reddit felső, odatapadó fejléce alatt kezdődnek. Ezt mérjük meg.
  function measureTop() {
    if (!settings.cardMode || !document.body) return;
    markOffpath();
    let h = 0;
    // A saját gombunkat és panelünket kihagyjuk, a Reddit legfelső elemét keressük.
    const hits = document.elementsFromPoint(Math.round(window.innerWidth / 2), 2);
    let e = hits.find((x) => !(ui && (x === ui.host || ui.host.contains(x))));
    while (e && e !== document.body && e !== document.documentElement) {
      const pos = getComputedStyle(e).position;
      if (pos === 'fixed' || pos === 'sticky') {
        h = Math.max(0, Math.round(e.getBoundingClientRect().bottom));
        break;
      }
      e = e.parentElement;
    }
    if (h > window.innerHeight / 3) h = 0; // nem fejléc, hanem valami nagy réteg
    if (h !== topPx) { topPx = h; ensureStyle(); }
  }

  function cardModeActive() {
    return !!settings.cardMode && !openedPostId();
  }

  let styleEl = null;

  function ensureStyle() {
    const parent = document.head || document.documentElement;
    if (!parent) return;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'rsz-style';
    }
    const css = (settings.showHidden ? SHOW_CSS : HIDE_CSS) +
      (settings.hidePromos ? PROMO_CSS : '') +
      (cardModeActive() ? cardCss() + `\n:root { --rsz-top: ${topPx}px; }` : '');
    if (styleEl.textContent !== css) styleEl.textContent = css;
    if (!styleEl.isConnected) parent.appendChild(styleEl);
  }

  function applyShowClass() {
    ensureStyle();
  }

  // ---------------------------------------------------------------------------
  // Gomb és beállítópanel (saját Shadow DOM-ban, hogy a Reddit stílusa ne zavarja)
  // ---------------------------------------------------------------------------

  const UI_CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.badge {
  position: fixed; z-index: 2147483646;
  left: 12px; bottom: calc(env(safe-area-inset-bottom, 0px) + 14px);
  display: flex; align-items: center; gap: 6px;
  height: 40px; padding: 0 14px; border-radius: 20px; border: 0;
  background: rgba(28, 28, 30, .82); color: #fff;
  font: 600 15px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  box-shadow: 0 2px 10px rgba(0,0,0,.25);
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.badge .n { font-variant-numeric: tabular-nums; }
.backdrop {
  position: fixed; inset: 0; z-index: 2147483647;
  background: rgba(0,0,0,.4);
  display: flex; align-items: flex-end; justify-content: center;
}
.panel {
  width: 100%; max-width: 520px; max-height: 88vh;
  display: flex; flex-direction: column; overflow: hidden;
  background: #fff; color: #1c1c1e;
  border-radius: 16px 16px 0 0;
  font: 15px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.scroll {
  flex: 1 1 auto; min-height: 0; overflow: auto;
  -webkit-overflow-scrolling: touch; overscroll-behavior: contain;
  padding: 0 18px 8px;
}
@media (min-width: 640px) {
  .backdrop { align-items: center; }
  .panel { border-radius: 16px; max-height: 80vh; }
}
.head { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px 10px; }
h2 { margin: 0; font-size: 19px; font-weight: 700; }
.x { border: 0; background: transparent; color: inherit; font-size: 22px; line-height: 1; padding: 4px 8px; cursor: pointer; opacity: .6; }
label.t { display: block; font-weight: 600; margin-bottom: 6px; }
textarea {
  width: 100%; min-height: 220px; resize: vertical;
  font: 16px/1.45 ui-monospace, Menlo, Consolas, monospace;
  padding: 10px 12px; border-radius: 10px;
  border: 1px solid #c7c7cc; background: #f7f7f8; color: inherit;
}
textarea:focus { outline: 2px solid #0a84ff; outline-offset: 0; border-color: transparent; }
.help { margin: 8px 0 14px; padding-left: 18px; font-size: 13px; color: #6e6e73; }
.help li { margin: 2px 0; }
code { font: 12.5px ui-monospace, Menlo, Consolas, monospace; background: rgba(127,127,127,.15); padding: 1px 4px; border-radius: 4px; }
.row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-top: 1px solid rgba(127,127,127,.2); }
.row input { width: 20px; height: 20px; margin: 0; accent-color: #0a84ff; flex: none; }
.row label { flex: 1; }
.list-title { font-weight: 600; margin: 12px 0 6px; }
ul.hidden { list-style: none; margin: 0; padding: 0; font-size: 13.5px; }
ul.hidden li { padding: 6px 0; border-bottom: 1px solid rgba(127,127,127,.15); }
ul.hidden .kw { display: inline-block; font-weight: 600; color: #e5484d; margin-right: 6px; }
.empty { font-size: 13.5px; color: #6e6e73; }
.btns {
  flex: none; display: flex; gap: 10px;
  padding: 12px 18px calc(env(safe-area-inset-bottom, 0px) + 14px);
  border-top: 1px solid rgba(127,127,127,.2);
}
.btns button { flex: 1; height: 46px; border-radius: 12px; border: 0; font: 600 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; cursor: pointer; }
.save { background: #0a84ff; color: #fff; }
.cancel { background: rgba(127,127,127,.18); color: inherit; }
@media (prefers-color-scheme: dark) {
  .panel { background: #1c1c1e; color: #f2f2f7; }
  textarea { background: #2c2c2e; border-color: #3a3a3c; }
  .help, .empty { color: #98989d; }
}`;

  let ui = null;

  function mk(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    (children || []).forEach((c) => e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return e;
  }

  function ensureUi() {
    if (ui && ui.host.isConnected) return ui;
    if (!document.body) return null;
    const host = mk('div', { id: 'reddit-szuro' });
    const root = host.attachShadow({ mode: 'open' });
    root.appendChild(mk('style', { text: UI_CSS }));
    const count = mk('span', { class: 'n', text: '0' });
    const badge = mk('button', { class: 'badge', type: 'button', title: 'Reddit-szűrő', 'aria-label': 'Reddit-szűrő beállításai', onclick: openPanel }, ['🙈', count]);
    root.appendChild(badge);
    // A gépelés ne indítsa el a Reddit billentyűparancsait.
    ['keydown', 'keyup', 'keypress'].forEach((t) => root.addEventListener(t, (e) => e.stopPropagation()));
    document.body.appendChild(host);
    ui = { host, root, badge, count, backdrop: null };
    return ui;
  }

  let badgeQueued = false;
  function scheduleBadge() {
    if (badgeQueued) return;
    badgeQueued = true;
    requestAnimationFrame(() => {
      badgeQueued = false;
      const u = ensureUi();
      if (u) u.count.textContent = String(document.querySelectorAll('.' + HID).length);
      if (markOffpath()) measureTop();
      checkPending();
      watchCards();
    });
  }

  function hiddenOnPage() {
    return Array.from(document.querySelectorAll('.' + HID)).map((b) => ({
      kw: b.getAttribute('data-rsz') || '',
      title: b.getAttribute('data-rsz-title') || '',
    }));
  }

  function openPanel() {
    const u = ensureUi();
    if (!u || u.backdrop) return;

    const ta = mk('textarea', { spellcheck: 'false', autocapitalize: 'none', autocorrect: 'off', autocomplete: 'off', id: 'rsz-list' });
    ta.value = settings.list;

    const show = mk('input', { type: 'checkbox', id: 'rsz-show' });
    show.checked = !!settings.showHidden;
    show.addEventListener('change', () => {
      settings.showHidden = show.checked;
      applyShowClass();
      save();
    });

    const card = mk('input', { type: 'checkbox', id: 'rsz-card' });
    card.checked = !!settings.cardMode;
    card.addEventListener('change', () => {
      settings.cardMode = card.checked;
      ensureStyle();
      measureTop();
      rescanAll();
      save();
    });

    const promo = mk('input', { type: 'checkbox', id: 'rsz-promo' });
    promo.checked = settings.hidePromos !== false;
    promo.addEventListener('change', () => {
      settings.hidePromos = promo.checked;
      ensureStyle();
      quietPromos();
      save();
    });

    const items = hiddenOnPage();
    const list = items.length
      ? mk('ul', { class: 'hidden' }, items.slice(0, 40).map((it) =>
          mk('li', null, [mk('span', { class: 'kw', text: it.kw }), it.title])))
      : mk('p', { class: 'empty', text: 'Ezen az oldalon még nincs elrejtett poszt.' });

    const close = () => {
      u.backdrop.remove();
      u.backdrop = null;
      document.removeEventListener('keydown', onEsc, true);
    };
    const onEsc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };

    const doSave = () => {
      settings.list = ta.value;
      matcher = buildMatcher(settings.list);
      save();
      rescanAll();
      close();
    };

    const panel = mk('div', { class: 'panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Reddit-szűrő' }, [
      mk('div', { class: 'head' }, [
        mk('h2', { text: 'Reddit-szűrő' }),
        mk('button', { class: 'x', type: 'button', 'aria-label': 'Bezárás', text: '✕', onclick: close }),
      ]),
      mk('div', { class: 'scroll' }, [
        mk('label', { class: 't', for: 'rsz-list', text: 'Kulcsszavak, soronként egy' }),
        ta,
        mk('ul', { class: 'help' }, [
          mk('li', null, ['A szó elejére illeszt, így a ragos alakokat is kiszűri: ', mk('code', { text: 'trump' }), ' → Trumpról, Trump\'s.']),
          mk('li', null, ['Csak pontosan ez a szó: idézőjelben, pl. ', mk('code', { text: '"musk"' }), '.']),
          mk('li', null, ['Kivétel kötőjellel: ', mk('code', { text: '-trumpet' }), ' – a trombitás posztok maradnak.']),
          mk('li', null, ['Egész subreddit: ', mk('code', { text: 'r/politics' }), '. Megjegyzés: ', mk('code', { text: '# …' }), '.']),
          mk('li', null, ['A cím, a flair, a poszt szövege és a link címe számít. Kis- és nagybetű, ékezet nem.']),
        ]),
        mk('div', { class: 'row' }, [card, mk('label', { for: 'rsz-card', text: 'Kártyanézet: egy poszt egy képernyő, felfelé húzással lapozol, mint a TikTokon' })]),
        mk('div', { class: 'row' }, [show, mk('label', { for: 'rsz-show', text: 'Elrejtett posztok mutatása halványan, ellenőrzéshez' })]),
        mk('div', { class: 'row' }, [promo, mk('label', { for: 'rsz-promo', text: 'A Reddit app-reklámjainak elrejtése (pl. „Get the Reddit app” sáv)' })]),
        mk('div', { class: 'list-title', text: 'Ezen az oldalon elrejtve: ' + items.length }),
        list,
      ]),
      mk('div', { class: 'btns' }, [
        mk('button', { class: 'cancel', type: 'button', text: 'Mégse', onclick: close }),
        mk('button', { class: 'save', type: 'button', text: 'Mentés', onclick: doSave }),
      ]),
    ]);

    u.backdrop = mk('div', { class: 'backdrop', onclick: (e) => { if (e.target === u.backdrop) close(); } }, [panel]);
    u.root.appendChild(u.backdrop);
    document.addEventListener('keydown', onEsc, true);
  }

  // ---------------------------------------------------------------------------
  // Indítás
  // ---------------------------------------------------------------------------

  // A dokumentumot magát figyeljük, így akkor is működik, ha a szkript
  // még a <html> elem létrejötte előtt indul.
  ensureStyle();
  quietPromos();
  document.querySelectorAll('meta').forEach(killSmartBanner);
  observer.observe(document, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['post-title'],
  });

  const onReady = () => { ensureUi(); rescanAll(); measureTop(); };
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { measureTop(); if (cardModeActive()) go(0); }, 250);
  });
  window.addEventListener('popstate', () => { lastPath = location.pathname; ensureStyle(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady, { once: true });
  else onReady();
  window.addEventListener('load', () => { rescanAll(); measureTop(); }, { once: true });

  // A bővítmény saját tárolója az elsődleges; a helyi másolat csak a gyors induláshoz kell.
  loadGM().then((fromGM) => {
    const gm = migrate(fromGM);
    const stored = gm.s;
    // Nincs mentés a bővítményben (első indítás, vagy nincs GM): a helyi/alap lista megy bele.
    if (!stored) { save(); return; }
    if (stored.list !== settings.list || stored.showHidden !== settings.showHidden ||
        stored.hidePromos !== settings.hidePromos || stored.cardMode !== settings.cardMode) {
      settings = stored;
      matcher = buildMatcher(settings.list);
      applyShowClass();
      rescanAll();
      if (document.body) measureTop();
      save();
    } else if (gm.changed || local.changed) {
      save();
    }
  });

  // Teszteléshez és hibakereséshez.
  window.__redditSzuro = { norm, parseList, buildMatcher, migrate, rescanAll, version: '1.7.0' };
})();
