# MedShield — website build

Static site. No build step, no framework, no CDN, no npm. Open `index.html`
directly (it works from `file://`) or serve the folder with any static server.

```
index.html          the page — all 11 sections
css/style.css       all styling, hand-written
assets/             logo derivatives, OG card, process artwork
README.md           this file
```

---

## Status: all 11 sections built

| # | Section | id | Status |
|---|---|---|---|
| 01 | Hero | `#top` | Built |
| 02 | Proof strip | `#proof` | Built |
| 03 | Positioning band | — | Built |
| 04 | The problem — six doubts | — | Built |
| 05 | Four services | `#services` | Built |
| 06 | How a case runs — 8 steps | `#process` | Built |
| 07 | Case studies | `#case-studies` | Built — **blocked from publishing** |
| 08 | Why MedShield | — | Built |
| 09 | The people | `#about` | Built |
| 10 | Closing CTA band | — | Built |
| 11 | Contact + form | `#contact` | Built |

Copy is taken verbatim from `CONTENT.md`. No claim, figure, name or
certification appears on the page that is not in that file.

### Against the brief's targets

| | Old site | Target | This build |
|---|---|---|---|
| Desktop scroll | 21,886 px | ~9,000 px | **12,458 px** |
| Word count | 261 | 1,400–1,500 | **1,501** |
| Working CTAs | 0 | all | **22 anchors, 0 dead** |
| Initial payload | 59.6 MB | under 3 MB | **118 KB** |

Desktop scroll is ~38% over the 9,000px target. It is not padding: every
section is at or under its `BRIEF.md` §4 budget except `#process`
(3,342px vs 3,000px), which carries eight illustrated steps. Getting to
9,000px means dropping the process artwork to a 2-column icon grid or cutting
copy — both are content decisions, so they are flagged here rather than taken
unilaterally. Scroll-per-word is 8.3px against the old site's 84px.

**Verified** (Chromium, over `file://`) — 16/16 Definition of Done checks:

- No console errors; no horizontal scroll at 390 / 768 / 1440 px.
- 22 `href="#…"` anchors, **0 dead**. Every nav and footer link resolves.
- Exactly one `<h1>`; 48 headings, **none empty** (the old build had 8 of 15
  empty from animated spans).
- Title, meta description, OG and Twitter tags present.
- Form validates, names the fix, and succeeds in place.
- 29 focusable elements, all keyboard-reachable with a visible focus ring.
- All text meets WCAG AA — measured against painted pixels, not assumed.
- Readable with JS disabled (1,475 words render) and with CSS disabled.
- **Initial view 118 KB; full page with all eight process images 609 KB**
  against a 3 MB budget.

---

## Step 2 changes

**Process images re-encoded.** `assets/process/1–8.png` totalled **13.0 MB**
— over 4× the entire page budget. Converted to WebP at 900px wide:
**491 KB total, a 96% reduction**. The PNGs are left in place as masters. The
images are `loading="lazy"`, so the initial view stays at 118 KB. They are
also height-capped (`max-height: 260px`) — at full width they pushed the
process section to 4,570px against a 3,000px budget. The artwork is supporting
evidence; the captions carry the argument.

**Captions are the corrected ones from `CONTENT.md`.** The artwork maps to the
eight steps correctly; only the old site's captions were wrong.

**Three Step 1 issues fixed:**

1. The hero's secondary CTA is now "See how a case runs" → `#process`, which
   exists.
2. `og:image` was `apple-touch-icon.png`, a square icon that crops badly in a
   link preview. Replaced with a generated **1200×630** card
   (`assets/og-card.png`, 52 KB) built from the brand palette and the H1, with
   `og:image:width` / `:height` / `:alt`.
3. No placeholder phone or email remains. Verified by search: no
   `+91 44 4000 0000`, no `care@medshield.in`, and **no `tel:` or `mailto:`
   links anywhere** — the only contact routes on the page are the four
   `[CONFIRM]` markers.

**Nav and footer restored.** Header carries Services / How it works / Case
studies / About + CTA. Footer has three columns including the four service
anchors. Every target verified to exist.

### Decisions worth knowing

**The hero still has no photograph.** Nothing in `assets/` is a usable
maritime still — the two "hero" files are the same AI cutout of an officer
clutching his chest, and `ship-side` / `ship-exterior` are the old build's
porthole and deck plates. The navy gradient stands in; it guarantees contrast
and costs 0 bytes. **One real vessel photograph is the highest-value asset the
client can send.** Layer it beneath the existing gradient stops in `.hero`.

**Section 09 names nine teams, not ten doctors.** The individual bios in the
client folder belong on an inner team page — on the homepage they cost scroll
and date quickly as people move.

**`BRIEF.md` §6 traps avoided.** No third-party corporate names (TATA, Maxis,
Airtel) appear anywhere; the claims advisory copy describes an employer's
duty, never an insurance policy. All bracketed editorial notes from the .docx
files were resolved in `CONTENT.md` and none reached the page.

---

## Blocked — needs the client

All four are marked `[CONFIRM]` in the markup and left visibly blank.
**Do not fill any of these with a plausible guess.**

1. **The 24/7 emergency number and a monitored inbox.** Marked in the contact
   section and footer. The old site's `+91 44 4000 0000` and
   `care@medshield.in` look like placeholders and are deliberately not reused.
   **This is the most damaging gap on the page** — the emergency block
   currently promises a route it cannot give.
2. **Written clearance for the two case studies** (section 07). Already
   anonymised, but clearance and confirmation of the savings figures are
   required before publishing. Marked inline in the section.
3. **Cases managed to date**, and target first-response time. Would strengthen
   the proof strip, which currently runs on six figures.
4. **Commercial model** — retainer per vessel, per crew member, or per case.

Plus, not a `[CONFIRM]` but the biggest visual upgrade available: **one real
maritime photograph** for the hero.

---

## What is next

- **Design pass.** This step prioritised content-complete and structurally
  correct markup, as instructed. Type rhythm, spacing and section transitions
  have not had a dedicated pass.
- **Motion**, only where it earns its place — tasteful entrance reveals
  honouring `prefers-reduced-motion`. No scroll-scrubbing, no pinning.
- **Wire the form.** `// TODO: wire to endpoint` marks the spot in the inline
  script. Nothing leaves the browser today.
- **Decide the scroll-length question** above (process section).
- **Inner pages**: team bios, Privacy Policy, Terms, Careers. All four are
  named in `CONTENT.md` but have no pages, so they are **not linked** — a link
  to a missing page is the same defect as a dead anchor. The footer says
  Privacy and Terms are pending.

---

## Not done

Stated plainly rather than marked complete:

- No hero photograph (reasoned above).
- Desktop scroll is 12,458px vs the ~9,000px target (reasoned above).
- Privacy Policy, Terms of Service and Careers are not linked — no pages exist.
- No backend. The form's success state is real; the submission is not.
- Section 07 is built but **must not be published** without written sign-off.
