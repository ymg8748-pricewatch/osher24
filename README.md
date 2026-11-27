# Osher Ad branches comparison
Static page (`public/`) plus Cloudflare Pages Functions (`functions/`). Reads the existing database through two token-gated read-only functions (`br24_find`, `br24_meta`). Nothing here writes to that database.

## Environment secrets
Cloudflare Pages > Settings > Environment variables (type "Secret"). Never commit them. For local runs copy `.dev.vars.example` to `.dev.vars`.

| Name | Meaning |
|---|---|
| `SB_URL`, `SB_ANON`, `BR24_TOKEN` | database connection |
| `COOKIE_SECRET` | long random string that signs login sessions |
| `BRANCH_PASSWORDS` | JSON, one password per branch code: `{"022":"...","024":"..."}` |
| `ADMIN_PASSWORD` | optional network manager; can switch branches and opens `/admin.html` (legacy name `SITE_PASSWORD` also works) |
| `STALE_HOURS` | optional, hours before the "prices are out of date" banner shows (default 36) |

## Optional: KV (statistics + login rate limiting)
Create a KV namespace (Workers & Pages > KV) and bind it to the Pages project as **KV** (Settings > Bindings). Without it the site works the same, just without statistics and without the 8-failed-logins-per-15-minutes lock per IP.

## Login and roles
Login page: pick a branch, type its password. A branch login locks "my branch" to that branch; admin can switch. Sessions last 30 days; `/logout` ends one. Changing a branch password (or `COOKIE_SECRET`) logs that branch out. Every branch sees all 24 branches' prices.

## Branches
`functions/_branches.json` is the single source for names, approximate locations and regions. Edit it, redeploy.

## Features
- Branch list: every branch in one plain list (rank, price, difference from my branch, promo, distance), sortable by price or distance, filterable by region.
- Share / export (📤): colourful picture for WhatsApp, PDF, Excel (basket: summary + comparison matrix with live formulas + products sheet). Built in the browser by `public/export.js`; ExcelJS is loaded from jsDelivr on demand. On phones the system share sheet is used, on desktop the file is downloaded.
- Basket: add products, edit quantities, see the total per branch for the whole basket (branches missing an item are listed at the bottom), and what buying each item at its cheapest branch would save.
- Price-gap filter: show only products where other branches are cheaper (or more expensive) than your branch by at least X shekels; products are sorted by the biggest gap and the branch list shows only the matching branches.
- Search by barcode or name (several words in any order), promo filter, recent searches, share link (`/?q=<barcode>`; admin links also carry `&b=<branch>`).
- Barcode scan (▦ button): live camera (native `BarcodeDetector` where available, otherwise the ZXing library loaded from jsDelivr on demand, which also works on iPhone). If the camera is blocked, it opens the phone camera to take a photo of the barcode and decodes that. Needs HTTPS (Cloudflare provides it).
- Banner when prices are older than `STALE_HOURS` or the database does not answer.
- Installable as an app (manifest + minimal service worker; `/api` is never cached).
- `/admin.html` (admin only): database health, data age, top searches, searches with no result, searches per branch.
- Server: 60-second edge cache for repeated searches, query length cap, errors written to the Cloudflare logs.

## Rotating the database token
1. Create the new token in the database. 2. Update `BR24_TOKEN` in Cloudflare and redeploy. 3. Remove the old token.

## Not included
Price history and price alerts: the two read-only functions return only current prices, so that needs a database change.

