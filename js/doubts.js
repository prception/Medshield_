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

  /* The section that slides up over the finished picture. Taken as "whatever
     follows this one" rather than named by class, so the overlap survives the
     order of the page changing — and is simply skipped if this is the last
     section on the page. */
  var next = section.nextElementSibling;
  if (next && next.tagName !== 'SECTION') next = null;

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
  var SHOW_MEDIA = true;

  var PUSH_ALLOWANCE = 150;

  /* The overlap tail, in viewports.

     The doubts section ends with its picture filling the pinned stage. Rather
     than releasing the pin there and scrolling the next section up in the
     ordinary way — which reads as the composition being scrolled off — the
     stage HOLDS that finished frame while the following section travels up
     over it, covering it like a card dealt on top.

     Expressed in viewports because that is exactly the distance the covering
     section has to travel: from fully below the fold to flush with the top.
     One viewport is a 1:1 relationship between scroll and cover, which is what
     makes the move feel direct rather than parallaxed. */
  var OVERLAP_VH = 1;

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
    // The SAME axis the picture opens about (cardsCentre), not the frame's
    // midpoint — a card's side is decided by which half of the seam it is on,
    // and measuring that against a different line mis-sorts the middle cards.
    var cx = fr.left + fr.width / 2 + cardsCentre().x;
    /* Room is measured PER SIDE against the frame's real edges. The axis the
       cards part about is the seam, which is not the frame's midpoint, so the
       two sides have different amounts of space — taking the frame's half
       width for both would let the tighter side push its cards past the edge.
       The push is the smaller of the two, so the composition stays symmetric
       about the seam. */
    var room = Infinity;
    cards.forEach(function (c) {
      var r = c.getBoundingClientRect();
      var dx = (r.left + r.width / 2) - cx;
      if (Math.abs(dx) < r.width * 0.5) return; // straddles the centre
      room = Math.min(room, dx < 0 ? (r.left - fr.left) : (fr.right - r.right));
    });
    if (room === Infinity) room = 0;
    return Math.min(PUSH_ALLOWANCE, Math.max(0, room));
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

    /* The horizontal anchor is the one vertical line that is a GAP IN EVERY
       ROW — the channel the picture opens along.

       The rows are raked (top row in columns 2-4, bottom row in 1-3), so they
       do not share all their joins: the top row's joins fall between cards
       1|2 and 2|3, the bottom row's between 4|5 and 5|6. Most of those lines
       run through a card in the other row. Exactly one does not — the join
       shared by both rows — and that is the only place the picture can grow
       without covering something.

       It is FOUND, not assumed. Taking the bounding box's midpoint happens to
       land on the right line for the current arrangement, but only because
       the rake is symmetric; a change to the column assignments would move the
       real channel while the bounding-box centre stayed put, and the picture
       would silently start opening over a card again. Searching the joins
       keeps the anchor tied to the geometry that actually matters.

       Measured off real boxes rather than computed from the frame, because the
       frame carries the shell's padding and its middle is not the block's. */
    var rects = cards.map(function (c) { return c.getBoundingClientRect(); });

    var L = Infinity, R = -Infinity, T = Infinity, B = -Infinity;
    rects.forEach(function (r) {
      L = Math.min(L, r.left); R = Math.max(R, r.right);
      T = Math.min(T, r.top);  B = Math.max(B, r.bottom);
    });
    if (L === Infinity) return { x: 0, y: 0 };

    // Group into rows by vertical position.
    var rows = [];
    rects.forEach(function (r) {
      var row = null;
      for (var i = 0; i < rows.length; i++) {
        if (Math.abs(rows[i].top - r.top) < r.height * 0.5) { row = rows[i]; break; }
      }
      if (row) row.items.push(r);
      else rows.push({ top: r.top, items: [r] });
    });

    /* Candidate channels: every join in every row. A candidate survives only
       if it clears every card in every OTHER row too. */
    var candidates = [];
    rows.forEach(function (row) {
      var a = row.items.slice().sort(function (x, y) { return x.left - y.left; });
      for (var i = 1; i < a.length; i++) {
        candidates.push((a[i - 1].right + a[i].left) / 2);
      }
    });

    var blockMid = (L + R) / 2;
    var cx = null, best = Infinity;
    candidates.forEach(function (c) {
      // Clear of every card? (a hair of tolerance for sub-pixel layout)
      var clear = rects.every(function (r) {
        return c <= r.left + 0.5 || c >= r.right - 0.5;
      });
      if (!clear) return;
      // Of the valid channels, the one nearest the block's middle.
      var d = Math.abs(c - blockMid);
      if (d < best) { best = d; cx = c; }
    });

    // No channel clears every row (e.g. a single-column layout) — fall back to
    // the block's own middle rather than picking a line through a card.
    if (cx === null) cx = blockMid;

    return {
      x: cx - (fr.left + fr.width / 2),
      y: ((T + B) / 2) - (fr.top + fr.height / 2)
    };
  }

  function centreSeam() {
    gsap.set(cards, { clearProps: 'transform' });
    // Measured about the seam axis, the same line cardsCentre() returns, so
    // the width the picture opens into is the gap at the place it opens.
    var fr = frame.getBoundingClientRect();
    var mid = fr.left + fr.width / 2 + cardsCentre().x;
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

  /* The card block's full height, top of the highest card to bottom of the
     lowest — the height the picture panel takes, so its top and bottom edges
     land exactly level with the block's. Measured off the resting layout, with
     transforms cleared, so a rebuild never reads a block that is mid-push. */
  function cardsBlockHeight() {
    gsap.set(cards, { clearProps: 'transform' });
    var T = Infinity, B = -Infinity;
    cards.forEach(function (c) {
      var r = c.getBoundingClientRect();
      T = Math.min(T, r.top); B = Math.max(B, r.bottom);
    });
    return (T === Infinity) ? 0 : (B - T);
  }

  function measure() {
    var fw = frame.clientWidth  || 1;
    var vh = window.innerHeight || 1;
    var wide = window.matchMedia('(min-width: 1000px)').matches;

    /* The picture is a PANEL THE HEIGHT OF THE CARD BLOCK, seated on the
       block's centre line — not a full-viewport bleed.

       This is what the reference actually shows: the image spans both card
       rows exactly, top edge level with the top row's top and bottom edge
       level with the bottom row's bottom, and the cards butt straight against
       its sides with no gutter between them. Widening it therefore pushes the
       cards apart the way stretching a picture would, because the picture's
       edges and the cards' edges are in continuous contact.

       A 100vh full-bleed (which this was) breaks that reading twice over: the
       panel is taller than the composition so the cards no longer bracket it,
       and it ends by covering them rather than displacing them. Height is
       measured off the real cards so the panel and the block stay the same
       height whatever the copy does to them. */
    var blockH = cardsBlockHeight();
    var fullH = blockH || vh * 0.52;

    /* Width is what the cards vacate: the resting seam plus their outward
       travel on each side. No GAP_INSET is subtracted — the reference has the
       cards touching the picture's edges, and a margin there is precisely what
       made this read as a small panel floating in a slot rather than as the
       cards being forced apart BY the picture. */
    var fullW = wide
      ? centreSeam() + effectivePush() * 2
      : Math.min(fw * 0.86, 460);

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

      /* The expansion targets, in PIXELS, because both are now measured off
         the card block rather than the viewport: the panel's height IS the
         block's height and its width IS the opening the cards make. Viewport
         units would express a proportion of the wrong box.

         Re-measured on every resize (build() calls measure()), so this stays
         correct at any window size without the units doing that job.

         There is no `narrowVH` any more: the height never animates, so there
         is no intermediate height to name. */
      fullVW:  fullW,
      fullVH:  fullH
    };

    /* Pin the <img> to the frame's FINAL size, so the frame is a window that
       opens onto a picture already at full scale rather than a box that scales
       the picture with it. This is what makes the growth read as a reveal —
       see the .doubts__media img block in style.css.

       Sized to the TAKEOVER, not to stage 1. The reveal ends with the panel
       filling the section, so that is the photograph's real final size; had it
       been pinned to the stage-1 panel it would have been correct while the
       cards were being pushed apart and then stretched as the panel grew past
       them. Held at this size throughout, the window uncovers more of it in
       stage 1 and simply catches up with it in stage 2. */
    var overW = stage.clientWidth  || window.innerWidth;
    var overH = stage.clientHeight || vh;
    media.style.setProperty('--doubts-img-w', overW + 'px');
    media.style.setProperty('--doubts-img-h', overH + 'px');
    media.style.removeProperty('--doubts-media-full');

    /* Anchor the picture on the measured CHANNEL rather than the frame's
       middle, correcting for wherever the stylesheet's own centring parks it.

       The frame's middle and the card channel are not the same point — the
       shell's padding puts them ~20px apart — and the window opens
       symmetrically about whatever point it is anchored on. Anchored on the
       frame, its right edge reached cards 02 and 06 while its left edge sat
       clear of 01 and 05, which is the lopsided overlap that showed up on
       screen.

       The resting position is MEASURED rather than derived from padding
       values: it is whatever `left: 50%` plus the -50% self-centring actually
       resolves to, and an arithmetic guess at that is the kind of thing that
       goes stale the moment the shell's measure changes. */
    var cc = cardsCentre();

    // Where does the stylesheet's centring put it on its own? Zero our offset,
    // read the result, then restore. One reflow, at build/resize time only.
    var prevCx = media.style.getPropertyValue('--doubts-media-cx');
    media.style.setProperty('--doubts-media-cx', '0px');
    var fr = frame.getBoundingClientRect();
    var mr = media.getBoundingClientRect();
    var autoCentre = (mr.left + mr.width / 2) - (fr.left + fr.width / 2);
    if (prevCx) media.style.setProperty('--doubts-media-cx', prevCx);

    media.style.setProperty('--doubts-media-cx', (cc.x - autoCentre) + 'px');

    /* Vertically the panel must sit level with the card block: its top edge on
       the block's top edge, its bottom on the block's bottom. Measured the same
       way as the horizontal offset — where does the box land with no nudge,
       and how far is that from where it belongs — because `top` is resolved
       against the frame's padding box and the block is centred in the frame's
       content box, which are not the same origin. Assuming they were left the
       panel ~39px low, hanging below the bottom row. */
    if (wide) {
      var prevCy = media.style.getPropertyValue('--doubts-media-cy');
      media.style.setProperty('--doubts-media-cy', '0px');
      var restT = media.getBoundingClientRect().top;
      if (prevCy) media.style.setProperty('--doubts-media-cy', prevCy);

      var blockTop = Infinity;
      cards.forEach(function (c) {
        blockTop = Math.min(blockTop, c.getBoundingClientRect().top);
      });
      media.style.setProperty('--doubts-media-cy', (blockTop - restT) + 'px');
    } else {
      media.style.removeProperty('--doubts-media-cy');
    }
  }

  /* Each card's vector from the SEAM, measured from the resting (final)
     layout. Used both to collapse the cards toward the centre for state 2 and
     to push them outward in state 3. Measured with all transforms cleared, so
     a re-measure never compounds the previous frame's offsets.

     Measured against the seam rather than the frame's middle: the frame
     carries the shell's padding, so its centre sits to one side of where the
     cards actually meet, and a card just inside the seam on that side would
     be handed the wrong sign — it would push INTO the opening picture rather
     than away from it. */
  function cardVectors() {
    gsap.set(cards, { clearProps: 'transform' });

    var fr = frame.getBoundingClientRect();
    var cc = cardsCentre();
    var cx = fr.left + fr.width  / 2 + cc.x;
    var cy = fr.top  + fr.height / 2 + cc.y;

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

         `mid` means the channel RUNS THROUGH this card — tested against the
         card's own edges, not against how near its centre is to the line. The
         centre test was wrong for the raked grid: cards 02 and 06 begin 6px
         to the right of the channel, entirely clear of it, yet their centres
         are within half a width of it, so they were classified as middle
         cards, dodged vertically instead of moving aside, and the expanding
         picture ran straight into their left edge.

         Decided by measured position, not by slot name, so it stays correct
         when the grid collapses to two columns or one. */
      var isMid = cx > r.left + 0.5 && cx < r.right - 0.5;

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
        /* Scroll distance for the whole transformation, PLUS one viewport of
           tail. The tail is what the next section slides up through: the
           doubts stage stays pinned and holding its finished full-bleed
           picture while Services travels up over it (see the overlap block
           after this timeline). Without the extra viewport the pin would
           release the moment the picture finished, and the cover would have
           nothing standing still to cover. */
        end: '+=' + Math.round(window.innerHeight * (3.2 + OVERLAP_VH)),
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
      // Full height from the outset: only the width ever animates. A pixel
      // value now — fullVH is measured off the card block, not the viewport.
      height: geo.fullVH,
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

    /* The panel's resting left edge, as a fraction of the stage. Read from the
       stylesheet's --panel-start rather than assumed to be 0.5, so moving the
       fill further left is a one-line CSS change and the overshoot and the
       statement's offset below both follow it automatically. Falls back to the
       half-and-half split if the property is missing. */
    var panelStart = parseFloat(
      getComputedStyle(panel).getPropertyValue('--panel-start')
    );
    if (!isFinite(panelStart)) panelStart = 0.5;

    var overshoot = Math.max(
      0, panel.getBoundingClientRect().width - stageW * (1 - panelStart)
    );

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
    /* The distance from the stage's centre to the PANEL's centre. The panel
       spans panelStart -> 1 of the stage, so its centre sits at
       (panelStart + 1) / 2, and the offset is that minus the stage's own
       centre. At the old half-and-half split this is exactly the quarter-width
       it used to be hard-coded as. */
    var startX = geo.wide ? stageW * ((panelStart + 1) / 2 - 0.5) : 0;

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
    /* The picture waits until the six cards have finished arriving, then
       opens IN THE SAME BEAT as the cards parting — the reference's model.

       Theirs is two tweens placed at the same position:

         .to(secondList, { x: ±itemWidth / 2 })      // the columns part
         .from(secondVisualOuter, { width: 0 }, '<') // the picture opens

       The `'<'` is the whole point. The gap and the thing filling it are one
       event, so the picture is never a shape that appears in a hole that was
       already waiting — it is what forces the hole open. Running the two in
       sequence (which is what this did before) read as two animations that
       happened to follow each other.

       CARDS_SETTLED is derived from the card timings above rather than typed
       as a constant, so the two cannot drift apart if the stagger or the
       duration is retuned. */
    var CARDS_SETTLED = 0.12 + (cards.length - 1) * 0.022 + 0.30;
    var PART_AT = CARDS_SETTLED + 0.03;

    /* ---- STATE 3: the centre pushes the layout apart --------------------

       The frame grows from its own centre (it is centred in a grid cell, so
       both edges travel outward equally — no corner-anchored scaling), and
       every card is displaced outward by the distance the image's edge gains.

       EXPAND_AT is PART_AT: the cards' outward move and the picture's opening
       are the same event, placed at the same position on the timeline — the
       reference's `'<'`. */
    var EXPAND_AT = PART_AT;

    /* WIDTH ONLY — the reference's actual expansion.

       Theirs sets the visual wrapper `top: 0; bottom: 0`, so the box is at its
       full height before any scroll and the timeline animates nothing but the
       width (`.from(secondVisualOuter, { width: 0 })`). The height tween in
       their final `.fromTo` is what carries the box on to a 100vh full-bleed
       AFTER it has opened, not part of the opening itself.

       Animating our height alongside the width was what stopped the growth
       reading as a reveal: the window's top and bottom edges were travelling
       too, so the picture behind them slid vertically as it was uncovered
       instead of sitting still. With the height fixed the frame opens purely
       sideways, like curtains, and the photograph behind it never moves.

       The `top` compensation goes with it. It existed to keep a GROWING box
       centred on its own middle; a box whose height never changes is already
       centred and needs no per-frame correction. */

    /* The reveal runs in THREE beats, strictly in order — none of them
       overlaps the next:

         STAGE 1  the panel opens between the cards to exactly the width they
                  vacate, staying the height of the card block. The cards are
                  displaced, never covered — this is the "stretching" beat.

         CLEAR    the cards and the watermark fade out, while the panel HOLDS
                  at its stage-1 size and does not move.

         STAGE 2  the panel grows to fill the whole section, over ground that
                  is already empty.

       The clear-out is its own beat rather than something running underneath
       stage 2. When the fade and the growth overlapped, the panel was visibly
       sweeping over cards that were still on screen at half opacity — six
       boxes ghosting through the photograph as it passed. Separating them
       means the picture never expands across anything: by the time it starts
       growing there is nothing left to cover.

       The 0.12 left at the end is dead scroll holding the finished frame. */
    var TOTAL_DUR  = (1 - EXPAND_AT) - 0.12;
    var STAGE1_DUR = TOTAL_DUR * 0.50;
    var CLEAR_AT   = EXPAND_AT + STAGE1_DUR;
    var CLEAR_DUR  = TOTAL_DUR * 0.18;
    var STAGE2_AT  = CLEAR_AT + CLEAR_DUR;
    var STAGE2_DUR = TOTAL_DUR - STAGE1_DUR - CLEAR_DUR;

    // Kept for the card push below, which runs against stage 1 only.
    var EXPAND_DUR = STAGE1_DUR;

    /* The picture is on screen from the instant it starts opening. At zero
       width there is nothing to see, so it needs no fade of its own — fading
       it in separately is what made it read as a layer appearing rather than
       an edge parting. */
    if (SHOW_MEDIA) {
      /* Stage 1: height fixed at the card block's, width opens to the gap.
         The box is at its full stage-1 height before anything moves, exactly
         as the reference's `top: 0; bottom: 0` wrapper is. */
      tl.set(media, {
          autoAlpha: 1,
          height: geo.fullVH,
          top: 0
        }, EXPAND_AT)
        .fromTo(media,
          { width: 0 },
          { width: geo.fullVW, duration: STAGE1_DUR },
          EXPAND_AT);

      /* The CLEAR beat: the cards and the watermark go while the panel holds
         still at its stage-1 size. Nothing is moving here except the opacity,
         so the composition empties out around a picture that has already
         stopped — and stage 2 then grows over bare ground. */
      tl.to(cards, { autoAlpha: 0, duration: CLEAR_DUR }, CLEAR_AT)
        .to(stmt,  { autoAlpha: 0, duration: CLEAR_DUR }, CLEAR_AT);

      /* Stage 2: the takeover. Width and height both run to the section's full
         size, and `top` with them so the panel finishes flush with the stage
         rather than dropping downward out of the block it started in. */
      var overW = stage.clientWidth;
      var overH = stage.clientHeight;

      /* The `top` the panel must end on is MEASURED, not assumed to be half
         the height it gains. That identity only holds if the panel starts
         centred in the stage, and it does not: the card block it is seated on
         sits below the stage's middle, so a symmetric growth landed the panel
         8px above the stage's top edge and left a sliver of ground showing.

         What is wanted is the delta between where the panel's top edge is now
         (level with the card block) and where it has to finish (level with the
         stage), which is exactly that difference. */
      var stageTop = stage.getBoundingClientRect().top;
      var blockTop = Infinity;
      cards.forEach(function (c) {
        blockTop = Math.min(blockTop, c.getBoundingClientRect().top);
      });
      var topPx = (blockTop === Infinity) ? 0 : (stageTop - blockTop);

      tl.to(media, {
          width:  overW,
          height: overH,
          top:    topPx,
          duration: STAGE2_DUR
        }, STAGE2_AT);
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
        tl.to(card, { y: v.sy * 10, duration: EXPAND_DUR }, EXPAND_AT);
        return;
      }

      /* Cards move HORIZONTALLY away from the channel — the reference's
         `x: ±itemWidth / 2` on its two lists, one sign per side. That is the
         motion the reveal is made of: the cards pull apart and the picture
         occupies exactly the gap they open.

         The rows are raked, so a card can sit on the channel in its own row
         (the top row's card 3 and the bottom row's card 4 are each outboard of
         the shared join). Such a card has nowhere sideways to go that helps —
         the picture is not growing toward it — so it steps aside VERTICALLY
         instead, and only as far as the picture's edge actually reaches it. */
      if (v.mid) {
        var overlap = (geo.fullH / 2) - (Math.abs(v.dy) - v.halfH);
        var vRoom = Math.max(0, (stage.clientHeight / 2) - (Math.abs(v.dy) + v.halfH));
        tl.to(card, {
          y: v.sy * Math.min(Math.max(0, overlap + 14), vRoom),
          duration: EXPAND_DUR
        }, EXPAND_AT);
      } else {
        tl.to(card, {
          x: v.sx * pushX,
          duration: EXPAND_DUR
        }, EXPAND_AT);
      }
    });

    /* ---- THE OVERLAP: the next section slides up over the held picture ---

       Everything above resolves at progress 1 of a ONE-unit timeline. The
       trigger's range is now longer than that (see OVERLAP_VH on the `end`
       above), so the tail is expressed as extra timeline duration rather than
       as a separate ScrollTrigger: one scrub, one pin, one source of truth for
       where in the section we are. The composition therefore still occupies
       0 -> 1 and the cover occupies 1 -> 1 + OVERLAP_SPAN, and because the
       trigger's distance was extended in the same proportion, the acts keep
       the scroll distance they were tuned against.

       OVERLAP_SPAN is that proportion: OVERLAP_VH viewports of the 3.2 the
       composition uses. Derived from the same two numbers the `end` is built
       from, so retuning either cannot put the two out of step. */
    var OVERLAP_SPAN = OVERLAP_VH / 3.2;

    /* The tail claims its scroll distance, and the cover is pulled up into it.

       Two things together make the overlap, and neither works alone:

       THE HOLD. The empty tween below is what keeps the pin alive for the
       extra viewport. Without it the timeline would resolve the moment the
       picture landed and the pin would release there, leaving nothing standing
       still to be covered.

       THE PULL. `pinSpacing` reserves the FULL pin distance as an empty spacer
       under the section, and the next section sits after that spacer — which
       is exactly why it stays below the fold for the whole pin however long
       the pin is. Left alone, extending the pin would simply hold the picture
       for a viewport and then scroll Services up afterwards, in sequence, with
       no overlap at all.

       Pulling the cover up by the tail's own height cancels precisely the
       spacer the tail added. Its position in the document is then what it
       would have been WITHOUT the tail — flush against the end of the
       composition — so across the tail's viewport of scroll it rises from the
       bottom of the fold to the top while the pinned stage below it does not
       move. One pixel of cover per pixel of scroll, and the document's total
       height is unchanged, so nothing downstream shifts.

       A negative margin rather than a transform, deliberately: the sections
       after this one must follow the cover up, and a transform would move the
       cover alone and leave a viewport-tall hole beneath it. */
    if (next) {
      next.style.marginTop = (-Math.round(window.innerHeight * OVERLAP_VH)) + 'px';
    }

    tl.to({}, { duration: OVERLAP_SPAN }, 1);
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
    /* The cover is a sibling, not part of the composition, so its own two
       pieces are undone here. The margin especially: it is a negative pull
       measured against the viewport height at build time, and leaving a stale
       one in place across a resize would overlap the sections by the wrong
       amount — build() writes a fresh one. */
    if (next) {
      next.style.marginTop = '';
      gsap.set(next, { clearProps: 'transform' });
    }
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
  // Marks the covering section as an opaque layer that paints above the pinned
  // stage. Added here rather than in the markup so it only ever applies when
  // the animation is actually running (see .doubts-cover in style.css).
  if (next) next.classList.add('doubts-cover');
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
