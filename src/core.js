/* core.js — lexicon sentiment with negation and contrast, aspect extraction, log-odds keywords, suspicious-review checks, trends with change points, phrase mining, comparison and CSV import (pure, unit-tested). */

var POS = { good: 2, great: 3, excellent: 4, amazing: 4, awesome: 4, love: 3, loved: 3, perfect: 4, fantastic: 4, solid: 2, crisp: 2, clear: 2, rich: 2, comfortable: 3, comfy: 3, easy: 2, fast: 2, quick: 2, reliable: 3, sturdy: 2, worth: 2, recommend: 3, impressive: 3, best: 3, nice: 2, decent: 1, fine: 1, happy: 3, pleased: 3, smooth: 2, seamless: 3, punchy: 2, long: 1, lasts: 2, stable: 2, works: 1, helpful: 2, quickly: 1, beautiful: 3, premium: 2, lightweight: 2, fixed: 2, improved: 2, bargain: 3 };
var NEG = { bad: -2, terrible: -4, awful: -4, horrible: -4, hate: -3, poor: -3, worst: -4, broke: -3, broken: -3, cheap: -2, flimsy: -3, uncomfortable: -3, hurt: -3, hurts: -3, painful: -3, drops: -2, dropping: -2, disconnects: -3, disconnect: -2, lag: -2, laggy: -2, lags: -2, delay: -2, muffled: -3, tinny: -3, dies: -3, died: -3, dead: -3, short: -1, slow: -2, annoying: -2, disappointed: -3, disappointing: -3, useless: -4, overpriced: -3, expensive: -1, refund: -2, return: -1, returned: -2, returning: -2, issue: -1, issues: -2, problem: -2, problems: -2, fails: -3, failed: -3, crackling: -3, static: -2, loose: -2, falls: -2, rude: -3, never: -1, worse: -3, stopped: -2, unusable: -4, waste: -3, faulty: -3, nightmare: -3, unhelpful: -3 };
var NEGATORS = ['not', 'no', 'never', "n't", 'hardly', 'barely', 'without', 'isnt', 'cannot'];
var INTENS = { very: 1.5, really: 1.4, super: 1.5, extremely: 1.8, so: 1.3, incredibly: 1.8, quite: 1.2, totally: 1.4 };
var ASPECTS = {
  'Sound': /\b(sound|audio|bass|treble|music|mids|highs|soundstage|volume)\b/i,
  'Battery': /\b(battery|charge|charging|charged|hours|lasts?|recharge)\b/i,
  'Comfort & fit': /\b(comfort\w*|fit|fits|ears?|tips|ear tips|wear|hurts?|falls? out)\b/i,
  'Connectivity': /\b(bluetooth|connect\w*|pair\w*|disconnect\w*|drops?|dropping|lag\w*|latency|signal)\b/i,
  'Noise cancelling': /\b(anc|noise cancel\w*|noise-cancel\w*|cancellation|transparency)\b/i,
  'Mic & calls': /\b(mic|microphone|calls?|voice)\b/i,
  'Price & value': /\b(price|value|worth|money|expensive|cheap|overpriced|bargain|\$\d+)\b/i,
  'Build & case': /\b(build|plastic|case|hinge|sturdy|flimsy|durable|broke|broken|quality)\b/i,
  'App & updates': /\b(app|firmware|update\w*|eq|equalizer|software)\b/i,
  'Support & shipping': /\b(support|customer service|warranty|shipping|delivery|arrived|package|refund|replacement)\b/i,
};
var STOP = {};
"the a an and or but i it its it's this that these those to of in on for with my me is was are were be been have has had they them their you your we our at as so if just very really from after before about would could will can do does did than then there here also get got one two all out up down when what which who too more most much some any only even them i'm i've don't".split(' ').forEach(function (w) { STOP[w] = 1; });

