/* Osher24 export module: Excel (ExcelJS), picture (canvas), PDF (picture inside a PDF), WhatsApp text.
   Used by the page in the browser and by Node (to make sample files). No data leaves the device.

   model = {
     date: Date, mine: '022',
     names: {code: name}, reg: {code: regionIndex}, regions: [regionName...],
     dist: {code: km}            // optional, km from my branch
     items: [{name, code, qty, d: {branchCode: [shelf, effective, promoQty, promoText, flag]}}]
   }
   One item => "single product" layout; several items => "basket" layout. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OsherExport = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const FONT = 'Arial';
  const C = { ink: 'FF111111', paper: 'FFF2EEE3', card: 'FFFFFDF7', lime: 'FFC9FF2F', blue: 'FF2447FF', hot: 'FFFF5A1F', grey: 'FF8A8A80', lightGrey: 'FFE9E5D8', green: 'FF0A8A3C', white: 'FFFFFFFF' };
  const REG_FILL = ['FFBDD7EE', 'FFC6E0B4', 'FFFFE699', 'FFF8CBAD', 'FFD9C3E8'];
  const PRICE = '"₪"0.00', PRICE_PROMO = '"★ ₪"0.00', DIFF = '+"₪"0.00;-"₪"0.00;"—"', PCT = '+0.0%;-0.0%;"—"';
  const medal = r => (r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : '');
  const fmt = n => '₪' + Number(n).toFixed(2);
  const pad2 = n => String(n).padStart(2, '0');
  const dateStr = d => `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
  const colLetter = n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

  /* ---------- analysis shared by every format ---------- */
  function analyze(m) {
    const codes = Object.keys(m.names);
    const items = m.items.map(it => ({ ...it, qty: it.qty || 1 }));
    const regionOf = c => (m.regions && m.reg && m.regions[m.reg[c]]) || '';
    const branches = codes.map(c => {
      let sum = 0, missing = 0;
      for (const it of items) { const v = it.d[c]; if (!v) missing++; else sum += v[1] * it.qty; }
      return { c, name: m.names[c], region: regionOf(c), regionIdx: m.reg ? m.reg[c] : undefined, sum, missing, km: m.dist ? m.dist[c] : undefined };
    });
    const complete = branches.filter(b => !b.missing).sort((a, b) => a.sum - b.sum || a.name.localeCompare(b.name, 'he'));
    const partial = branches.filter(b => b.missing).sort((a, b) => a.missing - b.missing || a.sum - b.sum);
    const order = [...complete, ...partial];
    complete.forEach((b, i) => (b.rank = i + 1));
    const best = complete[0] || null, mine = branches.find(b => b.c === m.mine) || null;
    const split = items.reduce((s, it) => { const e = Object.values(it.d).map(v => v[1]); return s + (e.length ? Math.min(...e) * it.qty : 0); }, 0);
    const per = items.map(it => {
      const rows = Object.entries(it.d).map(([c, v]) => ({ c, name: m.names[c], region: regionOf(c), shelf: v[0], eff: v[1], promo: v.length > 2 ? v[3] : null, km: m.dist ? m.dist[c] : undefined })).sort((a, b) => a.eff - b.eff || a.name.localeCompare(b.name, 'he'));
      rows.forEach((r, i) => (r.rank = i + 1));
      const my = rows.find(r => r.c === m.mine) || null;
      return { it, rows, my, lo: rows[0] || null, hi: rows[rows.length - 1] || null };
    });
    return { items, branches, order, complete, partial, best, mine, split, per, regionOf, date: m.date || new Date() };
  }
  const isBasket = m => m.items.length > 1 || m.forceBasket;

  /* ============================== EXCEL ============================== */
  const fillOf = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
  const thin = argb => ({ style: 'thin', color: { argb: argb || 'FFD6D1C2' } });
  const box = argb => ({ top: thin(argb), bottom: thin(argb), left: thin(argb), right: thin(argb) });
  function put(ws, addr, value, o = {}) {
    const c = ws.getCell(addr);
    c.value = value;
    c.font = { name: FONT, size: o.size || 11, bold: !!o.bold, italic: !!o.italic, color: { argb: o.color || C.ink } };
    if (o.fill) c.fill = fillOf(o.fill);
    c.alignment = { horizontal: o.h || 'center', vertical: 'middle', wrapText: o.wrap !== false, readingOrder: 'rtl' };
    if (o.border !== false) c.border = box(o.borderColor);
    if (o.fmt) c.numFmt = o.fmt;
    return c;
  }
  const scale3 = ref => ({ ref, rules: [{ type: 'colorScale', cfvo: [{ type: 'min' }, { type: 'percentile', value: 50 }, { type: 'max' }], color: [{ argb: 'FF63BE7B' }, { argb: 'FFFFEB84' }, { argb: 'FFF8696B' }] }] });
  function banner(ws, last, title, sub) {
    ws.mergeCells(`A1:${last}1`); ws.mergeCells(`A2:${last}2`);
    put(ws, 'A1', title, { size: 22, bold: true, color: C.lime, fill: C.ink, border: false, h: 'right' });
    put(ws, 'A2', sub, { size: 11, color: C.paper, fill: 'FF2B2B2B', border: false, h: 'right' });
    ws.getRow(1).height = 38; ws.getRow(2).height = 22;
  }
  const sheetOpts = (extra = {}) => ({ views: [{ rightToLeft: true, showGridLines: false, ...extra }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }, properties: { tabColor: { argb: C.lime } } });

  function buildWorkbook(ExcelJS, m) {
    const A = analyze(m), wb = new ExcelJS.Workbook();
    wb.creator = 'אושר24'; wb.created = A.date;
    const mineName = m.names[m.mine] || '';
    const sub = `${dateStr(A.date)}  ·  הסניף שלי: ${mineName}  ·  ${A.items.length} ${A.items.length === 1 ? 'מוצר' : 'מוצרים'}`;
    if (isBasket(m)) { sheetSummary(wb, ExcelJS, m, A, sub); sheetMatrix(wb, m, A, sub); sheetProducts(wb, m, A, sub); }
    else sheetSingle(wb, m, A, sub);
    return wb;
  }

  /* ---- single product: one clean list of all branches ---- */
  function sheetSingle(wb, m, A, sub) {
    const P = A.per[0], ws = wb.addWorksheet('השוואה', sheetOpts({ state: 'frozen', ySplit: 9 }));
    const hasKm = !!m.dist;
    const heads = ['דירוג', 'סניף', 'אזור', 'מחיר (₪)', 'מחיר מדף', 'מבצע', 'הפרש ממני (₪)', 'הפרש ממני (%)'].concat(hasKm ? ['מרחק (ק״מ)'] : []);
    const last = colLetter(heads.length);
    banner(ws, last, 'אושר24 · השוואת מחירים', sub);
    ws.mergeCells(`A3:${last}3`); put(ws, 'A3', P.it.name, { size: 18, bold: true, h: 'right', border: false, fill: C.paper });
    ws.mergeCells(`A4:${last}4`); put(ws, 'A4', 'ברקוד: ' + P.it.code, { size: 10, color: C.grey, h: 'right', border: false, fill: C.paper });
    ws.getRow(3).height = 30;
    const my = P.my, lo = P.lo, hi = P.hi;
    const cards = [
      ['המחיר אצלי', my ? my.eff : '—', C.blue, C.white, my ? PRICE : '@'],
      ['הכי זול', lo.eff, C.lime, C.ink, PRICE],
      ['הכי יקר', hi.eff, 'FFFFD6C9', C.ink, PRICE],
      ['הפער שלי מהזול', my ? my.eff - lo.eff : '—', C.ink, C.lime, my ? DIFF : '@'],
    ];
    const per = Math.floor(heads.length / 4) || 1;
    cards.forEach((cd, i) => {
      const c1 = colLetter(i * per + 1), c2 = colLetter(i === 3 ? heads.length : (i + 1) * per);
      ws.mergeCells(`${c1}6:${c2}6`); ws.mergeCells(`${c1}7:${c2}7`);
      put(ws, `${c1}6`, cd[0], { size: 10, bold: true, color: cd[3], fill: cd[2], border: false });
      put(ws, `${c1}7`, cd[1], { size: 20, bold: true, color: cd[3], fill: cd[2], border: false, fmt: cd[4] });
    });
    ws.getRow(7).height = 34;
    const hr = 9;
    heads.forEach((h, i) => put(ws, `${colLetter(i + 1)}${hr}`, h, { bold: true, color: C.lime, fill: C.ink, borderColor: C.ink }));
    ws.getRow(hr).height = 26;
    P.rows.forEach((r, i) => {
      const row = hr + 1 + i, isMine = r.c === m.mine, isLo = r.rank === 1;
      const base = isMine ? 'FFDDE5FF' : isLo ? 'FFEAFFB0' : i % 2 ? 'FFF7F3E8' : C.card;
      const vals = [r.rank, r.name + (isMine ? '  (אני)' : ''), r.region, r.eff, r.shelf, r.promo || '', my ? r.eff - my.eff : '', my && my.eff ? (r.eff - my.eff) / my.eff : ''];
      if (hasKm) vals.push(r.c === m.mine ? 0 : r.km == null ? '' : Math.round(r.km * 10) / 10);
      vals.forEach((v, k) => {
        const ref = `${colLetter(k + 1)}${row}`;
        const o = { fill: base, bold: isMine || isLo || k === 3, h: k === 1 || k === 2 ? 'right' : 'center' };
        if (k === 0) o.fmt = '0';
        if (k === 3) { o.fmt = r.promo ? PRICE_PROMO : PRICE; o.size = 12; }
        if (k === 4) { o.fmt = PRICE; o.color = C.grey; }
        if (k === 5 && r.promo) { o.fill = 'FFFFE699'; o.bold = true; }
        if (k === 6) { o.fmt = DIFF; o.color = typeof v === 'number' ? (v < -0.004 ? C.green : v > 0.004 ? 'FFD9480F' : C.ink) : C.ink; o.bold = true; }
        if (k === 7) { o.fmt = PCT; o.color = typeof v === 'number' ? (v < -0.0004 ? C.green : v > 0.0004 ? 'FFD9480F' : C.ink) : C.ink; }
        if (hasKm && k === 8) o.fmt = '0.0';
        put(ws, ref, v, o);
      });
      if (r.promo) ws.getCell(`D${row}`).note = 'מבצע: ' + r.promo;
      ws.getRow(row).height = 22;
    });
    const first = hr + 1, lastRow = hr + P.rows.length;
    ws.addConditionalFormatting(scale3(`D${first}:D${lastRow}`));
    const widths = [8, 26, 12, 13, 12, 16, 16, 16, 12];
    heads.forEach((_, i) => (ws.getColumn(i + 1).width = widths[i]));
    ws.getCell(`A${lastRow + 2}`).value = '★ = מחיר מבצע · ההפרש מחושב מול הסניף שלי · צבע המחיר: ירוק זול, אדום יקר';
    ws.getCell(`A${lastRow + 2}`).font = { name: FONT, size: 9, italic: true, color: { argb: C.grey } };
    ws.getCell(`A${lastRow + 2}`).alignment = { horizontal: 'right', readingOrder: 'rtl' };
  }

  /* ---- basket: summary ---- */
  function sheetSummary(wb, ExcelJS, m, A, sub) {
    const ws = wb.addWorksheet('סיכום', sheetOpts({ state: 'frozen', ySplit: 9 }));
    const last = 'G';
    banner(ws, last, 'אושר24 · סל קניות', sub);
    const mine = A.mine, best = A.best;
    const cards = [
      ['A', 'B', 'הסל הזול ביותר', best ? best.sum : '—', best ? best.name : 'אין סניף עם כל המוצרים', C.lime, C.ink, best ? PRICE : '@'],
      ['C', 'E', 'הסל אצלי', mine && !mine.missing ? mine.sum : '—', mine && !mine.missing ? `מקום ${mine.rank} מתוך ${A.complete.length}` : 'חסרים מוצרים בסניף שלי', C.blue, C.white, mine && !mine.missing ? PRICE : '@'],
      ['F', 'G', 'קונים כל מוצר איפה שהכי זול', A.split, mine && !mine.missing && mine.sum > A.split ? `חיסכון ${fmt(mine.sum - A.split)} מול הסל אצלי` : 'דורש כמה סניפים', C.ink, C.lime, PRICE],
    ];
    cards.forEach(cd => {
      ws.mergeCells(`${cd[0]}4:${cd[1]}4`); ws.mergeCells(`${cd[0]}5:${cd[1]}5`); ws.mergeCells(`${cd[0]}6:${cd[1]}6`);
      put(ws, `${cd[0]}4`, cd[2], { size: 10, bold: true, color: cd[6], fill: cd[5], border: false });
      put(ws, `${cd[0]}5`, cd[3], { size: 22, bold: true, color: cd[6], fill: cd[5], border: false, fmt: cd[7] });
      put(ws, `${cd[0]}6`, cd[4], { size: 11, color: cd[6], fill: cd[5], border: false });
    });
    ws.getRow(5).height = 38;
    const hr = 9, heads = ['דירוג', 'סניף', 'אזור', 'סה״כ סל (₪)', 'פער מהזול (₪)', 'פער מהזול (%)', 'מוצרים חסרים'];
    heads.forEach((h, i) => put(ws, `${colLetter(i + 1)}${hr}`, h, { bold: true, color: C.lime, fill: C.ink, borderColor: C.ink }));
    ws.getRow(hr).height = 26;
    const cheapest = best ? best.sum : 0;
    A.order.forEach((b, i) => {
      const row = hr + 1 + i, isMine = b.c === m.mine, ok = !b.missing, isLo = ok && b.rank === 1;
      const base = isMine ? 'FFDDE5FF' : isLo ? 'FFEAFFB0' : !ok ? 'FFEFEDE6' : i % 2 ? 'FFF7F3E8' : C.card;
      const txt = ok ? C.ink : C.grey;
      put(ws, `A${row}`, ok ? (medal(b.rank) ? medal(b.rank) + ' ' + b.rank : b.rank) : '—', { fill: base, bold: true, color: txt });
      put(ws, `B${row}`, b.name + (isMine ? '  (אני)' : ''), { fill: base, bold: isMine || isLo, h: 'right', color: txt });
      put(ws, `C${row}`, b.region, { fill: b.regionIdx != null ? REG_FILL[b.regionIdx] : base, color: C.ink, h: 'right' });
      put(ws, `D${row}`, ok ? b.sum : '—', { fill: base, bold: true, size: 12, fmt: PRICE, color: txt });
      put(ws, `E${row}`, ok ? b.sum - cheapest : '—', { fill: base, fmt: DIFF, color: txt });
      put(ws, `F${row}`, ok && cheapest ? (b.sum - cheapest) / cheapest : '—', { fill: base, fmt: PCT, color: txt });
      put(ws, `G${row}`, b.missing || '', { fill: base, color: b.missing ? 'FFD9480F' : txt, bold: !!b.missing });
      ws.getRow(row).height = 22;
    });
    const f = hr + 1, l = hr + A.order.length;
    if (A.complete.length > 1) {
      ws.addConditionalFormatting(scale3(`D${f}:D${f + A.complete.length - 1}`));
      ws.addConditionalFormatting({ ref: `E${f}:E${f + A.complete.length - 1}`, rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: 'FFFFB199' }, gradient: false }] });
    }
    [9, 28, 13, 15, 16, 15, 14].forEach((w, i) => (ws.getColumn(i + 1).width = w));
    const n = ws.getCell(`A${l + 2}`);
    n.value = 'דירוג נכון למועד הייצוא. בגיליון "השוואה" אפשר לשנות כמויות והסכומים יתעדכנו. סניף שחסר בו מוצר לא נכלל בדירוג.';
    n.font = { name: FONT, size: 9, italic: true, color: { argb: C.grey } }; n.alignment = { horizontal: 'right', readingOrder: 'rtl' };
  }

  /* ---- basket: matrix with live formulas ---- */
  function sheetMatrix(wb, m, A, sub) {
    const cols = A.order, nB = cols.length, firstCol = 4, lastColN = firstCol + nB - 1, lastL = colLetter(lastColN);
    const hdr = 5, f = hdr + 1, l = hdr + A.items.length;
    const tot = l + 1, miss = l + 2, rk = l + 3, gap = l + 4;
    const ws = wb.addWorksheet('השוואה', sheetOpts({ state: 'frozen', xSplit: 3, ySplit: hdr }));
    banner(ws, lastL, 'אושר24 · השוואת סל לפי סניף', sub);
    // region band + branch headers
    put(ws, `A${hdr - 1}`, '', { border: false });
    ['מוצר', 'ברקוד', 'כמות'].forEach((h, i) => { ws.mergeCells(`${colLetter(i + 1)}${hdr - 1}:${colLetter(i + 1)}${hdr}`); put(ws, `${colLetter(i + 1)}${hdr - 1}`, h, { bold: true, color: C.lime, fill: C.ink, borderColor: C.ink }); });
    cols.forEach((b, i) => {
      const L = colLetter(firstCol + i), isMine = b.c === m.mine, isLo = !b.missing && b.rank === 1;
      put(ws, `${L}${hdr - 1}`, b.region, { size: 9, bold: true, fill: b.regionIdx != null ? REG_FILL[b.regionIdx] : C.lightGrey, borderColor: C.ink });
      put(ws, `${L}${hdr}`, b.name, { bold: true, size: 10, color: isMine ? C.white : isLo ? C.ink : C.lime, fill: isMine ? C.blue : isLo ? C.lime : C.ink, borderColor: C.ink });
      ws.getColumn(firstCol + i).width = 12.5;
    });
    ws.getRow(hdr - 1).height = 18; ws.getRow(hdr).height = 34;
    // product rows
    A.items.forEach((it, r) => {
      const row = f + r, band = r % 2 ? 'FFF7F3E8' : C.card;
      put(ws, `A${row}`, it.name, { h: 'right', bold: true, fill: band });
      put(ws, `B${row}`, it.code, { size: 9, color: C.grey, fill: band });
      const q = put(ws, `C${row}`, it.qty, { bold: true, color: 'FF0000FF', fill: 'FFFFF9D6', fmt: '0', borderColor: 'FFD9C98A' });
      q.dataValidation = { type: 'whole', operator: 'between', formulae: [1, 99], allowBlank: false, showErrorMessage: true, errorTitle: 'כמות', error: 'הזן מספר שלם בין 1 ל-99' };
      cols.forEach((b, i) => {
        const v = it.d[b.c], L = colLetter(firstCol + i);
        if (!v) put(ws, `${L}${row}`, '—', { color: C.grey, fill: 'FFEFEDE6' });
        else {
          const c = put(ws, `${L}${row}`, v[1], { fmt: v.length > 2 && v[3] ? PRICE_PROMO : PRICE, bold: false });
          if (v.length > 2 && v[3]) c.note = 'מבצע: ' + v[3];
        }
      });
      ws.getRow(row).height = 24;
      ws.addConditionalFormatting(scale3(`${colLetter(firstCol)}${row}:${lastL}${row}`));
      ws.addConditionalFormatting({ ref: `${colLetter(firstCol)}${row}:${lastL}${row}`, rules: [{ type: 'expression', priority: 1, formulae: [`AND(ISNUMBER(${colLetter(firstCol)}${row}),${colLetter(firstCol)}${row}=MIN($${colLetter(firstCol)}${row}:$${lastL}${row}))`], style: { font: { bold: true, underline: true } } }] });
    });
    // totals with formulas (cached results included, so previews show numbers before any recalculation)
    const rowsLbl = [[tot, 'סה״כ סל', 13], [miss, 'מוצרים חסרים', 10], [rk, 'דירוג', 11], [gap, 'פער מהזול (₪)', 11]];
    rowsLbl.forEach(([r, t, s]) => { ws.mergeCells(`A${r}:C${r}`); put(ws, `A${r}`, t, { bold: true, size: s, color: C.lime, fill: C.ink, h: 'right', borderColor: C.ink }); });
    const totals = cols.map(b => (b.missing ? null : b.sum)), minTot = Math.min(...totals.filter(x => x != null));
    cols.forEach((b, i) => {
      const L = colLetter(firstCol + i), rng = `${L}${f}:${L}${l}`, tr = `$${colLetter(firstCol)}${tot}:$${lastL}${tot}`;
      const ok = !b.missing, isMine = b.c === m.mine;
      put(ws, `${L}${tot}`, { formula: `IF(${L}${miss}>0,"—",SUMPRODUCT($C$${f}:$C$${l},${rng}))`, result: ok ? b.sum : '—' }, { bold: true, size: 13, fmt: PRICE, borderColor: C.ink, fill: isMine ? 'FFDDE5FF' : C.card });
      put(ws, `${L}${miss}`, { formula: `ROWS(${rng})-COUNT(${rng})`, result: b.missing }, { fmt: '0;;""', color: 'FFD9480F', bold: true });
      put(ws, `${L}${rk}`, { formula: `IF(ISNUMBER(${L}${tot}),RANK(${L}${tot},${tr},1),"—")`, result: ok ? b.rank : '—' }, { bold: true, fmt: '0' });
      put(ws, `${L}${gap}`, { formula: `IF(ISNUMBER(${L}${tot}),${L}${tot}-MIN(${tr}),"—")`, result: ok ? b.sum - minTot : '—' }, { fmt: DIFF });
    });
    if (A.complete.length > 1) ws.addConditionalFormatting(scale3(`${colLetter(firstCol)}${tot}:${lastL}${tot}`));
    ws.getRow(tot).height = 28;
    [30, 15, 9].forEach((w, i) => (ws.getColumn(i + 1).width = w));
    ws.mergeCells(`A${gap + 2}:${lastL}${gap + 2}`);
    const n = ws.getCell(`A${gap + 2}`);
    n.value = 'הכמות (עמודה C, בצהוב) ניתנת לעריכה והסכומים והדירוג מתעדכנים אוטומטית. ★ = מחיר מבצע (הערה בתא). צבע: ירוק זול, אדום יקר, בכל שורה. קו תחתון = הכי זול במוצר.';
    n.font = { name: FONT, size: 9, italic: true, color: { argb: C.grey } }; n.alignment = { horizontal: 'right', readingOrder: 'rtl', wrapText: true };
    ws.getRow(gap + 2).height = 28;
  }

  /* ---- basket: products ---- */
  function sheetProducts(wb, m, A, sub) {
    const ws = wb.addWorksheet('המוצרים', sheetOpts({ state: 'frozen', ySplit: 5 }));
    banner(ws, 'I', 'אושר24 · המוצרים בסל', sub);
    const heads = ['מוצר', 'ברקוד', 'כמות', 'המחיר אצלי', 'הכי זול', 'איפה הכי זול', 'חיסכון ליחידה', 'חיסכון כולל', 'דירוג אצלי'];
    heads.forEach((h, i) => put(ws, `${colLetter(i + 1)}4`, h, { bold: true, color: C.lime, fill: C.ink, borderColor: C.ink }));
    ws.getRow(4).height = 26;
    A.per.forEach((p, i) => {
      const row = 5 + i, band = i % 2 ? 'FFF7F3E8' : C.card, save = p.my ? p.my.eff - p.lo.eff : null;
      put(ws, `A${row}`, p.it.name, { h: 'right', bold: true, fill: band });
      put(ws, `B${row}`, p.it.code, { size: 9, color: C.grey, fill: band });
      put(ws, `C${row}`, p.it.qty, { fill: band, fmt: '0' });
      put(ws, `D${row}`, p.my ? p.my.eff : '—', { fill: 'FFDDE5FF', fmt: PRICE, bold: true });
      put(ws, `E${row}`, p.lo.eff, { fill: 'FFEAFFB0', fmt: PRICE, bold: true });
      put(ws, `F${row}`, p.lo.name, { fill: band, h: 'right' });
      put(ws, `G${row}`, save, { fill: band, fmt: '"₪"0.00;;"—"', color: save > 0.004 ? C.green : C.ink, bold: save > 0.004 });
      put(ws, `H${row}`, { formula: `IF(ISNUMBER(G${row}),G${row}*C${row},"—")`, result: save == null ? '—' : save * p.it.qty }, { fill: band, fmt: '"₪"0.00;;"—"', bold: true });
      put(ws, `I${row}`, p.my ? `${p.my.rank} / ${p.rows.length}` : '—', { fill: band });
      ws.getRow(row).height = 22;
    });
    const l = 4 + A.per.length;
    ws.mergeCells(`A${l + 1}:G${l + 1}`);
    put(ws, `A${l + 1}`, 'חיסכון כולל אם קונים הכל בסניף הזול לכל מוצר', { bold: true, color: C.lime, fill: C.ink, h: 'right', borderColor: C.ink });
    put(ws, `H${l + 1}`, { formula: `SUM(H5:H${l})`, result: A.per.reduce((s, p) => s + (p.my ? (p.my.eff - p.lo.eff) * p.it.qty : 0), 0) }, { bold: true, size: 13, fmt: PRICE, fill: C.lime });
    [32, 15, 8, 13, 12, 18, 14, 14, 12].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  }

  /* ============================== PICTURE ============================== */
  const SANS = 'Arial, "Segoe UI", "Noto Sans Hebrew", sans-serif';
  const hex = a => '#' + a.slice(2);
  function mix(a, b, t) { const p = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)); const x = p(a), y = p(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
  const priceColor = t => (t < .5 ? mix('#0a8a3c', '#d98a06', t * 2) : mix('#d98a06', '#e03a1e', (t - .5) * 2));

  function renderCanvas(m, doc) {
    doc = doc || document;
    const A = analyze(m), basket = isBasket(m), W = 1080, P = 48, S = 2;
    const measure = doc.createElement('canvas').getContext('2d');
    const font = (size, w) => `${w || 400} ${size}px ${SANS}`;
    const wrap = (text, size, w, maxW) => { measure.font = font(size, w); measure.direction = 'rtl'; const words = String(text).split(' '), lines = []; let cur = ''; for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (measure.measureText(t).width > maxW && cur) { lines.push(cur); cur = wd; } else cur = t; } if (cur) lines.push(cur); return lines; };
    const rowH = 62;
    let head = 150, title = [], listLines = [], rows;
    if (basket) {
      title = ['סל קניות'];
      A.items.forEach(it => listLines.push(...wrap(`${it.name}  ×${it.qty}`, 26, 400, W - 2 * P - 40).slice(0, 1)));
      listLines = listLines.slice(0, 12);
      rows = A.order;
    } else { title = wrap(A.per[0].it.name, 44, 800, W - 2 * P); rows = A.per[0].rows; }
    const infoH = basket ? 40 + listLines.length * 36 + 150 : title.length * 54 + 40 + 190;
    const H = head + infoH + 70 + rows.length * rowH + 110;
    const cv = doc.createElement('canvas'); cv.width = W * S; cv.height = H * S;
    const x = cv.getContext('2d'); x.scale(S, S); x.direction = 'rtl'; x.textBaseline = 'middle';
    const DK = !!m.dark, FM = { '#f2eee3': '#10151a', '#111': '#0a0e12', '#dde5ff': '#1c2a5a', '#eaffb0': '#2a3a14', '#f7f3e8': '#19222b', '#fffdf7': '#141b22', '#ece9df': '#1a222a' }, TM = { '#0a8a3c': '#4ade80', '#d9480f': '#ff7a45', '#a06800': '#f5b942', '#6d6a60': '#9aa6b0', '#2a2a2a': '#e6ebef', '#8a8a80': '#8d99a3' };
    const T = (t, px, py, o = {}) => { x.font = font(o.size || 28, o.weight); x.fillStyle = DK ? (o.color ? (TM[o.color] || o.color) : '#eef2f5') : (o.color || '#111'); x.textAlign = o.align || 'right'; x.fillText(String(t), px, py); };
    const R = (px, py, w, h, c, r) => { x.fillStyle = DK ? (FM[c] || c) : c; x.beginPath(); if (x.roundRect) x.roundRect(px, py, w, h, r || 0); else x.rect(px, py, w, h); x.fill(); };
    R(0, 0, W, H, '#f2eee3');
    // header band
    R(0, 0, W, head - 30, '#111');
    R(W - P - 150, 36, 150, 66, '#c9ff2f', 14); T('24', W - P - 20, 70, { size: 46, weight: 900 });
    T('אושר', W - P - 150 - 14, 70, { size: 56, weight: 900, color: '#fff' });
    T(dateStr(A.date), P, 56, { size: 24, color: '#b9b5a6', align: 'left' });
    T('השוואת מחירים', P, 92, { size: 22, color: '#8a8a80', align: 'left' });
    let y = head;
    const mineName = m.names[m.mine] || '';
    if (!basket) {
      const p = A.per[0];
      title.forEach(t => { T(t, W - P, y + 25, { size: 44, weight: 800 }); y += 54; });
      T('ברקוד ' + p.it.code, W - P, y + 8, { size: 22, color: '#6d6a60' }); y += 44;
      // 3 summary tiles
      const tiles = [['אצלי · ' + mineName, p.my ? fmt(p.my.eff) : '—', '#2447ff', '#fff', p.my ? `מקום ${p.my.rank} מתוך ${p.rows.length}` : 'לא נמכר בסניף שלי'],
        ['הכי זול', fmt(p.lo.eff), '#c9ff2f', '#111', p.lo.name],
        ['הפער שלי מהזול', p.my ? (p.my.eff - p.lo.eff < .004 ? 'אצלי הכי זול' : '+' + fmt(p.my.eff - p.lo.eff)) : '—', '#111', '#c9ff2f', p.my && p.lo.eff ? ((p.my.eff - p.lo.eff) / p.lo.eff * 100).toFixed(0) + '% מהזול' : '']];
      const tw = (W - 2 * P - 2 * 16) / 3;
      tiles.forEach((t, i) => { const tx = W - P - (i + 1) * tw - i * 16; R(tx, y, tw, 150, t[2], 20); T(t[0], tx + tw - 20, y + 28, { size: 20, color: t[3], weight: 700 }); T(t[1], tx + tw - 20, y + 80, { size: 44, color: t[3], weight: 900 }); T(t[4], tx + tw - 20, y + 124, { size: 20, color: t[3] }); });
      y += 150 + 36;
    } else {
      T(`סל קניות · ${A.items.length} מוצרים`, W - P, y + 28, { size: 44, weight: 800 }); y += 70;
      listLines.forEach(l => { T('•  ' + l, W - P, y + 14, { size: 26, color: '#2a2a2a' }); y += 36; });
      if (A.items.length > 12) { T(`ועוד ${A.items.length - 12} מוצרים`, W - P, y + 14, { size: 22, color: '#6d6a60' }); y += 36; }
      y += 14;
      const mine = A.mine, best = A.best;
      const tiles = [['הסל הזול ביותר', best ? fmt(best.sum) : '—', '#c9ff2f', '#111', best ? best.name : ''],
        ['הסל אצלי · ' + mineName, mine && !mine.missing ? fmt(mine.sum) : '—', '#2447ff', '#fff', mine && !mine.missing ? `מקום ${mine.rank} מתוך ${A.complete.length}` : 'חסרים מוצרים'],
        ['כל מוצר איפה שהכי זול', fmt(A.split), '#111', '#c9ff2f', mine && !mine.missing && mine.sum > A.split ? 'חיסכון ' + fmt(mine.sum - A.split) : 'כמה סניפים']];
      const tw = (W - 2 * P - 2 * 16) / 3;
      tiles.forEach((t, i) => { const tx = W - P - (i + 1) * tw - i * 16; R(tx, y, tw, 150, t[2], 20); T(t[0], tx + tw - 20, y + 28, { size: 20, color: t[3], weight: 700 }); T(t[1], tx + tw - 20, y + 80, { size: 44, color: t[3], weight: 900 }); T(t[4], tx + tw - 20, y + 124, { size: 20, color: t[3] }); });
      y += 150 + 36;
    }
    // table header
    R(P, y, W - 2 * P, 52, '#111', 12);
    const heads = basket ? ['#', 'סניף', 'סה״כ סל', 'פער מהזול'] : ['#', 'סניף', 'מחיר', 'הפרש ממני'];
    T(heads[0], W - P - 24, y + 27, { size: 22, color: '#c9ff2f', weight: 700, align: 'center' });
    T(heads[1], W - P - 76, y + 27, { size: 22, color: '#c9ff2f', weight: 700 });
    T(heads[2], 560, y + 27, { size: 22, color: '#c9ff2f', weight: 700, align: 'center' });
    T(heads[3], 300, y + 27, { size: 22, color: '#c9ff2f', weight: 700, align: 'center' });
    y += 58;
    const prices = basket ? A.complete.map(b => b.sum) : rows.map(r => r.eff), lo = Math.min(...prices), hi = Math.max(...prices);
    const myRow = !basket ? A.per[0].my : null;
    rows.forEach((r, i) => {
      const id = r.c, isMine = id === m.mine;
      const ok = basket ? !r.missing : true, val = basket ? r.sum : r.eff;
      const isLo = ok && (basket ? r.rank === 1 : r.rank === 1);
      const bg = isMine ? '#dde5ff' : isLo ? '#eaffb0' : !ok ? '#ece9df' : i % 2 ? '#f7f3e8' : '#fffdf7';
      R(P, y, W - 2 * P, rowH - 6, bg, 12);
      if (isMine) R(W - P - 8, y, 8, rowH - 6, '#2447ff', 4);
      const rank = ok ? r.rank : '—';
      T(rank, W - P - 24, y + 28, { size: 24, color: '#6d6a60', weight: 700, align: 'center' });
      T(r.name + (isMine ? '  (אני)' : ''), W - P - 76, y + 22, { size: 28, weight: isMine || isLo ? 800 : 500 });
      let sub = '';
      if (basket) sub = ok ? (r.region || '') : `חסרים ${r.missing} מוצרים`;
      else sub = (r.promo ? '★ ' + r.promo : r.shelf !== r.eff ? 'מדף ' + fmt(r.shelf) : '') + (r.km != null && !isMine ? (r.promo || r.shelf !== r.eff ? '  ·  ' : '') + Math.round(r.km) + ' ק״מ' : '');
      if (sub) T(sub, W - P - 76, y + 46, { size: 17, color: r.promo ? '#a06800' : '#8a8a80', weight: r.promo ? 700 : 400 });
      const col = ok ? priceColor(hi > lo ? (val - lo) / (hi - lo) : 0) : '#8a8a80';
      T(ok ? fmt(val) : '—', 560, y + 28, { size: 30, weight: 900, color: col, align: 'center' });
      let d = '', dc = DK ? '#cfd6dc' : '#111';
      if (basket) { if (ok && r.rank > 1) { d = '+' + fmt(val - lo); dc = '#d9480f'; } else if (ok) { d = 'הכי זול'; dc = '#0a8a3c'; } }
      else if (myRow && !isMine) { const df = r.eff - myRow.eff; if (Math.abs(df) > .004) { d = (df < 0 ? '−' : '+') + fmt(Math.abs(df)); dc = df < 0 ? '#0a8a3c' : '#d9480f'; } else d = '='; }
      else if (isMine) d = 'אני';
      T(d, 300, y + 28, { size: 26, weight: 800, color: dc, align: 'center' });
      y += rowH;
    });
    y += 14;
    T('נוצר ב-אושר24 · ' + dateStr(A.date) + (basket ? ' · סניפים עם מוצרים חסרים מופיעים בסוף' : ' · ★ מבצע'), W / 2, y + 20, { size: 20, color: '#8a8a80', align: 'center' });
    // trim to the real height
    const out = doc.createElement('canvas'); out.width = W * S; out.height = Math.min(cv.height, (y + 60) * S);
    const ox = out.getContext('2d'); ox.drawImage(cv, 0, 0);
    return out;
  }

  /* ============================== PDF ============================== */
  function canvasToPdf(canvas) {
    const b64 = canvas.toDataURL('image/jpeg', 0.92).split(',')[1], bin = atob(b64), jpg = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) jpg[i] = bin.charCodeAt(i);
    const pw = 595.28, ph = +(pw * canvas.height / canvas.width).toFixed(2), enc = new TextEncoder(), chunks = [], offs = [];
    let pos = 0;
    const push = b => { const u = typeof b === 'string' ? enc.encode(b) : b; chunks.push(u); pos += u.length; };
    const obj = (n, body) => { offs[n] = pos; push(`${n} 0 obj\n${body}\nendobj\n`); };
    push('%PDF-1.4\n');
    obj(1, '<</Type/Catalog/Pages 2 0 R>>');
    obj(2, '<</Type/Pages/Kids[3 0 R]/Count 1>>');
    obj(3, `<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${pw} ${ph}]/Resources<</XObject<</Im0 4 0 R>>>>/Contents 5 0 R>>`);
    offs[4] = pos; push(`4 0 obj\n<</Type/XObject/Subtype/Image/Width ${canvas.width}/Height ${canvas.height}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${jpg.length}>>\nstream\n`); push(jpg); push('\nendstream\nendobj\n');
    const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
    obj(5, `<</Length ${content.length}>>\nstream\n${content}\nendstream`);
    const xref = pos;
    push(`xref\n0 6\n0000000000 65535 f \n` + [1, 2, 3, 4, 5].map(n => String(offs[n]).padStart(10, '0') + ' 00000 n \n').join(''));
    push(`trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(chunks, { type: 'application/pdf' });
  }

  /* ============================== text / helpers ============================== */
  function reportText(m, url) {
    const A = analyze(m), mineName = m.names[m.mine] || '';
    if (!isBasket(m)) {
      const p = A.per[0];
      return [`🛒 ${p.it.name}`, p.my ? `אצלי (${mineName}): ${fmt(p.my.eff)} · מקום ${p.my.rank} מתוך ${p.rows.length}` : '', `הכי זול: ${fmt(p.lo.eff)} ב${p.lo.name}`, `הכי יקר: ${fmt(p.hi.eff)} ב${p.hi.name}`, url || ''].filter(Boolean).join('\n');
    }
    const lines = [`🧺 סל קניות (${A.items.length} מוצרים)`];
    if (A.best) lines.push(`הסל הזול ביותר: ${fmt(A.best.sum)} ב${A.best.name}`);
    if (A.mine && !A.mine.missing) lines.push(`אצלי (${mineName}): ${fmt(A.mine.sum)} · מקום ${A.mine.rank} מתוך ${A.complete.length}`);
    lines.push(`כל מוצר איפה שהכי זול: ${fmt(A.split)}`);
    return lines.concat(url ? [url] : []).join('\n');
  }
  function fileName(m, ext) { const d = m.date || new Date(); return `אושר24-${isBasket(m) ? 'סל' : 'מוצר'}-${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}.${ext}`; }

  return { analyze, buildWorkbook, renderCanvas, canvasToPdf, reportText, fileName, isBasket, fmt };
});