## שיפורים אחרונים
- **הסל:** שורת "סניף מומלץ" (הזול ביותר לסל, כמה חוסך, כמה ק"מ).
- **סריקה:** מצב "הוספה לסל ברצף" במסך הסורק, עם צפצוף ורטט.
- **חיפוש:** הצעות תוך כדי הקלדה ותיקון שגיאות כתיב (מקצר את המילה עד 2 אותיות).
- **דוח פערים:** כפתור "📊 דוח פערים" מייצא לאקסל את התוצאות הנוכחיות (אצלי מול הכי זול והממוצע).
- **אופליין:** עד 10 חיפושים אחרונים נשמרים במכשיר ומוצגים כשאין חיבור.
- **נגישות:** כפתור ♿ (גודל טקסט, ניגודיות גבוהה, בלי אנימציות), מיקוד נראה, הכרזות לקורא מסך.

## עוד שיפורים
- **מחיר חריג:** סניף שמחירו סוטה 15%+ מהחציון מסומן "חריג" ברשימה, והמונה מופיע ליד "X מתוך Y".
- **צמצום לפי מילה:** מתחת לחיפוש מופיעות מילים נפוצות משמות התוצאות (מותג, סוג) ללחיצה. (אין בנתונים שדה קטגוריה, לכן הצמצום לפי מילה.)
- **סריקות אחרונות:** כפתור "🕘 סריקות" שומר עד 50 ברקודים במכשיר, עם חיפוש.
- **קישור לסל:** בסל, "🔗 קישור לסל" יוצר קישור (`?cart=קוד.כמות,...`) שפותח את אותו סל אצל מי שמקבל אותו.
- **התראת נתונים ישנים:** `GET /api/health?key=<HEALTH_KEY>` מחזיר 200/503. מחברים אותו לשירות ניטור חינמי (UptimeRobot וכד') שישלח מייל/SMS.
  אופציונלי: `ALERT_WEBHOOK` (Slack/Discord/Teams/Make) לשליחת הודעה עצמאית, פעם ב-6 שעות לכל היותר (דורש KV).
  משתני סביבה חדשים: `HEALTH_KEY`, `ALERT_WEBHOOK` (שניהם אופציונליים).

## השוואה בין סניפים (בסיס פונקציונלי מ-PriceWatch)
מפת היכולות המלאה (מה הועבר, מה דולג ולמה): `docs/PARITY.md`.
- **מסך מלחמת סניפים / איפה אני יקר / מבצעים / באנר סניפים חסרים** משתמשים בפונקציות קריאה חדשות. להריץ פעם אחת `db/br24_readonly_rpcs.sql` ב-Supabase.
  לפני ההרצה: בקובץ יש `br24_require_token` שחוסם הכול. יש להחליף את גוף הפונקציה בבדיקת הטוקן שכבר קיימת ב-`br24_find`. עד אז המסכים מציגים "דורש את הפונקציות החדשות".
- **צופה:** `VIEWER_PASSWORDS` = `{"022":"סיסמה"}`. צופה רואה חיפוש והשוואה, בלי סל, ייצוא ודוחות. במסך הכניסה בוחרים "מנהל סניף" או "צופה".

## הודעת כניסה
- `public/notice.js`: חלון חובה שמוצג בכל טעינת עמוד (אישור והמשך). שום דבר לא נשמר בדפדפן.

## עמודים משפטיים וצד שלישי (27.11.2026)
- `public/privacy.html`, `terms.html`, `accessibility.html`: נגישים גם לפני כניסה (ברשימת `PUBLIC` ב-`_middleware.js`). פרטי המפעיל והמייל מולאו בכל שלושת העמודים.
- קישורים: בתחתית מסך הכניסה ובתחתית האתר.
- הפונט Heebo, ExcelJS ו-ZXing מאוחסנים ב-`public/vendor/` (רישיונות בתיקייה). אין יותר קריאות ל-Google Fonts או jsDelivr.
- עוגייה אחת בלבד (`o24`, חיונית), ולכן אין באנר הסכמה. אם יתווספו כלי אנליטיקה או עוגיות נוספות, צריך לעדכן את מדיניות הפרטיות ולהוסיף הסכמה.

## אבטחה (27.11.2026)
- `_middleware.js` מוסיף לכל תשובה: HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (מצלמה רק מהאתר), ו-CSP במצב Report-Only. כדי לאכוף את ה-CSP: לפתוח את האתר, לוודא בקונסולה שאין הפרות, ולשנות את שם הכותרת `content-security-policy-report-only` ל-`content-security-policy`.
- `/admin` ו-`/admin.html` נחסמים לכל מי שאינו מנהל רשת (הפניה לדף הבית). נקודות הקצה של הניהול נבדקות בשרת, ובקשות ניהול מדומיין אחר נדחות.
- סיסמאות שמוגדרות מהניהול: לפחות 4 תווים (נבדק בשרת).
- התראה על כניסות חשודות: כשכתובת IP ננעלת אחרי 8 ניסיונות כושלים נשלחת הודעה אחת ל-`ALERT_WEBHOOK` (דורש KV). כניסת מנהל ושינוי סיסמה נרשמים ביומן של Cloudflare.
