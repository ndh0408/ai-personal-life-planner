# LifeOS AI — UX Principles

These are not suggestions. They are the rules every screen, modal, and copy
string in this app must pass before merge. If a design violates one of them,
the design changes — not the rule.

## 1. Use first, configure later

The first 60 seconds belong to **value**, not setup. Onboarding asks for the
absolute minimum to make Quick Capture work — email, password, OpenAI key.
Currency, week-start, theme, language refinements all happen *inside* the
working app via inline nudges, not a setup wizard.

## 2. Quick Capture first

The fastest path to recording anything is one input box and one tap.
Categorical screens (Tasks, Expenses, Meals…) exist for browsing and editing,
not for primary capture. If a flow requires the user to "first navigate to
Expenses, then tap +", the flow is wrong.

## 3. Smart defaults

Every input field has a guess that is right ≥ 80% of the time:

- Date → today.
- Time → now, rounded to the nearest 15 minutes.
- Currency → VND.
- Locale → device locale (vi if vi-VN, en otherwise).
- Mood/sleep window → "last night".
- Task priority → "normal".

Wrong guesses must be cheap to override (one chip tap), not the price of admission.

## 4. Progressive disclosure

The default surface for any modal shows only what 80% of users need. "More
options" is a single button or swipe-down that reveals the long tail. Never
display 12 fields up front because 1 user in 50 might want one of them.

## 5. Advanced settings are hidden

Settings has two pages: **Account / Preferences** (visible) and **Developer**
(hidden behind seven taps on the version number, like Android). Things that
live in Developer:
- Raw token expiry,
- API base URL override,
- Force model selector,
- Local cache wipe.

A normal user never sees these and cannot accidentally break the app.

## 6. As few inputs as possible

If a screen can work with N fields, it ships with N. Adding the (N+1)-th
requires a signed-off product reason. Specifically:

- No required `description` / `notes` field anywhere.
- No required `category` before AI parses.
- No `tags` in MVP.
- Email / password are the *only* required fields in onboarding besides the API
  key.

## 7. Beautiful, professional surface

Every screen meets these visual baselines (full system in
[MOBILE_DESIGN_SYSTEM.md](./MOBILE_DESIGN_SYSTEM.md)):

- Type pairing: editorial display + clean sans body. No system default San
  Francisco / Roboto.
- Colour: warm dark base, single accent (sienna `#C97B4A`). No neon. No three-colour
  gradients.
- Spacing: 8-pt grid; vertical rhythm follows a 1.25 modular scale.
- Motion: 200–280 ms ease-out for entry, 160 ms ease-in for exit. No bounce.
- Empty states: a sentence + an action, not a sad illustration.
- Loading: skeleton frames matching the final layout, never a blank spinner over
  the whole screen.

## 8. Works for real, end-to-end

A screen is not "done" because it renders. It is done when:

- It can be reached from cold start in ≤ 3 taps.
- Every action mutates the real database (or fails with a clear error).
- It survives reload (offline cache + server hydration).
- The visible state matches the server state within 1 round trip.

**Fake success** — an animation that says "Saved!" while the network call
silently failed — is forbidden. Surface real errors, retry inline.

## 9. Mobile never calls OpenAI directly

Even though Expo can do `fetch()` to api.openai.com, we never do. The reasons:

- The OpenAI key would have to leave secure storage to be used.
- We can't rate-limit, can't audit, can't cancel from the server.
- We lose the ability to substitute providers later without an app update.

Every model call goes through `apps/api`.

## 10. Backend encrypts the user's API key

Plaintext API keys never touch the database, the filesystem, or any log.
On `POST /api/ai/credentials`:

- AES-256-GCM with per-row IV.
- `ENCRYPTION_KEY` is a 32-byte secret in the API env, never in the repo.
- The decrypted value lives in a single function scope for the duration of
  one OpenAI call, then is dereferenced.
- The key is **never** echoed back to the client. The only "read" endpoint
  returns `hasKey: true|false` and timestamps, nothing else.

---

## Anti-patterns (instant rejection in PR review)

- A screen that opens with an empty 8-field form.
- A button labelled "Submit" or "Save" without context.
- An error toast saying "Something went wrong".
- A success toast for an operation that didn't actually succeed.
- An onboarding step that can be skipped but breaks the next screen.
- Lorem ipsum, "TODO", or `// FIXME` shipped to the user.
- A loading spinner that lasts > 800 ms with no skeleton.
- Settings that don't take effect until app restart.
- A modal that asks the user to pick a `provider` or a `model`.
