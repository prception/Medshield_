/* ==========================================================================
   MedShield — services.js
   Entrance choreography for section 04, "What we do".

   The section is exactly 100vh and everything happens inside it, in two acts
   on one timeline, released when the section actually reaches the screen:

     ACT 1  the wordmark   WHAT (outline) -> WE -> DO rise out of their masks,
                           140ms apart, then the lede fades in
     ACT 2  the cards      four glass panes swing in from the right, 130ms
                           apart, each followed by a highlight sweeping across
                           its face once it has landed

   The wordmark is the anchor: act 2 does not begin until the first word has
   fully arrived, so the reader's eye is on the type before anything moves in
   from the edge.

   ---------------------------------------------------------------------------
   DESIGN NOTES

   1. CSS owns the resting layout, JS owns only the departure from it.
      Words animate to translateY(0) and cards to x:0 — that is, to the layout
      the stylesheet already computed. The hidden start states live behind the
      .services--live class, which this file adds only once it knows it can
      animate out of them. A missing or failed script therefore leaves a
      complete, fully visible static section. Same contract as doubts.js.

   2. The cards arrive on an ARC, not a straight slide. Each starts with
      rotationY and a slight skew so the pane appears to swing round to face
      the reader as it lands. A pure x-translation on a translucent panel reads
      as a sliding rectangle; the rotation is what sells it as a sheet of
      glass. transformPerspective is set per element, so no ancestor needs a
      perspective of its own — which matters because an ancestor perspective
      would have created a containing block and broken the 100vh grid.

   3. Travel distance is MEASURED, not hard-coded, from each card's own box to
      the right edge of the window. The far-left card therefore travels furthest
      and the rightmost least, which is what makes the four read as one sheet
      of glass panes fanning in rather than four equal slides.

   4. The sheen is chained AFTER its card lands, never concurrent with it.
      Sweeping a highlight across a pane that is still rotating reads as a
      glitch; the sweep only makes sense on a surface that has come to rest.

   5. Nothing here is scrubbed. The section is a fixed 100vh with no pin, so a
      scrubbed timeline would have only ~1 viewport of scroll to play through
      and would feel abrupt at any speed. It plays once, on its own clock, at
      the pace the easing dictates — which is what keeps it cinematic.

   6. The release is NOT a ScrollTrigger start position. This section is the
      cover for the pinned composition above it, which pulls it up by a
      negative margin — so its document position is a viewport earlier than
      its visual arrival, and any position-based start fires while it is still
      off screen. See the long note at the watcher below.

   Depends on: gsap.min.js (js/vendor/). ScrollTrigger is not used to start
   this animation (note 6) but IS required for the resize refresh, and is
   loaded before this file. Bails out cleanly if either is missing.
   ========================================================================== */

