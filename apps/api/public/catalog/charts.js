'use strict';
/**
 * Dependency-free SVG charts for the console's history panels.
 *   Charts.stacked(host, runs, { onSelect })  passed / failed / other per run (columns, oldest -> newest)
 *   Charts.rate(host, runs, opts)             pass rate per run (line, 0-100%)
 *   Charts.hbars(host, rows, { series })      one horizontal bar per category, stacked by series
 * runs: [{ id, key, created_at, passed, failed, other }]
 * Colours come from CSS tokens (--viz-pass / --viz-fail / --viz-other / --viz-rate) in index.html.
 */
const Charts = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const H = 176, PAD = { t: 14, r: 40, b: 24, l: 34 }, GAP = 2, BAR_MAX = 24, RADIUS = 4;
  const SERIES = [
    ['passed', 'Passed', 'var(--viz-pass)'],
    ['failed', 'Failed', 'var(--viz-fail)'],
    ['other', 'Other', 'var(--viz-other)'],
  ];
  const day = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const stamp = (d) => new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const shortStamp = (d) => new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  const totalOf = (r) => r.passed + r.failed + r.other;
  // Tooltip heading: a run is named by its time and key; callers charting other buckets (days) pass opts.title.
  const titleOf = (r, opts) => (opts && opts.title ? opts.title(r) : `${stamp(r.created_at)} · ${r.key}`);

  function node(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function label(parent, x, y, str, anchor, cls) {
    const t = node('text', { x, y, 'text-anchor': anchor || 'middle' }, parent);
    if (cls) t.setAttribute('class', cls);
    t.textContent = str;
    return t;
  }
  // Smallest round ceiling whose half is also a round tick (the axis labels 0, max/2, max).
  function niceMax(v) {
    if (v <= 4) return 4;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const m = v / p;
    return (p < 10 ? [6, 8, 10] : [1, 2, 3, 4, 5, 6, 8, 10]).find((s) => m <= s) * p;
  }

  // Sized from the host's real width so text stays at its true pixel size.
  function frame(host, aria) {
    host.replaceChildren();
    const w = Math.max(host.clientWidth, 240);
    const svg = node('svg', { width: w, height: H, viewBox: `0 0 ${w} ${H}`, role: 'img', 'aria-label': aria }, host);
    return { svg, w, pw: w - PAD.l - PAD.r, ph: H - PAD.t - PAD.b };
  }
  function yAxis(svg, w, ticks, y, fmt) {
    for (const v of ticks) {
      const yy = Math.round(y(v)) + 0.5;
      node('line', { x1: PAD.l, x2: w - PAD.r, y1: yy, y2: yy, class: v === 0 ? 'axis' : 'grid' }, svg);
      label(svg, PAD.l - 6, yy + 3.5, fmt(v), 'end');
    }
  }
  // Label from the newest run backwards so the latest is always shown; skip to avoid collisions.
  // Several runs on one day would all read "Sep 26", so those charts label with the time too.
  function xLabels(svg, runs, cx, pw) {
    const repeats = new Set(runs.map((r) => day(r.created_at))).size < runs.length;
    const fmt = repeats ? shortStamp : day;
    const step = Math.max(1, Math.ceil((runs.length * (repeats ? 84 : 52)) / pw));
    for (let i = runs.length - 1; i >= 0; i -= step) label(svg, cx(i), H - 6, fmt(runs[i].created_at));
  }

  function tip(host) {
    let t = host.querySelector('.viz-tip');
    if (!t) {
      t = document.createElement('div');
      t.className = 'viz-tip';
      t.hidden = true;
      host.appendChild(t);
    }
    return t;
  }
  // Labels are data: built with textContent, never innerHTML.
  function showTip(host, x, y, title, rows) {
    const t = tip(host);
    t.replaceChildren();
    const h = document.createElement('div');
    h.className = 'viz-tip-title';
    h.textContent = title;
    t.appendChild(h);
    for (const [value, name, color] of rows) {
      const row = document.createElement('div');
      row.className = 'viz-tip-row';
      const key = document.createElement('span');
      key.className = 'viz-key';
      key.style.background = color;
      const b = document.createElement('b');
      b.textContent = value;
      const n = document.createElement('span');
      n.textContent = name;
      row.append(key, b, n);
      t.appendChild(row);
    }
    t.hidden = false;
    t.style.left = Math.min(Math.max(x - t.offsetWidth / 2, 0), host.clientWidth - t.offsetWidth) + 'px';
    t.style.top = Math.max(y - t.offsetHeight - 10, 0) + 'px';
  }
  function hideTip(host) {
    const t = host.querySelector('.viz-tip');
    if (t) t.hidden = true;
  }

  // Column segment; the top segment gets the 4px rounded data-end, the baseline stays square.
  function colPath(x, y, w, h, round) {
    const r = round ? Math.min(RADIUS, w / 2, h) : 0;
    if (!r) return `M${x},${y + h}V${y}H${x + w}V${y + h}Z`;
    return `M${x},${y + h}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h}Z`;
  }

  function stacked(host, runs, opts) {
    const { svg, w, pw, ph } = frame(host, `Results per run across ${runs.length} runs`);
    const max = niceMax(Math.max(1, ...runs.map(totalOf)));
    const y = (v) => PAD.t + ph - (v / max) * ph;
    yAxis(svg, w, [0, max / 2, max], y, (v) => String(Math.round(v)));
    const band = pw / runs.length;
    const bw = Math.max(3, Math.min(BAR_MAX, band * 0.62));
    const cx = (i) => PAD.l + band * i + band / 2;

    runs.forEach((r, i) => {
      const g = node('g', { class: 'col' }, svg);
      const segs = SERIES.filter(([k]) => r[k] > 0);
      let base = 0;
      segs.forEach(([k, , color], j) => {
        const bottom = y(base) - (j ? GAP : 0); // 2px surface gap between stacked segments
        base += r[k];
        const h = Math.max(bottom - y(base), 1);
        node('path', { d: colPath(cx(i) - bw / 2, bottom - h, bw, h, j === segs.length - 1), fill: color, class: 'mark' }, g);
      });
      // Hit target is the whole band, not just the painted column.
      const hit = node('rect', {
        x: PAD.l + band * i, y: PAD.t, width: band, height: ph, class: 'hit', tabindex: 0,
        'aria-label': `${titleOf(r, opts)}: ${r.passed} passed, ${r.failed} failed, ${r.other} other`,
      }, g);
      const show = () => {
        g.classList.add('hot');
        showTip(host, cx(i), y(totalOf(r)), titleOf(r, opts), SERIES.map(([k, name, color]) => [r[k], name, color]));
      };
      const hide = () => { g.classList.remove('hot'); hideTip(host); };
      hit.addEventListener('pointerenter', show);
      hit.addEventListener('pointerleave', hide);
      hit.addEventListener('focus', show);
      hit.addEventListener('blur', hide);
      if (opts && opts.onSelect) {
        hit.classList.add('link');
        hit.addEventListener('click', () => opts.onSelect(r));
        hit.addEventListener('keydown', (e) => { if (e.key === 'Enter') opts.onSelect(r); });
      }
    });
    xLabels(svg, runs, cx, pw);
  }

  function rate(host, runs, opts) {
    const { svg, w, pw, ph } = frame(host, `Pass rate per run across ${runs.length} runs`);
    const y = (v) => PAD.t + ph - v * ph;
    yAxis(svg, w, [0, 0.5, 1], y, (v) => Math.round(v * 100) + '%');
    const band = pw / runs.length;
    const cx = (i) => PAD.l + band * i + band / 2;
    const pts = runs
      .map((r, i) => (totalOf(r) ? { x: cx(i), y: y(r.passed / totalOf(r)), v: r.passed / totalOf(r), r } : null))
      .filter(Boolean);
    if (!pts.length) return;

    const line = pts.map((p, j) => (j ? 'L' : 'M') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join('');
    const first = pts[0], last = pts[pts.length - 1];
    node('path', { d: `${line}L${last.x.toFixed(1)},${y(0)}L${first.x.toFixed(1)},${y(0)}Z`, class: 'area' }, svg);
    node('path', { d: line, class: 'line' }, svg);
    node('circle', { cx: last.x, cy: last.y, r: 4, class: 'dot' }, svg);
    label(svg, last.x + 8, last.y + 4, Math.round(last.v * 100) + '%', 'start', 'end-label');
    xLabels(svg, runs, cx, pw);

    // Crosshair snaps to the nearest run; arrow keys step through runs when focused.
    const cross = node('line', { y1: PAD.t, y2: PAD.t + ph, class: 'cross', visibility: 'hidden' }, svg);
    const hot = node('circle', { r: 4, class: 'dot', visibility: 'hidden' }, svg);
    const overlay = node('rect', {
      x: PAD.l, y: PAD.t, width: pw, height: ph, class: 'hit', tabindex: 0,
      'aria-label': 'Pass rate trend. Use left and right arrow keys to step through runs.',
    }, svg);
    let cur = pts.length - 1;
    const show = (p) => {
      for (const n of [cross, hot]) n.setAttribute('visibility', 'visible');
      cross.setAttribute('x1', p.x);
      cross.setAttribute('x2', p.x);
      hot.setAttribute('cx', p.x);
      hot.setAttribute('cy', p.y);
      showTip(host, p.x, p.y, titleOf(p.r, opts), [
        [Math.round(p.v * 100) + '%', 'pass rate', 'var(--viz-rate)'],
        [`${p.r.passed}/${totalOf(p.r)}`, (opts && opts.noun) || 'cases passed', 'var(--viz-pass)'],
      ]);
    };
    const hide = () => {
      for (const n of [cross, hot]) n.setAttribute('visibility', 'hidden');
      hideTip(host);
    };
    overlay.addEventListener('pointermove', (e) => {
      const x = e.clientX - svg.getBoundingClientRect().left;
      cur = pts.reduce((best, p, j) => (Math.abs(p.x - x) < Math.abs(pts[best].x - x) ? j : best), 0);
      show(pts[cur]);
    });
    overlay.addEventListener('pointerleave', hide);
    overlay.addEventListener('focus', () => show(pts[cur]));
    overlay.addEventListener('blur', hide);
    overlay.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      cur = Math.min(pts.length - 1, Math.max(0, cur + (e.key === 'ArrowRight' ? 1 : -1)));
      show(pts[cur]);
    });
  }

  // Row bar segment; the last segment gets the rounded data-end, the baseline (left) stays square.
  function rowPath(x, y, w, h, round) {
    const r = round ? Math.min(RADIUS, h / 2, w) : 0;
    if (!r) return `M${x},${y}H${x + w}V${y + h}H${x}Z`;
    return `M${x},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h - r}A${r},${r} 0 0 1 ${x + w - r},${y + h}H${x}Z`;
  }

  /**
   * Horizontal bars, one row per category, value at the tip; several series stack left to right.
   *   rows: [{ label, values: { <key>: n } }]   opts.series: [[key, name, color], ...]
   * The chart is as tall as its rows, so it suits category counts a column chart would cramp.
   */
  function hbars(host, rows, opts) {
    const series = opts.series, ROW = 26, BAR = 12, TOP = 4, CHAR = 6.3;
    host.replaceChildren();
    const w = Math.max(host.clientWidth, 240);
    const val = (r, k) => Number(r.values[k]) || 0;
    const sum = (r) => series.reduce((a, [k]) => a + val(r, k), 0);
    const max = Math.max(1, ...rows.map(sum));
    const labelW = Math.min(Math.max(...rows.map((r) => r.label.length)) * CHAR + 12, w * 0.5, 300);
    const tipW = String(max).length * 7 + 12;
    const pw = w - labelW - tipW;
    const h = rows.length * ROW + TOP * 2;
    const svg = node('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}`, role: 'img', 'aria-label': `${series.map((s) => s[1]).join(', ')} across ${rows.length} rows` }, host);
    node('line', { x1: labelW + 0.5, x2: labelW + 0.5, y1: TOP, y2: h - TOP, class: 'axis' }, svg);
    // Long names often differ only at the end ("… (staging)" / "… (development)"), so cut the middle.
    const fit = Math.max(6, Math.floor((labelW - 12) / CHAR));
    const clip = (s) => (s.length > fit ? s.slice(0, Math.ceil((fit - 1) / 2)) + '…' + s.slice(s.length - Math.floor((fit - 1) / 2)) : s);

    rows.forEach((r, i) => {
      const g = node('g', { class: 'col' }, svg);
      const cy = TOP + i * ROW + ROW / 2;
      const name = label(g, labelW - 8, cy + 4, clip(r.label), 'end');
      if (r.label.length > fit) node('title', {}, name).textContent = r.label;
      const segs = series.filter(([k]) => val(r, k) > 0);
      let x = labelW + 1;
      segs.forEach(([k, , color], j) => {
        const full = (val(r, k) / max) * pw, gap = j ? GAP : 0;
        node('path', { d: rowPath(x + gap, cy - BAR / 2, Math.max(full - gap, 1), BAR, j === segs.length - 1), fill: color, class: 'mark' }, g);
        x += full;
      });
      label(g, x + 6, cy + 4, String(sum(r)), 'start', 'end-label');
      const parts = series.map(([k, n]) => `${val(r, k)} ${n}`).join(', ');
      const hit = node('rect', { x: 0, y: cy - ROW / 2, width: w, height: ROW, class: 'hit', tabindex: 0, 'aria-label': `${r.label}: ${parts}` }, g);
      const show = () => {
        g.classList.add('hot');
        showTip(host, Math.min(labelW + pw / 2, w - 90), cy - ROW / 2, r.label, series.map(([k, n, color]) => [val(r, k), n, color]));
      };
      const hide = () => { g.classList.remove('hot'); hideTip(host); };
      hit.addEventListener('pointerenter', show);
      hit.addEventListener('pointerleave', hide);
      hit.addEventListener('focus', show);
      hit.addEventListener('blur', hide);
    });
  }

  return { stacked, rate, hbars };
})();
