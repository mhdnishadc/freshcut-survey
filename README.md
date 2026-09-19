# FreshCut Survey

A mobile-first survey app for a fresh-cut vegetable business, plus a dashboard that
turns the answers into decisions.

**The business:** hotels and restaurants buy whole vegetables and burn staff hours
peeling, cutting and washing them. We want to sell them fresh-cut, washed,
ready-to-cook vegetables instead. **Phase 1 is finding out whether that is a real
business** — so field staff visit nearby hotels, interview the chef or purchase
manager, and record the answers here.

The dashboard then answers the questions that decide whether to build the operation:

- How many kilograms a day do these kitchens actually get through? (our order volume)
- How much labour and wage cost would we be displacing?
- Which vegetables and which cuts? (our SKU list and processing line)
- How much premium over raw market price will they pay? (our margin)
- What delivery window do they need? (our production shift)
- Who is ready to order right now? (the call sheet)

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| App | Next.js 16 (App Router), TypeScript, Tailwind v4 | One deployable for form + dashboard |
| Database | Supabase Postgres | Real SQL, a table editor to eyeball raw rows, free tier |
| Auth | Supabase Auth, email + password | No SMTP needed, so no email rate limits |
| Hosting | Vercel | Free, zero-config for Next.js |

Running cost for phase 1: **₹0**.

No chart library, no component library, no ORM. The charts are server-rendered
HTML and one inline SVG, so nothing heavy ships to a field phone.

---

## Setup

### 1. Supabase (about 5 minutes)

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**, paste all of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), Run.
3. **Authentication → Users → Add user** — create one account per team member
   (email + password, tick "Auto Confirm User"). There is no public sign-up: this
   app is for your team only.
4. **Project Settings → API** — copy the Project URL and the `anon` `public` key.

> Never put the `service_role` key in this app. It bypasses Row Level Security.
> The two keys above are public by design and safe in the browser bundle.

### 2. Run it locally

```bash
npm install
cp .env.local.example .env.local   # then paste your URL and anon key into it
npm run dev
```

Open http://localhost:3000 and sign in with the account you created.

### 3. Deploy to Vercel

1. Push this repo to GitHub (see below).
2. [vercel.com/new](https://vercel.com/new) → import the repo.
3. Add the two environment variables from `.env.local`.
4. Deploy. Send the URL to your field team and have them sign in once — the
   session lasts for weeks, so they will not have to log in at each hotel.

### 4. Push to GitHub

```bash
git remote add origin https://github.com/<you>/freshcut-survey.git
git branch -M main
git push -u origin main
```

---

## Changing the questionnaire

**Edit one file: [`lib/survey/questions.ts`](lib/survey/questions.ts).**

That file is the single source of truth. The form fields, the validation rules,
the review screen, the CSV columns and the dashboard charts are all generated
from it. No database migration is needed — answers live in a JSONB column keyed
by question id.

```ts
{
  id: "veg_kg_per_day",        // storage key — never change it once interviews exist
  label: "Vegetables used per day (approx.)",
  type: "number",              // short_text | long_text | number | single_select
                               // | multi_select | yes_no | rating
  required: true,
  unit: "kg",
  min: 0, max: 5000,
  decimal: true,
  help: "Shown under the label — tell the interviewer how to ask.",
}
```

Conditional questions use `showIf`, so a follow-up only appears when it is
relevant and is not enforced while hidden:

```ts
{ id: "price_premium", /* … */ showIf: { questionId: "would_buy_precut", in: ["yes", "maybe"] } }
```

Two rules:

- **Never change or reuse an `id`** once interviews exist — it orphans the stored
  answers. Add a new question instead.
- **Bump `QUESTIONNAIRE_VERSION`** when you change questions. Each response records
  the version it was answered against, and in-progress drafts from an older
  version are discarded rather than half-restored.

Ids listed in `HOTEL_FIELD_BY_QUESTION_ID` are written to real columns on `hotels`
instead of the JSON blob. The handful of ids in `KEY_QUESTIONS` drive the headline
KPIs — if you rename one of those, TypeScript will tell you.

---

## How it is built

```
app/
  login/                  email + password sign-in
  survey/                 the form  +  actions.ts (the submit Server Action)
  dashboard/              overview · hotels · hotels/[id] · leads
  auth/signout/           POST-only sign out
components/
  survey/                 stepper form + the question renderer
  dashboard/              charts, trend, hotel table
  ui/                     Button, Input, Card, Badge — hand-rolled
lib/
  survey/questions.ts     ← THE QUESTIONNAIRE
  survey/schema.ts        validation generated from the config
  survey/draft.ts         localStorage autosave + offline retry queue
  analytics/aggregate.ts  config-driven summarising
  supabase/               browser and server clients
proxy.ts                  session refresh + route guard (Next 16 renamed middleware → proxy)
supabase/migrations/      the schema
```

### Decisions worth knowing

**Login is required for the survey too, not just the dashboard.** Only your own
staff use it, so a public link would invite junk rows and expose the question set.
Sessions persist for weeks, and the interviewer's identity comes free from
`auth.uid()` instead of being typed at every hotel.

**Answers are JSONB keyed by question id; hotel identity is typed columns.** That
split is what makes the questionnaire swappable while keeping name, phone and
locality fast to search and filter.

**Two tables, not one.** `hotels` is the durable business entity, `survey_responses`
are interviews attached to it. Re-interviewing a hotel updates the same hotel row
(matched on name + locality) and adds a second response, so contact details never
fork.

**Drafts survive everything.** Every keystroke autosaves to `localStorage`. A submit
that fails goes into a retry queue and flushes when the phone reconnects. An
interview is never lost to a dropped connection or a dead battery.

**No `service_role` key anywhere.** All access runs through the signed-in user's own
session with Row Level Security enforcing it. The `anon` role is granted nothing —
an anonymous visitor cannot read a single hotel name or phone number.

**Every chart is single-series in one hue.** Magnitude is carried by bar length, not
by colour identity, so there is no categorical palette to get colour-vision wrong.
The green ordinal ramp in `app/globals.css` was validated for both light and dark
surfaces (monotone lightness, adjacent ΔL ≥ 0.06, light end ≥ 2:1 contrast).

---

## Checks

```bash
npx tsc --noEmit    # types
npm run lint        # eslint (next build no longer lints in Next 16)
npm run build       # production build
```
