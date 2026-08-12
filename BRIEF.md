# MedShield Website — Build Brief

You are building the MedShield homepage from scratch. This file is the full
context. Read it completely before writing any code.

---

## 1. What MedShield is

A **maritime healthcare and claims management company**. B2B. Nearly a decade
operating. HQ Chennai, offices Singapore and UAE.

They do **not** treat patients directly. They manage the entire medical
lifecycle of a crew member's case on behalf of the **employer** — telemedicine,
hospital coordination, claims, legal advisory, budgeting, documentation.

**The single most important distinction:**

> The patient is the seafarer. **The customer is the employer.**

Every word on the site is written for the employer, not the crew member.

### Who buys

| Reader | Age | Measured on | Their real question |
|---|---|---|---|
| Crewing / HR manager | 40–58 | Crew availability, repatriation cost | "If I hand you a case at 3am, what lands on my desk in the morning?" |
| Fleet superintendent / DPA | 45–65 | MLC compliance, incident record | "Have you handled this case, in that port, on a vessel like mine?" |
| Insurance / P&I stakeholder | 40–60 | Annual medical spend, dispute rate | "What does your involvement do to my claims cost?" |

Often ex-seafarers. Sceptical of vendor polish. Reading on a phone or a
locked-down corporate desktop, frequently with a competitor's proposal open
alongside. They skim, then forward.

---

## 2. Why the previous site failed

A previous version was built and audited. It was visually accomplished —
GSAP scroll-scrubbing, pinned sections, a porthole pull-back, an eight-state
process scene — and it failed commercially. Measured from the live DOM:

- **21,886 px of scroll carrying 261 words** (~84px of scroll per word)
- **0 forms, 0 input fields**
- **18 nav/CTA links pointing at sections that did not exist** — every CTA inert
- **59.6 MB hero video**, autoplaying, blocking first paint
- **2 of 16 sampled scroll frames were blank** — empty screens mid-sequence
- **8 of 15 headings returned empty strings** (text split into animated spans)
- No `<title>` beyond one word, no meta description
- Sold telemedicine to seafarers; **3 of 4 actual revenue lines absent**

**The lesson to carry into this build:** the choreography buried the argument.
Do not repeat it. Content and structure first; motion only where it earns
its place, and never at the cost of scroll length or legibility.

### Targets for this build

| | Old | This build |
|---|---|---|
| Desktop scroll | 21,886 px | **~9,000 px** |
| Word count | 261 | **~1,400–1,500** |
| Working CTAs | 0 | **all of them** |
| Initial payload | 59.6 MB video | **under 3 MB** |

---

## 3. Build approach — read this before choosing a stack

**Phase A (do this first): plain, static, content-complete.**

- Semantic HTML + hand-written CSS. **No GSAP, no ScrollTrigger, no Lenis,
  no scroll-scrubbing, no pinned sections.**
- No build step, no framework, no CDN dependencies.
- Every section present, in order, with the real copy from `CONTENT.md`.
- Every link resolves. Every heading is real text in the DOM.
- Responsive via CSS grid/flex. Mobile is a genuine edit, not a squeeze.
- It should be readable with CSS disabled and usable with JS disabled.

Only once the full page exists and reads correctly do we consider motion —
and then only tasteful entrance reveals that respect
`prefers-reduced-motion`. Getting this order wrong is exactly what broke
the last build.

**Design register:** clinical, calm, credible. Maritime navy, white/off-white
ground, one restrained accent. Generous type, strong hierarchy, real numbers
given room. This is a page a 55-year-old superintendent reads on a phone
between meetings — legibility beats atmosphere every time.

---

## 4. Page structure — 11 sections

Full copy for each is in `CONTENT.md`. Order matters and is deliberate.

