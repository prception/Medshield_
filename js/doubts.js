/* ==========================================================================
   MedShield — doubts.js
   Scroll-driven three-state transformation for section 03, "The problem".

   The section is one continuous spatial composition that scrubs through
   three visually distinct states while the stage is pinned:

     STATE 1  (0 -> ~32%)  split screen: intro left, statement right
     STATE 2  (~12 -> 43%) the six cards arrive from the centre and settle
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
  /* The payoff layer inside the frame: the About statement and the numbers.
     Optional — if the markup is the older version without it, everything
     below simply skips, so this file still drives a page that does not have
     one. */
  var reveal = section.querySelector('.doubts__reveal');
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

  /* Scroll distance the three acts play over, in viewports (the OVERLAP_VH
     tail is added on top of this).

     3.2 was right while the section ended on the picture. It does not survive
     the payoff layer being added on top of it: measured on a 900px viewport
     the whole reveal - scrim, statement, lede, CTA and the stats band - was
     getting 282px of a 3780px track, 7.5%, and the cover began rising 29px
     before it finished. One trackpad flick is 300-500px, so a fast scroll
     crossed the entire beat inside a single gesture and the reader arrived at
     Services having never seen the text.

     Stretching the track is normally the wrong lever - it makes the section
     longer without making anything slower, since the acts keep their same
     fractions. It is the right one HERE because the extra distance is not
     spread across the section: it is given to the reveal and to a hold after
     it (see REVEAL_HOLD below), so the earlier acts keep the pixel budget
     they were tuned against and the payoff gets the room it never had. */
  /* Trimmed 4.4 -> 3.8 to even out the page's pacing. At 4.4 this pin claimed
     4.4 + 0.55 + 1 = 5.95 viewports of scroll while the Services section that
     follows had only 1 (fixed 100vh, no pin), so the reader crawled through
     this section and then shot past the next one. The reveal and the hold keep
     their absolute pixel budget - REVEAL_HOLD_VH is untouched, and the 0.6vh
     comes off the earlier acts, which had the most room to give. */
  var TRACK_VH = 3.8;

  /* Scroll held on the FINISHED composition before the cover starts rising,
     in viewports. This is the part that actually fixes a fast scroll: an
     animation can always be crossed in one gesture, but a hold cannot be -
     the reader has to scroll THROUGH it, and for that distance the finished
     statement and stats band are simply standing there, complete and still.

     0.55 of a viewport is ~500px, which is about one full trackpad flick. So
     even the fastest single gesture that lands inside this section ends with
     the payoff on screen rather than past it. */
  var REVEAL_HOLD_VH = 0.55;

  /* Breathing room kept between the expanded picture and the cards it has
     pushed aside, per side. The picture is sized to the opening MINUS this,
     so the composition ends with a clear margin rather than edges touching. */
  var GAP_INSET = 18;

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

  /* The card block's top edge, as a `top` value for the picture — i.e. in the
     media's own offset parent (.doubts__frame).

     The picture is seated ON the block, so this is where its box starts. It
     used to be hard-coded 0, which is correct only where the block begins at
     the frame's top edge — true on the wide layout, where the grid is the
     frame's only occupant, and false on the compact one, where the intro sits
     above the grid inside the same frame. There the picture was lifted to the
     frame's ceiling, level with the intro's eyebrow instead of with the cards,
     and its bottom edge fell short of the block by the same distance.

     Measured, not derived from the intro's height, so it stays right whatever
     the copy above the grid wraps to. */
  function cardsBlockTop() {
    gsap.set(cards, { clearProps: 'transform' });
    var T = Infinity;
    cards.forEach(function (c) {
      T = Math.min(T, c.getBoundingClientRect().top);
    });
    if (T === Infinity) return 0;
    return T - frame.getBoundingClientRect().top;
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
    /* The compact cap is READ from the stylesheet rather than repeated here,
       so the one definition lives in the place that already uses it. It is
       per-breakpoint (--doubts-cap tightens on small phones), so a duplicated
       constant would be wrong at some widths — and wrong silently, since the
       only symptom is a picture that stops growing.

       The fallback matches the stylesheet's own default for the same reason. */
    var capProp = parseFloat(
      getComputedStyle(grid).getPropertyValue('--doubts-cap')
    );
    if (!isFinite(capProp) || capProp <= 0) capProp = 460;

    /* ONE formula for both layouts: the picture claims exactly the seam the
       closed card block leaves, plus the travel the cards make on each side.

       The compact layout used to have a formula of its own (a fraction of the
       frame, capped), because its cards did not move — they drifted 10px and
       the picture simply grew over them. Now that the compact grid is narrowed
       and centred like the desktop one, its cards have room to part and the
       same negotiation applies: effectivePush() is called once and drives both
       the cards' travel and the picture's width, so the two can never
       disagree. Sizing them separately is exactly what once had the picture
       opening for 150px a side while the cards could only manage 60.

       The cap still binds on compact, where the seam plus a full push could
       otherwise reach the shell's edges. */
    var fullW = centreSeam() + effectivePush() * 2;
    if (!wide) fullW = Math.min(fullW, capProp);

    /* On the compact layout the picture is BOUND TO THE CARD BLOCK, exactly as
       it is on the wide one: its top edge level with the highest card and its
       bottom edge level with the lowest, so it spans the listed cards rather
       than occupying a slot cut out of the middle of them.

       It used to be clamped to `gridBandHeight() - 24` — the empty grid row
       between the two card blocks. That made the phone a different composition
       from the desktop: a small letterboxed strip parked in a gap, roughly a
       fifth of the block's height, which then had to jump to full-stage size in
       stage 2 with nothing in between. Binding it to the block is what the
       expansion needs to read as one continuous move: the picture opens ACROSS
       the cards, and then the same box keeps growing into the stats.

       The block height is already what `fullH` holds (cardsBlockHeight above),
       so there is nothing to clamp here — only the width to derive. The cards
       stay legible over it because .doubts__grid sits at z-index 3, above the
       picture's z-index 2 (see the stacking block in style.css), and because
       the CLEAR beat fades them out before stage 2 grows past them.

       Width is unchanged — it still comes from the frame (the ternary above),
       not from the height's aspect ratio. The picture is a cropping window: the
       <img> inside is pinned to the takeover's size and never scales, so a
       taller box simply shows more of the same photograph. Deriving width from
       16:9 at the block's full height would have made the box wider than the
       frame. */

    // The state-2 strip: narrow enough to read as a seam between the cards.
    /* The intermediate width. The cards are closed up against each other on
       BOTH layouts now, so the picture's first appearance is exactly the seam
       between them — it emerges IN the join and then forces it open. Sizing it
       wider than the seam would have it overlap the cards before they have
       moved, which is the overlap the expansion exists to resolve. */
    var narrowW = Math.max(8, centreSeam());

    geo = {
      wide:    wide,
      narrowW: narrowW,
      // The strip is TALLER than the final image, which is what makes the
      // expansion read as opening outward rather than simply inflating: it
      // gains a lot of width and gives back a little height.
      narrowH: Math.min(vh * 0.62, 520),
      fullW:   fullW,
      fullH:   fullH,
      /* Where the picture's box starts, so it is seated on the card block
         rather than on the frame's ceiling. Zero on the wide layout, where the
         two coincide; a real offset on the compact one, where the intro sits
         above the grid in the same frame. */
      blockTop: cardsBlockTop(),
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
      /* COMPACT (< 1000px): the same measured seat the wide branch gets.

         This branch used to clear the offset entirely, on the assumption that
         the stylesheet's own centring already put the picture on the card
         block at this size. It does not: the compact frame carries the intro
         above the grid, so `top` (resolved against the frame's PADDING box)
         and the block (centred in the frame's CONTENT box) start from
         different origins, and the picture came to rest a measured 48px BELOW
         the top card at every compact width — its bottom edge hanging the same
         48px past the last row. That is the misalignment on screen: the panel
         opens across a band that is a card-gap lower than the cards it is
         supposed to be spanning.

         Measured exactly as above — where does the box land with no nudge, and
         how far is that from the block's top edge — rather than derived from
         padding values, which go stale the moment the compact measure changes.

         Scoped to this else branch, so the wide layout never reaches it. */
      var prevCyC = media.style.getPropertyValue('--doubts-media-cy');
      media.style.setProperty('--doubts-media-cy', '0px');
      var restTC = media.getBoundingClientRect().top;
      if (prevCyC) media.style.setProperty('--doubts-media-cy', prevCyC);

      var blockTopC = Infinity;
      cards.forEach(function (c) {
        blockTopC = Math.min(blockTopC, c.getBoundingClientRect().top);
      });
      if (blockTopC === Infinity) {
        media.style.removeProperty('--doubts-media-cy');
      } else {
        media.style.setProperty('--doubts-media-cy', (blockTopC - restTC) + 'px');
      }
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
        /* The hold is scroll distance like any other act, so it is claimed
           here too. Without it in the `end` the timeline would simply have
           more duration packed into the same pixels - every act, the hold
           included, would get proportionally FEWER pixels rather than more,
           which is the opposite of the point. */
        end: '+=' + Math.round(
          window.innerHeight * (TRACK_VH + REVEAL_HOLD_VH + OVERLAP_VH)
        ),
        pin: stage,
        pinSpacing: true,
        // The site drives real window scroll (hero.js's wheel engine calls
        // window.scrollTo), so a fixed pin is correct here — a transform pin
        // would fight that engine's per-frame writes.
        pinType: 'fixed',
        anticipatePin: 1,
        /* The engine's lerp already carries the smoothing, so this stays
           light — a second heavy lag on top would read as the section
           lagging behind the page rather than moving with it. */
        scrub: 0.5,
        invalidateOnRefresh: true,

        /* THE STAGE STANDS DOWN ONCE IT IS PAST.

           pinType:'fixed' parks the stage at the pin's end offset on release
           (position:relative + translateY of the whole pin distance), which is
           correct — the finished composition belongs at the bottom of its own
           track. But the cover's negative margin (see the overlap block near
           the end of this file) pulls everything after it UP by a viewport and
           a half, so the parked box still reaches ~400px into the Process
           section's scroll range while Services and Process paint over it.

           That is invisible during ordinary scrolling, because both of those
           sections are opaque. It is NOT invisible during the process->cases
           morph: #process.is-morphing is deliberately transparent and its
           camera's clip closes inward from the left and right edges, so the
           strips the clip vacates had nothing behind them but this parked
           stage — and the About stats band inside it showed through as a
           navy panel with 'ISO 45001' and '24/7 Medical desk' floating in the
           corners.

           visibility rather than display: the stage's box must stay exactly
           where it is (its height is part of the layout the pin spacer was
           measured against, and doubts.js re-measures on refresh), so it is
           taken out of PAINT only. Restored the moment the trigger is entered
           again from below, so scrolling back up finds the composition intact.

           Set on the stage rather than the section: .doubts is also the
           theme-ground observer's measurement box, and hiding that would
           change what the header reads for its ink. */
        onLeave: function () { stage.style.visibility = 'hidden'; },
        onEnterBack: function () { stage.style.visibility = ''; }
      }
    });

    /* ---- STATE 1 (0 -> ~0.32): the panel wipes leftward -----------------

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
      top: geo.blockTop,
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

    /* ---- STATE 2 (~0.12 -> 0.43): cards arrive, strip is established ---

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
          x: 0, autoAlpha: 1, duration: 0.22,
          delay: 0
        },
        /* Overlaps the fill deliberately: the panel is still growing leftward
           at 0.12, so the cards are inside the colour field as it arrives.
           They are ON the fill, never behind it. The per-card offset keeps
           them sweeping in rather than landing as one block. */
        0.12 + i * 0.018
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
    var CARDS_SETTLED = 0.12 + (cards.length - 1) * 0.018 + 0.22;
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

       The 0.04 left at the end is dead scroll holding the finished frame.

       This was 0.12, and together with the entry timings it left the picture
       badly short of room. Measured against a 900px viewport the split was:

         entry (panel + six cards)  0.00 -> 0.53   ~1180px
         picture, narrow -> full    0.56 -> 0.88    ~920px  (in three beats)
         dead hold                  0.88 -> 1.00    ~346px

       The expansion is the largest visual change in the section and it was
       getting less scroll than the entry, with a third of a viewport doing
       nothing at the end. That ratio — not the section's overall length — is
       why this act reads as fast: per pixel scrolled it moves several times
       more than anything before it. Reclaiming most of the hold and giving
       the reclaimed distance to the growth beats evens the rate out. */
    var TOTAL_DUR  = (1 - EXPAND_AT) - 0.04;
    var STAGE1_DUR = TOTAL_DUR * 0.44;
    var CLEAR_AT   = EXPAND_AT + STAGE1_DUR;
    var CLEAR_DUR  = TOTAL_DUR * 0.12;
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
          top: geo.blockTop
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
      // Same test measure() used, so the two layouts cannot disagree.
      var wideNow = geo.wide;

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
      /* An ABSOLUTE `top`, not the delta. The measurement below is the delta —
         how far the panel's top edge has to travel from the card block up to
         the stage's ceiling — and it has to be added to where the panel
         actually starts, which is geo.blockTop.

         The two used to be the same number because stage 1 left the panel at
         `top: 0`, so a delta from there WAS an absolute position. Now that the
         panel is seated on the card block (geo.blockTop, so it spans the cards
         on every layout), the delta alone would land it that much too high —
         on a phone, a couple of hundred pixels above the stage, leaving the
         ground showing under the finished picture. */
      var topPx = (blockTop === Infinity)
        ? 0
        : geo.blockTop + (stageTop - blockTop);

      /* The takeover runs to the FULL STAGE on every layout.

         The compact branches used to hold the picture at the card block's own
         height and top (geo.fullVH / geo.blockTop), so stage 2 on a phone
         finished as a band across the middle of the section with the page
         ground showing above and below it — ~150px of gap at the top at 390px
         wide. That is the unfilled section: the reveal ends, the statement and
         the numbers come up, and they stand on a strip rather than on a
         picture that owns the stage.

         The reason it was held back no longer applies. That note reported the
         picture bursting out of the area the cards define — but the picture
         was seated 48px BELOW the block at every compact width (measure()
         cleared --doubts-media-cy on this branch), so it was never bracketing
         the cards to begin with and any height it gained showed as an edge in
         the wrong place. With the seat measured, the box now starts exactly on
         the block and grows out of it symmetrically, which is the same
         continuous move the wide layout makes.

         overW/overH/topPx are the stage's own measurements and are already
         computed above for the wide branch — the compact branch simply uses
         them too, so the two layouts cannot drift apart. */

      /* COMPACT ONLY: the takeover is sized to the LARGE viewport, not to the
         stage.

         The stage is `height: 100svh` — the SMALL viewport height, i.e. the
         height with the mobile browser's toolbars expanded. overH is that box,
         and it is correct for the card composition. It is NOT correct for the
         finished picture: the toolbars retract during this very scroll, the
         visible viewport grows to the large viewport height, and a picture cut
         to svh leaves a strip of page ground above and below it — measured at
         90px on a 390x844 phone whose small viewport is 754.

         A SEPARATE value rather than a change to overH: overH still feeds the
         wide branch and the <img> pinning in measure(), and both must keep the
         stage's own height. This one is read from --doubts-vh-full (declared
         on the stage in the max-width:1023px block in style.css, as 100lvh)
         and is only ever consulted below the desktop breakpoint.

         The picture is made TALLER THAN THE LARGE VIEWPORT and centred on the
         stage, rather than sized to exactly one viewport and pinned to an edge.

         Which edge the toolbar's space appears at is not fixed. On some
         viewports the pinned stage keeps its ceiling and the space opens at the
         foot; on others the stage re-centres as the viewport grows and the
         picture is carried DOWNWARD, opening the gap at the head instead —
         measured at 38px (375px wide) and 45px (768px) with the box anchored to
         its top edge, while 390px was flush. Anchoring to either edge therefore
         fixes one case and breaks the other.

         Covering BOTH is what the overshoot is for: the box takes the toolbar's
         full height as slack on each side and stays centred, so the visible
         viewport is covered wherever it lands within that range. The excess is
         cropped by the window the <figure> already is (overflow: hidden) and by
         the section's own clip, so the extra height is never seen as anything
         but photograph. */
      var compactOverH = overH;
      var compactTopPx = topPx;
      if (!wideNow) {
        /* MEASURED with a probe element, not read off the custom property.

           getComputedStyle() on an unregistered custom property returns the
           literal token it was declared with — "100lvh", not a pixel length —
           so parseFloat() on it yields 100 and would collapse the picture to a
           hundred pixels. The property is declared in the stylesheet so the
           unit lives with the rest of the section's CSS, but the VALUE has to
           come from laying it out. */
        var probe = document.createElement('div');
        probe.style.cssText =
          'position:absolute;top:-9999px;left:0;width:1px;visibility:hidden;' +
          'pointer-events:none;height:' +
          (getComputedStyle(stage).getPropertyValue('--doubts-vh-full') || '100lvh');
        stage.appendChild(probe);
        var lvhPx = probe.getBoundingClientRect().height;
        probe.remove();

        /* Only ever GROWS the picture. If lvh is unsupported, unreadable, or
           already equal to svh (every desktop browser, and any phone with
           static chrome), this leaves the stage's own height untouched. */
        if (isFinite(lvhPx) && lvhPx > overH) {
          /* The toolbar's height is the whole uncertainty: the viewport can
             grow by at most (lvh - svh), in either direction relative to the
             stage. Taking that much slack on BOTH sides covers every landing
             point, so the picture is (lvh + slack) tall and centred. */
          var slack = lvhPx - overH;
          compactOverH = lvhPx + slack;
          compactTopPx = topPx - slack;
        }
      }

      tl.to(media, {
          width:  overW,
          height: wideNow ? overH : compactOverH,
          top:    wideNow ? topPx : compactTopPx,
          duration: STAGE2_DUR
        }, STAGE2_AT);

      /* THE PAYOFF. The statement and the numbers come up ON the finished
         picture, in the dead scroll that was already being held at the end of
         the timeline (the 0.04 subtracted from TOTAL_DUR above).

         Placed at the END of stage 2, not underneath it, for the same reason
         the clear-out is its own beat: type rising through a frame that is
         still growing reads as two unrelated animations, and the line lengths
         reflow every frame while the box widens. By the time this starts the
         frame has stopped, so the layout the type is measured against is
         final and the only thing moving is the type.

         The rows lift in sequence — statement, then the stats band — which is
         the reading order, and it is what makes the band land as a floor
         under a claim that is already standing rather than as four numbers
         arriving with it. */
      if (reveal) {
        /* Queried individually rather than as .revealInner > * because the
           statement group is a WRAPPER (see .doubts__revealTop in the
           markup): lifting the wrapper would move its four children as one
           slab, and the sequence is the whole point. */
        var revealRows = [
          reveal.querySelector('.doubts__revealEyebrow'),
          reveal.querySelector('.doubts__revealTitle'),
          reveal.querySelector('.doubts__revealLede'),
          reveal.querySelector('.doubts__revealLink'),
          reveal.querySelector('.doubts__stats')
        ].filter(Boolean);

        /* MUST FINISH BY TIMELINE POSITION 1. The tail from 1 ->
           1+OVERLAP_SPAN is the cover rising over the pinned stage, so
           anything still animating past 1 plays behind a section that is
           already sliding up over it - which is exactly what a first pass
           did: the statement arrived, and the stats band was still under the
           fold when the cover ate it.

           MEASURED, not assumed. The timeline here is 1.3125 long (the tail
           is OVERLAP_SPAN on top of the composition's 1), and the cover
           crosses the fold at normalized progress ~0.755, which is exactly
           position 1. So position 1 really is the deadline.

           It starts at 0.62 of stage 2 rather than after it because the end of
           the timeline is a thin slice of scroll: anchored to the very end the
           whole reveal ran inside ~7.5% of the section - 282px of a 3780px
           track, less than one trackpad flick - and read as type snapping on
           at the last moment, or on a fast scroll never being seen at all.
           Starting mid-growth gives it a real run, and the frame is close
           enough to its final width by then that the type is not measured
           against a box still visibly moving.

           Widening the run is only half of it, though, and the weaker half: a
           longer animation is still an animation, and any animation can be
           crossed in one gesture. What actually guarantees the reader sees
           this is the HOLD after it (REVEAL_HOLD_VH), which cannot be crossed
           without scrolling through it. */
        var REVEAL_AT  = STAGE2_AT + STAGE2_DUR * 0.62;
        var REVEAL_END = 0.99;
        var REVEAL_DUR = REVEAL_END - REVEAL_AT;

        /* The scrim first and alone: it is what makes white type legible on
           the photograph, so it must be under the type before any of it is
           readable, not arriving with it. */
        tl.fromTo(reveal,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: REVEAL_DUR * 0.45 },
          REVEAL_AT);

        /* The rows are fitted INSIDE the reveal's own span rather than
           given free fractions of it. The last row finishes at
             offset + stagger*(n-1) + duration
           and with 0.2 / 0.09 / 0.7 that came to 1.26 of REVEAL_DUR - the
           tail of the stagger ran 77px past the composition's end and into
           the hold. Solving the fractions against the row count instead means
           the band lands exactly on REVEAL_END however many rows there are. */
        var ROW_OFFSET  = 0.14;
        var ROW_STAGGER = 0.08;
        var ROW_SPAN    = 1 - ROW_OFFSET - ROW_STAGGER * (revealRows.length - 1);

        tl.fromTo(revealRows,
          { y: 26, autoAlpha: 0 },
          {
            y: 0, autoAlpha: 1,
            duration: REVEAL_DUR * ROW_SPAN,
            stagger: REVEAL_DUR * ROW_STAGGER,
            ease: 'power2.out'
          },
          REVEAL_AT + REVEAL_DUR * ROW_OFFSET);
      }
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

      /* Cards move HORIZONTALLY away from the channel — the reference's
         `x: ±itemWidth / 2` on its two lists, one sign per side. That is the
         motion the reveal is made of: the cards pull apart and the picture
         occupies exactly the gap they open.

         This is ONE code path for both layouts now. The compact grid used to
         opt out of it into a 10px vertical drift, because its cards filled the
         frame and had nowhere to be pushed to; narrowing and centring that
         grid (max-width in the compact block of style.css) gives them the same
         room the desktop block has always had, so the same push applies.

         The v.mid branch below is the desktop's alone in practice. Its rows
         are raked, so a card can sit ON the channel in its own row (the top
         row's card 3 and the bottom row's card 4 are each outboard of the
         shared join). Such a card has nowhere sideways to go that helps — the
         picture is not growing toward it — so it steps aside VERTICALLY
         instead, and only as far as the picture's edge actually reaches it.
         The compact grid is two even columns with every card cleanly one side
         of the seam, so nothing there is `mid` and all six take the push. */
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

       OVERLAP_SPAN is that proportion: OVERLAP_VH viewports of the TRACK_VH
       the composition uses. Derived from the same two numbers the `end` is
       built from, so retuning either cannot put the two out of step. */
    var OVERLAP_SPAN = OVERLAP_VH / TRACK_VH;

    /* The hold, in the same units: viewports of the track the composition
       occupies. It sits BETWEEN the composition finishing and the cover
       starting, so the timeline is now
         0 .. 1                         the composition
         1 .. 1+HOLD_SPAN               the finished picture, standing still
         .. +OVERLAP_SPAN               the cover rising over it
       and the deadline the reveal has to beat is still position 1. */
    var HOLD_SPAN = REVEAL_HOLD_VH / TRACK_VH;

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
    /* THE COVER IS NOT ANIMATED BY A TWEEN - it is pulled up by a negative
       margin and then rises PASSIVELY with page scroll for whatever spacer
       distance is left under it. That is what makes the overlap 1:1 and it is
       why the margin, not the timeline, decides how far it travels.

       It also means the hold and the cover are in direct conflict: the hold
       claims pin distance that the cover must NOT move through, but a passive
       rise moves through everything. Cancelling the hold in the margin as well
       fixed the extra scroll and destroyed the hold with it (the stats band
       started being covered 160px after the composition ended); cancelling
       only the overlap gave the hold back and put the empty scroll back, since
       the cover then spent 1400px crossing a 900px viewport at two-thirds rate.

       So the margin keeps its original job - cancel the overlap, exactly one
       viewport of travel - and the HOLD is handled separately below, by
       pinning the cover in place with a transform for its duration and then
       releasing it. Distance the cover is held through is distance it does not
       rise through, which is what the hold was always asking for. */
    if (next) {
      next.style.marginTop = (-Math.round(
        window.innerHeight * (OVERLAP_VH + REVEAL_HOLD_VH)
      )) + 'px';
    }

    /* The hold first, then the overlap. Two empty tweens rather than one: the
       cover's pull-up is keyed to OVERLAP_VH alone (it must travel exactly one
       viewport, no more), while the hold adds scroll distance that the cover
       must NOT move through. Merging them would have made the cover rise
       across the hold as well, at a fraction of the rate, which is the slow
       drifting overlap this was meant to avoid. */
    /* THE HOLD, expressed on the cover itself.

       The margin above pulled the cover up by OVERLAP + HOLD, so without this
       it would already be mid-rise when the composition finishes. This tween
       puts that borrowed distance back as a transform for the hold's duration:
       the cover sits translated DOWN by the hold's height - i.e. exactly where
       the margin would have left it without the hold - holds there while the
       reader scrolls the hold's distance, and then travels back to 0 across
       the overlap.

       The net effect is the one the hold was added for: the finished payoff
       stands still and uncovered for ~500px of scroll, and the cover then does
       its full 1:1 viewport rise afterwards, with no empty scroll at either
       end because every pixel of pin is now doing something. */
    var holdPx = Math.round(window.innerHeight * REVEAL_HOLD_VH);

    tl.fromTo(next,
      { y: holdPx },
      { y: holdPx, duration: HOLD_SPAN, ease: 'none' },
      1);
    tl.to(next, { y: 0, duration: OVERLAP_SPAN, ease: 'none' }, 1 + HOLD_SPAN);
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
    /* The payoff layer and its rows: build() writes autoAlpha/y onto both the
       layer and each child, so both have to be released — clearing only the
       wrapper would leave the rows sitting at opacity 0 inside a visible
       parent after a resize. */
    if (reveal) {
      reveal.style.removeProperty('--doubts-reveal-drop');
      gsap.set(reveal, { clearProps: 'all' });
      gsap.set(reveal.children, { clearProps: 'all' });
      gsap.set(reveal.querySelectorAll('.doubts__revealInner *'), { clearProps: 'all' });
    }
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
