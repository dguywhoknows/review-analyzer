const { $, $$, h, esc, busy, toast, download, store } = Kit;
const uid = () => Math.random().toString(36).slice(2, 9);
let datasets = store.get('datasets', []);
let curId = store.get('current', null);
let replies = store.get('replies', {});
let R = [];
const saveSets = () => { store.set('datasets', datasets); store.set('current', curId); };
const cur = () => datasets.find((d) => d.id === curId);
const stars = (n) => (n == null ? '' : '★'.repeat(n) + '☆'.repeat(5 - n));

/* ================= datasets ================= */
function addDataset(name, reviews) {
  const d = { id: uid(), name, reviews: reviews.map((r) => ({ text: r.text, rating: r.rating, date: r.date })) };
  datasets.push(d); curId = d.id; saveSets(); open();
  return d;
}
function loadSamples() {
  datasets = datasets.filter((d) => !d.sample);
  const a = { id: uid(), name: 'Aurora Buds (sample)', sample: true, reviews: sampleReviews(11) }, b = { id: uid(), name: 'Pulse Pro (sample)', sample: true, reviews: sampleReviews(29, 'b') };
  datasets.push(a, b); curId = a.id; saveSets(); open();
}
function open() {
  const d = cur() || datasets[0];
  if (!d) { R = []; return renderAll(); }
  curId = d.id;
  R = d.reviews.filter((r) => r.text && r.text.trim()).map((r, i) => enrich(r, i));
  renderAll();
}
function renderSelects() {
  const opts = datasets.map((d) => `<option value="${d.id}">${esc(d.name)} (${d.reviews.length})</option>`).join('');
  $('#dataset').innerHTML = opts; $('#dataset').value = curId || '';
  ['#cmpA', '#cmpB'].forEach((s, i) => { const keep = $(s).value; $(s).innerHTML = opts; $(s).value = datasets.some((d) => d.id === keep) ? keep : datasets[i]?.id || datasets[0]?.id || ''; });
}
$('#dataset').onchange = () => { curId = $('#dataset').value; saveSets(); open(); };
$('#delSet').onclick = () => { const d = cur(); if (!d || !confirm(`Delete "${d.name}"?`)) return; datasets = datasets.filter((x) => x !== d); delete replies[d.id]; store.set('replies', replies); curId = datasets[0]?.id || null; saveSets(); open(); };
$('#sample').onclick = () => { loadSamples(); toast('Loaded two sample products'); };
$('#csv').onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const r = rowsToReviews(parseCSV(await f.text()));
  if (r.error) toast(r.error, 'err'); else { addDataset(f.name.replace(/\.\w+$/, ''), r.reviews); toast(`Imported ${r.reviews.length} reviews`); }
  e.target.value = '';
};
$('#pasteBtn').onclick = () => {
  const t = $('#paste');
  if (t.classList.contains('hidden')) { t.classList.remove('hidden'); t.focus(); $('#pasteBtn').textContent = 'Analyze pasted'; return; }
  const list = parsePasted(t.value);
  if (!list.length) return toast('Paste one review per line', 'err');
  addDataset('Pasted ' + new Date().toLocaleDateString(), list);
  t.value = ''; t.classList.add('hidden'); $('#pasteBtn').textContent = 'Paste reviews';
};

