# review-analyzer

[![tests](https://github.com/dguywhoknows/review-analyzer/actions/workflows/tests.yml/badge.svg)](https://github.com/dguywhoknows/review-analyzer/actions/workflows/tests.yml)

Drop in product reviews to get aspect-level sentiment, trend lines, suspicious-review detection, and an AI executive summary with reply drafts.

Live: https://dguywhoknows.github.io/review-analyzer/

## Overview

Review Radar reads hundreds of reviews so you don't have to. A local NLP pipeline splits reviews into sentences and scores sentiment with a lexicon that handles negation, intensifiers and 'but' clauses. It maps each sentence to product aspects (sound, battery, fit, connectivity …) to build a diverging aspect-sentiment chart, and plots rating and text sentiment month by month. Weighted log-odds with an informative prior surfaces the words that separate 5from 1reviews. Suspicious-review heuristics catch near-duplicates (shingle Jaccard), same-day 5bursts, generic one-liners and rating/text mismatches. The AI turns a stratified sample plus the stats into an executive brief with prioritized actions, and drafts empathetic replies to negative reviews.

## Pages

- **Overview**
- **Trends**
- **Phrases**
- **Compare**
- **Replies**
- **Settings**

## Features

- CSV import with auto column detection, paste mode, and a 146-review synthetic sample with real trends
- Sentence-level lexicon sentiment with negation scope, intensifiers and contrastive 'but' weighting
- Aspect extraction + diverging positive/neutral/negative bars (click to filter)
- Monthly rating vs text-sentiment trend lines and rating distribution
- Distinctive-word clouds via weighted log-odds ratio (Monroe, Colaresi & Quinn 2008)
- Suspicious-review detector: near-duplicates, bursts, generic 5, rating/text mismatch
- AI executive brief (praise, complaints, requests, prioritized actions) and streaming reply drafts
- Datasets: keep several imported or pasted review sets in the browser and switch between them; CSV import detects text, rating and date columns and rescales ratings out of 10 or 100
- Trends page: monthly rating and text sentiment, a month-by-aspect heatmap of net sentiment, and change-point detection that reports when an aspect's complaints rose or fell
- Phrases page: recurring two- and three-word phrases in negative and positive reviews, ranked by frequency and lift over the rest
- Compare page: two products side by side, aspect by aspect, sorted by the largest difference (two fictional sample products included)
- Replies page: a queue of negative reviews with drafted, editable public replies, sent/draft status and CSV export
- The offline executive summary now cites detected shifts and complaint phrases

## How it works

LLM calls are used for:

- Executive summary from a stratified review sample + computed statistics (JSON)
- Customer-care reply drafting

Everything else (parsing, sentiment, aspect mining, statistics, duplicate detection, charts) runs locally in the browser.

## Getting started

No build step and no dependencies. Serve the folder with any static server:

```bash
git clone https://github.com/dguywhoknows/review-analyzer.git
cd review-analyzer
python -m http.server 8000
```

Then open http://localhost:8000.

`index.html` is the public home page, `login.html` handles accounts and `app.html` is the app.

### Telling the app what to do

Every page has an **Ask AI** box (Ctrl/Cmd+K). Type a request in plain words and the model plans a sequence of
calls to the app's own functions, runs them and reports back. The **Instructions** tab stores standing
preferences that are added to every AI request the app makes.

### Configuration

`src/lib/config.js` is generated from the build settings: the Supabase project (accounts) and the AI proxy URL.
Signed-in users get the built-in AI through the proxy, which keeps the provider key as a server-side secret.
Without those settings the app runs for guests, in demo mode, or with a personal [Groq](https://console.groq.com/keys)
or [OpenRouter](https://openrouter.ai/keys) key entered under **Settings → Model provider** (stored only in this
browser and sent only to that provider).

## Testing

`src/core.js` holds the app's logic as pure functions and is covered by 9 unit tests.

```bash
node tests/run-node.js        # CI runs this on every push
```

Or open `tests/index.html` in a browser ([live](https://dguywhoknows.github.io/review-analyzer/tests/)).

## Project structure

```
index.html           public home page (generated)
login.html           sign-in and sign-up (generated)
app.html             the app: markup for every page
src/app.js           UI, page wiring and event handlers
src/core.js          pure logic with no DOM access (unit-tested)
src/demo.js          sample responses used when no API key is configured
src/lib/ai.js        LLM client: Groq / OpenRouter, streaming, JSON mode, retries
src/lib/dom.js       DOM helpers, namespaced storage, markdown renderer
src/lib/router.js    hash router and the Settings page
src/lib/copilot.js   AI command box that drives the app's own functions
src/lib/auth.js      accounts (Supabase Auth) and the sign-in gate
styles/base.css      design tokens and shared components
styles/app.css       app-specific styles
tests/               unit tests (browser runner + Node runner for CI)
```

## Tech

- Lexicon-based sentiment analysis
- Fightin' Words log-odds with Dirichlet prior
- w-shingling + Jaccard similarity
- Sentiment, aspects, log-odds, suspicious-review checks, change points, phrase mining, comparison and CSV mapping in src/core.js covered by unit tests run in the browser and in CI
- Vanilla JavaScript, no framework or bundler
- Deployed with GitHub Pages

## License

MIT
