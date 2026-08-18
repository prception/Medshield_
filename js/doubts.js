/* ==========================================================================
   MedShield — doubts.js
   Scroll-driven three-state transformation for section 03, "The problem".

   The section is one continuous spatial composition that scrubs through
   three visually distinct states while the stage is pinned:

     STATE 1  (0 -> 30%)   split screen: intro left, statement right
     STATE 2  (30 -> 60%)  the six cards arrive from the centre and settle
                           around a NARROW vertical central image
     STATE 3  (60 -> 100%) the image expands from its own centre while the
                           cards are pushed outward, opening into the final
                           composition

   ---------------------------------------------------------------------------
   DESIGN NOTES

   1. CSS owns the resting layout, JS owns only the departure from it.
      Every card's FINAL position is its natural grid position. GSAP animates
      x/y/scale/opacity FROM a centre-collapsed state TO zero — i.e. to the
      layout the stylesheet already computed. Nothing here positions anything,
      so a resize, a font swap, or a failed script all degrade to a correct
      static section (see the .doubts--live scoping in style.css).

   2. The image expands by animating its FRAME's width/height, not by scaling
      the picture. The <img> inside is fixed at the frame's widest state and
      centred with a translate, so widening the frame reveals more of an
      undistorted photograph. A scale() on the frame would have squashed the
      picture; a scale() on the image would have blurred it at the top of the
      range. Both were rejected for that reason.

   3. Card motion is DERIVED from the image, not merely concurrent with it.
      The outward push in state 3 is computed from the frame's half-width
      growth, so a card moves exactly as far as the image's edge travels
      toward it. That is what makes the centre feel like it is physically
      pushing the layout apart rather than two animations that happen to
      overlap.

   4. Geometry is measured, never hard-coded. Card offsets come from real
      getBoundingClientRect() positions relative to the frame's centre, so the
      same code produces a correct composition at every breakpoint and is
      re-measured on resize.

   Depends on: gsap.min.js, ScrollTrigger.min.js (js/vendor/, loaded before
   this file). Bails out cleanly if either is missing.
   ========================================================================== */

