# Conseal — Correction

Sprintfour hackathon submission, Problem 3: fixing the tool's mistakes.

Sam is reviewing a tool's suggested redactions on a case file. Some of what
it hid isn't sensitive at all (false positives). Worse, it left a name and a
phone number untouched (missed PII). Sam moves fast and trusts the tool more
than he should — this app is the correction surface built for that person.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000.

PII detection uses a cloud LLM call. Add your key to `.env.local`
(see `.env.example`) to run live detection:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Without a key, the app falls back to a saved real detection run
(`lib/sample-detection.ts`) so the correction experience works out of the
box — useful for reviewers without a key. Use the "re-run live detection"
link in the top bar once a key is set.

## What's here

- `lib/sample-document.ts` — the case file Sam is reviewing
- `app/api/detect/route.ts` — calls the LLM, or returns the saved fallback
- `lib/heuristics.ts` — a small, deliberately dumb pattern scanner that
  flags possible missed PII (bare names, unpunctuated digit runs) that the
  detector's own output doesn't cover
- `lib/segments.ts` — merges suggested redactions, Sam's manual additions,
  and heuristic candidates into one ordered view of the document
- `components/ReviewQueue.tsx` — the risk-ranked correction queue
- `components/DocumentView.tsx` — the document, with click-to-focus and
  click-and-drag-to-flag-a-miss

See `WRITEUP.md` for what was built, what was deliberately left out, and why.
