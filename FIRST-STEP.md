# First Step — Step 1 of the build

Read `BRIEF.md` and `CONTENT.md` first. This file defines **only** what to
build in the first pass. Do not build ahead of it.

---

## Why this order

The previous site failed because it was beautiful and could not be replied to —
21,886 px of scroll, 261 words, zero forms, and 18 CTAs pointing at sections
that did not exist. So we build in the order that makes the page *work*, not
the order the sections appear.

Step 1 delivers a page that a real prospect could land on and respond to.
Everything after that widens the argument.

---

## Scope of Step 1

Build **three sections only**, in one static HTML file:

1. **Hero** (section 01)
2. **Proof strip** (section 02)
3. **Contact + form** (section 11)

Plus: header, footer, metadata, and the stylesheet that all later sections will
inherit.

**Do not build** sections 03–10 yet. Leave the anchors in the nav pointing at
`#services`, `#process`, `#case-studies` etc. only if those ids exist —
otherwise omit those nav items for now. **A dead link is the exact failure we
are correcting; do not reintroduce it.**

---

## Files to create

```
index.html          the page
css/style.css       all styling, hand-written, no framework
assets/             images (hero poster, logo)
README.md           what's built, what's next, what's blocked
```

No build step. No npm. No CDN. It should open correctly from `file://`.

---

## Technical requirements

- **No JavaScript libraries.** The only JS permitted in Step 1 is a small
  inline script for form validation and the success state.
- Semantic HTML: `<header>`, `<main>`, `<section>`, `<footer>`, one `<h1>`.
- CSS custom properties for the palette and type scale, defined once at
  `:root` — later sections will reuse them, so name them well.
- Mobile-first. Test at **390px** and **1440px** minimum.
- Real `<title>`, meta description, and Open Graph tags (see `CONTENT.md`).
- Visible `:focus` states on every interactive element.
- No horizontal page scroll at any width.

---

## Design direction

Clinical, calm, credible — not a startup landing page and not a brochure.

- **Ground:** white or a very slightly warm off-white. Deep maritime navy for
  dark blocks.
- **Accent:** one only. Restrained. Used for CTAs and figures, not decoration.
- **Type:** a strong, condensed or grotesque display face for headings; a
  highly legible humanist sans for body. Body text at ~65 characters per line.
- **Numbers get room.** The proof strip figures are the most persuasive thing
  on the page in Step 1 — set them large, with tabular figures.
- Generous whitespace, clear hierarchy, no decorative flourish that costs
  legibility.

Remember the reader: a 55-year-old superintendent, on a phone, between
meetings, sceptical.

---

## Section detail

### Hero

Copy is in `CONTENT.md` § 01. Full-width, roughly one viewport but **not
locked** to `100vh` — let it size to its content so nothing is ever cut off.

- Background: a still maritime image (sea/vessel), darkened enough that white
  text passes contrast. **No video in Step 1.**
- H1 must be real text in the DOM, not spans, not an image.
- Two buttons: primary `Request a proposal` → `#contact`; secondary
  `See how a case runs` → omit for now, or point to `#contact` too, since
  `#process` does not exist yet. Do not link to a missing id.

### Proof strip

Copy is in `CONTENT.md` § 02. Six figures, immediately below the hero.

- Horizontal strip on desktop; 2×3 or 3×2 grid on tablet; stacked or 2-column
  on mobile.
- **Static text.** No count-up animation — it delays the one thing the section
  exists to deliver.
- Figure large, label small and uppercase with letter-spacing.
- Include the supporting line about 80% medical professionals.

### Contact + form

Copy, fields and behaviour are in `CONTENT.md` § 11. **This is the most
important part of Step 1.**

- All seven fields, labels above inputs, correct `<label for>` associations.
- Client-side validation with messages that name the fix.
- Success state replaces the form in place — no redirect, no alert box.
- No backend yet: on submit, prevent default and show the success state.
  Leave a clearly commented `// TODO: wire to endpoint` where the POST goes.
- The emergency block sits beside or above the form, visually distinct.
  Use `[CONFIRM]` visibly where the phone number belongs — **do not invent a
  number, and do not reuse `+91 44 4000 0000` from the old site.**

### Header & footer

- Header: logo left, minimal nav right, `Request a proposal` button. Nav links
  only to ids that exist.
- Footer: as described at the end of `CONTENT.md`, with `[CONFIRM]` markers on
  the email and phone.

---

## Definition of done for Step 1

Before reporting complete, verify:

- [ ] Page opens from `file://` with no console errors
- [ ] No horizontal scroll at 390px, 768px, 1440px
- [ ] Every `href="#..."` resolves to an element that exists
- [ ] `<h1>` present, exactly one, real text
- [ ] Title, meta description and OG tags present
- [ ] Form validates, shows errors that name the fix, and shows the success
      state in place
- [ ] All `[CONFIRM]` items are visibly marked, not filled with guesses
- [ ] Keyboard: every control reachable and focus is visible
- [ ] Total page weight under 1 MB

Then write `README.md` listing: what is built, what is next (sections 03–10),
and the four `[CONFIRM]` blockers from `BRIEF.md` § 7.

**Report honestly.** If something is not done, say so plainly rather than
marking it complete.
