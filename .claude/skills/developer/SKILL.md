---
name: developer
description: How to write code in the VrijeBaan repo (Dutch padel-availability + KNLTB-opstelling Next.js app). Use this for ANY implementation work here — new features, new scrapers/integrations, API routes, UI changes, refactors, or fixing bugs. Covers this repo's non-standard Next.js version, Dutch-language convention, the "radically honest, dated" documentation style used throughout PROJECTPLAN.md/API_REQUIREMENTS.md, and the established scraper/polling architecture. Trigger even when the user just says "bouw X" or "fix Y" without naming the skill.
---

# VrijeBaan — developer conventions

Solo-developer project. These conventions exist because this codebase leans
hard on precise, dated, verified documentation instead of assumptions — the
third-party integrations it depends on (Playtomic, KNLTB, Foys,
Baanreserveren) change or break without notice, so the docs are the only
record of what's actually been checked. Breaking that discipline is the
single easiest way to leave the next session (human or Claude) chasing a
bug that's actually just stale docs.

## Before touching any Next.js API

This is **not** the Next.js you know — [AGENTS.md](../../../AGENTS.md) flags
breaking changes vs. what you were trained on. Before writing anything that
touches routing, server components, API routes, or config, check
`node_modules/next/dist/docs/` for the relevant guide and heed deprecation
notices. Don't pattern-match from memory of "normal" Next.js.

## Language convention

UI text, code comments/docstrings, and identifier names (variables,
functions, types) are **Dutch** throughout — `naam`, `spelers`,
`speelsterkte`, `bewaarTeam`, `zoekOp`, `Opstelling`, `Beschikbaarheid`.
Match this even for new files. English is fine only for things that are
inherently English (npm script names, library APIs, HTTP methods).

## The documentation discipline (read this before writing any integration code)

Every scraper/integration module carries a docstring that states plainly
what is confirmed, what isn't, and **the date it was verified** — see
[`src/lib/scrapers/playtomic.ts`](../../../src/lib/scrapers/playtomic.ts)
for the canonical example: it originally documented a working endpoint,
then was updated in place with a dated correction explaining exactly what
broke and how that was confirmed (not guessed).

Apply the same standard to your own work:
- Never write "this works" or "this is confirmed" unless you (or a cited
  prior session) actually observed it working — live request, live page
  render, a passing test against real data. If you can't verify something
  in your current environment (e.g. no Playwright browser binary, no
  Supabase credentials), say so explicitly instead of asserting success.
- When you finish a unit of work, add a dated note to
  [PROJECTPLAN.md](../../../PROJECTPLAN.md) or
  [API_REQUIREMENTS.md](../../../API_REQUIREMENTS.md) in the existing
  terse, evidence-citing style, e.g. `**Bevestigd (29 juli 2026)**: ...`.
  Correct stale claims in place (strike through / update) rather than
  leaving contradicting statements for a future reader to reconcile.
- If something that used to work now fails, don't just fix silently —
  update the docstring/doc with what changed and how you know.

## Scraper / integration architecture

Third-party booking systems here are fragile and inconsistent (see
[API_REQUIREMENTS.md](../../../API_REQUIREMENTS.md)) — some have a public
JSON endpoint (Foys), one had one that stopped working (Playtomic), one
requires a full headless browser because there's no stable API (KNLTB Meet
& Play, on Laravel Livewire). Pick the right pattern per system, don't
default to a bare `fetch`:

1. **Public JSON endpoint available** → a thin client function in
   `src/lib/scrapers/<name>.ts` (see `foys.ts`).
2. **No stable API, or a JS-rendered page** → a Playwright script in
   `scripts/scrape-<name>.ts`, following
   [`scripts/scrape-meetandplay.ts`](../../../scripts/scrape-meetandplay.ts)
   as the reference: handle cookie-consent banners, wait on the actual
   network response/DOM update rather than a fixed sleep, and use
   `page.evaluate()` to call into non-standard JS widgets directly (e.g. a
   Livewire/Pikaday component) instead of fighting a popup UI.
**Two traps this repo has already paid for — don't rediscover them:**

- **`page.evaluate()` with a TypeScript callback breaks under `tsx`.** esbuild
  injects a `__name` helper into nested functions, which doesn't exist in the
  page context → `ReferenceError: __name is not defined`. Pass the evaluate
  body as a **string** instead (a string isn't transformed). See the
  `LEES_SLOTEN_JS` constant in `scripts/scrape-playtomic.ts`.
- **A `200` with an empty body is not proof of "nothing available".** The Foys
  API answered `200 []` for weeks purely because two headers
  (`x-organisationid`, `x-federationid`) were missing — no error code, so it
  read as "no slots". When a bare fetch disagrees with what the browser shows,
  intercept the real traffic (Playwright `page.on("response")`) and copy what
  the frontend actually sends, rather than guessing at headers.

3. Whichever pattern you use, the app-facing interface lives in
   `src/lib/scrapers/<name>.ts` and is what `scripts/poll-availability.ts`
   and the UI import — it should read from stored/polled data, not scrape
   live inside a Next.js request (too slow, needs a browser binary the
   request runtime doesn't have).
4. Register new sources in `src/lib/pollConfig.ts`'s `POLL_CONFIG`. A club
   commented out there (not deleted) with a reason is intentional — it
   means the integration isn't safe/ready to poll yet, not an oversight.

## Sensitive data

Never persist third-party credentials (e.g. a user's MijnKNLTB password).
If a flow needs one, use it once to authenticate/scrape, then discard —
see [PROJECTPLAN.md §10.2](../../../PROJECTPLAN.md) for the reasoning and
the ToS/legal-risk considerations that go with it. This applies to any new
login-based integration, not just the ones already documented.

## Day-to-day commands

```bash
npm run dev            # dev server
npm test               # vitest, src/lib/__tests__/*.test.ts
npm run lint
npx tsx scripts/scrape-<name>.ts <args>   # run a scraper standalone
```

Use the [tester](../tester/SKILL.md) skill once a change is ready to verify.