| # | Section | Job | ~px |
|---|---|---|---|
| 01 | Hero | Name the service and the buyer in 4 seconds | 900 |
| 02 | Proof strip | Prove scale before they decide to keep scrolling | 260 |
| 03 | Positioning band | The three-part promise | 500 |
| 04 | The problem — six doubts | Make them recognise a week they've had | 1,100 |
| 05 | Four services | Answer "what do I buy from you" | 1,700 |
| 06 | How a case runs — 8 steps | Make the model feel already handled | 3,000 |
| 07 | Two case studies | Convert the sceptic with numbers | 1,000 |
| 08 | Why MedShield | The business case to forward internally | 700 |
| 09 | The people | Who makes the clinical call | 800 |
| 10 | Closing CTA band | Convert before the footer | 400 |
| 11 | Contact + form | Capture the lead | 900 |

**Build order is not the same as page order.** See `FIRST-STEP.md` —
start with section 01, 02 and 11, because a page that cannot be replied
to converts nobody.

---

## 5. Non-negotiable rules

1. **Every link resolves.** `#about`, `#services`, `#case-studies`,
   `#contact` must all exist as real ids. The last build had 18 dead links.
2. **Headings are real text.** Never split heading text into animated spans.
   Animate a wrapper if you must animate at all.
3. **Content readable without JS**, with motion reduced, and at any scroll
   position. No copy may ever rest off-screen.
4. **Mobile is a different edit.** No hero video under 860px — poster image
   only. No pinned scrubs, ever.
5. **Weight budget: under 3 MB initial view.** Re-encode any video. WebP for
   photographs.
6. **Never invent proof.** No fabricated statistics, client names,
   certifications or response times. Anything not supplied is marked
   `[CONFIRM]` and left visibly blank — never filled with a plausible guess.
   The audience will check.
7. **Metadata is not optional.** Real `<title>`, meta description, Open Graph
   tags. This audience shares links over WhatsApp and email.

---

## 6. ⚠ Critical warning about the client content files

The client folder contains .docx files with **bracketed editorial instructions
written to the copywriter, mixed inline with the actual content.** These are
notes, not copy. Examples found:

- In the Vijay Anand bio: *"(Pls dont mention specific corporate names, instead
  give a general description like 'Top Corporates')"* — the surrounding
  paragraph names TATA Group, Maxis Telecom and Airtel.
- In Claims Advisory: *"(Its not an insurance policy, so we need to rephrase
  this. As it is more of an employer's duty/obligation/responsibility)"*
- In the Senthil Kumar bio: *"Bring a note about MLC and ILO to profile"*
- In About Us: *"(Lets brings this as point 2)"*, *"Kindly bring in the IT
  team mentioning their 24X7/365 days tech enablement"*

**Never paste any of this to the page.** Doing so would publish named
third-party corporations against explicit client instruction, and describe a
legal duty as an insurance policy. The copy in `CONTENT.md` has already had
every one of these instructions applied and resolved. Use `CONTENT.md` as the
source of truth; treat the raw .docx files as reference only.

---

## 7. What is still missing from the business

Five things. Mark them `[CONFIRM]` in the markup and leave them visibly
incomplete rather than inventing values:

1. **The real 24/7 emergency number and monitored inbox.** The old site
   published `+91 44 4000 0000` and `care@medshield.in`, which appear to be
   placeholders. A number that rings nowhere is worse than no number.
2. **Cases managed to date**, and target first-response time.
3. **Commercial model** — retainer per vessel, per crew member, or per case.
4. **Written clearance** to publish the two case studies (already anonymised,
   but the savings figures need sign-off before going live).
5. **The network size figure.** Client sources contradict each other: the PDF
   says **1,800+ partner hospitals**, a later note says **3,500+ treatment
   providers across India**. Until the client resolves this in writing, ship
   the lower figure (1,800+). Also needs verification: **"ISO 45001 — first and
   only in India"** (keep, but confirm) and **"India's largest maritime
   healthcare network"** (removed from the page pending evidence — likely
   disputed).

Everything else needed is already in `CONTENT.md`.
