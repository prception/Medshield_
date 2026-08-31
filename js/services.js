/* ==========================================================================
   MedShield — services.js
   Entrance choreography for section 04, "What we do".

   The section is exactly 100vh and everything happens inside it, in two acts
   on one timeline, released when the section actually reaches the screen:

     ACT 1  the wordmark   WHAT (outline) -> WE -> DO rise out of their masks,
                           140ms apart, then the lede fades in
     ACT 2  the cards      four glass panes slide straight in from the right,
                           140ms apart, each followed by a highlight sweeping
                           across its face once it has landed

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

   2. The cards arrive on a STRAIGHT slide — a pure x-translation, no rotation,
      no skew, no scale. Anything that turns the pane as it lands reads as a
      swing rather than as a slide, and this section wants the plainer reading:
      four panes entering from the right edge and stopping.

   3. Travel distance is MEASURED, not hard-coded — but it is measured ONCE,
      from the leftmost card, and shared by all four. Per-card distances meant
      per-card speeds over a shared duration, which is a fan. One distance is
      what makes the row move as parallel straight slides. Measured at render
      time, not at build time, so it is correct after webfonts and layout have
      settled.

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
  /* Distance from the card's resting box to beyond the right edge of the
     window. +64px clears the pane's drop shadow so nothing shows off-stage.

     UNIFORM ACROSS THE FOUR CARDS, and that is the point of the current
     entrance. Measuring each card from ITS OWN left edge gave the far-left
     card a travel roughly four times the rightmost one's; run over the same
     duration that is four different speeds, so the row read as a fan opening
     rather than as four panes sliding straight in. Taking the offset from the
     LEFTMOST card and giving it to all four means every pane covers the same
     distance at the same rate — one straight, parallel slide from the right.

     NOT safe to measure lazily, which is what this note used to claim. The
     card is parked with `visibility` in CSS, but GSAP writes the from-state's
     transform at tween-CREATION time (immediateRender defaults to true on
     fromTo), so by the time a second card is measured the first is already
     displaced and getBoundingClientRect reports it off-stage. Hence the single
     up-front measurement below. */
  /* MEASURED FROM THE UNTRANSFORMED LAYOUT, ONCE, AND CACHED.

     The subtle failure this replaces: gsap.fromTo() defaults to
     immediateRender:TRUE — including inside a paused timeline. (Only plain
     .to() tweens default to false; an earlier comment in this file had that
     backwards.) So the moment card 1's tween is CREATED, GSAP writes its
     from-state and physically displaces card 1 to translateX(~1336px).

     offsetFor() then ran again while building card 2's tween — and it loops
     over every card taking getBoundingClientRect().left to find the leftmost.
     Card 1 was no longer at 168px; it was at 1504px, off-stage. So "leftmost"
     became card 2, and card 2 got a SHORTER travel. Card 2's tween then
     displaced card 2, so card 3 measured shorter still, and so on. Each card
     poisoned the measurement for the next:

         intended   1336  1336  1336  1336   (uniform — the design)
         actual     1336  1057   778   500   (cascade)

     Every card therefore started at exactly viewport+64 — just past the right
     edge — and crossed only its OWN distance to its own resting slot. Card 1
     had to cover 1272px of screen in the same 1.25s that card 4 covered 436px.
     Under power2.out, which spends most of its distance early, card 1 was home
     within the first third of its tween while the others were still visibly
     gliding. That is the "first card is already there" bug: not a timing
     fault, a measurement fault.

     Measuring ONCE up front, before a single tween exists, is what makes the
     travel genuinely uniform. Cached in a closure variable rather than
     recomputed per call so no later render can re-enter the same trap, and
     re-measured explicitly on resize (below) where the layout really has
     changed and nothing is mid-flight. */
  var travel = 0;

  function measureTravel() {
    /* Clear any inline transform first: on a resize the cards may still carry
       the from-state from the initial build, and reading through it would
       reproduce exactly the cascade described above. */
    gsap.set(cards, { x: 0 });

    var left = window.innerWidth;
    cards.forEach(function (c) {
      var l = c.getBoundingClientRect().left;
      if (l < left) left = l;
    });
    travel = (window.innerWidth - left) + 64;
    return travel;
  }

  measureTravel();

  function offsetFor() {
    return travel;
  }

  /* WHY THIS IS NOT A PLAIN start: 'top 68%'.

     .doubts pins its stage with pinType:'fixed' and holds it for an extra
     viewport while the section AFTER IT is pulled up over it like a card
     dealt on top: doubts.js writes a negative margin-top of -100vh onto its
     nextElementSibling and tags it .doubts-cover. That used to be this
     section; after the page reorder it is .about. Either way the reasoning
     below stands unchanged — measuring the real on-screen rect is correct
     whether or not anything upstream has shifted this section's document
     position, which is exactly why it was written that way.

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
  /* SAFETY NET — and note what it is NOT keyed to.

     The cards are parked with visibility:hidden and revealed only by their
     tween, so anything that stops the timeline from ever playing would leave
     the grid permanently blank. That is worth guarding against.

     But it must NOT be a timer started at page load. A reader who takes longer
     than the timeout to scroll this far — which is the normal case, not the
     edge case — would trip it while the section was still legitimately waiting
     off screen. The guard would then strip the parked state and mark every
     card arrived, so when the watcher finally released the timeline the cards
     were already sitting at rest and each fromTo merely blinked them in place.
     That is the "appearing one by one in the same spot" bug.

     So the guard is armed only once the section is genuinely near the viewport
     and therefore SHOULD have fired, and it re-checks that the timeline has
     not started before acting. Until then there is no timer at all. */
  var failsafe = null;

  function armFailsafe() {
    if (failsafe) return;
    failsafe = setTimeout(function () {
      if (tl.progress() > 0 || tl.isActive()) return;
      gsap.ticker.remove(watch);
      section.classList.remove('services--live');
      cards.forEach(function (card) {
        gsap.set(card, { clearProps: 'transform,visibility,willChange' });
        card.classList.add('service--arrived');
      });
    }, 4000);
  }

  tl.eventCallback('onStart', function () {
    clearTimeout(failsafe);
    failsafe = -1;   /* non-null, so armFailsafe can never re-arm it */
  });

  /* WATCHES THE SECTION'S REAL ON-SCREEN POSITION.

     Not a ScrollTrigger start position, and not a scroll listener — the two
     obvious choices are both wrong here for the same underlying reason.

     A start position is wrong because an upstream pin can pull a section up
     over it with margin-top:-100vh, putting the section's document position a
     full viewport earlier than where it visually arrives. Any position-based
     start resolves against the shifted position and fires while the section is
     still off screen — the choreography then plays out unseen and the reader
     scrolls in to find everything at rest. (.doubts does exactly this to
     whatever follows it; that is no longer this section, but the guarantee is
     what matters, not which section currently benefits from it.)

     A scroll listener is wrong because a covering section is moved by the
     pinned stage's transform, and the frame it arrives on does not reliably
     emit a scroll event.

     The ticker sees every frame and measures the section's live rect, which is
     correct whether or not something upstream has pulled it up. Nothing here
     depends on the overlap's size, so retuning OVERLAP_VH in doubts.js cannot
     desynchronise it, and it behaves identically if the cover mechanism is
     removed. One rect per frame, only until it fires once, then it detaches —
     nothing is left measuring for the life of the page. Running immediately
     also covers a deep link to #services or a reload mid-page. */
  function watch() {
    var vh = window.innerHeight;

    /* RELEASE WHEN THE SECTION ARRIVES — which is what the reader perceives
       as "reaching the section", and is the whole requirement.

       This gate has been through two wrong shapes, both worth recording.

       It first watched only the grid's TOP edge (0.55vh). That was fine in
       itself. Then, chasing the "card 1 is already there" bug, it also
       required the row's BOTTOM edge on screen (bottom <= vh - 8). That fixed
       nothing — the real cause was a measurement cascade in offsetFor(), see
       measureTravel() — and it introduced this delay:

           viewport   grid top when     grid top the gate
           height     section flush     actually waited for    late by
             768          212                  422              210px
            1080          232                  688              456px
            1440          239                 1048              809px

       Because the grid sits ~220px below the section's top edge, demanding its
       bottom be on screen means demanding the section scroll several hundred
       pixels PAST flush. The reader arrives, the row sits there, and the cards
       only move once they have scrolled well in. That is the reported lateness.

       With travel now genuinely uniform, the bottom test earns nothing: every
       card starts fully off-stage and crosses the screen at the same rate, so
       there is no card that can finish early and no reason to wait for the row
       to be vertically complete.

       So the gate is back to the section's own top edge, at 0.8 — it fires as
       the section is coming up to fill the screen, slightly BEFORE flush, so
       the first frames of travel play as the reader settles onto the section
       rather than after. Measured on the section rather than the grid because
       the section is the thing whose arrival the reader is registering. */
    var top = section.getBoundingClientRect().top;

    if (top <= vh * 0.8) {
      armFailsafe();
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

  /* ONE scrub value for all three words, and it is deliberate.

     This used to be graded — 0.45 for WHAT against 0.3 for WE/DO, a mild
     version of the reference's 0.6/0.3 split — to make WHAT's later arrival
     read as a lag rather than only as a longer distance. That grading is what
     broke the left edge.

     `scrub: n` is a SMOOTHING lag, not an easing: each word chases the scroll
     position over n seconds. Different values therefore mean the words are
     still catching up at DIFFERENT rates after the scroll stops, so the lockup
     settles in stages and its left edge — WHAT's W, the widest travel and the
     slowest chase — creeps into place last and lands at a different moment
     every time depending on how abruptly the reader stopped scrolling. Flick
     the wheel and it never visibly settles at all.

     The parallax is still there: it comes from TRAVEL above (1.15 against
     0.85), which is a difference in DISTANCE covered over the same scroll
     range. That is the grading actually wanted. With a shared scrub all three
     reach x:0 on the same frame, so the left edge is in the same place every
     time the section is at rest. */
  var SCRUB = { what: 0.3, we: 0.3, do_: 0.3 };

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
          /* 'top top', NOT 'bottom top'.

             This is the other half of the inconsistent-left-edge bug. The
             section is locked to 100vh, so 'bottom top' — the section's bottom
             edge reaching the viewport top — is only reached once the section
             has scrolled ENTIRELY past. The words therefore hit x:0 at the
             exact moment the wordmark leaves the screen, and at every position
             where the section is actually being READ the tween sits around
             half done: all three words parked to the right of where the
             stylesheet puts them, by an amount that changes with every pixel
             of scroll. The lockup never had a resting left edge to be
             consistent about.

             Ending at 'top top' — the section's own top reaching the viewport
             top, which for a 100vh section is exactly when it fills the
             screen — means the travel is spent by the time the reader is
             looking at it, and the words hold at their CSS position for the
             whole time the section is in view. Scrolling back up still
             reverses it, which is the point of scrubbing. */
          end: 'top top',
          scrub: SCRUB[key]
        }
      }
    ));
  });

  if (lede) {
    tl.fromTo(lede,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' },
      0
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
      0.18
    );
  }

  /* ---- ACT 2: the glass cards ------------------------------------------ */

  /* A SHARED LEAD-IN BEFORE THE FIRST CARD MOVES.

     Card 1 used to sit at t=0, so it began travelling on the very frame the
     ticker released the timeline. That frame is the one frame in the whole
     sequence least likely to be settled: it is the frame the cover's transform
     just carried the grid across the release line on, and card 1 is the only
     card exposed to it — cards 2-4 are held back 0.14s, 0.28s and 0.42s and so
     always start from a quiet frame. The asymmetry is why the artefact only
     ever showed on the first card.

     0.12s costs nothing perceptually and puts all four cards on the same
     footing: by the time card 1 moves, the release frame is behind us and the
     row is demonstrably still. The stagger between cards is untouched, so the
     fan reads exactly as before — the whole row simply begins a breath later.

     Kept small deliberately. Anything longer starts to read as a pause between
     the wordmark settling and the cards answering it, which is a different
     piece of choreography from the one this section is composed as. */
  var LEAD_IN = 0.12;

  cards.forEach(function (card, i) {
    var sheen = card.querySelector('.service__sheen');
    /* The first card moves IMMEDIATELY on release, because release is now tied
       to the cards' own arrival on screen (see the watcher above) rather than
       to the section's top edge. The old 0.62 offset existed to let the
       wordmark settle first, but it was measured against a trigger that fired
       roughly half a viewport earlier — kept here it would simply burn 0.62s
       of the slide off-screen again.

       0.14 apart rather than 0.13, so the four-card stagger still reads as a
       fan rather than as one block, and the last card lands ~1.5s in. */
    var at = LEAD_IN + i * 0.14;

    tl.fromTo(card,
      {
        /* Fully opaque from the first frame. Fading a card in WHILE it travels
           makes the slide read as an appearance rather than as movement — the
           pane is already half-arrived by the time it is visible enough to
           track. Opaque, it is a solid object crossing the screen, which is
           what a slide is. It starts off-stage past the right edge, so there
           is nothing to hide it from. */
        opacity: 1,
        /* REVEALED IN THE FROM-STATE, not in onStart, and the difference is
           the whole bug.

           gsap.fromTo() defaults to immediateRender:TRUE, even inside a
           paused timeline — it is only plain .to() tweens that default to
           false. So the from-values land the moment the tween is CREATED, and
           onStart fires much later, on release. Revealing the card in onStart
           therefore left it visibility:hidden for the whole build-to-release
           gap and for the first render of travel; with the easing spending
           most of its distance early, the card became visible only once it was
           essentially home, so each one blinked into its final position
           instead of sliding.

           (That same immediateRender:true is what made the shared travel
           distance measurable only ONCE, up front — see measureTravel().)

           Putting visibility in the from-state makes the reveal and the
           off-stage transform land in the SAME render, so the card is visible
           for the entire journey and nothing is shown at its resting spot. */
        visibility: 'visible',
        /* FUNCTION-BASED, so the distance is measured when the tween actually
           renders rather than when the file runs.

           These tweens are built at script time but the timeline is paused
           until the cards reach 88% of the viewport, which can be a long
           way later — after webfonts swap, after the grid has settled at its
           final width. A value baked in at build time is measured against a
           layout that no longer exists, so the card starts at the wrong offset
           and the first frame jumps to correct it. That jump is the glitch at
           the START of the slide. */
        x: function () { return offsetFor(); }
      },
      {
        x: 0,
        /* Longer and on a gentler curve than the old power3.out. power3 spends
           ~80% of its distance in the first third of the tween, so a card was
           essentially home before the eye could track it and the slide read as
           a pop. power2.out over 1.25s keeps the pane visibly crossing the
           screen for most of its run, which is what makes a straight slide
           legible as a slide. */
        duration: 1.25,
        ease: 'power2.out',
        /* PROMOTED FOR THE DURATION OF THE SLIDE, AND ONLY THAT LONG.

           Each card carries two large gradient pseudo-layers plus a border
           radius, so without an explicit layer the browser repaints all of
           that on every frame of the travel — which is the other half of the
           stutter. force3D keeps the transform on translate3d so it stays on
           the compositor, and will-change is set here rather than in CSS so it
           exists only while something is actually moving.

           Both are released in onComplete. Left on permanently, four promoted
           layers get re-composited on every subsequent scroll frame — a real
           jank source on this page, which scroll-scrubs the section above. */
        force3D: true,
        onStart: function () {
          gsap.set(card, { willChange: 'transform' });
        },
        onComplete: function () {
          /* Order matters. clearProps drops the inline transform, so the card
             is sitting at its true layout position with no transform at all
             BEFORE the class that transitions transform is added. Adding the
             class first would let that 340ms transition animate the removal of
             the slide's final transform — a visible drift at the end of the
             journey, which is the snap this replaces.

             clearProps also has to happen here rather than as a tween property:
             as a property GSAP applies it on completion of this tween, which is
             the same frame, but doing it by hand is what lets the class land in
             a guaranteed order after it. */
          /* transform and willChange only. NOT visibility — clearing that
             would drop the inline `visible` and re-expose the stylesheet's
             .services--live { visibility: hidden }, making the card vanish the
             instant it landed. The inline value stays for the life of the
             page; it costs nothing and is the only thing holding the card
             against that rule. */
          gsap.set(card, { clearProps: 'transform,willChange' });
          card.classList.add('service--arrived');
        }
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

      /* Re-measure the cards' shared travel too, but ONLY while the entrance
         is still pending. Once the timeline has played the cards sit at x:0
         and the start offset is never read again — while measureTravel()
         writes x:0 to clear inline transforms, which on a landed row is a
         harmless no-op but on a row mid-flight would yank every card to its
         resting place. Guarding on progress keeps it to the case that needs
         it: a resize that happens before the reader ever reaches the section,
         where the grid has re-laid out at a new width and the offsets measured
         at load are stale. */
      if (tl.progress() === 0 && !tl.isActive()) measureTravel();

      ScrollTrigger.refresh();
    }, 150);
  });
}());