(function () {
  'use strict';

  var section = document.querySelector('.services');
  if (!section) return;

  // No GSAP -> leave the static section alone. .services--live is never added,
  // so none of the hidden start states in the stylesheet apply.
  if (!window.gsap || !window.ScrollTrigger) return;

  var words    = Array.prototype.slice.call(section.querySelectorAll('.services__wInner'));
  var cards    = Array.prototype.slice.call(section.querySelectorAll('.service'));
  var lede     = section.querySelector('.services__lede');
  var cta      = section.querySelector('.services__cta');
  var wordmark = section.querySelector('.services__wordmark');
  if (!words.length || !cards.length) return;

  gsap.registerPlugin(ScrollTrigger);

  // Hand the hidden start states to CSS now that we know we can animate out of
  // them.
  section.classList.add('services--live');

  // Reduced motion: the class above is enough — the stylesheet's
  // prefers-reduced-motion block restores every resting state. Nothing to
  // animate, nothing to clean up.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* The words' off-stage start state is set in ACT 1 below, per word, because
     each starts at a different xPercent. Nothing to set here. */

  /* Distance a card must start beyond the right edge of the window, measured
     from its own box. +64px clears the pane's drop shadow so nothing is
     visible parked off-stage. */
  function offsetFor(card) {
    var box = card.getBoundingClientRect();
    return (window.innerWidth - box.left) + 64;
  }

  /* WHY THIS IS NOT A PLAIN start: 'top 68%'.

     The section above (.doubts) pins its stage with pinType:'fixed' and holds
     it for an extra viewport while THIS section is pulled up over it like a
     card dealt on top. doubts.js does that by writing a negative
     margin-top of -100vh onto its nextElementSibling — which is this section —
     and tags it .doubts-cover.

     That margin moves the section's document position a full viewport EARLIER
     than where it visually arrives. A position-based start therefore fires
     while the section is still behind the pinned stage, and the whole
     choreography plays out unseen: you scroll in and everything is already in
     its final state. That is the bug this replaces.

     So the trigger watches the section's REAL on-screen position instead —
     its top edge measured against the viewport, which is correct whether or
     not something upstream has pulled it up. Nothing here depends on the
     overlap's size, so retuning OVERLAP_VH in doubts.js cannot desynchronise
     it, and it behaves identically if the cover mechanism is ever removed. */
  var tl = gsap.timeline({ paused: true });

  /* Releases the timeline once the section's top edge has risen to 62% of the
     viewport — i.e. it genuinely covers the lower third of the screen and the
     reader is looking at it.

     On GSAP's ticker rather than a scroll listener: the cover is moved by the
     pinned composition's transform, and the frame it arrives on does not
     reliably emit a scroll event. The ticker sees every frame, so the start is
     exact. It measures one rect per frame only until it fires once, then
     detaches itself — nothing is left measuring for the life of the page.
     Running it immediately also covers the already-in-view cases: a deep link
     to #services, or a reload mid-page. */
  function watch() {
    if (section.getBoundingClientRect().top <= window.innerHeight * 0.62) {
      gsap.ticker.remove(watch);
      tl.play();
    }
  }
  gsap.ticker.add(watch);

  /* ---- ACT 1: the wordmark --------------------------------------------- */

  /* HORIZONTAL, SCROLL-SCRUBBED — matching the reference exactly.

     The reference does NOT mask the words upward (which is what this file did
     before). Each word starts pushed to the RIGHT by a different amount and
     slides left to its resting place, scrubbed against scroll position rather
     than played on a clock. Its own values, from the minified bundle:

       gsap.set(c[0], { xPercent: 120 })   // What — furthest out
       gsap.set(c[1], { xPercent:  20 })   // We   — barely offset
       gsap.set(c[2], { xPercent:  60 })   // DO   — mid
       ... gsap.to(e, { xPercent: 0, duration: 2, ease: 'power2.out',
                        scrubbed, scrub: 0.3 (0.6 for DO) })

     GRADED, but gently — see the values below. The reference's 6:1 spread
     between its extremes pulls its words right apart mid-slide; the interlock
     here (the em-based left offsets, the z-order, WHAT's opaque fill sitting
     over WE) is a designed composition, so the spread is kept narrow enough
     that the lockup stays readable as one mark the whole way in.

     Scrubbed, so the words track the scrollbar and reverse when the reader
     scrolls back up. This is why the wordmark is no longer on the paused
     timeline the cards use. */

  /* GRADED, but far more gently than the reference.

     WHAT starts furthest out and WE/DO only slightly behind it, so there IS
     visible parallax — the outline arrives last and settles onto the two solid
     words — without the composition coming apart the way the reference's own
     120/20/60 spread does. The reference's ratio between its extremes is 6:1;
     this is 1.35:1, so the words stay recognisably one lockup for the whole
     slide and only the final centimetre of travel differs between them.

     ABSOLUTE PIXELS, not xPercent. xPercent is a percentage of each element's
     OWN width, and the words are nothing like the same width — at desktop size
     WHAT is ~790px against ~360px for WE and DO. Equal xPercent values would
     therefore still produce wildly unequal travel (~950px vs ~425px), so the
     grading has to be expressed in shared pixels to be the grading actually
     intended rather than a side effect of glyph counts.

     Distances are a multiple of the wordmark's measured width, so the travel
     scales with the composition rather than being a magic number, and it is
     re-measured on resize below. */
  var TRAVEL = {
    what: 1.15,   /* furthest — clears its own width, arrives last */
    we:   0.85,
    do_:  0.85
  };

  /* WHAT gets the slower scrub as well, so its later arrival is a lag and not
     just a longer distance covered at the same rate. 0.45 against 0.3 is a mild
     version of the reference's 0.6/0.3 split. */
  var SCRUB = { what: 0.45, we: 0.3, do_: 0.3 };

  /* DOM order is WHAT, WE, DO. */
  var KEYS = ['what', 'we', 'do_'];

  function wordmarkWidth() {
    var box = wordmark ? wordmark.getBoundingClientRect() : null;
    return box && box.width ? box.width : window.innerWidth;
  }

  var baseW = wordmarkWidth();
  var wordTweens = [];

  words.forEach(function (word, i) {
    var key = KEYS[i] || 'we';

    /* fromTo with a FUNCTION-BASED start value. The function is what makes the
       resize handler's invalidate() work: on invalidate GSAP re-runs it and
       picks up the freshly measured baseW. A literal number, or a separate
       gsap.set(), would be baked in at creation and invalidate() would restore
       the stale distance instead. */
    wordTweens.push(gsap.fromTo(word,
      { x: function () { return baseW * TRAVEL[key]; } },
      {
        x: 0,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: section,
          /* The reference triggers on each word ("top bottom" -> "bottom top").
             Here the trigger is the SECTION, because this section is the cover
             for the pinned composition above it and is pulled up by a negative
             margin — a per-word trigger would measure the shifted position and
             resolve before the words are on screen. Same reason the cards use a
             rect watcher rather than a start position. */
          start: 'top bottom',
          end: 'bottom top',
          scrub: SCRUB[key]
        }
      }
    ));
  });

  if (lede) {
    tl.fromTo(lede,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' },
      0.5
    );
  }

  /* The CTA follows the lede by a beat, so the eye reads the sentence and then
     is handed the exit — rather than both arriving as one block. fromTo, like
     the lede, so there is no hidden start state left behind if GSAP is absent
     or the timeline never resolves. */
  if (cta) {
    tl.fromTo(cta,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' },
      0.68
    );
  }

  /* ---- ACT 2: the glass cards ------------------------------------------ */

  cards.forEach(function (card, i) {
    var sheen = card.querySelector('.service__sheen');
    /* 0.62 puts the first card in motion while the wordmark is still settling,
       so the two acts overlap rather than queue — that overlap is what removes
       the dead beat between them. */
    var at = 0.62 + i * 0.13;

    tl.fromTo(card,
      {
        opacity: 0,
        x: offsetFor(card),
        rotationY: -16,
        skewY: 2.5,
        scale: 0.95,
        transformPerspective: 900,
        transformOrigin: '50% 50%'
      },
      {
        opacity: 1,
        x: 0,
        rotationY: 0,
        skewY: 0,
        scale: 1,
        duration: 1.2,
        ease: 'power3.out',
        /* Clearing the transform on arrival drops the compositor layer. Left
           in place, four cards each carrying two large gradient layers stay
           promoted and get re-composited on every subsequent scroll frame — a
           real jank source on this page, which scroll-scrubs the section
           above. */
        clearProps: 'transform,transformPerspective'
      },
      at
    );

    if (sheen) {
      tl.fromTo(sheen,
        { opacity: 1, x: '-140%' },
        {
          x: '250%',
          duration: 1,
          ease: 'power2.inOut',
          onComplete: function () { gsap.set(sheen, { opacity: 0 }); }
        },
        at + 0.8
      );
    }
  });

  /* The grid drops to 2-up at 900px and 1-up at 560px, and the section releases
     its fixed height there, so every measured offset and the trigger's own
     start position change.

     The words need more than a ScrollTrigger refresh. Their travel is an
     absolute pixel distance derived from the wordmark's width, and --wm is
     viewport-driven — so a resize invalidates it. invalidate() makes each tween
     re-run its function-based start value on the next tick, and re-measuring
     baseW first is what that re-run picks up. Without this the words would keep
     using the width measured at load: too short after widening (they start on
     screen) or too long after narrowing (they never fully arrive).

     The cards need nothing equivalent: once their timeline has played they sit
     at x:0 and their stale start offsets are never read again. */
  var resizeId;
  window.addEventListener('resize', function () {
    clearTimeout(resizeId);
    resizeId = setTimeout(function () {
      baseW = wordmarkWidth();
      wordTweens.forEach(function (t) { t.invalidate(); });
      ScrollTrigger.refresh();
    }, 150);
  });
}());
