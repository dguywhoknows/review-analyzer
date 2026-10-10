/* Seeded sample review sets for two fictional earbuds, used on first load and on the Compare page. */
function seededRandom(seed) { var s = seed; return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
function sampleReviews(seed, variant) {
  const r = seededRandom(seed || 11), pick = (a) => a[Math.floor(r() * a.length)], b = variant === 'b';
  const P = { connect: ['Pairing is instant and the connection never drops.', 'Bluetooth is rock solid, even across the office.'], battery: ['Battery lasts all day.', 'The battery lasts a full week of commutes.'], sound: ['The sound is crisp and the bass is punchy.', 'Audio quality is excellent for the price.', 'Music sounds rich and clear.'], comfort: ['Very comfortable, I wear them for hours.', 'They fit my ears perfectly.'], anc: ['Noise cancelling is impressive on the subway.', 'ANC works great on flights.'], price: ['Totally worth the money.', 'Great value at $79.'], app: ['The app EQ is easy to use.', 'After the firmware update everything is smooth.'], mic: ['Calls are clear, people hear me fine.'] };
  const N = { sound: ['The sound is muffled and the bass is weak.', 'Audio is tinny at high volume.'], connect: ['Bluetooth keeps dropping, really annoying.', 'The left bud disconnects every few minutes.', 'Pairing is a nightmare and the audio lags on videos.'], battery: ['Battery dies after 2 hours now.', 'After three months the battery life is terrible.', 'The case does not charge the right earbud anymore.'], comfort: ['They hurt my ears after an hour.', 'The tips are loose and they fall out when running.'], mic: ['The mic is muffled on calls.', 'People say I sound tinny on calls.'], build: ['The case hinge broke after a month, feels flimsy.', 'Cheap plastic build.'], support: ['Customer service was slow and unhelpful.', 'Shipping took three weeks.'] };
  const out = [];
  const start = Date.UTC(2026, 0, 1);
  for (let i = 0; i < 140; i++) {
    const day = Math.floor(r() * 270), date = new Date(start + day * 864e5).toISOString().slice(0, 10), m = day / 30;
    const negChance = b ? 0.24 : 0.22 + (m < 3.5 ? 0.12 : -0.04) + (m > 6 ? 0.08 : 0);
    const neg = r() < negChance;
    const parts = [];
    if (neg) {
      const pool = b ? ['sound', 'sound', 'build', 'mic', 'comfort'] : m < 3.5 ? ['connect', 'connect', 'comfort', 'mic', 'build', 'support'] : m > 6 ? ['battery', 'battery', 'battery', 'comfort', 'mic', 'build'] : ['battery', 'comfort', 'mic', 'support', 'connect'];
      parts.push(pick(N[pick(pool)]));
      if (r() < 0.5) parts.push(pick(P[pick(['sound', 'price', 'anc'])]).replace(/^./, (c) => 'But ' + c.toLowerCase()));
      if (r() < 0.3) parts.push(pick(['Returning them.', 'Disappointed.', 'Would not recommend.']));
    } else {
      parts.push(pick(P[pick(b ? ['battery', 'battery', 'connect', 'price', 'comfort'] : ['sound', 'sound', 'comfort', 'anc', 'price', 'app', 'battery', 'mic'])]));
      if (r() < 0.6) parts.push(pick(P[pick(['sound', 'comfort', 'anc', 'price'])]));
      if (r() < 0.25) parts.push(pick(N[pick(['comfort', 'mic', 'battery'])]).replace(/\.$/, ', but no big deal.'));
      if (m >= 3.5 && r() < 0.2) parts.push('The firmware update fixed the connection issues I had.');
    }
    const opener = pick(['Bought these for the gym.', 'Got them as a birthday gift.', 'Using them daily on my commute.', 'Second pair I’ve owned.', 'Upgraded from cheaper buds.', 'I mostly use them for podcasts.', 'Picked them up on sale.', 'Work from home, on calls all day.', 'I run 5k three times a week with these.', 'My kid borrowed them for a week.', 'Ordered in black.', 'Had them since launch.', '', '', '']);
    const closer = pick(['', '', '', 'Overall happy.', 'Will update after a few more weeks.', 'Mixed feelings.', 'Do your research.', 'Would buy again.', 'Four months in.', 'Took a while to get used to the touch controls.', 'The case is pocketable.']);
    const text = [opener, ...new Set(parts), neg && closer === 'Would buy again.' ? '' : closer].filter(Boolean).join(' ');
    const s = sentScore(text);
    const rating = Math.max(1, Math.min(5, Math.round(3 + Math.tanh(s / 4) * 2 + (r() - 0.5))));
    out.push({ text, rating, date });
  }
  if (b) return out;
  ['Best earbuds ever, five stars!', 'Best earbuds ever, five stars!!', 'Best earbuds ever! Five stars.', 'Love it', 'Great product'].forEach((t, i) => out.push({ text: t, rating: 5, date: '2026-05-14' }));
  out.push({ text: 'Bluetooth disconnects constantly and the battery died in a week. Terrible.', rating: 5, date: '2026-07-02' });
  return out;
}
