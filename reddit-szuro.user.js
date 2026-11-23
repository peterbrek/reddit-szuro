// ==UserScript==
// @name         Reddit-szűrő
// @namespace    https://github.com/peterbrek
// @homepageURL  https://github.com/peterbrek/reddit-szuro
// @updateURL    https://raw.githubusercontent.com/peterbrek/reddit-szuro/main/reddit-szuro.user.js
// @downloadURL  https://raw.githubusercontent.com/peterbrek/reddit-szuro/main/reddit-szuro.user.js
// @version      1.0.0
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
    'elon',
    '-elongat',
    'musk',
    '-muskát',
    '-muskotály',
    '-musket',
    'altman',
    'huang',
    'nvidia ceo',
    'nvidia vezér',
  ].join('\n');

  const DEFAULTS = { list: DEFAULT_LIST, showHidden: false };

  const hasGM = typeof GM !== 'undefined' && GM && typeof GM.getValue === 'function';

  function parseStored(raw) {
    if (!raw) return null;
    try {
      const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (obj && typeof obj.list === 'string') return Object.assign({}, DEFAULTS, obj);
    } catch (e) { /* sérült adat: marad az alap */ }
    return null;
  }

  function loadLocal() {
    try { return parseStored(localStorage.getItem(STORE_KEY)); } catch (e) { return null; }
  }

  async function loadGM() {
    if (!hasGM) return null;
    try { return parseStored(await GM.getValue(STORE_KEY)); } catch (e) { return null; }
  }

  function save() {
    const raw = JSON.stringify({ list: settings.list, showHidden: settings.showHidden });
    try { localStorage.setItem(STORE_KEY, raw); } catch (e) { /* privát mód */ }
    if (hasGM) { try { GM.setValue(STORE_KEY, raw); } catch (e) { /* nincs GM */ } }
  }

  let settings = loadLocal() || Object.assign({}, DEFAULTS);

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

  const observer = new MutationObserver((mutations) => {
    if (!styleEl || !styleEl.isConnected) ensureStyle();
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
  const HIDE_CSS = `.${HID}, .${HID} + hr { display: none !important; }`;
  const SHOW_CSS = `
.${HID} { opacity: .45; outline: 2px dashed #e5484d; outline-offset: -2px; }
.${HID}::before {
  content: "Elrejtve · " attr(data-rsz);
  display: block; padding: 6px 12px;
  font: 600 12px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #e5484d;
}`;

  let styleEl = null;

  function ensureStyle() {
    const parent = document.head || document.documentElement;
    if (!parent) return;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'rsz-style';
    }
    const css = settings.showHidden ? SHOW_CSS : HIDE_CSS;
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
        mk('div', { class: 'row' }, [show, mk('label', { for: 'rsz-show', text: 'Elrejtett posztok mutatása halványan, ellenőrzéshez' })]),
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
  observer.observe(document, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['post-title'],
  });

  const onReady = () => { ensureUi(); rescanAll(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady, { once: true });
  else onReady();
  window.addEventListener('load', rescanAll, { once: true });

  // A bővítmény saját tárolója az elsődleges; a helyi másolat csak a gyors induláshoz kell.
  loadGM().then((stored) => {
    if (!stored) { if (hasGM) save(); return; }
    if (stored.list !== settings.list || stored.showHidden !== settings.showHidden) {
      settings = stored;
      matcher = buildMatcher(settings.list);
      try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch (e) { /* privát mód */ }
      applyShowClass();
      rescanAll();
    }
  });

  // Teszteléshez és hibakereséshez.
  window.__redditSzuro = { norm, parseList, buildMatcher, rescanAll, version: '1.0.0' };
})();