/* ---------- sentiment ---------- */
/* Sum of lexicon scores; a negator within 3 words flips (x -0.8), an intensifier scales, and anything after "but/however/although" counts 1.4x while what came before is damped. */
function sentScore(sentence) {
  var toks = String(sentence).toLowerCase().replace(/n't/g, " n't").match(/[a-z']+|\$\d+/g) || [], s = 0, afterBut = false;
  toks.forEach(function (t, i) {
    if (t === 'but' || t === 'however' || t === 'although') { afterBut = true; s *= 0.6; return; }
    var v = POS[t] || NEG[t] || 0;
    if (!v) return;
    var prev = toks.slice(Math.max(0, i - 3), i);
    if (prev.some(function (p) { return NEGATORS.indexOf(p) >= 0; })) v *= -0.8;
    var inten = prev.map(function (p) { return INTENS[p]; }).filter(Boolean)[0];
    if (inten) v *= inten;
    s += afterBut ? v * 1.4 : v;
  });
  return s;
}
function splitSentences(t) { return String(t).split(/(?<=[.!?])\s+|\n+/).filter(function (s) { return s.trim(); }); }
function enrich(r, i) {
  var out = Object.assign({}, r, { i: r.i != null ? r.i : i });
  out.sents = splitSentences(out.text).map(function (s) { return { s: s, score: sentScore(s), aspects: Object.keys(ASPECTS).filter(function (a) { return ASPECTS[a].test(s); }) }; });
  out.score = out.sents.reduce(function (a, x) { return a + x.score; }, 0);
  out.norm = Math.tanh(out.score / 4);
  out.aspects = out.sents.reduce(function (a, x) { x.aspects.forEach(function (y) { if (a.indexOf(y) < 0) a.push(y); }); return a; }, []);
  out.mismatch = out.rating != null && ((out.rating >= 4 && out.norm < -0.35) || (out.rating <= 2 && out.norm > 0.35));
  return out;
}
function aspectStats(R) {
  var st = {};
  R.forEach(function (r) { r.sents.forEach(function (x) { x.aspects.forEach(function (a) { var o = st[a] || (st[a] = { pos: 0, neg: 0, neu: 0 }); if (x.score > 0.5) o.pos++; else if (x.score < -0.5) o.neg++; else o.neu++; }); }); });
  return Object.keys(st).map(function (a) { var o = st[a], n = o.pos + o.neg + o.neu; return { a: a, pos: o.pos, neg: o.neg, neu: o.neu, n: n, net: (o.pos - o.neg) / Math.max(1, n) }; }).sort(function (x, y) { return y.n - x.n || x.a.localeCompare(y.a); });
}

/* ---------- distinctive words (Monroe et al. weighted log-odds with an informative prior) ---------- */
function wordCounts(rs) { var c = {}, n = 0; rs.forEach(function (r) { (r.text.toLowerCase().match(/[a-z][a-z']+/g) || []).forEach(function (w) { if (STOP[w] || w.length < 3) return; c[w] = (c[w] || 0) + 1; n++; }); }); return { c: c, n: n }; }
function logOdds(R, minCount) {
  var isPos = function (r) { return (r.rating != null ? r.rating : r.norm > 0 ? 5 : 1) >= 4; }, isNeg = function (r) { return (r.rating != null ? r.rating : r.norm > 0 ? 5 : 1) <= 2; };
  var I = wordCounts(R.filter(isPos)), J = wordCounts(R.filter(isNeg)), A = wordCounts(R), V = Object.keys(A.c).length || 1;
  var a0 = A.n, scaleK = (0.01 * a0) / V, A0 = 500 + scaleK * V;
  var out = Object.keys(A.c).filter(function (w) { return A.c[w] >= (minCount || 3); }).map(function (w) {
    var aw = (A.c[w] / a0) * 500 + scaleK, yi = I.c[w] || 0, yj = J.c[w] || 0;
    var d = Math.log((yi + aw) / (I.n + A0 - yi - aw)) - Math.log((yj + aw) / (J.n + A0 - yj - aw));
    return { w: w, z: d / Math.sqrt(1 / (yi + aw) + 1 / (yj + aw)) };
  }).sort(function (a, b) { return b.z - a.z; });
  return { pos: out.filter(function (x) { return x.z > 0; }).slice(0, 16), neg: out.filter(function (x) { return x.z < 0; }).reverse().slice(0, 16) };
}

/* ---------- suspicious reviews ---------- */
function shingles(t) { var w = String(t).toLowerCase().match(/[a-z']+/g) || [], s = {}; for (var i = 0; i + 2 < w.length; i++) s[w.slice(i, i + 3).join(' ')] = 1; return Object.keys(s); }
function suspicious(R) {
  var S = R.map(function (r) { return shingles(r.text); }), out = [];
  for (var i = 0; i < R.length; i++) for (var j = i + 1; j < R.length; j++) {
    if (S[i].length < 3 || S[j].length < 3) continue;
    var inter = S[i].filter(function (x) { return S[j].indexOf(x) >= 0; }).length, jac = inter / (S[i].length + S[j].length - inter);
    if (jac > 0.75) out.push({ r: R[j], kind: 'duplicate', why: Math.round(jac * 100) + '% identical to review #' + (R[i].i + 1) });
  }
  var byDay = {};
  R.filter(function (r) { return r.rating === 5 && r.date; }).forEach(function (r) { (byDay[r.date] = byDay[r.date] || []).push(r); });
  Object.keys(byDay).filter(function (d) { return byDay[d].length >= 4; }).forEach(function (d) { out.push({ r: byDay[d][0], kind: 'burst', why: byDay[d].length + ' five-star reviews on ' + d + ' (burst)' }); });
  R.filter(function (r) { return r.rating === 5 && r.text.split(/\s+/).length <= 4; }).forEach(function (r) { out.push({ r: r, kind: 'short', why: 'very short generic 5-star' }); });
  R.filter(function (r) { return r.mismatch; }).forEach(function (r) { out.push({ r: r, kind: 'mismatch', why: r.rating + '-star but the text reads ' + (r.norm < 0 ? 'negative' : 'positive') }); });
  return out;
}

/* ---------- trends ---------- */
function monthlyAspect(R) {
  var months = {}, cells = {};
  R.forEach(function (r) {
    if (!r.date) return;
    var m = r.date.slice(0, 7);
    months[m] = months[m] || { n: 0, rating: 0, rated: 0, sent: 0 };
    months[m].n++; months[m].sent += r.norm; if (r.rating != null) { months[m].rating += r.rating; months[m].rated++; }
    r.sents.forEach(function (x) { x.aspects.forEach(function (a) { var k = a + '|' + m, o = cells[k] || (cells[k] = { pos: 0, neg: 0, n: 0 }); o.n++; if (x.score > 0.5) o.pos++; else if (x.score < -0.5) o.neg++; }); });
  });
  var ms = Object.keys(months).sort(), aspects = {};
  Object.keys(ASPECTS).forEach(function (a) { var row = ms.map(function (m) { var o = cells[a + '|' + m]; return o ? { net: (o.pos - o.neg) / o.n, n: o.n, neg: o.neg } : null; }); if (row.some(Boolean)) aspects[a] = row; });
  return { months: ms, rating: ms.map(function (m) { return months[m].rated ? months[m].rating / months[m].rated : null; }), sentiment: ms.map(function (m) { return months[m].sent / months[m].n; }), count: ms.map(function (m) { return months[m].n; }), aspects: aspects };
}
/* Single change point: the split that maximizes the difference in means, weighted by segment sizes. Needs at least `min` points per side. */
function changePoint(values, min) {
  min = min || 2;
  var v = values.map(function (x, i) { return { x: x, i: i }; }).filter(function (p) { return p.x != null && !isNaN(p.x); });
  if (v.length < min * 2) return null;
  var best = null;
  for (var k = min; k <= v.length - min; k++) {
    var a = v.slice(0, k), b = v.slice(k), ma = a.reduce(function (s, p) { return s + p.x; }, 0) / a.length, mb = b.reduce(function (s, p) { return s + p.x; }, 0) / b.length;
    var score = Math.abs(mb - ma) * Math.sqrt((a.length * b.length) / v.length);
    if (!best || score > best.score) best = { index: v[k].i, before: ma, after: mb, delta: mb - ma, score: score };
  }
  return best;
}

/* ---------- phrases ---------- */
/* Frequent 2-3 word phrases (no stopword at either edge) in the selected reviews, ranked by count and lift over the rest. */
function topPhrases(R, pick, limit) {
  var count = function (rs) {
    var c = {};
    rs.forEach(function (r) {
      var w = r.text.toLowerCase().match(/[a-z][a-z']*/g) || [], seen = {};
      for (var n = 2; n <= 3; n++) for (var i = 0; i + n <= w.length; i++) {
        var g = w.slice(i, i + n);
        if (STOP[g[0]] || STOP[g[n - 1]] || g.some(function (x) { return x.length < 2; })) continue;
        var key = g.join(' ');
        if (!seen[key]) { seen[key] = 1; c[key] = (c[key] || 0) + 1; }
      }
    });
    return c;
  };
  var sel = R.filter(pick), rest = R.filter(function (r) { return !pick(r); }), A = count(sel), B = count(rest);
  return Object.keys(A).filter(function (k) { return A[k] >= 2; }).map(function (k) {
    var pa = A[k] / Math.max(1, sel.length), pb = ((B[k] || 0) + 0.5) / Math.max(1, rest.length + 1);
    return { phrase: k, count: A[k], share: pa, lift: pa / pb };
  }).filter(function (x, i, arr) { return !arr.some(function (y) { return y !== x && y.phrase.indexOf(x.phrase) >= 0 && y.count >= x.count; }); })
    .sort(function (a, b) { return b.count * Math.log(1 + b.lift) - a.count * Math.log(1 + a.lift); }).slice(0, limit || 15);
}

/* ---------- comparison ---------- */
function summarize(R) {
  var rated = R.filter(function (r) { return r.rating != null; });
  return { n: R.length, avg: rated.length ? rated.reduce(function (a, r) { return a + r.rating; }, 0) / rated.length : null, positive: R.length ? R.filter(function (r) { return r.norm > 0.2; }).length / R.length : 0, aspects: aspectStats(R) };
}
function compareAspects(A, B) {
  var map = function (s) { var o = {}; s.forEach(function (x) { o[x.a] = x; }); return o; }, a = map(A), b = map(B), names = Object.keys(a).concat(Object.keys(b).filter(function (k) { return !a[k]; }));
  return names.map(function (k) { return { aspect: k, a: a[k] ? a[k].net : null, b: b[k] ? b[k].net : null, na: a[k] ? a[k].n : 0, nb: b[k] ? b[k].n : 0, diff: a[k] && b[k] ? b[k].net - a[k].net : null }; }).sort(function (x, y) { return Math.abs(y.diff || 0) - Math.abs(x.diff || 0); });
}

/* ---------- import ---------- */
function parseCSV(text) {
  var rows = [], row = [], cur = '', q = false;
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(function (c) { return c.trim(); })) rows.push(row); row = []; }
    else cur += ch;
  }
  row.push(cur); if (row.some(function (c) { return c.trim(); })) rows.push(row);
  return rows;
}
function isoDate(s) { var d = new Date(s); return isNaN(d) ? null : d.toISOString().slice(0, 10); }
/* Find text/rating/date columns by header name; ratings out of 10 or 100 are rescaled to 1-5. */
function rowsToReviews(rows) {
  if (!rows.length) return { reviews: [], error: 'Empty file' };
  var head = rows[0].map(function (c) { return c.toLowerCase().trim(); });
  var find = function (re) { return head.findIndex(function (c) { return re.test(c); }); };
  var ti = find(/^(text|review|body|comment|content|review_text|review text)$/), ri = find(/rating|stars|score/), di = find(/date|time|created/);
  if (ti < 0) ti = find(/text|review|body|comment|content/);
  if (ti < 0) return { reviews: [], error: 'Need a "text" or "review" column' };
  var vals = rows.slice(1).map(function (r) { return ri >= 0 ? parseFloat(r[ri]) : NaN; }).filter(function (x) { return !isNaN(x); }), max = vals.length ? Math.max.apply(null, vals) : 5;
  var scale = max > 10 ? 100 : max > 5 ? 10 : 5;
  return { reviews: rows.slice(1).map(function (r) {
    var raw = ri >= 0 ? parseFloat(r[ri]) : NaN;
    return { text: (r[ti] || '').trim(), rating: isNaN(raw) ? null : Math.max(1, Math.min(5, Math.round(scale === 5 ? raw : 1 + (raw / scale) * 4))), date: di >= 0 && r[di] ? isoDate(r[di]) : null };
  }).filter(function (r) { return r.text; }), error: null };
}
/* "4 | Great sound but…" or just text, one review per line. */
function parsePasted(text) {
  return String(text).split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) { var m = l.match(/^([1-5])\s*[|:\-]\s*(.*)$/); return m ? { rating: +m[1], text: m[2], date: null } : { rating: null, text: l, date: null }; });
}
function repliesCSV(items) {
  var q = function (x) { return '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"'; };
  return 'review,rating,date,reply,status\n' + items.map(function (x) { return [x.text, x.rating, x.date, x.reply, x.status].map(q).join(','); }).join('\n');
}
