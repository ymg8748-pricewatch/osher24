/* Entry notice: a modal shown on every page load. Nothing is stored in the browser. */
(function () {
  var NOTICE_V = '2026-11-27';
  var P = [
    'אתר זה הוקם כפרויקט אישי לצורכי תחביב בלבד, והוא אינו אתר רשמי של אושר עד או של רשת אחרת. שמות ומותגים שייכים לבעליהם.',
    'הנתונים באתר, ובכלל זה מחירים, מבצעים ומלאי, נלקטים אוטומטית מקבצי השקיפות הפומביים שהרשתות מפרסמות, ועלולים להיות חלקיים, לא מעודכנים או שגויים. המחיר בחנות הוא המחיר המחייב.',
    'האתר פרטי ומיועד לאנשים שאושרו על ידי מפעיל האתר בלבד. אין להעביר את הקישור או פרטי ההתחברות לאחרים. אין להעתיק, לשכפל או להפיץ את הנתונים, ואין להשתמש בהם למסחר או לפרסום.',
    'מפעיל האתר רשאי לשנות, להפסיק או לחסום גישה לאתר בכל עת וללא הודעה מראש. אין התחייבות שהאתר יפעל ברציפות וללא תקלות.',
    'האתר שומר רק את הנתונים הדרושים לתפעולו: שם משתמש וסניף, כתובת IP להגבלת ניסיונות כניסה (כניסות מנהל נרשמות ביומן עם כתובת IP), וסטטיסטיקת חיפושים מצטברת. ללא פרסומות וללא מעקב.',
    'השימוש באתר ובנתונים הוא על אחריות המשתמש בלבד. מפעיל האתר אינו אחראי לכל נזק או הפסד, ישיר או עקיף, שייגרמו משימוש בנתונים או מהסתמכות עליהם. בלחיצה על "אישור והמשך" אתה מאשר שקראת והבנת, ומוותר מראש על כל טענה, דרישה או תביעה כלפי מפעיל האתר בגין השימוש באתר.',
    'על האתר והשימוש בו יחולו דיני מדינת ישראל, ולבתי המשפט בישראל הסמכות הבלעדית.'
  ];
  function build() {
    var css = document.createElement('style');
    css.textContent = '#o24n{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;padding:14px;direction:rtl;font-family:Heebo,system-ui,Arial,sans-serif}' +
      '#o24n .d{width:100%;max-width:560px;max-height:calc(100vh - 28px);max-height:calc(100dvh - 28px);background:#1b232a;color:#f2f5f3;border:1px solid #2d3a43;border-radius:18px;display:flex;flex-direction:column;box-shadow:0 20px 60px #000a}' +
      '#o24n h2{margin:0;padding:16px 18px 10px;font-size:20px;font-weight:800;border-bottom:1px solid #2d3a43}' +
      '#o24n .t{overflow:auto;padding:12px 18px;font-size:15px;line-height:1.65;-webkit-overflow-scrolling:touch}' +
      '#o24n .t p{margin:0 0 11px}#o24n .t a{color:#c6ff4d}' +
      '#o24n .f{padding:12px 18px 16px;border-top:1px solid #2d3a43}' +
      '#o24n button{display:block;width:100%;padding:14px;border:0;border-radius:999px;background:#c6ff4d;color:#10151a;font:800 17px Heebo,system-ui,Arial,sans-serif;cursor:pointer}' +
      '#o24n button:focus-visible,#o24n a:focus-visible{outline:3px solid #fff;outline-offset:2px}' +
      '#o24n .s{margin-top:8px;text-align:center;font-size:12px;color:#9aa8b0}';
    document.head.appendChild(css);
    var ov = document.createElement('div'); ov.id = 'o24n'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'o24nt');
    var d = document.createElement('div'); d.className = 'd';
    var h = document.createElement('h2'); h.id = 'o24nt'; h.textContent = 'שים לב לפני השימוש'; d.appendChild(h);
    var t = document.createElement('div'); t.className = 't'; t.tabIndex = 0;
    P.forEach(function (x) { var p = document.createElement('p'); p.textContent = x; t.appendChild(p); });
    var pr = document.createElement('p'); pr.appendChild(document.createTextNode('נתון שגוי? '));
    var a = document.createElement('a'); a.href = 'mailto:ymg8748@gmail.com?subject=' + encodeURIComponent('דיווח על נתון שגוי באושר24'); a.textContent = 'אפשר לדווח למפעיל האתר'; pr.appendChild(a); pr.appendChild(document.createTextNode('.')); t.appendChild(pr);
    d.appendChild(t);
    var f = document.createElement('div'); f.className = 'f';
    var b = document.createElement('button'); b.type = 'button'; b.textContent = 'אישור והמשך'; f.appendChild(b);
    d.appendChild(f); ov.appendChild(d);
    var others = [].slice.call(document.body.children), prevOverflow = document.documentElement.style.overflow;
    others.forEach(function (e) { e.inert = true; });
    document.documentElement.style.overflow = 'hidden';
    document.body.appendChild(ov);
    function trap(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); }
      if (e.key === 'Tab') {
        var f1 = [t, a, b], i = f1.indexOf(document.activeElement);
        e.preventDefault(); f1[(i + (e.shiftKey ? f1.length - 1 : 1)) % f1.length].focus();
      }
    }
    document.addEventListener('keydown', trap, true);
    b.onclick = function () {
      document.removeEventListener('keydown', trap, true);
      others.forEach(function (e) { e.inert = false; });
      document.documentElement.style.overflow = prevOverflow;
      ov.remove(); css.remove();
    };
    b.focus();
  }
  if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
})();
