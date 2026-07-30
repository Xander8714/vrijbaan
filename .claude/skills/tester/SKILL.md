---
name: tester
description: How to verify changes in the VrijBaan repo (Dutch padel-availability + KNLTB-opstelling app) before claiming they work. Use this after implementing anything here, when the user asks to test/verify/check a change, when a scraper or polling job needs validating against a live site, or when adding unit tests. Encodes what can be verified locally vs. what needs real credentials/network, the vitest conventions in src/lib/__tests__/, the Playwright scraper verification loop, and the honest-reporting rule that an unverifiable step gets reported as unverified rather than assumed working. Trigger on "test dit", "werkt dit?", "controleer", or right after finishing an implementation.
---

# VrijBaan — testing & verification

The point of this skill: in this repo a claim that something "works" is a
piece of documented data (see the `developer` skill's documentation
discipline). So verification isn't a formality at the end — it determines
what you're allowed to write down. An unverified change reported as working
is worse than one reported honestly as untested, because the next session
will build on it.

## Verification ladder — go as far as the environment allows

Work down this list and note where you stopped:

1. **Type-check + lint** — always possible.
   ```bash
   npx tsc --noEmit
   npm run lint
   ```
2. **Unit tests** — always possible, no external services.
   ```bash
   npm test
   ```
3. **Build** — catches Next.js-version-specific breakage that `tsc` misses.
   ```bash
   npm run build
   ```
4. **Dev server / real UI** — needs a port; use the browser tools
   (`preview_start` + the Browser pane) to actually look at the page and
   read the console, not just assume it renders.
   ```bash
   npm run dev
   ```
5. **Scraper against the live site** — needs network access to the target
   plus a Playwright browser binary (`npx playwright install chromium`).
   Often blocked; see below.
6. **Supabase / Stripe / Telegram round-trip** — needs real credentials in
   `.env.local`. If they're absent, the scripts are written to fail with a
   clear message; confirming *that* is not the same as confirming the
   round-trip works.

## Unit tests

Tests live in `src/lib/__tests__/<module>.test.ts` (vitest), mirroring the
module under test — see `lineup.test.ts` and `availabilityDiff.test.ts`.
Pure-logic modules (`lineup.ts`, `availabilityDiff.ts`) are the ones worth
unit-testing; scrapers aren't, because their real failure mode is a changed
third-party page, which a mock can't catch. For a scraper, test the parsing
helper on a captured fixture if anything, and verify the rest live.

## Verifying a scraper live

Run it standalone and read the output — don't infer from the code:

```bash
npx tsx scripts/scrape-<name>.ts <args>
```

Two traps documented from real experience here:

- **An empty `slots` array is often a valid result, not a broken
  selector.** Late in the evening a club genuinely has no bookable slots
  left today. Disambiguate by re-running for *tomorrow* — if that returns
  slots, the scraper works (see API_REQUIREMENTS.md §2).
- **A working page does not imply a working bare `fetch`.** Confirmed twice:
  Foys answered `200 []` to a plain fetch while the page showed slots (cause,
  found 29 juli 2026: the missing `x-organisationid`/`x-federationid`
  headers — a `200` with an empty array is the most misleading failure mode
  there is, because it looks like a real "nothing free"), and Playtomic's old
  endpoint returns CloudFront 403 while `playtomic.com` renders fine. When a
  fetch disagrees with the browser, intercept the browser's own requests
  (`page.on("response")` in Playwright) and copy what it actually sends —
  don't guess headers.
- **A test can encode a false assumption.** The first version of
  `geo.test.ts` asserted Haarlem–Overveen ≈ 1,6 km "because PDOK said so" and
  failed. PDOK measures to the *edge* of a place; our haversine measures
  centre-to-centre (5,79 km). The code was right and the test was wrong — when
  a test fails, check which side actually holds the false belief before
  "fixing" the code.

If the site or a browser binary is unreachable in your environment, say
exactly that. "Scraper geschreven volgens het bestaande patroon, nog niet
live geverifieerd (geen netwerktoegang tot X)" is the correct report.

## Reporting results

State what you ran and what happened, including failures with their actual
output. Then record the outcome in
[PROJECTPLAN.md](../../../PROJECTPLAN.md) /
[API_REQUIREMENTS.md](../../../API_REQUIREMENTS.md) with the date, in the
existing style — both successes (`**Bevestigd (29 juli 2026)**: ...`) and
the parts you couldn't verify and why. Also correct anything there that
your test just disproved; a disproof is as valuable as a confirmation and
this repo has already had to reverse two "it works" claims.

## Manual/user testing

For UX questions rather than correctness, [USER_TESTING.md](../../../USER_TESTING.md)
has the tester protocol (3 tasks, feedback form, "patterns across 3+
testers before fixing"). Point the user there rather than inventing an ad-hoc
script.
