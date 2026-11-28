/* osher24 visual layer: glass, cursor, tilt, scroll indicator and kinetic headings. No libraries. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || root.hasAttribute('data-rm');
  var fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  var fxOff = false; try { fxOff = localStorage.o24fx === 'off'; } catch (e) {}

  root.classList.add('fx3d');

  /* kinetic headings: split text-only headings into words that rise into view */
  function split(el) {
    if (el.dataset.kin || el.childElementCount || !el.textContent.trim()) return;
    el.dataset.kin = '1';
    var words = el.textContent.trim().split(/\s+/), n = Math.min(words.length, 10);
    el.setAttribute('aria-label', el.textContent.trim());
    el.textContent = '';
    words.forEach(function (w, i) {
      var o = document.createElement('span'), inn = document.createElement('i');
      o.className = 'kw'; o.setAttribute('aria-hidden', 'true'); inn.style.setProperty('--w', Math.min(i, n)); inn.textContent = w;
      o.appendChild(inn); el.appendChild(o); if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
  }
  var out = document.getElementById('out');
  function kin() { if (reduce) return; out.querySelectorAll('h2,.hh>span:first-child').forEach(split); }
  if (out) { kin(); new MutationObserver(kin).observe(out, { childList: true }); }

  /* category icons (SVG sprite, no images) next to every product */
  var CAT = [['pharma', /שמפו|סבון|משחה|קרם|דאודורנט|דיאודורנט|טמפון|תחבושת|חיתול|מברשת שיניים|ויטמין|גילוח|מגבון|פארם|שן|פנדה|אקמול|נורופן/],
    ['clean', /כביסה|מרכך|נוזל כלים|אקונומיקה|מנקה|ספוג|שקיות אשפה|נייר טואלט|מגבות נייר|ניקוי|סנו|פיירי|אריאל|כלים/],
    ['drink', /מים|מיץ|קולה|פפסי|ספרייט|בירה|יין|משקה|תה |קפה|סודה|שתיה|שתייה|נס |נקטר|פריגת|וודקה|ויסקי/]];
  function catOf(name) { for (var i = 0; i < CAT.length; i++) if (CAT[i][1].test(name)) return CAT[i][0]; return /חלב|גבינה|יוגורט|שמנת|קוטג|לבן|ביצ/.test(name) ? 'dairy' : /לחם|פסטה|אורז|שוקולד|במבה|ביצ|עוף|בשר|דג|ירק|פרי|שמן|סוכר|קמח|עוגי|חטיף/.test(name) ? 'food' : 'basket'; }
  function icon(name, cls) { return '<svg class="' + (cls || 'ic3d') + '" viewBox="0 0 48 48" aria-hidden="true"><use href="#ic-' + catOf(name) + '"/></svg>'; }
  window.o24icon = icon;
  var icT = 0;
  function icons() {
    icT = 0;
    out.querySelectorAll('.rw[data-code]:not([data-ic])').forEach(function (r) {
      var b = r.querySelector('.nm b'), k = r.querySelector('.rk'); if (!b || !k) return;
      r.setAttribute('data-ic', '1'); k.innerHTML = icon(b.textContent);
    });
    document.querySelectorAll('#toc .pod:not([data-ic])').forEach(function (p) {
      var b = p.querySelector('b'); if (!b) return; p.setAttribute('data-ic', '1'); p.insertAdjacentHTML('afterbegin', icon(b.textContent, 'ic3d pic'));
    });
    var pn = out.querySelector('.pn:not([data-ic])');
    if (pn) { pn.setAttribute('data-ic', '1'); pn.insertAdjacentHTML('afterbegin', icon(pn.textContent, 'ic3d hic')); }
  }
  var icObs = new MutationObserver(function () { if (!icT) icT = requestAnimationFrame(icons); });
  if (out) { icons(); icObs.observe(out, { childList: true, subtree: true }); }
  var tocEl = document.getElementById('toc'); if (tocEl) icObs.observe(tocEl, { childList: true, subtree: true });

  /* scroll progress */
  var bar = document.createElement('div'); bar.id = 'fxp'; bar.setAttribute('aria-hidden', 'true'); bar.innerHTML = '<i></i>';
  document.body.appendChild(bar);
  var fill = bar.firstChild, tick = 0;
  function prog() {
    tick = 0;
    var max = root.scrollHeight - innerHeight;
    if (max < 120) { bar.classList.remove('on'); return; }
    bar.classList.add('on'); fill.style.transform = 'scaleY(' + Math.min(1, Math.max(0, scrollY / max)) + ')';
  }
  var st = 0;
  addEventListener('scroll', function () { root.classList.add('scrolling'); clearTimeout(st); st = setTimeout(function () { root.classList.remove('scrolling'); }, 700); }, { passive: true });
  function sched() { if (!tick) tick = requestAnimationFrame(prog); }
  addEventListener('scroll', sched, { passive: true }); addEventListener('resize', sched);
  if (window.ResizeObserver) new ResizeObserver(sched).observe(document.body);
  prog();

  if (!fine || reduce) return;

  /* 3D tilt on feature cards */
  root.classList.add('fx-tilt');
  var cur = null;
  function tilt(e) {
    var el = e.target.closest && e.target.closest('.best,.homec,.qt');
    if (cur && cur !== el) { cur.style.removeProperty('--rx'); cur.style.removeProperty('--ry'); }
    cur = el; if (!el) return;
    var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5, k = el.classList.contains('homec') ? 2.2 : 6;
    el.style.setProperty('--ry', (x * k).toFixed(2) + 'deg'); el.style.setProperty('--rx', (-y * k).toFixed(2) + 'deg');
  }
  document.addEventListener('pointermove', tilt, { passive: true });
  document.addEventListener('pointerleave', function () { if (cur) { cur.style.removeProperty('--rx'); cur.style.removeProperty('--ry'); cur = null; } });

  /* magnetic cursor */
  var ring = document.createElement('div'), dot = document.createElement('div');
  ring.id = 'fxc'; dot.id = 'fxd'; ring.setAttribute('aria-hidden', 'true'); dot.setAttribute('aria-hidden', 'true');
  document.body.appendChild(ring); document.body.appendChild(dot);
  root.classList.add('fx-cur');
  var mx = -100, my = -100, rx = -100, ry = -100, run = 0, mag = null;
  var HOT = 'a,button,select,summary,[role=button],[data-code],.chip,.qt,label';
  var MAG = '.chip,.qt,#scan,.tab,.go';
  function loop() {
    rx += (mx - rx) * .22; ry += (my - ry) * .22;
    ring.style.transform = 'translate3d(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px,0)';
    dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
    run = (Math.abs(mx - rx) > .3 || Math.abs(my - ry) > .3) ? requestAnimationFrame(loop) : 0;
  }
  document.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    mx = e.clientX; my = e.clientY; ring.classList.add('on'); dot.classList.add('on');
    if (!run) run = requestAnimationFrame(loop);
    var t = e.target.closest ? e.target : null, hot = t && t.closest(HOT);
    ring.classList.toggle('h', !!hot);
    var m = t && t.closest(MAG);
    if (mag && mag !== m) { mag.style.translate = ''; mag = null; }
    if (m) {
      var r = m.getBoundingClientRect(), dx = (e.clientX - (r.left + r.width / 2)) * .18, dy = (e.clientY - (r.top + r.height / 2)) * .18;
      m.style.translate = Math.max(-8, Math.min(8, dx)).toFixed(1) + 'px ' + Math.max(-6, Math.min(6, dy)).toFixed(1) + 'px'; mag = m;
    }
  }, { passive: true });
  document.addEventListener('pointerleave', function () { ring.classList.remove('on'); dot.classList.remove('on'); if (mag) { mag.style.translate = ''; mag = null; } });
})();