/* ================= overview ================= */
function renderAll() {
  renderSelects();
  if (!R.length) { $('#tiles').innerHTML = ''; $('#list').innerHTML = '<div class="empty">Load the samples or import reviews.</div>'; return; }
  renderOverview();
  if (Router.current === 'trends') renderTrends();
  if (Router.current === 'phrases') renderPhrases();
  if (Router.current === 'compare') renderCompare();
  if (Router.current === 'replies') renderReplies();
}
function renderOverview() {
  const S = summarize(R), AS = S.aspects, rated = R.filter((r) => r.rating != null);
  const pain = AS.filter((a) => a.n >= 6).sort((a, b) => a.net - b.net)[0];
  $('#tiles').innerHTML = [['Reviews', R.length], ['Avg rating', S.avg != null ? S.avg.toFixed(2) + ' / 5' : '—'], ['Positive text', Math.round(S.positive * 100) + '%'], ['Most discussed', AS[0]?.a || '—'], ['Biggest pain point', pain?.a || '—'], ['Rating/text mismatches', R.filter((r) => r.mismatch).length]]
    .map(([k, v]) => `<div class="stat"><div class="k">${k}</div><div class="v" style="font-size:19px">${esc(v)}</div></div>`).join('');
  $('#aspects').innerHTML = AS.map((a) => `<div class="asp" data-a="${esc(a.a)}" title="Filter reviews"><span>${esc(a.a)}</span><div class="div"><i class="n" style="width:${(100 * a.neg) / a.n}%"></i><i class="z" style="width:${(100 * a.neu) / a.n}%"></i><i class="p" style="width:${(100 * a.pos) / a.n}%"></i></div><b class="mono small" style="text-align:right;color:${a.net >= 0 ? 'var(--good)' : 'var(--bad)'}">${a.net >= 0 ? '+' : ''}${Math.round(a.net * 100)}</b></div>`).join('') || '<div class="empty">No aspects detected.</div>';
  $$('.asp[data-a]').forEach((e) => (e.onclick = () => { $('#fAspect').value = e.dataset.a; renderList(); $('#list').scrollIntoView({ behavior: 'smooth' }); }));
  $('#fAspect').innerHTML = '<option value="">All aspects</option>' + AS.map((a) => `<option>${esc(a.a)}</option>`).join('');
  $('#distMini').innerHTML = distHTML(rated);
  const lo = logOdds(R);
  const cloud = (xs, col) => xs.map(({ w, z }) => `<span style="font-size:${Math.min(26, 12 + Math.abs(z) * 2.2)}px;color:${col};opacity:${Math.min(1, 0.45 + Math.abs(z) / 6)}">${esc(w)}</span>`).join('') || '<span class="muted small">Not enough data.</span>';
  $('#posWords').innerHTML = cloud(lo.pos, 'var(--good)');
  $('#negWords').innerHTML = cloud(lo.neg, 'var(--bad)');
  const sus = suspicious(R).slice(0, 14);
  $('#sus').innerHTML = sus.length ? sus.map((s) => `<div class="rv"><div class="meta"><span class="tag warn">${esc(s.why)}</span><span>#${s.r.i + 1}</span><span class="stars">${stars(s.r.rating)}</span></div>${esc(s.r.text.slice(0, 140))}</div>`).join('') : '<div class="empty">Nothing suspicious detected.</div>';
  renderList();
}
function distHTML(rated) {
  if (!rated.length) return '<p class="small muted">No ratings in this dataset.</p>';
  const dist = [5, 4, 3, 2, 1].map((s) => rated.filter((r) => r.rating === s).length), max = Math.max(...dist);
  return [5, 4, 3, 2, 1].map((s, i) => `<div class="asp" style="cursor:default;grid-template-columns:50px 1fr 40px"><span class="stars">${s} star</span><div class="div"><i class="p" style="width:${(100 * dist[i]) / max}%;background:#f59e0b"></i></div><span class="small">${dist[i]}</span></div>`).join('');
}
function renderList() {
  const a = $('#fAspect').value, f = $('#fSent').value;
  const list = R.filter((r) => (!a || r.aspects.includes(a)) && (!f || (f === 'neg' ? r.norm < -0.2 : f === 'pos' ? r.norm > 0.2 : r.mismatch)));
  const box = $('#list');
  box.innerHTML = '';
  list.slice(0, 150).forEach((r) => {
    const body = h('div');
    body.innerHTML = r.sents.map((x) => (x.score > 0.5 ? `<mark class="pos">${esc(x.s)}</mark>` : x.score < -0.5 ? `<mark class="neg">${esc(x.s)}</mark>` : esc(x.s))).join(' ');
    box.append(h('div', { class: 'rv' }, h('div', { class: 'meta' }, h('span', {}, '#' + (r.i + 1)), h('span', { class: 'stars' }, stars(r.rating)), r.date ? h('span', {}, r.date) : '', h('span', { class: 'tag ' + (r.norm > 0.2 ? 'good' : r.norm < -0.2 ? 'bad' : '') }, `sentiment ${r.norm >= 0 ? '+' : ''}${r.norm.toFixed(2)}`), ...r.aspects.map((x) => h('span', { class: 'tag' }, x))), body));
  });
  if (!list.length) box.append(h('div', { class: 'empty' }, 'No reviews match.'));
}
$('#fAspect').onchange = renderList;
$('#fSent').onchange = renderList;
$('#summ').onclick = (e) => busy(e.currentTarget, async () => {
  const AS = aspectStats(R);
  const pick = (f, n) => R.filter(f).sort(() => Math.random() - 0.5).slice(0, n).map((r) => `[${r.rating ?? '?'} stars${r.date ? ' ' + r.date : ''}] ${r.text}`);
  const sample = [...pick((r) => r.norm < -0.2, 25), ...pick((r) => r.norm > 0.2, 20), ...pick((r) => Math.abs(r.norm) <= 0.2, 8)];
  const out = await AI.chat([
    { role: 'system', content: 'You are a product insights analyst. Using local stats plus a review sample, write an executive brief. Ground every claim in the data; cite approximate frequencies. Return JSON {"headline":"one sentence","summary":"3 sentences","praise":["..."],"complaints":["..."],"requests":["feature requests or wishes"],"actions":[{"action":"","impact":"high|med|low","why":""}]}.' },
    { role: 'user', content: `Stats: ${R.length} reviews; aspect sentiment ${JSON.stringify(AS.map((a) => ({ aspect: a.a, mentions: a.n, pos: a.pos, neg: a.neg })))}; rating/text mismatches ${R.filter((r) => r.mismatch).length}.\n\nSample:\n${sample.join('\n')}` },
  ], { json: true, temperature: 0.3, maxTokens: 1800, demo: () => {
    const worst = AS.filter((a) => a.n >= 6).sort((a, b) => a.net - b.net), best = AS.filter((a) => a.n >= 6).sort((a, b) => b.net - a.net), phr = topPhrases(R, (r) => r.norm < -0.2, 3);
    const m = monthlyAspect(R), shift = worst[0] && m.aspects[worst[0].a] ? changePoint(m.aspects[worst[0].a].map((c) => (c ? c.neg / c.n : null))) : null;
    return { headline: `Customers praise ${best[0]?.a.toLowerCase() || 'the product'}, but ${worst[0]?.a.toLowerCase() || 'some issues'} drag ratings down.`, summary: `Across ${R.length} reviews, ${best[0]?.a} gets ${best[0]?.pos} positive mentions while ${worst[0]?.a} draws ${worst[0]?.neg} negative ones.${shift ? ` ${worst[0].a} complaints ${shift.delta > 0 ? 'rose' : 'fell'} from ${m.months[shift.index]}.` : ''} Recurring complaint phrases include ${phr.map((p) => `"${p.phrase}"`).join(', ')}.`, praise: best.slice(0, 3).map((a) => `${a.a}: ${a.pos} positive mentions`), complaints: worst.slice(0, 3).map((a) => `${a.a}: ${a.neg} negative mentions`), requests: phr.map((p) => `Fix "${p.phrase}" (${p.count} reviews)`), actions: worst.slice(0, 3).map((a, i) => ({ action: `Investigate ${a.a.toLowerCase()} problems`, impact: ['high', 'med', 'low'][i], why: `${a.neg} negative mentions, net ${Math.round(a.net * 100)}` })) };
  } });
  const list = (t, xs) => `<div class="stat"><div class="k">${t}</div><ul>${(xs || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
  $('#summary').innerHTML = `<h3 style="text-transform:none;letter-spacing:0;color:var(--text);font-size:17px">${esc(out.headline || '')}</h3><p>${esc(out.summary || '')}</p><div class="sum-grid">${list('Praise', out.praise)}${list('Complaints', out.complaints)}${list('Requests', out.requests)}</div><h3 style="margin-top:14px">Recommended actions</h3><table><tr><th>Action</th><th>Impact</th><th>Why</th></tr>${(out.actions || []).map((a) => `<tr><td>${esc(a.action)}</td><td><span class="tag ${a.impact === 'high' ? 'bad' : a.impact === 'med' ? 'warn' : ''}">${esc(a.impact)}</span></td><td class="small">${esc(a.why)}</td></tr>`).join('')}</table>`;
});

/* ================= trends ================= */
function renderTrends() {
  const m = monthlyAspect(R);
  $('#dist').innerHTML = '';
  if (m.months.length < 2) { $('#trend').innerHTML = '<p class="small muted">Add dates to see trends.</p>'; $('#heat').innerHTML = ''; $('#shifts').innerHTML = ''; return; }
  const W = 640, H = 170, x = (i) => 30 + (i * (W - 40)) / (m.months.length - 1), y = (v) => H - 20 - ((v - 1) / 4) * (H - 34);
  const line = (vals, f) => vals.map((v, i) => (v == null ? null : `${x(i)},${f(v)}`)).filter(Boolean).join(' ');
  $('#trend').innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Monthly rating trend">${[1, 2, 3, 4, 5].map((v) => `<line x1="30" x2="${W - 10}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="4" y="${y(v) + 4}" font-size="10" fill="var(--muted)">${v}</text>`).join('')}<polyline fill="none" stroke="#f59e0b" stroke-width="2.5" points="${line(m.rating, y)}"/><polyline fill="none" stroke="var(--accent)" stroke-width="2" stroke-dasharray="5 4" points="${line(m.sentiment, (v) => y(3 + v * 2))}"/>${m.months.map((mm, i) => `<text x="${x(i)}" y="${H - 4}" font-size="10" text-anchor="middle" fill="var(--muted)">${mm.slice(2)}</text>`).join('')}</svg><div class="small muted"><span style="color:#f59e0b">solid</span> average rating · <span style="color:var(--accent)">dashed</span> text sentiment (scaled to 1-5)</div>`;
  const color = (c) => { if (!c) return 'transparent'; const v = Math.max(-1, Math.min(1, c.net)); return v >= 0 ? `color-mix(in srgb, var(--good) ${Math.round(v * 70)}%, var(--panel-2))` : `color-mix(in srgb, var(--bad) ${Math.round(-v * 70)}%, var(--panel-2))`; };
  $('#heat').innerHTML = `<table class="heat"><tr><th></th>${m.months.map((mm) => `<th>${mm.slice(2)}</th>`).join('')}</tr>${Object.entries(m.aspects).map(([a, row]) => `<tr><td class="lbl">${esc(a)}</td>${row.map((c) => `<td style="background:${color(c)}" title="${c ? `${c.n} mentions, ${c.neg} negative` : 'no mentions'}">${c ? (c.net >= 0 ? '+' : '') + Math.round(c.net * 100) : ''}</td>`).join('')}</tr>`).join('')}</table>`;
  const shifts = Object.entries(m.aspects).map(([a, row]) => ({ a, cp: changePoint(row.map((c) => (c ? c.neg / c.n : null))) })).filter((x) => x.cp && Math.abs(x.cp.delta) >= 0.15).sort((p, q) => q.cp.score - p.cp.score);
  const overall = changePoint(m.rating);
  $('#shifts').innerHTML = (overall && Math.abs(overall.delta) >= 0.3 ? `<div class="phr"><span><b>Average rating</b> ${overall.delta > 0 ? 'rose' : 'fell'} from ${overall.before.toFixed(2)} to ${overall.after.toFixed(2)} starting ${m.months[overall.index]}</span><span></span><span></span></div>` : '') +
    (shifts.map((s) => `<div class="phr"><span><b>${esc(s.a)}</b>: share of negative mentions ${s.cp.delta > 0 ? 'rose' : 'fell'} from ${Math.round(s.cp.before * 100)}% to ${Math.round(s.cp.after * 100)}% starting ${m.months[s.cp.index]}</span><span class="tag ${s.cp.delta > 0 ? 'bad' : 'good'}">${s.cp.delta > 0 ? 'worse' : 'better'}</span><span></span></div>`).join('') || '<div class="empty">No clear shifts.</div>');
}

/* ================= phrases ================= */
function renderPhrases() {
  const row = (p) => `<div class="phr"><span>${esc(p.phrase)}</span><span class="small muted">${p.count} reviews</span><span class="small">${p.lift.toFixed(1)}× vs rest</span></div>`;
  $('#negPhrases').innerHTML = topPhrases(R, (r) => r.norm < -0.2, 15).map(row).join('') || '<div class="empty">Not enough negative reviews.</div>';
  $('#posPhrases').innerHTML = topPhrases(R, (r) => r.norm > 0.2, 15).map(row).join('') || '<div class="empty">Not enough positive reviews.</div>';
}

/* ================= compare ================= */
function renderCompare() {
  const A = datasets.find((d) => d.id === $('#cmpA').value), B = datasets.find((d) => d.id === $('#cmpB').value);
  if (!A || !B || A === B) { $('#cmpTiles').innerHTML = ''; $('#cmpTable').innerHTML = '<div class="empty">Pick two different datasets.</div>'; return; }
  const sa = summarize(A.reviews.map((r, i) => enrich(r, i))), sb = summarize(B.reviews.map((r, i) => enrich(r, i)));
  $('#cmpTiles').innerHTML = [[A.name, sa], [B.name, sb]].map(([n, s]) => `<div class="stat"><div class="k">${esc(n)}</div><div class="v" style="font-size:18px">${s.avg != null ? s.avg.toFixed(2) + ' / 5' : '—'} · ${Math.round(s.positive * 100)}% positive</div></div>`).join('');
  const pct = (v) => (v == null ? '' : `<div class="bar"><span style="width:${Math.round(((v + 1) / 2) * 100)}%;background:${v >= 0 ? 'var(--good)' : 'var(--bad)'}"></span></div>`);
  $('#cmpTable').innerHTML = `<div class="cmp small muted"><span>Aspect</span><span>${esc(A.name)}</span><span>${esc(B.name)}</span><span>B − A</span></div>` + compareAspects(sa.aspects, sb.aspects).map((c) => `<div class="cmp"><span>${esc(c.aspect)}</span><span>${pct(c.a)}<span class="small muted">${c.a == null ? 'not mentioned' : `${Math.round(c.a * 100)} net · ${c.na} mentions`}</span></span><span>${pct(c.b)}<span class="small muted">${c.b == null ? 'not mentioned' : `${Math.round(c.b * 100)} net · ${c.nb} mentions`}</span></span><b class="mono" style="color:${c.diff == null ? 'var(--muted)' : c.diff >= 0 ? 'var(--good)' : 'var(--bad)'}">${c.diff == null ? '—' : (c.diff >= 0 ? '+' : '') + Math.round(c.diff * 100)}</b></div>`).join('');
}
$('#cmpA').onchange = renderCompare;
$('#cmpB').onchange = renderCompare;

/* ================= replies ================= */
const repOf = (r) => ((replies[curId] = replies[curId] || {})[r.i] || null);
function setRep(r, patch) { const m = (replies[curId] = replies[curId] || {}); m[r.i] = Object.assign({ reply: '', status: 'draft' }, m[r.i] || {}, patch); store.set('replies', replies); }
async function draftReply(r) {
  const text = await AI.chat([
    { role: 'system', content: 'You are a customer-care lead writing a public reply to a negative review: empathetic, specific to their issue, no corporate clichés, offer a concrete next step (support email placeholder support@example.com), under 80 words, no promises you cannot keep.' },
    { role: 'user', content: `Review (${r.rating ?? '?'} stars): ${r.text}` },
  ], { temperature: 0.6, demo: `Thanks for taking the time to write this, and sorry the ${(r.aspects[0] || 'product').toLowerCase()} let you down. Could you email support@example.com with your order number? We'll troubleshoot it with you and arrange a replacement if it turns out to be a hardware fault.` });
  setRep(r, { reply: text.trim(), status: 'draft' });
}
function renderReplies() {
  const neg = R.filter((r) => r.norm < -0.2 || (r.rating != null && r.rating <= 2)), f = $('#repFilter').value;
  const list = neg.filter((r) => { const s = repOf(r)?.status; return !f || (f === 'todo' ? !s : s === f); });
  $('#repSummary').textContent = `${neg.length} negative reviews · ${neg.filter((r) => repOf(r)?.status === 'sent').length} answered · ${neg.filter((r) => repOf(r)?.status === 'draft').length} drafted`;
  const box = $('#repList');
  box.innerHTML = '';
  if (!list.length) box.append(h('div', { class: 'card empty' }, 'Nothing here.'));
  list.slice(0, 60).forEach((r) => {
    const rep = repOf(r);
    const ta = h('textarea', { 'aria-label': 'Reply', placeholder: 'Write a reply or draft one', oninput: (e) => setRep(r, { reply: e.target.value }) }, rep?.reply || '');
    box.append(h('div', { class: 'card rep stack' },
      h('div', { class: 'meta row small muted' }, h('span', {}, '#' + (r.i + 1)), h('span', { class: 'stars' }, stars(r.rating)), r.date ? h('span', {}, r.date) : '', ...r.aspects.map((x) => h('span', { class: 'tag' }, x)), rep ? h('span', { class: 'tag ' + (rep.status === 'sent' ? 'good' : 'warn') }, rep.status) : ''),
      h('div', {}, r.text), ta,
      h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: (e) => busy(e.currentTarget, async () => { await draftReply(r); renderReplies(); }) }, rep?.reply ? 'Redraft' : 'Draft reply'), h('button', { class: 'btn sm ghost', onclick: () => navigator.clipboard.writeText(ta.value).then(() => toast('Copied')) }, 'Copy'), h('button', { class: 'btn sm ghost', onclick: () => { setRep(r, { status: rep?.status === 'sent' ? 'draft' : 'sent', reply: ta.value }); renderReplies(); } }, rep?.status === 'sent' ? 'Mark not sent' : 'Mark sent'))));
  });
}
$('#repFilter').onchange = renderReplies;
$('#repAll').onclick = (e) => busy(e.currentTarget, async () => { const todo = R.filter((r) => (r.norm < -0.2 || (r.rating != null && r.rating <= 2)) && !repOf(r)).slice(0, 5); for (const r of todo) await draftReply(r); renderReplies(); toast(`Drafted ${todo.length}`); });
$('#repCsv').onclick = () => download('replies.csv', repliesCSV(R.filter((r) => repOf(r)).map((r) => Object.assign({ text: r.text, rating: r.rating, date: r.date }, repOf(r)))), 'text/csv');

/* ================= boot ================= */
Router.on('trends', renderTrends);
Router.on('phrases', renderPhrases);
Router.on('compare', renderCompare);
Router.on('replies', renderReplies);
if (!datasets.length) loadSamples(); else open();