(function () {
  'use strict';

  var section = document.querySelector('.doubts');
  if (!section) return;

  // No GSAP -> leave the static composition alone. .doubts--live is never
  // added, so none of the animated CSS applies.
  if (!window.gsap || !window.ScrollTrigger) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce.matches) return;

  gsap.registerPlugin(ScrollTrigger);

  var stage  = section.querySelector('.doubts__stage');
  var frame  = section.querySelector('.doubts__frame');
  var split  = section.querySelector('.doubts__split');
  var panel  = section.querySelector('.doubts__panel');
  var stmt   = section.querySelector('.doubts__statement');
  var grid   = section.querySelector('.doubts__grid');
  var media  = section.querySelector('.doubts__media');
  var cards  = Array.prototype.slice.call(section.querySelectorAll('.doubt'));

  if (!stage || !frame || !split || !grid || !media || !panel || !cards.length) return;

  /* --- Geometry ---------------------------------------------------------

     Two image sizes drive everything:

       NARROW  the state-2 vertical strip
       FULL    the state-3 dominant image

     FULL is expressed as a fraction of the frame so the composition scales
     with the shell rather than jumping at an arbitrary pixel width, and is
     capped so the picture never outgrows the cards that must stay readable
     beside it. */

  var geo = {};

  /* How far each card travels outward during the state-3 expansion, per side.
     A fixed number rather than one derived from the image, because the image
     is in turn sized from the space the cards vacate — deriving each from the
     other made the two definitions circular. Fixing the travel here breaks
     that loop and leaves one honest reading: the cards step aside by this
     much, and the picture may claim exactly what they gave up. */
  /* TEMPORARY: the central picture is switched off while the card
     choreography is being settled. Flip to true to bring it back — the
     expansion code it gates is complete and still tuned to these timings,
     nothing else has to change. */
  var SHOW_MEDIA = false;

  var PUSH_ALLOWANCE = 150;

  /* Breathing room kept between the expanded picture and the cards it has
     pushed aside, per side. The picture is sized to the opening MINUS this,
     so the composition ends with a clear margin rather than edges touching. */
  var GAP_INSET = 18;

  /* Height of the empty band the compact grid reserves for the picture,
     measured as the real vertical gap between the last card of the upper
     block and the first card of the lower one. Measured rather than read from
     the stylesheet so the two cannot drift apart, and so it stays correct
     whatever the cards' content does to their heights. */
  function gridBandHeight() {
    if (cards.length < 2) return { h: 0, mid: 0 };
    // Measured off the RESTING layout: a leftover transform from a previous
    // build would otherwise report a band that does not exist.
    gsap.set(cards, { clearProps: 'transform' });

    /* Find the band by MEASURING the rows rather than assuming which index
       ends the upper one. The compact grid is three columns (cards 0-2 above
       the band, 3-5 below), not two — indexing cards[3]/cards[4] as the pair
       either side of the gap picked two cards in the SAME row, reported a
       band of ~0, and left the picture centred well above the real gap, where
       it covered the top row.

       Splitting on the largest vertical jump between consecutive cards works
       for any column count, so this cannot drift again if the grid changes. */
    var rects = cards.map(function (c) { return c.getBoundingClientRect(); });
    var split = 0, biggest = -Infinity;
    for (var i = 1; i < rects.length; i++) {
      var gap = rects[i].top - rects[i - 1].top;
      if (gap > biggest) { biggest = gap; split = i; }
    }
    if (!split) return { h: 0, mid: 0 };

    // Lowest edge of the row above, highest edge of the row below.
    var upperBottom = -Infinity, lowerTop = Infinity;
    for (var j = 0; j < rects.length; j++) {
      if (j < split) upperBottom = Math.max(upperBottom, rects[j].bottom);
      else           lowerTop    = Math.min(lowerTop,    rects[j].top);
    }

    var frameTop = frame.getBoundingClientRect().top;
    return {
      h: Math.max(0, lowerTop - upperBottom),
      // Relative to .doubts__frame — the media's containing block on this
      // layout (see the compact block in style.css).
      mid: ((upperBottom + lowerTop) / 2) - frameTop
    };
  }

  /* The seam across the middle of the closed card block: the horizontal gap
     between the innermost card left of centre and the innermost one right of
     it. With no reserved column this is just the grid's column gap, but it is
     MEASURED rather than assumed so a change to the grid or the gap token
     cannot leave the picture sized against a seam that no longer exists.

     Cards straddling the centre line are ignored — a card the line runs
     through is not beside the seam, and counting it produced a negative gap
     on rows whose middle card sits dead centre. */
  /* How far a card ACTUALLY travels outward, per side.

     PUSH_ALLOWANCE is only the request: a card may not leave the frame, so
     the real distance is that request clamped by the room remaining between
     the outermost card and the frame's edge. The picture is sized from this
     rather than from the raw allowance, because sizing it to a push the cards
     could not perform is precisely what made it grow over them — the image
     opened for 150px a side while the cards could only manage 60. */
  function effectivePush() {
    gsap.set(cards, { clearProps: 'transform' });
    var fr = frame.getBoundingClientRect();
    var cx = fr.left + frame.clientWidth / 2;
    var reach = 0;
    cards.forEach(function (c) {
      var r = c.getBoundingClientRect();
      var dx = (r.left + r.width / 2) - cx;
      if (Math.abs(dx) < r.width * 0.5) return; // straddles the centre
      reach = Math.max(reach, Math.abs(dx) + r.width / 2);
    });
    var room = Math.max(0, (frame.clientWidth / 2) - reach);
    return Math.min(PUSH_ALLOWANCE, room);
  }

  /* The card block's own centre, as an offset from the media's containing
     block. The picture must open from THIS point, not from the frame's
     middle: the frame carries the shell's padding, and its centre sits ~20px
     right of where the six cards actually balance. Anchoring to the frame put
     the expansion visibly off the composition's axis.

     Returns {x, y} in pixels relative to .doubts__frame, which is what the
     stylesheet's --doubts-media-cx / --doubts-media-cy consume. */
  function cardsCentre() {
    gsap.set(cards, { clearProps: 'transform' });
    var fr = frame.getBoundingClientRect();
    var L = Infinity, R = -Infinity, T = Infinity, B = -Infinity;
    cards.forEach(function (c) {
      var r = c.getBoundingClientRect();
      L = Math.min(L, r.left);  R = Math.max(R, r.right);
      T = Math.min(T, r.top);   B = Math.max(B, r.bottom);
    });
    if (L === Infinity) return { x: 0, y: 0 };
    return {
      x: ((L + R) / 2) - (fr.left + fr.width / 2),
      y: ((T + B) / 2) - (fr.top  + fr.height / 2)
    };
  }

  function centreSeam() {
    gsap.set(cards, { clearProps: 'transform' });
    var mid = frame.getBoundingClientRect().left + frame.clientWidth / 2;
    var leftEdge = -Infinity, rightEdge = Infinity;
    cards.forEach(function (c) {
      var r = c.getBoundingClientRect();
      if (r.right <= mid) leftEdge  = Math.max(leftEdge, r.right);
      if (r.left  >= mid) rightEdge = Math.min(rightEdge, r.left);
    });
    if (leftEdge === -Infinity || rightEdge === Infinity) return 0;

    // The RESTING gap. The caller adds the cards' outward travel
    // (PUSH_ALLOWANCE) on top, since that space is only vacated in state 3.
    return Math.max(0, rightEdge - leftEdge);
  }

  function measure() {
    var fw = frame.clientWidth  || 1;
    var vh = window.innerHeight || 1;
    var wide = window.matchMedia('(min-width: 1000px)').matches;

    /* On the compact layout the picture has a row of its own between the two
       card blocks, so it can take most of the width — it is the centre those
       blocks open away from, and at 0.42 it read as a stamp floating in a
       gap rather than as the section's anchor. */
    var fullW = wide ? Math.min(fw * 0.42, 620) : Math.min(fw * 0.86, 460);

    /* On the wide layout the cards close up across the centre — the grid
       reserves nothing — so the space the picture ends up in is exactly the
       space the cards VACATE, which is PUSH_ALLOWANCE on each side plus the
       column gap they already had between them. That makes the expansion a
       genuine displacement rather than the filling-in of a hole that was
       waiting all along. */
    if (wide) {
      /* The opening the cards create: the resting seam plus their outward
         travel on each side. Sized to exactly that, the picture's edges meet
         the cards' edges precisely — so GAP_INSET pulls it back a little on
         both sides, leaving a visible margin of ground instead of the two
         touching. Without it the picture appeared to overlap the cards even
         though the arithmetic was correct. */
      var opening = centreSeam() + effectivePush() * 2;
      fullW = Math.min(fullW, opening - GAP_INSET * 2);
    }

    /* Height follows the SOURCE aspect (hero-poster.jpg is 1280x720), capped
       against the viewport. Deriving it rather than picking a ratio is what
       keeps the expanded picture the same photograph it started as — an
       independent height made the frame squarer than the image and the crop
       drifted as it grew. */
    var fullH = Math.min(vh * 0.52, fullW * (720 / 1280));

    /* On the compact layout the picture must not outgrow the empty grid row
       reserved for it, or it grows back over the cards the row exists to keep
       clear. The row is measured rather than assumed, so the two stay in step
       even if the stylesheet's band changes. */
    if (!wide) {
      var band = gridBandHeight();
      /* Fit INSIDE the band with clearance, not merely equal to it. At exactly
         the band's height the picture's edges touch the rows above and below,
         and since the cards carry a small outward push in state 3 the two were
         landing on each other — the top row's titles ended up under the
         image. The inset keeps a visible gutter on both sides at every point
         in the timeline. */
      var fit = band.h - 24;
      if (fit > 0 && fullH > fit) {
        fullH = fit;
        fullW = fullH * (1280 / 720);
      }
      /* Nudge the picture from where the grid stack puts it (the frame's
         centre) onto the band's centre. `position: relative` offsets from the
         element's OWN flow position, so what the stylesheet needs is the
         DELTA between the two centres, not the band's absolute midpoint —
         writing the latter pushed the picture down the page by its full
         offset instead of the few pixels it actually had to move.

         Written as a custom property consumed by CSS `top`, never as an
         inline transform: GSAP animates this element's width/height, and an
         inline transform is the one thing that could fight it. */
      var frameMid = frame.getBoundingClientRect().height / 2;
      media.style.setProperty('--doubts-band-mid', (band.mid - frameMid) + 'px');
    } else {
      media.style.removeProperty('--doubts-band-mid');
    }

    // The state-2 strip: narrow enough to read as a seam between the cards.
    /* The intermediate width. On the wide layout the cards are closed up
       against each other, so the picture's first appearance is exactly the
       seam between them — it emerges IN the join and then forces it open.
       Sizing it wider than the seam would have it overlap the cards before
       they have moved, which is the overlap the expansion exists to resolve. */
    var narrowW = wide ? Math.max(8, centreSeam()) : 64;

    geo = {
      wide:    wide,
      narrowW: narrowW,
      // The strip is TALLER than the final image, which is what makes the
      // expansion read as opening outward rather than simply inflating: it
      // gains a lot of width and gives back a little height.
      narrowH: Math.min(vh * 0.62, 520),
      fullW:   fullW,
      fullH:   fullH,
      /* How far a card steps aside, per side. This is PUSH_ALLOWANCE, the
         same number the picture's width was allowed to claim above — so the
         card's travel and the picture's growth are two halves of one
         negotiation rather than two independent animations that happen to
         overlap (note 3). It is capped by the room actually available at the
         frame's edge where that is tighter. */
      push:    PUSH_ALLOWANCE,

      /* The expansion targets, in VIEWPORT UNITS — the reference's model.
         Expressing them this way rather than in pixels is what keeps the
         growth correct when the window changes without re-deriving anything,
         and it is what lets the picture head for a genuine full-bleed.

         Not the reference's literal 100vw/100vh: theirs takes over the whole
         section at the end, whereas this picture has to leave the six cards
         readable around it. The SHAPE is identical — both axes driven in vh
         and vw with a compensating negative `top` — only the destination is
         scaled to what this composition can give up. */
      fullVW:  wide ? Math.min(fullW / window.innerWidth * 100, 92) : 86,
      fullVH:  wide ? Math.min(fullH / vh * 100, 58) : 26,
      narrowVH: Math.min(62, (Math.min(vh * 0.62, 520) / vh) * 100)
    };

    // The <img> is a plain object-fit: cover child now (see style.css), so it
    // needs no width of its own — the frame crops it at whatever size it is.
    media.style.removeProperty('--doubts-media-full');

    /* Anchor the picture on the CARD BLOCK's centre rather than the frame's.
       The frame carries the shell's padding, so its middle sits about 20px to
       the right of where the six cards actually balance — small, but the
       expansion runs symmetrically about this point, so the drift is visible
       as the picture growing off the composition's axis. */
    var cc = cardsCentre();
    media.style.setProperty('--doubts-media-cx', cc.x + 'px');
    if (wide) media.style.setProperty('--doubts-media-cy', cc.y + 'px');
    else      media.style.removeProperty('--doubts-media-cy');
  }

  /* Each card's vector from the frame's centre, measured from the resting
     (final) layout. Used both to collapse the cards toward the centre for
     state 2 and to push them outward in state 3. Measured with all transforms
     cleared, so a re-measure never compounds the previous frame's offsets. */
  function cardVectors() {
    gsap.set(cards, { clearProps: 'transform' });

    var fr = frame.getBoundingClientRect();
    var cx = fr.left + fr.width  / 2;
    var cy = fr.top  + fr.height / 2;

    return cards.map(function (card) {
      var r = card.getBoundingClientRect();
      var dx = (r.left + r.width  / 2) - cx;
      var dy = (r.top  + r.height / 2) - cy;

      /* The outward push is AXIS-ASSIGNED, not radial.

         A radial push was the first version and it failed in two ways at
         once: the middle column barely moved sideways (its dx is ~0, so the
         unit vector is almost pure y) yet still had to clear an image
         growing horizontally, so cards 02/05 ended up sitting ON the picture;
         meanwhile the outer columns were pushed the full distance and ran off
         both edges of the viewport.

         Splitting by column fixes both at the source, because the two groups
         have genuinely different jobs:

           MIDDLE column  the image grows into its horizontal space, so it
                          must clear VERTICALLY — there is nowhere else to go.
           OUTER columns  the image's edge advances toward them, so they move
                          HORIZONTALLY, by however far that edge travels.

         `mid` is decided by measured position, not by slot name, so it stays
         correct when the grid collapses to two columns or one. */
      var isMid = Math.abs(dx) < r.width * 0.5;

      return {
        dx: dx, dy: dy,
        mid: isMid,
        sx: dx < 0 ? -1 : 1,
        sy: dy < 0 ? -1 : 1,
        halfW: r.width / 2,
        halfH: r.height / 2
      };
    });
  }

  /* --- Timeline ---------------------------------------------------------

     One timeline, one scrub, three acts on a 0-1 progress scale. Every tween
     is a plain interpolation with no elastic/back easing, so scrolling back
     up runs the exact inverse — the "reversible" requirement. */

  var tl;

  function build() {
    /* cardVectors() FIRST: it clears every transform the previous timeline
       left behind, so the layout measure() then reads is the resting one.
       Running measure() first meant the compact band was measured while the
       cards still carried their state-3 offsets — the gap it found was in the
       wrong place, and the picture was centred above the real band where it
       covered the top row's titles. */
    var vec = cardVectors();
    measure();

    tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        // Scroll distance for the whole transformation. Generous on purpose:
        // three states need room to read as three states.
        end: '+=' + Math.round(window.innerHeight * 3.2),
        pin: stage,
        pinSpacing: true,
        // The site drives real window scroll (hero.js's wheel engine calls
        // window.scrollTo), so a fixed pin is correct here — a transform pin
        // would fight that engine's per-frame writes.
        pinType: 'fixed',
        anticipatePin: 1,
        scrub: 0.6,
        invalidateOnRefresh: true
      }
    });

    /* ---- STATE 1 (0 -> 0.30): the panel wipes leftward ------------------

       The mechanic the reference uses, reproduced against this palette: the
       filled right-hand panel travels one full panel-width to the LEFT and
       off the stage, and the card composition is simply revealed behind it.
       Not a cross-fade — the panel stays fully opaque for the whole wipe, so
       the motion reads as one surface sliding away rather than two layers
       dissolving into each other.

       The statement inside it drifts at a slower rate than the panel itself.
       That parallax is what keeps the type from feeling glued to the panel:
       it lags, the way a foreground element does when the surface behind it
       moves. Kept small — the brief rules out heavy parallax. */

    /* The image starts at ZERO width — it is not present at the top of the
       section at all, and only opens on scroll. The reference does exactly
       this (its visual wrapper measures w:0 before any scroll), and it is
       what makes the picture read as something the section produces rather
       than something that was always sitting there. */
    gsap.set(media, {
      width: 0,
      height: geo.narrowVH + 'vh',
      top: 0,
      autoAlpha: 0,
      // While disabled it stays out of the layout entirely rather than
      // sitting at zero width, so it cannot affect anything it is measured
      // against (the card seam, the compact band).
      display: SHOW_MEDIA ? '' : 'none'
    });
    gsap.set(cards, { autoAlpha: 0 });

    /* The panel starts as the right HALF of the stage and travels to the
       left, GROWING as it goes until it covers the section edge to edge.
       Two things happen at once and they are what make the move read as one
       surface taking over the composition:

         x     from its resting left edge (the stage's midpoint) to 0
         width from half the stage to the whole of it

       Written as `left` + `width` rather than a scale, because scaling would
       stretch the statement inside it. The panel's own left edge is what
       travels, so the fill sweeps leftward across the intro and lands as a
       full-bleed field — the reference's "second panel arrives and becomes
       the section" behaviour, reproduced against this palette.

       The right-edge overshoot is declared in the stylesheet (8vw) and read
       back here rather than duplicated as a number, so the two cannot drift
       apart: the end width is simply "the whole stage, plus whatever
       overshoot the panel already carries". */
    var stageW = stage.clientWidth;
    var overshoot = Math.max(0, panel.getBoundingClientRect().width - stageW / 2);

    /* The statement's journey, in one continuous tween per property.

       It STARTS sitting in the panel's right half — stacked, full white, at
       reading size — and ENDS as a wide, faint watermark across the middle of
       the finished composition. Because the element is centred on the stage
       by the stylesheet, "the middle" is its natural resting place and the
       tween only has to undo the offset that puts it in the panel to begin
       with. That offset is a quarter of the stage: the centre of the right
       half, measured from the centre of the whole.

       Scale rather than font-size, so the type interpolates on the compositor
       instead of relaying out every frame. */
    /* Only the wide layout starts the statement off-centre: there the panel
       is the right HALF of the stage, so its centre is a quarter-width away
       from the stage's. On the compact layout the panel is already full-bleed
       and the statement is centred from the outset — offsetting it there
       pushed the type off the side of the screen, which was the whole of
       state 1 at 390px. */
    var startX = geo.wide ? stageW * 0.25 : 0;

    gsap.set(stmt, { xPercent: -50, yPercent: -50, x: startX, scale: 0.62, opacity: 1 });

    tl.to(panel, {
        left: 0,
        width: stageW + overshoot,
        duration: 0.24
      }, 0.06)
      // The statement slides to the true centre and grows as the fill takes
      // over the section, arriving as the watermark the cards sit on.
      .to(stmt, { x: 0, scale: 1, duration: 0.28 }, 0.06)
      // ...and drops back to a ghost once the cards are on it, so it reads as
      // a ground texture rather than as competing type. 0.12 matches the
      // reference's own resolved opacity closely.
      .to(stmt, { opacity: 0.12, duration: 0.18 }, 0.20)
      // The intro is covered by the arriving fill rather than fading on its
      // own; this only takes it out once the panel is over it, so the two
      // never cross-dissolve.
      .to(split, { autoAlpha: 0, duration: 0.14 }, 0.14);

    /* ---- STATE 2 (0.30 -> 0.60): cards arrive, strip is established ----

       Cards start collapsed at the centre (scaled down, stacked on the seam)
       and travel outward to their resting grid positions. Because the tween
       targets x:0/y:0, the destination is the CSS layout — see note 1. */

    cards.forEach(function (card, i) {
      tl.fromTo(card,
        {
          /* The cards ride IN WITH THE FILL. They start off the right edge of
             the stage and travel leftward at the same rate as the panel's
             leading edge, so they enter as part of that moving surface rather
             than assembling on the ground behind it and being uncovered —
             which is what they did before, and which read as two separate
             things happening at once.

             The stagger is a fraction of the stage width, so the six arrive
             as a loose column sweeping in rather than a single rigid block.
             Right-hand cards (odd index) trail slightly further out, which is
             what gives the entry its diagonal rake. */
          x: stageW * (0.72 + (i % 3) * 0.12),
          autoAlpha: 0
        },
        {
          x: 0, autoAlpha: 1, duration: 0.30,
          delay: 0
        },
        /* Overlaps the fill deliberately: the panel is still growing leftward
           at 0.12, so the cards are inside the colour field as it arrives.
           They are ON the fill, never behind it. The per-card offset keeps
           them sweeping in rather than landing as one block. */
        0.12 + i * 0.022
      );
    });

    /* The image OPENS from nothing rather than sliding in already formed: it
       starts at zero width (see the gsap.set above) and parts to the narrow
       strip as the cards settle around it. Two separate growths follow —
       0 -> narrow here, narrow -> full in state 3 — which is what gives the
       section its "the centre keeps opening" reading, and it guarantees the
       strip is established well before the main expansion begins. */
    /* Opens to the intermediate width and then HOLDS. The gap between this
       tween ending (~0.48) and the expansion starting (0.60) is deliberate
       dead time in the scrub: the composition sits complete and still for a
       stretch of scroll, so state 2 registers as a state the reader arrives
       at rather than a frame passed through on the way to state 3. Without
       that pause the two growths ran together and read as one long stretch. */
    /* Strictly AFTER every card has settled, with a beat of stillness in
       between. The last card starts at 0.12 + 5 x 0.022 = 0.23 and runs for
       0.30, so the composition is complete at 0.53; the picture waits until
       0.56. Nothing overlaps.

       CARDS_SETTLED is derived from the card timings above rather than typed
       as a constant, so the two cannot drift apart if the stagger or the
       duration is retuned.

       Nothing of the picture shows before this: it holds at zero width AND
       zero opacity from the start, so the cards arrive around an empty centre
       and the image is something the finished composition then produces. */
    var CARDS_SETTLED = 0.12 + (cards.length - 1) * 0.022 + 0.30;
    var mediaIn = CARDS_SETTLED + 0.03;

    /* TEMPORARILY DISABLED — the central picture.
       Set SHOW_MEDIA back to true to restore it. Everything else is
       untouched: the cards still arrive on the same schedule and still push
       outward at EXPAND_AT, so the timing this was tuned against is
       preserved and re-enabling is a one-word change. */
    if (SHOW_MEDIA) {
      tl.to(media, { autoAlpha: 1, duration: 0.03 }, mediaIn)
        .to(media, { width: geo.narrowW, duration: 0.10 }, mediaIn);
    }

    /* ---- STATE 3: the centre pushes the layout apart --------------------

       The frame grows from its own centre (it is centred in a grid cell, so
       both edges travel outward equally — no corner-anchored scaling), and
       every card is displaced outward by the distance the image's edge gains.

       EXPAND_AT is anchored to the strip finishing rather than to a fixed
       0.60: once the reveal was pushed back to follow the cards, a hard-coded
       start would have had the expansion begin while the strip was still
       opening, collapsing states 2 and 3 into one move. Deriving it keeps the
       three beats strictly in order however the earlier timings are retuned,
       and the small gap after the strip lands is the pause that lets state 2
       register as a state rather than a frame passed through. */
    var EXPAND_AT = mediaIn + 0.10 + 0.04;

    /* The reference's expansion, property for property.

       Width and height are driven in VIEWPORT UNITS toward a full-bleed
       target, and `top` runs negative in step with the height so the box stays
       centred on its original middle once it is taller than the row it
       occupies. Their numbers at 1440x900 were width 0 -> 59.8vw -> 100vw,
       height 100% -> 82.9vh -> 100vh, top 0 -> -77 -> -154; ours are the same
       shape, scaled to how much of the section this picture is meant to own.

       `top` is exactly half the height the box gains, negated — that identity
       is what keeps the growth symmetric about the centre line, and it is the
       part a width/height-only tween silently gets wrong (the picture grows
       downward and drifts off its own centre). */
    var growH = geo.fullVH - geo.narrowVH;   // vh gained
    var topPx = -(window.innerHeight * growH / 100) / 2;

    if (SHOW_MEDIA) {
      tl.to(media, {
        width:  geo.fullVW + 'vw',
        height: geo.fullVH + 'vh',
        top:    topPx,
        duration: 1 - EXPAND_AT
      }, EXPAND_AT);
    }

    /* The SAME distance the picture was sized against — one function, called
       by both, so the cards' travel and the picture's width can never
       disagree. When they were computed separately the picture opened for the
       full allowance while the cards were clamped to the room actually left
       inside the frame, and the difference showed up as the picture sitting
       on top of cards 02 and 05. */
    var pushX = effectivePush();

    cards.forEach(function (card, i) {
      var v = vec[i];

      /* On the compact layout the grid already reserves an empty row for the
         picture, so the cards' FINAL positions are clear of it by
         construction and the outward move is a small vertical one away from
         that band — just enough to read as the centre pushing, without
         reopening the overlap the reserved row exists to prevent. A
         horizontal push here would only shove the two columns off screen,
         since they already span the full width. */
      if (!geo.wide) {
        tl.to(card, { y: v.sy * 10, duration: 1 - EXPAND_AT }, EXPAND_AT);
        return;
      }

      if (v.mid) {
        /* Clear the image vertically. The distance is the overlap that
           actually exists — how far the grown image's edge reaches past the
           card's inner edge — so the card moves exactly as much as it must,
           and not at all if the image never reaches it.

           Bounded by the room left inside the pinned viewport: a middle card
           that pushed by its full overlap ran off the bottom edge on every
           viewport shorter than the grid, which is most of them. Clamping
           here rather than letting `overflow: clip` cut it keeps the card
           READABLE, which is the actual requirement. */
        var overlap = (geo.fullH / 2) - (Math.abs(v.dy) - v.halfH);
        var vRoom = Math.max(0, (stage.clientHeight / 2) - (Math.abs(v.dy) + v.halfH));
        tl.to(card, {
          y: v.sy * Math.min(Math.max(0, overlap + 14), vRoom),
          duration: 1 - EXPAND_AT
        }, EXPAND_AT);
      } else {
        tl.to(card, {
          x: v.sx * pushX,
          duration: 1 - EXPAND_AT
        }, EXPAND_AT);
      }
    });
  }

  function teardown() {
    if (tl) {
      if (tl.scrollTrigger) tl.scrollTrigger.kill(true);
      tl.kill();
      tl = null;
    }
    // .doubts__split covers the intro inside it; only elements this file
    // actually tweens need clearing.
    gsap.set([cards, media, panel, stmt, split], { clearProps: 'all' });
  }

  /* Rebuild on a real width change only. A vertical-only resize is almost
     always mobile browser chrome collapsing, and rebuilding there would make
     the composition jump mid-scroll. ScrollTrigger's own refresh handles the
     height change. */
  var lastW = window.innerWidth;
  var resizeTimer;

  window.addEventListener('resize', function () {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      teardown();
      build();
      ScrollTrigger.refresh();
    }, 200);
  }, { passive: true });

  // With the picture switched off, collapse the row the compact grid reserves
  // for it — otherwise the two card blocks are split by an empty band.
  if (!SHOW_MEDIA) grid.style.setProperty('--doubts-band', '0px');

  section.classList.add('doubts--live');
  build();

  // The pin's scroll distance depends on the section's measured height, which
  // is not final until the webfonts have swapped and the image has decoded.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }
  var img = media.querySelector('img');
  if (img && !img.complete) {
    img.addEventListener('load', function () { ScrollTrigger.refresh(); }, { once: true });
  }
})();
