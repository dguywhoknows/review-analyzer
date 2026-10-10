const load = (list) => list.map((r, i) => enrich(r, i));

test('sentScore handles negation, intensifiers and contrast', () => {
  assert.ok(sentScore('The sound is great.') > 0);
  assert.ok(sentScore('The sound is not great.') < 0);
  assert.ok(sentScore("It isn't bad at all.") > 0);
  assert.ok(sentScore('Really good.') > sentScore('Good.'));
  assert.ok(sentScore('The case is cheap but the sound is excellent.') > 0, 'clause after "but" dominates');
  assert.ok(sentScore('The sound is excellent but the battery died.') < 0);
  assert.eq(sentScore('They arrived on Tuesday.'), 0);
});

test('enrich finds aspects per sentence and rating mismatches', () => {
  const r = enrich({ text: 'Battery lasts all day. Bluetooth keeps dropping, really annoying.', rating: 5 }, 0);
  assert.deepEq(r.aspects, ['Battery', 'Connectivity']);
  assert.ok(r.sents[0].score > 0 && r.sents[1].score < 0);
  assert.ok(enrich({ text: 'Terrible, broke in a week, useless.', rating: 5 }, 1).mismatch);
  assert.ok(!enrich({ text: 'Terrible, broke in a week.', rating: 1 }, 2).mismatch);
});

test('aspectStats counts positive, negative and neutral mentions', () => {
  const s = aspectStats(load([{ text: 'Great sound.' }, { text: 'Muffled sound.' }, { text: 'The sound is loud.' }, { text: 'Battery died.' }]));
  const sound = s.find((x) => x.a === 'Sound');
  assert.deepEq([sound.pos, sound.neg, sound.neu, sound.n], [1, 1, 1, 3]);
  assert.eq(s[0].a, 'Sound');
  assert.eq(s.find((x) => x.a === 'Battery').net, -1);
});

test('logOdds separates words used in good and bad reviews', () => {
  const R = load(sampleReviews(11));
  const lo = logOdds(R);
  assert.ok(lo.pos.length > 3 && lo.neg.length > 3);
  assert.ok(lo.pos.every((x) => x.z > 0) && lo.neg.every((x) => x.z < 0));
  assert.ok(lo.neg.some((x) => /disconnect|dropping|battery|dies|terrible|hurt/.test(x.w)), lo.neg.map((x) => x.w).join(','));
});

test('suspicious flags duplicates, bursts, short 5-star and mismatches', () => {
  const R = load(sampleReviews(11));
  const kinds = new Set(suspicious(R).map((s) => s.kind));
  ['duplicate', 'burst', 'short', 'mismatch'].forEach((k) => assert.ok(kinds.has(k), k));
  assert.eq(suspicious(load([{ text: 'Fine product, works as described for me.', rating: 4 }])).length, 0);
});

test('monthlyAspect and changePoint find the connectivity fix', () => {
  const m = monthlyAspect(load(sampleReviews(11)));
  assert.ok(m.months.length >= 8);
  assert.eq(m.rating.length, m.months.length);
  const conn = m.aspects.Connectivity.map((c) => (c ? c.neg / c.n : null));
  const cp = changePoint(conn);
  assert.ok(cp && cp.delta < 0, 'connectivity complaints drop');
  assert.ok(cp.index >= 2 && cp.index <= 5, String(cp.index));
  assert.eq(changePoint([1, 2]), null);
  const step = changePoint([0, 0, 0, 0, 5, 5, 5]);
  assert.deepEq([step.index, step.before, step.after], [4, 0, 5]);
});

test('topPhrases mines repeated complaint phrases', () => {
  const R = load(sampleReviews(11));
  const p = topPhrases(R, (r) => r.norm < -0.2, 10);
  assert.ok(p.length >= 5);
  assert.ok(p.every((x) => x.count >= 2 && x.lift > 0));
  assert.ok(p.some((x) => /battery|bluetooth|ears|calls|case/.test(x.phrase)), p.map((x) => x.phrase).join(' | '));
  assert.ok(!p.some((x) => /^(the|and) /.test(x.phrase)), 'no stopword at the edge');
});

test('compareAspects ranks the biggest differences', () => {
  const A = summarize(load(sampleReviews(11))), B = summarize(load(sampleReviews(29, 'b')));
  const c = compareAspects(A.aspects, B.aspects);
  assert.ok(c.length >= 5);
  const sound = c.find((x) => x.aspect === 'Sound'), battery = c.find((x) => x.aspect === 'Battery');
  assert.ok(sound.diff < 0, 'product B sounds worse');
  assert.ok(battery.diff > 0, 'product B has the better battery');
  assert.ok(Math.abs(c[0].diff) >= Math.abs(c[c.length - 1].diff || 0));
});

test('CSV and pasted imports', () => {
  const rows = parseCSV('Review Text,Stars,Created\n"Great, really great",9,2026-03-01\nBad one,2,not a date\n,5,2026-01-01\n');
  const r = rowsToReviews(rows);
  assert.eq(r.error, null);
  assert.deepEq(r.reviews.map((x) => [x.text, x.rating, x.date]), [['Great, really great', 5, '2026-03-01'], ['Bad one', 2, null]]);
  assert.eq(rowsToReviews([['id', 'stars'], ['1', '5']]).error, 'Need a "text" or "review" column');
  assert.deepEq(parsePasted('4 | Nice sound\nNo rating here\n\n2: meh'), [{ rating: 4, text: 'Nice sound', date: null }, { rating: null, text: 'No rating here', date: null }, { rating: 2, text: 'meh', date: null }]);
  assert.eq(repliesCSV([{ text: 'a "b"', rating: 1, date: 'd', reply: 'r', status: 'sent' }]), 'review,rating,date,reply,status\n"a ""b""","1","d","r","sent"');
});
