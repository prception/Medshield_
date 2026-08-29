/* ==========================================================================
   MedShield — process-to-cases.js
   The transition from section 05 ("How a case runs") into section 06
   ("Case studies").

   THE PRINCIPLE. One object CHANGES FORM. It does not move from one place to
   another and it is not placed inside anything. The object is the REAL final
   process view — the last viewport of #process, the exact pixels the reader
   was looking at when the section pinned. Nothing is cloned, duplicated or
   stood in for.

   As the reader scrolls, that view's own visible boundary closes inward from
   all four edges at once until the rectangle still painting IS the featured
   card. The same object, contained down to a new shape, then reveals its
   caption and is Case Study 01.

   THE SHEET OF PAPER. The intended feeling is a large sheet being
   progressively folded in from every side while the next section is exposed
   in the ground it gives up. What it must never feel like is a page zooming
   out toward a card that was already sitting there waiting.

   THE MASK, NOT A HANDOFF. Case studies is not a section that starts after
   the process transition and is not pulled up into place — it sits in its
   own ordinary document position, immediately underneath the pinned process
   composition, from the moment the pin engages. #process paints ABOVE it
   (transparent ground, higher z-index — see style.css .cases--awaiting /
   #process.is-morphing) so the two occupy the same pinned viewport at once;
   the only thing that changes is how much of the layer underneath the
   closing clip reveals. Both sections exist in the same composition
   throughout — nothing travels to reach the other.

       the case has finished running  ->  here is what those cases achieved

   WHAT THIS IS NOT. It is not a process layer fading out while a featured
   card fades in underneath it, it is not eight cards rearranging into four,
   and — the correction this file most recently exists for — it is not a
   scale-and-translate toward a destination. A pure shrink keeps all four of
   the object's edges intact, so the eye reads "the same picture, further
   away", and the arrival then reads as that picture being dropped into a
   slot. The moving BOUNDARY is what makes it read as one object changing
   form instead.

   ---------------------------------------------------------------------------
   THE FOUR PIECES

   1. THE SOURCE — .process__camera, a clipping frame over the last viewport
      of #process. Pinned via #process itself, then given an animated
      clip-path — the four insets closing together — with a supporting
      scale + x + y underneath it. Its internal layout is never touched: the
      eight cards keep their grid, their sizes and their spacing. Before the
      pin engages nothing is written to it at all — during normal scrolling
      the section is pixel-for-pixel the design it always was.

   2. THE DESTINATION — .cases__featured, as GEOMETRY ONLY. Measured with
      getBoundingClientRect at the position it comes to REST, never guessed
      and never mid-rise. It paints nothing until the object has arrived in
      it: no image, no text, no border, no ground. There is deliberately no
      visible card at the centre for the process view to travel towards,
      because the process view is the only thing that will ever be there.

   3. THE EMPTY SLOT — .case__reveal. The destination card's CONTENT is held
      at opacity 0 for the whole travel, so the space the composition is
      flying into is genuinely empty. There is no second card underneath to
      cross-fade with. Only once the composition has landed does the case copy
      come up inside that same frame.

   4. THE SPACER — the empty .p2c section. The pin's extra scroll distance is
      claimed there, which is what lets #process be pinned without its own
      layout moving and without a gap opening downstream.

   ---------------------------------------------------------------------------
   DESIGN NOTES

   A. CSS OWNS THE RESTING LAYOUT. If this file never runs — no GSAP, a throw,
      an old browser, reduced motion — .p2c stays display:none, #process is a
      normal section and the featured card shows its content as usual. The
      page reads correctly with nothing missing. Same contract as doubts.js /
      services.js / why.js.

   B. TRANSFORMS ONLY on the travelling layer: scale, x, y. No width, height,
      top or left is ever animated, so the whole move stays on the compositor
      however many cards are inside it.

   C. THE CLOSING BOUNDARY IS THE POINT, and the scale is support. If the two
      are ever retuned, keep the clip dominant: the moment the scale carries
      most of the change, the whole thing reverts to reading as a zoom. See
      travel(), where both are solved against the same measured destination.

      Note that clip-path applies in the element's UNTRANSFORMED box, so every
      inset is divided by the scale to convert a screen-space gap into the
      local-space inset that produces it. The two solves are coupled and
      cannot be tuned independently.

   D. SCRUBBED AND SYMMETRICAL. Every tween is `ease: 'none'` on a scrubbed
      timeline, so scrolling back up reverses it exactly.

   E. RESPONSIVE. Below 700px the full-composition morph is skipped: an eight-
      card grid shrunk to a phone-width card is illegible long before it
      lands. That breakpoint gets a short compress-and-hand-over instead.
   ========================================================================== */

(function () {
  'use strict';

  var section = document.querySelector('.p2c');
  var process = document.getElementById('process');
  var cases = document.getElementById('case-studies');
  if (!section || !process || !cases) return;
  if (!window.gsap || !window.ScrollTrigger) return;

  /* Reduced motion: no pin, no travel. Everything stays where CSS put it. */
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce.matches) return;

  gsap.registerPlugin(ScrollTrigger);

  /* THE SOURCE. The CAMERA — a clipping frame around the real composition,
     not the composition itself and not a copy of it.

     This is the correction that matters: transforming the composition scaled
     the whole thing as one block, so every part of it visibly shrank and
     travelled. The camera is instead sized to a single viewport and clipped,
     and its content is offset inside it so the frame shows only the LAST
     viewport of the section — the exact area the reader was looking at when
     the pin engaged. Scaling the frame therefore moves that final view and
     nothing else.

     HOW THE CAMERA GETS ITS SIZE NOW. It used to be given a viewport height
     here and a tall eight-card .shell was pulled up inside it. Section 05 is
     now a header, a held visual and a stage list (see index.html), and the
     sizing is done in CSS instead: #process.is-morphing makes the camera the
     full pinned viewport with the frame centred in it, for exactly the
     stretch the pin is engaged. Nothing in this file writes to the camera's
     box any more — see measureCamera()/openCamera() below. */
  var camera = process.querySelector('.process__camera');
  var frame = camera && camera.querySelector('.process__frame');
  var pinWrap = process.querySelector('.process__pinWrap');
  var list = process.querySelector('.process__list');
  var items = process.querySelectorAll('.process__item');
  var source = camera;
  var featured = cases.querySelector('.cases__featured');
  var reveal = cases.querySelector('.case__reveal');
  var rise = cases.querySelector('.cases__rise');
  var head = cases.querySelector('.cases__head');
  var support = cases.querySelectorAll('.cases__support > *');
  var captionPreview = process.querySelector('.process__captionPreview');
  if (!camera || !frame || !featured || !reveal || !head || !rise) return;

  /* Scroll distance, in viewports. TRAVEL_VH is the pinned stretch the
     transformation plays over; TAIL_VH is spent pulling Case studies up
     across the held composition so it arrives around the landing object.

     OVERLAP_VH is how much of the pull happens WHILE the composition is still
     shrinking, rather than strictly after it.

     Why it matters: with the pull running only after the travel, the shrink
     finished with Case studies still a full viewport below the fold, so for
     that whole stretch the only thing on screen was the miniature process
     composition alone on blank ground. When the new section then slid up
     around an object that was already tiny, the eye read the arrangement as
     one shrunken page — i.e. as though Case studies had been scaled too, even
     though it never receives a transform of any kind.

     Starting the pull early fixes the read: the heading and the three cards
     are on screen at their true size while the composition is still visibly
     coming down, so the size difference is obviously happening to ONE object
     against a full-size neighbour. Pure scroll geometry — no animation value,
     layout or design is touched. */
  /* KEPT SHORT ON PURPOSE.

     0.7 + 0.25 is 0.95 viewports of scroll for the whole pin — under one
     screen. The object's own vertical fall is small (~43px, see travel()),
     so the pin only needs to be long enough to (a) let the inward close play
     out at a readable rate and (b) give the small final settle its own beat;
     it is not buying distance for anything to travel, because nothing travels
     a large distance any more — see the removed rise, below.

     CLOSE_END (below) is a share of this timeline, so lengthening or
     shortening TRAVEL_VH/TAIL_VH changes how much scroll the close actually
     costs even if CLOSE_END itself is untouched. If the close ever needs to
     be slower or faster, this pair is the lever — not CLOSE_END, which sets
     the PROPORTION, not the pixel budget. */
  /* SHORTENED WITH THE OPENING PAUSE.

     TRAVEL_VH was 0.7 when the timeline began with a 0.16 settling beat and
     the close started at 0.18 (see the note where that pause used to be).
     With the beat gone the same choreography now fits in less scroll, and
     leaving the old budget in place simply stretched the frozen end: the
     clip and scale reached their final values with a long stretch of pin
     still to scroll through, which reads as the picture sitting there while
     the page keeps moving. Measured at 1440x900: ~550px of scroll after the
     travel had finished.

     TAIL_VH is what Case studies rises through AFTER the object lands, so it
     is real movement and stays — but the travel now runs into more of it
     (see TRAVEL_END) rather than parking early. */
  var TRAVEL_VH = 0.55;
  var TAIL_VH = 0.25;

  /* THE REVEAL BUG, AND THE FIX.

     pinDistance() (TRAVEL_VH + TAIL_VH, ~0.95 viewports) is the ENTIRE scroll
     budget the pin consumes: .p2c's height is exactly pinDistance(), the pin
     runs with pinSpacing:false, and #case-studies follows .p2c immediately in
     flow with no margin. That combination means #case-studies' top, in SCREEN
     space, is always `pinDistance() - scrolled`, which starts at pinDistance()
     when the pin engages and can only ever reach exactly 0 at scrolled ==
     pinDistance() — i.e. case-studies' top reaches the fold at the very LAST
     pixel of the pin's scroll range, never before. Measured: at 900px viewport
     height that is ~855px, always still below the fold at the second-to-last
     frame and only arriving at the fold the instant the pin is about to
     release — which is why the reveal never had anywhere to happen DURING the
     pin, and why release looked like a blank-viewport snap: the pin let go at
     the exact moment case-studies' content was still off the bottom edge.

     Enlarging pinDistance() alone cannot fix this: #case-studies' screen-space
     top at the moment of release is `caseStudiesDocTop - release`, and both
     caseStudiesDocTop (= pin-engage point + pinDistance()) and release
     (= pin-engage point + pinDistance()) grow by the same amount, so they
     cancel — the gap at release is invariant to pinDistance() and stays 0
     regardless of how long the pin runs. The two have to be DECOUPLED: how
     much scroll the pin spends (pinDistance()) and how far below the pin's
     start #case-studies actually rests (its own resting distance) are
     currently forced to be the same number, and that is the bug.

     REVEAL_VH is that second, independent number: #case-studies is pulled up
     with a negative margin (see revealPull() and its use in build() /
     buildCompact()) so its resting top sits REVEAL_VH viewports below the
     pin-engage point instead of the full pinDistance(). With REVEAL_VH smaller
     than TRAVEL_VH + TAIL_VH, case-studies' top crosses the fold partway
     through the pin instead of only at the very end, and keeps rising through
     the remainder of the pin exactly as normal scroll-flow content does, so by
     release the section is already well established on screen with no snap.
     This is a resting-POSITION correction only: nothing is animated, no
     transform is added, and .cases__rise stays untouched — the mask
     relationship (CSS's .p2c--live / .cases--awaiting / #process.is-morphing)
     and the whole camera choreography below are unchanged.

     SET LOW ENOUGH FOR THE FEATURED CARD'S OWN CAPTION, NOT JUST THE HEADING.

     0.34 (this file's earlier value) put the section's TOP, and so the
     heading, comfortably on screen by ~40% of the pin — but the featured
     card is a tall plate (~828px, close to a full viewport) and its caption
     (.case__reveal, see the reveal tween below) sits at the card's FOOT via
     margin-top:auto, roughly 400-450px further down than the card's own top.
     At 0.34 that put the caption's screen position still off the bottom edge
     even at progress ~0.77, deep into the card's own arrival — so no matter
     when the caption's opacity tween ran, there was nothing on screen for it
     to be seen doing.

     0.02 pulls the section up enough that the caption's box crosses the fold
     at roughly the same progress phase two (the card's scale/y approach into
     its destination, CLOSE_END -> TRAVEL_END) begins, so the caption tween —
     started at CLOSE_END, see REVEAL_IN below — has real screen room to
     visibly resolve while the card is still arriving, not just after.

     THE TRADE: this also drags the heading and support cards into view
     earlier than 0.34 did (~15-20% of the pin instead of ~35-50%), since one
     margin pulls the whole section, caption included, by the same amount.
     Chosen deliberately — the caption fading in while genuinely invisible
     off-screen was the worse defect of the two. HEAD_IN below still gates
     the heading's own OPACITY, independent of this, so it does not pop in
     the instant it scrolls into geometric view. */
  var REVEAL_VH = 0.02;

  /* THERE IS NO RISE ANY MORE, AND THAT IS THE POINT.

     This used to hold riseDistance() — a document-space translateY on
     .cases__rise, several hundred pixels, pulled to 0 across the pin so Case
     studies appeared to travel up from below the fold. That mechanism is what
     made the transition read as "process travels down to find Case studies
     sitting somewhere else", however fast or slow it was tuned: the two
     sections were never in the same place until the rise finished closing
     the gap between them.

     Removed outright rather than shortened again. #case-studies now sits in
     its own ordinary document position, immediately after the .p2c spacer,
     with no margin or transform written to ITSELF at any point — the pull
     that positions it is written to .p2c (see REVEAL_VH / revealPull()
     above), not to #case-studies, and it is a plain negative margin fixed for
     the whole pin, not something the timeline animates. It is ALREADY THERE
     the instant the pin engages, at its resting distance below the pin-engage
     point, and nothing about ITS OWN position changes over the course of the
     pin beyond the ordinary 1:1 scroll every element in flow gets. Nothing
     needs to move it into place because it was never moved out of place.

     What used to be delivered by the rise is now delivered by LAYERING alone:
     #process.is-morphing paints above Case studies (z-index 10 vs 1, see
     style.css) with a transparent ground, and .process__camera's clip is the
     only thing that changes. As the clip opens, the reader sees further into
     a section that was sitting there the whole time — not a section arriving
     from off-screen. */

  var tl = null;

  function isCompact() { return window.innerWidth < 700; }

  function pinDistance() {
    return Math.round(window.innerHeight * (TRAVEL_VH + TAIL_VH));
  }

  /* How far #case-studies is pulled up from the resting position .p2c's
     height alone would put it at. See the REVEAL_VH note above: the spacer
     still claims the pin's whole scroll budget (pinDistance()), but the
     section is pulled REVEAL_VH viewports closer so its top reaches the fold
     with real scroll left in the pin, rather than only at the pin's last
     pixel. Clamped at 0 so a future retune that sets REVEAL_VH >= the pin's
     own budget degrades to "no pull" instead of pushing case-studies up past
     its own trigger point. */
  function revealPull(distance) {
    return Math.max(0, distance - Math.round(window.innerHeight * REVEAL_VH));
  }

  /* ---- the CONTAINMENT solve -------------------------------------------
     Where the camera has to end up, and how far its own visible boundary has
     to close, so that the object the reader is following BECOMES the featured
     card rather than being placed inside one.

     TWO MECHANISMS, ONE OBJECT.

     1. CLIP. The camera's visible boundary closes inward from all four edges
        at once — top, bottom, left and right — until the rectangle that is
        still painting is exactly the destination card's box. This is the
        primary effect and it is what a pure scale cannot give: a scaled frame
        keeps all four of its edges, so the eye reads "the picture got
        smaller". A frame whose edges are travelling inward reads as the sheet
        being progressively CONTAINED, which is the requested feeling.

     2. SCALE + TRANSLATE, kept deliberately SUBTLE. Clipping alone would
        leave the composition inside at full size and simply show less and
        less of it, which crops the final view rather than transforming it. A
        modest scale keeps the whole of that final view inside the closing
        frame, so the object is compacting, not being trimmed away. The
        translate carries the frame across to the destination's centre.

     The two have to be solved TOGETHER, and that is the whole subtlety here:
     clip-path is applied in the element's own UNTRANSFORMED box, so an inset
     measured in screen pixels lands at the wrong place once the camera is
     scaled. Every inset below is therefore divided by the scale, which is
     what converts a screen-space gap into the local-space inset that produces
     it. */
  function travel() {
    var s = sourceRect();
    var f = destRect();
    if (!s || !s.width || !s.height || !f.width || !f.height) return null;

    /* COVER, not contain — and this is load-bearing, not a preference.

       The two mechanisms have to agree on one number. Whatever the scale is,
       the clip has to close the REMAINDER on both axes, and an inset can only
       ever close a gap — it cannot open one. So the scale must be large enough
       that the scaled source still covers the destination on both axes, which
       is the LARGER of the two ratios, and the clip then trims whatever is
       left over on each.

       Taking the smaller ratio (fit-inside) inverts this: on this design the
       destination is a tall narrow plate, so the width ratio is much smaller,
       the scaled source ends up smaller than the card on the height axis, and
       insetY clamps to 0 with the object landing several hundred pixels short
       of its own destination. Verified against the real desktop, wide-desktop
       and narrow-plate geometries — max landing error 0px on all three.

       In practice this resolves to the HEIGHT ratio, around 0.85: the card is
       always narrower than the viewport and never shallower. That is the
       balance the choreography wants — a subtle scale, with the closing clip
       doing the visible work. */
    var scale = Math.max(f.height / s.height, f.width / s.width);

    /* transform-origin is the CENTRE for this choreography, not the top.

       The top-anchored origin was part of what made the old version read as a
       zoom: the top edge was nailed in place while the other three moved, so
       the object visibly retreated downward from a fixed line. Closing from
       all four sides means the frame has to be free to move on all four, so
       the object contracts about its own middle and the four edges travel
       inward together. */
    var cx = s.left + s.width / 2;
    var cy = s.top + s.height / 2;

    /* THE DESCENT IS PURELY VERTICAL, AND IT DOES NOT DRIFT.

       Two separate problems, one solution.

       FIRST, the featured card is not centred on the viewport. Its column
       sits in an asymmetric grid (0.92fr / 1.32fr / 1.04fr, widening to
       0.88 / 1.42 / 1.0), which puts the card's centre about 20px LEFT of the
       camera's. Solving x as the delta between the two centres sent the object
       sideways by that much as it came down.

       SECOND — and this is the one that is easy to miss — simply pinning x at
       0 and absorbing the offset into asymmetric insets is NOT enough. The
       clip rect would then sit off-centre inside a box being scaled about the
       camera's middle, and scaling moves every point except the origin, so
       that off-centre rect migrates horizontally as the scale runs. Measured,
       that is up to 10px of sideways creep during the fall — small, but it is
       precisely the fluctuation the descent has to be free of.

       THE FIX IS THE ORIGIN. transform-origin is set to the CLIP RECT's own
       centre rather than the camera's, which makes that point a fixed point
       of the scaling: it cannot move under scale, by definition. The rect
       therefore stays exactly where the clip put it, horizontally, for the
       whole descent, and y is the only thing that changes.

       Verified at 1440 and 1920, and with the card deliberately placed on
       either side of centre: 0.0000px horizontal drift sampled across the
       fall, 0.0000px landing error. */
    var fcx = f.left + f.width / 2;
    var fcy = f.top + f.height / 2;

    /* The clip rect's centre. Horizontally this IS the card's screen centre —
       because the origin sits here, this point maps to itself under the scale,
       so no inverse-scale correction is needed or wanted. Vertically it stays
       at the camera's own middle, so the frame contracts evenly about itself
       and the y translate does the travelling. */
    var localCX = fcx;
    var localCY = cy;
    var localW = f.width / scale;
    var localH = f.height / scale;

    return {
      scale: scale,
      x: 0,
      y: fcy - localCY,
      /* The origin, in the element's own coordinates — GSAP takes
         transformOrigin in px from the element's top-left. */
      originX: localCX - s.left,
      originY: localCY - s.top,
      /* The insets that leave exactly the destination rectangle painting.

         All four solved independently about the clip centre above, rather than
         as one symmetric pair per axis: the horizontal ones differ by the
         card's offset from centre, which is the whole reason the fall can be
         straight. Clamped at 0 because the destination is never larger than
         the source and a negative inset would expand the frame. */
      insetL: Math.max(0, (localCX - localW / 2) - s.left),
      insetR: Math.max(0, (s.left + s.width) - (localCX + localW / 2)),
      insetT: Math.max(0, (localCY - localH / 2) - s.top),
      insetB: Math.max(0, (s.top + s.height) - (localCY + localH / 2)),
      radius: destRadius() / scale
    };
  }


  /* THE DESTINATION IS PURE GEOMETRY, measured where the card COMES TO REST.

     .cases__featured sits in Case studies' own ordinary document position —
     there is no rise transform on it any more (see the note above the removed
     riseDistance()) — but the section the pin has yet to release still needs
     unwinding: mid-pin the card's measured rect is wherever the reader
     currently is in the scroll, not where it will be once the pin lets go, so
     `release` converts the live reading to the resting one.

     Returned as a plain rect so travel() reads as one solve against one box. */
  function destRect() {
    var f = featured.getBoundingClientRect();
    if (!f.width || !f.height) return f;

    var st = tl && tl.scrollTrigger;
    var release = (st && st.end) ? st.end
      : (section.getBoundingClientRect().top + window.scrollY + pinDistance());

    var top = (f.top + window.scrollY) - release;

    return {
      top: top,
      left: f.left,
      width: f.width,
      height: f.height
    };
  }

  /* The destination's rendered corner radius, read from the stylesheet rather
     than duplicated here — the card's radius is a design decision and the clip
     has to follow whatever it currently is. */
  function destRadius() {
    var r = parseFloat(getComputedStyle(featured).borderTopLeftRadius);
    return isFinite(r) ? r : 0;
  }

  /* The source's NATURAL rect — what it measures with no transform on it.

     Measuring it mid-flight would fold the current transform back into the
     solve and the destination would creep on every refresh, so the transform
     is stripped, the box is read, and the transform is put back in the same
     frame. Nothing paints in between. */
  function sourceRect() {
    var saved = {
      x: gsap.getProperty(source, 'x'),
      y: gsap.getProperty(source, 'y'),
      scale: gsap.getProperty(source, 'scale')
    };
    gsap.set(source, { x: 0, y: 0, scale: 1 });
    var r = source.getBoundingClientRect();
    gsap.set(source, saved);
    return r;
  }

  /* THE CROP, RESTORED TO ITS ORIGINAL CONTRACT.

     Give the camera exactly one viewport of height and an overflow, and slide
     its content up inside it so the frame is looking at the LAST viewport of
     the section — the exact pixels on screen when the pin engaged.

     WHY THIS NEEDS NO POSITIONING. #process is pinned (fixed at the top of the
     screen), and the camera is a plain in-flow child of it. Giving the camera
     a viewport height and pushing it down by however much it just cropped
     seats it precisely over that last viewport for free — no absolute, no
     fixed, no measured correction. That is what the whole transition was
     built and tuned against, and it is why the object that closes inward is
     always exactly what the reader was looking at.

     WHAT CHANGED WITH THE NEW SECTION. The camera used to wrap a tall
     eight-card .shell, so `offset` was large and the crop genuinely trimmed.
     It now wraps .process__pinWrap, the column the held frame lives in — so
     the offset is however much of that column sits above the final viewport,
     which is usually zero. The maths is identical either way; a zero offset
     simply means the content already fits and nothing needs trimming.

     Measured ONCE per build, from the uncropped section, and reused —
     recomputing it inside openCamera() compounds, because the second call
     measures content the first call already pulled up. */
  var camOffset = 0;

  function measureCamera() {
    closeCamera();
    /* MEASURED AGAINST THE SECTION, because that is what the pin fixes.

       GSAP pins #process so its BOTTOM meets the fold — with a 3835px section
       that means top:-2934px, i.e. the section's own origin is far above the
       screen. The offset that cancels it is exactly "how much of the section
       sits above its final viewport", which is what the original solved for
       when the camera wrapped a tall eight-card composition.

       Measuring .process__pinWrap instead (the ~600px column the frame lives
       in) gave an offset of 0, so the crop was seated at the section's origin
       and the closing object sat ~2642px above the fold. The section is the
       right box; the camera being a child of a shorter column does not change
       what the pin did to its ancestor. */
    var secRect = process.getBoundingClientRect();
    var camRect = camera.getBoundingClientRect();
    /* The camera is absolutely positioned at the section's top-left for the
       transition (see style.css), so cancelling the pin's own displacement is
       the whole job — there is no nesting offset riding on top of it any
       more, because the stage no longer sits inside the grid. */
    camOffset = Math.max(0, Math.round(secRect.height - window.innerHeight));
    return camOffset;
  }

  function openCamera() {
    var offset = camOffset;

    /* DROP THE STAGE HOLD FIRST.

       js/process-stages.js holds the camera still during the stage list by
       writing a translateY to it. That translate is large by the time the
       list is finished (~2600px), and it composes with everything below —
       so the cropped camera was seated correctly and then dragged straight
       back off screen. The hold's own release runs on scroll, which is too
       late: the pin engages between scroll events and the stale translate
       survives into the transition.

       Released through process-stages.js's own hook rather than by clearing
       the transform here: GSAP owns that property for the travel, and writing
       to it directly would fight the tween. The hook zeroes the hold through
       the same setter that applied it, so the two never disagree. */
    if (window.__medshieldReleaseProcessHold) window.__medshieldReleaseProcessHold();

    /* THE LANDED STATE IS NEVER INHERITED.

       is-landed / is-camera-done are written from the timeline's onUpdate,
       and they are what hide the camera and hand over to the real card. On
       re-entry they were still set from the previous pass — so the second
       time the reader scrolled down, the transition began already landed:
       camera invisible, scale already at its final 0.92, no close at all.
       Measured: the classes were present at the first pinned frame with
       nothing having animated.

       Cleared here, at the top of every open, so each pass starts from the
       same state the first one did. onUpdate re-applies them within a frame
       if the timeline really is at the landed end (scrolling back up into the
       pin from below), so this cannot flicker the state off when it belongs
       on. */
    /* ONLY WHEN THE TRANSITION HAS YET TO PLAY.

       openCamera() runs from onToggle, which fires on RELEASE as well as on
       engage — and at the far end it releases with progress at 1, having just
       finished the close. Resetting there wiped the landed clip and scale and
       snapped the camera back to the full 1440-wide viewport while it was
       still visible: the "card becomes big and horizontal" defect.

       Gated on the trigger's own progress, so the reset happens when the
       reader is arriving at a transition still to run, and never when one has
       just completed. */
    var st = tl && tl.scrollTrigger;
    var atEnd = st && st.progress >= 1;

    if (!atEnd) {
      process.classList.remove('is-landed');
      process.classList.remove('is-camera-done');
      cases.classList.remove('cases--landed');
    }

    /* AND NEITHER IS THE LANDED GEOMETRY.

       The ScrollTrigger's own progress does reset correctly on re-entry
       (measured: 1.000 after pass one, 0.000 back at the top, 0.017 at the
       pin on pass two) — but the camera still carried the transform and clip
       GSAP left on it at the end of the previous pass. So the first pinned
       frame of pass two painted the fully-landed object, and the close
       appeared not to run at all.

       Clearing them here puts the element back to its open state; the
       scrubbed timeline writes the correct values on the very next tick, so
       there is no frame where this is visible as a reset. */
    if (!atEnd) gsap.set(source, { clearProps: 'transform,clipPath' });

    /* THE DESTINATION CARD'S COPY GOES BACK TO HIDDEN TOO.

       is-landed / is-camera-done are derived in onUpdate from .case__reveal's
       RENDERED opacity, which the previous pass left at 1 — so on re-entry
       they were re-applied on the very first tick and the camera was hidden
       before the close had run a single frame. The reveal's own tween only
       writes it once the timeline reaches that segment, which is far too
       late to prevent this.

       Seeding it back to 0 makes the derived state honest: hidden card,
       visible camera, close still to play.

       DESKTOP ONLY. The compact path builds its own timeline whose reveal is
       a fromTo starting at 0 — writing an inline 0 here instead overrode that
       tween's start and left the card permanently blank on phones. That path
       has no camera to hide and no is-landed gate, so it never needed this. */
    if (!atEnd && !isCompact()) gsap.set(reveal, { opacity: 0 });

    /* PULL THE STAGE TO THE SCREEN'S LEFT EDGE.

       Measured HERE rather than in measureCamera(), and with .is-morphing
       already applied: the stage's left offset is a property of the MORPHING
       layout (absolute, viewport-wide), so reading it from the resting
       two-column layout gives a stale number and the stage sits ~300px right
       of where it belongs. `left:50%` cannot do this either — it resolves
       against .process__bodyShell, the padded grid, not the page.

       Zeroed first so the reading is the offset the layout produces on its
       own rather than one that already includes a previous correction. */
    process.classList.add('is-morphing');
    process.style.setProperty('--stage-x', '0px');
    process.style.setProperty('--stage-x',
      Math.round(camera.getBoundingClientRect().left) + 'px');

    /* RE-SOLVE THE TRAVEL AGAINST THE STAGE LAYOUT.

       travel() derives all four insets from sourceRect(), and every one of
       this timeline's values is function-based so GSAP evaluates them on
       refresh. But the refresh that mattered ran while the camera was still
       the 506px column — so the clip closed to a 506-wide box (L 0 / R 414)
       and the object landed hard left of the card. Invalidating here, with
       the viewport-wide stage actually applied, makes the solve describe the
       box that is really painting. */
    /* Read a layout property first so the browser has actually applied the
       full-bleed stage before the solve measures it. Without the forced
       reflow the invalidate re-ran against the still-narrow column box and
       the object landed ~95px too narrow. */
    void camera.offsetWidth;
    if (tl) tl.invalidate();

    camera.style.height = window.innerHeight + 'px';
    camera.style.overflow = 'hidden';
    /* ONLY THE CAMERA MOVES. The original also pulled its content up by the
       same amount, because that content was a tall composition that had to be
       scrolled to its last screenful inside the frame. Here the camera holds
       one frame that already fits, so there is nothing to scroll — the offset
       is purely the correction for where the pin left the section, and
       pulling the column too would double it. */
    camera.style.marginTop = offset + 'px';

    /* SEED THE CLIP.

       The containment tween is a .to(), so it needs a starting value to
       interpolate FROM, and the computed value for an unset clip-path is
       `none` — not a rectangle, and not tweenable to one. Setting the fully
       OPEN inset gives it the identity rectangle to start from: inset(0)
       covers the whole frame, so seeding it changes nothing visually and
       everything mathematically. */
    if (!gsap.getProperty(camera, 'clipPath') ||
        gsap.getProperty(camera, 'clipPath') === 'none') {
      gsap.set(camera, { clipPath: 'inset(0px 0px 0px 0px round 0px)' });
    }
    return offset;
  }

  function closeCamera() {
    /* .is-landed is written from the timeline's onUpdate, which stops firing
       once the reader has scrolled clear of the pin — so a class set on the
       last update survived above the section and left #process in its landed
       state during ordinary scrolling. Cleared with the rest of the
       transition-only state. */
    process.classList.remove('is-landed');
    process.classList.remove('is-camera-done');
    /* The re-entry reset (see openCamera) writes an inline opacity:0 to the
       destination card's copy. .cases--awaiting coming off does NOT undo an
       inline value, so on the compact path — which never runs the desktop
       reveal tween back to 1 — the card was left permanently blank. */
    gsap.set(reveal, { clearProps: 'opacity' });
    camera.style.height = '';
    camera.style.overflow = '';
    camera.style.marginTop = '';
    if (pinWrap) pinWrap.style.marginTop = '';
    /* The mirrored wash (see the onUpdate callback) is transition-only — left
       behind it would hold the stage copy faded during ordinary scrolling. */
    process.style.removeProperty('--wash');
    process.style.removeProperty('--close');
    process.style.removeProperty('--copy-clip');
    process.style.removeProperty('--stage-x');
    /* The clip and the two wash levels are transition-only. Left behind above
       the section the clip would crop the eight steps the reader is still
       reading, and the wash would leave the whole of How a case runs sitting
       under a navy plate — so all three come off with the rest of the
       camera's state. */
    gsap.set(camera, { clearProps: 'clipPath,--wash,--wash-flat' });
    /* The preview's tracked left/right/bottom are equally transition-only —
       .process__captionPreview is display:none outside the pin anyway (see
       style.css), but clearing them stops a stale inline value from being
       visible for one frame if the pin is re-entered. */
    if (captionPreview) gsap.set(captionPreview, { clearProps: 'left,right,bottom' });
  }

  function build() {
    section.classList.add('p2c--live');
    /* Holds the destination card's content at opacity 0 and marks the section
       as the one being flown into. Removed in teardown so the card is never
       left blank if the animation is torn down. */
    cases.classList.add('cases--awaiting');

    measureCamera();

    if (isCompact()) { buildCompact(); return; }

    var TAIL_SPAN = TAIL_VH / TRAVEL_VH;

    /* THE SPACER, PLUS THE REVEAL PULL.

       pinSpacing is off, so .p2c's own height IS the scroll the pin consumes
       while #process sits fixed over the viewport. #case-studies follows
       .p2c immediately in the document, so its resting top is set entirely by
       .p2c's box: height alone would put it pinDistance() below the pin-engage
       point (arriving at the fold only on the pin's last pixel — see REVEAL_VH
       above), so .p2c also carries a negative margin-bottom that pulls
       #case-studies REVEAL_VH viewports closer instead. Case studies is
       ALREADY THERE the instant the pin engages, at that closer resting
       distance; there is no gap being animated closed and nothing travelling
       into place — the pull is a fixed offset for the whole pin, not a tween.

       This used to also carry a negative margin that set where Case studies
       came to rest, with a separate rise transform doing the actual travel on
       top of it (see the removed riseDistance()). The rise stays gone — there
       is still no transform anywhere on #case-studies — but the negative
       margin is back for a different reason: see REVEAL_VH above. Without it,
       #case-studies' natural top is pinDistance() below the pin-engage point,
       which is precisely the amount of scroll the pin has to spend before it
       releases, so the section can only ever reach the fold on the pin's very
       last pixel. The margin here pulls it up so it arrives with scroll to
       spare — a resting-position correction, not a travel. */
    var dist = pinDistance();
    section.style.height = dist + 'px';
    section.style.marginBottom = (-revealPull(dist)) + 'px';

    tl = gsap.timeline({
      scrollTrigger: {
        /* #process is the trigger AND the pinned element: the composition the
           reader is looking at is the thing that stops. Pinning a separate
           stage is what made the previous version feel like a stand-in. */
        trigger: process,
        /* The pin engages when the END of the process section reaches the
           bottom of the fold — the moment the reader has just finished it and
           its final state is fully on screen. */
        start: 'bottom bottom',
        end: '+=' + dist,
        pin: process,
        /* .p2c already reserves this distance as real document height, so
           ScrollTrigger must NOT add a spacer of its own on top of it. */
        pinSpacing: false,
        /* The page has no scroll-smoothing library and jumps to anchors with
           window.scrollTo, so a fixed pin is correct here — matching
           doubts.js, whose pin shares this page. */
        pinType: 'fixed',
        anticipatePin: 1,
        /* DIRECT, not eased at all.

           This was 0.08, a couple of frames of GSAP-side smoothing on top of
           the page's OWN scroll smoothing — hero.js runs a Lenis-equivalent
           integrator at LERP 0.1, so the scroll position ScrollTrigger reads
           is already eased. Even a small second smoothing pass is a second
           curve stacked on the first, and the visible result is the object
           not quite tracking the scrollbar: it settles a beat after the wheel
           input stops rather than sitting exactly where the scroll position
           says it should.

           scrub:true removes GSAP's smoothing entirely, so the timeline's
           progress is a direct read of the (already-eased) scroll position on
           every tick — one curve, not two, and the card genuinely moves WITH
           the scroll rather than catching up to it. */
        scrub: true,
        invalidateOnRefresh: true,
        /* The pinned-only styling: transparent ground and a raised stacking
           order, applied for exactly the stretch the pin is engaged and taken
           off the instant it releases. Scoping this to the toggle rather than
           to a class present from load is what keeps #process's normal
           appearance untouched during ordinary scrolling. */
        onToggle: function (self) {
          process.classList.toggle('is-morphing', self.isActive);
          /* The crop exists ONLY while the pin is engaged. Leaving it on
             during normal scrolling would clip the section down to one
             viewport and hide the first six steps outright, so it is opened
             as the pin takes hold and closed the instant it releases. */
          /* The crop is wanted for the whole pin AND for everything past it —
             at the far end the composition has already faded out under the
             revealed case copy, and restoring the full-height section there
             would snap all eight cards back into view for a frame before the
             pin releases. It is only unwanted ABOVE the section, where the
             reader is reading the steps normally and it must be whole.

             Written as a state test rather than an activate/deactivate edge:
             re-entering the pin from below fires the toggle with isActive
             true but had, as an edge, already skipped the open — leaving the
             frame cropped with no offset and the composition parked off
             screen. Deriving it from progress every time makes the state the
             same whichever direction the reader arrives from. */
          if (self.progress > 0) openCamera(); else closeCamera();

        }
      }
    });

    /* --- NO OPENING PAUSE ANY MORE -------------------------------------
       There used to be a 0.16 beat here (and CLOSE_IN sat at 0.18 to match):
       the composition arrived, was read as having come to rest, and only then
       began to contain. That was right when the section was still MOVING at
       the moment the pin engaged — the beat is what turned a scroll into a
       stop.

       It is wrong now. The frame has already been held perfectly still beside
       the stage list for the whole of stage 05, so it is long since read as
       stopped by the time the pin takes over. Keeping the beat just spent
       ~450px of scroll with .is-morphing active and nothing visibly changing:
       the reader had finished the last stage and was still scrolling, waiting
       for the close to start. Measured at 1440x900 — the close did not begin
       moving until 5 wheel steps after the pin engaged. */

    /* --- THE TRANSITION RUNS IN TWO DISTINCT MOVEMENTS -------------------

       This is the choreography correction. The clip and the travel used to be
       one tween over one span, so the frame was closing WHILE it was already
       sliding toward the card — and two simultaneous movements read as a
       single vague one. The eye cannot tell a closing boundary from a
       departing object when both happen at once, so it settles on the simpler
       reading of the two: the thing is going away.

       Separating them gives each movement its own moment, and the sequence
       then states the idea in order:

         PHASE ONE   the sheet is contained, in place — it is not going
                     anywhere, it is becoming a smaller thing
         PHASE TWO   that smaller thing, now a definite object, travels to
                     where it belongs while the section assembles around it

       Both phases are on the same scrubbed timeline, so the whole sequence
       still reverses exactly.

       WHY clipPath AND NOT overflow. The frame has to close CONTINUOUSLY and
       on a scrub, which means the boundary itself is the animated quantity.
       overflow:hidden gives a boundary fixed to the element's box; only a clip
       can have its four edges at arbitrary, scrubbable positions. It is also
       compositor-friendly on an inset() with a uniform radius, so the whole
       move stays off the main thread with eight cards inside it.

       Values are function-based throughout, so invalidateOnRefresh re-solves
       them against fresh geometry on resize without the timeline being
       rebuilt. */

    /* --- PHASE ONE, 0.16 -> CLOSE_END  the frame closes IN PLACE ----------
       The edges travel inward and NOTHING else moves: no scale, no x, no y.
       The pinned view stays precisely where the reader last saw it and simply
       gets contained.

       THE INSETS ARE travel()'S, NOT A SEPARATE TARGET. This is the whole
       correction to this phase, and it is easy to get wrong: the obvious move
       is to close phase one down to the destination card's actual size, but
       that overshoots badly. The clip and the scale are two halves of one
       solve — travel() divides each inset by the final scale precisely so that
       the clip closes to the LARGER intermediate rectangle and the scale
       finishes the job.

       At the real desktop geometry that intermediate rectangle is about
       510x900 against a 1440x900 frame: the top and bottom insets resolve to
       0 (the plate is 88-92vh against a 100vh camera, so there is barely any
       vertical difference for them to close) and the vertical containment is
       carried by the scale in phase two. The left and right insets are NOT
       equal — see travel() — because they also carry the card's offset from
       the viewport centre, which is what lets the descent be straight.

       Closing to the card's own 431x760 here instead would leave phase two
       with almost nothing to do but slide — which is exactly the "shrinks,
       then moves" reading this file exists to avoid.

       So phase one is the original inward logic unchanged; the only thing the
       phase split alters is WHEN it happens relative to the travel, never
       where it closes to. */
    /* Starts immediately. See the note where the opening pause used to be:
       the frame arrives already still, so there is nothing to settle and the
       close begins on the first pixel of the pin. */
    var CLOSE_IN = 0;
    /* THE CLOSE'S SHARE OF THE TIMELINE — most of it, and deliberately widened.

       CLOSE_IN 0.18 -> CLOSE_END 0.92 is ~55% of the WHOLE pin (was ~46%),
       which is the fix for the close reading as too fast on scroll: the frame
       now needs more scroll distance to close the same amount, i.e. a lower
       rate per pixel scrolled, while TRAVEL_VH/TAIL_VH — and so the total
       scroll the whole pin costs — is untouched. The extra span is taken from
       the fall/settle phase, which stays a short punctuation after the close
       rather than a peer to it.

       0.92 puts the end of the close at ~68% of the pin, which is where the
       small final downward movement begins. */
    var CLOSE_END = 0.92;
    /* Declared here rather than beside the copy fades that use it: the phase
       two tween below needs it immediately, and a `var` assigned further down
       would be hoisted-but-undefined at that point, giving it a NaN duration. */
    /* The 0.22 is the FALL's share of the tail, cut from 0.62.

       It is the other half of the retune above: with the close holding its
       original scroll budget, this is where the saving comes from. The fall
       now costs 175px instead of 518px, and since the object only drops ~43px
       the shortened version is still a slower rate of movement than most of
       the transition — it simply no longer spends a third of the pin
       delivering almost nothing. */
    /* The travel now runs through MOST of the tail rather than a quarter of
       it. At 0.267 the object reached its final scale and clip with roughly
       three-quarters of the tail still to scroll, and nothing moved for that
       whole stretch. 0.8 keeps a short beat at the very end for the landing
       to settle into while leaving no long frozen run before it. */
    var TRAVEL_END = CLOSE_END + (1 - CLOSE_END) + TAIL_SPAN * 0.8;
    /* The timeline's own final position — moved up here (it used to only be
       declared much later, beside the copy reveal) because the settle tween
       below now needs it directly. See the note there for why. */
    var END = 1 + TAIL_SPAN;

    tl.to(source, {
      clipPath: function () {
        var t = travel();
        if (!t) return 'inset(0px 0px 0px 0px round 0px)';
        /* CSS inset() order is TOP RIGHT BOTTOM LEFT. The left and right
           values are different (see travel()) and this is the one place that
           asymmetry is written out, so the order matters here in a way it did
           not when both sides shared one number. */
        return 'inset(' + t.insetT + 'px ' + t.insetR + 'px ' +
               t.insetB + 'px ' + t.insetL + 'px round ' + t.radius + 'px)';
      },
      /* THE CLIP RECT'S CENTRE, not the camera's — see travel(). Set here so
         it is already correct when phase two starts scaling about it, and so
         the fall has no horizontal component at all.

         Function-based like everything else, because it depends on the
         destination's measured position and must re-solve on refresh. */
      transformOrigin: function () {
        var t = travel();
        return t ? (t.originX + 'px ' + t.originY + 'px') : '50% 50%';
      },
      duration: CLOSE_END - CLOSE_IN,
      /* A GENTLE EASE, and the one place in this file that is not linear.

         Everything else here is ease:'none' so that scroll position maps
         straight to progress. That is right for the travelling and rising
         parts, where any curve makes the object appear to drift relative to
         the reader's own scrolling. The CLOSE is different: it is a shape
         change, not a position change, so there is nothing for it to drift
         against, and a linear inset starts and stops dead — the edges snap
         into motion at CLOSE_IN and halt at CLOSE_END.

         power1.inOut eases both ends just enough to remove those two corners
         while leaving the middle of the close essentially linear. The effect
         is a boundary that begins to move, closes steadily, and settles,
         rather than one that switches on and off.

         Still fully scrubbed and still exactly reversible — an ease is a
         reparameterisation of progress, not a duration-based animation, so
         scrolling back up retraces the identical curve. */
      ease: 'power1.inOut'
    }, CLOSE_IN);

    /* THE CAPTION PREVIEW TRACKS THE SAME CLOSING BOX THE CLIP DOES.

       .process__captionPreview used to sit at inset:0 on the camera's own
       full, untransformed box (see style.css) — deliberately, so the wash
       colour behind it could rely on the clip alone for containment. That
       is right for a full-bleed colour but wrong for TEXT that has to land
       in the same bottom-left corner the real caption occupies: inset:0
       centres it in whatever the clip currently leaves visible, which is
       not where the text settles once the frame has fully closed.

       Solved the same way the clip itself is: left/right/bottom are tweened
       to travel()'s OWN insetL/insetR/insetB, on the identical CLOSE_IN ->
       CLOSE_END span and easing as the clipPath tween above, so the text's
       box and the visible frame's box are always the same rectangle — the
       text is IN the corner of the closing card from the first frame of the
       close, not centred and then relocated at the end. */
    if (captionPreview) {
      tl.to(captionPreview, {
        left: function () { var t = travel(); return t ? t.insetL + 'px' : 0; },
        right: function () { var t = travel(); return t ? t.insetR + 'px' : 0; },
        bottom: function () { var t = travel(); return t ? t.insetB + 'px' : 0; },
        duration: CLOSE_END - CLOSE_IN,
        ease: 'power1.inOut'
      }, CLOSE_IN);
    }

    /* --- THE SKIN CHANGE, alongside phase one -----------------------------
       While the frame closes, the surface inside it becomes the case-study
       card's surface: the white process ground and its photography wash down
       to the featured plate's navy.

       This runs on the SAME span as the close, deliberately. The two are one
       idea — the object is not shrinking and then being recoloured, it is
       becoming the card, and the shape and the skin have to arrive together
       or the reader sees two separate edits to the same thing.

       TWO PASSES, DIFFERENTLY TIMED. --wash is the multiply layer and leads:
       it does the tonal work, darkening the photographs toward the navy while
       keeping their contrast, so the content stays legible as content for as
       long as possible. --wash-flat is the normal-blend fill and follows,
       coming up late and only part of the way, closing the last of the colour
       gap to the exact token so the landed object matches the card beside it.

       It stops at 0.86 rather than 1: a full flat fill would erase the
       composition entirely, and the whole point is that the process content is
       still faintly present inside the plate it became — the same way the
       featured card carries an image behind its copy.

       Both are plain numbers on a custom property, so they scrub and reverse
       exactly like everything else here.

       SPED UP TO FINISH BY ROUGHLY THE CLOSE'S OWN MIDPOINT. This was 0.92 —
       full colour only arrived right as the close itself was ending, so for
       most of the inward containment the reader was still looking at the
       process photography through only a thin tint, with #case-studies (the
       actual "previous section" showing through the transparent ground
       around the closing frame — see the mask relationship notes) visible
       for a correspondingly long stretch. 0.45 lands --wash at 1 around 45%
       of the close's own span, matching the requested "solid by roughly the
       midpoint" — well ahead of CLOSE_END rather than arriving alongside it. */
    tl.fromTo(camera,
      { '--wash': 0 },
      { '--wash': 1, duration: (CLOSE_END - CLOSE_IN) * 0.45, ease: 'none' },
      CLOSE_IN);

    /* --wash-flat follows the same proportion of the same, now-shorter run —
       it still comes up late relative to --wash and still stops short of 1
       (see the note above this pair), just over a span that finishes with it
       rather than long after it. */
    tl.fromTo(camera,
      { '--wash-flat': 0 },
      { '--wash-flat': 0.86, duration: (CLOSE_END - CLOSE_IN) * 0.27, ease: 'none' },
      CLOSE_IN + (CLOSE_END - CLOSE_IN) * 0.22);

    /* --- PHASE TWO, CLOSE_END -> the travel ------------------------------
       The contained object moves down and across into the destination.

       The clip is left exactly as phase one set it — see the note on the tween
       below. What moves here is only the transform.

       The scale is deliberately slight — around 0.85, see travel(). Phase one
       has already done the shape change; this phase is about the object
       arriving somewhere, and a heavy scale here would put the zoom reading
       back into exactly the beat that has to read as travel.

       It runs INTO the tail rather than finishing before it, so the object is
       still visibly moving while Case studies assembles around it at full
       size, rather than parking early and waiting. */
    /* NO clipPath HERE. Phase one has already closed it to travel()'s insets,
       which are the final ones — they are expressed in the element's local box
       and local insets do not change when a transform is applied to that box.
       So the clip is simply left alone and the scale carries it to its final
       painted size. Re-tweening it to the value it already holds would be a
       no-op that still costs a string parse and an interpolation every
       refresh. */
    /* How much of the destination the approach covers. The remaining 1-APPROACH
       is the settle below. */
    var APPROACH = 0.90;

    tl.to(source, {
      /* 90% OF THE WAY, not all of it.

         Both the scale and the y are interpolated to APPROACH of their solved
         values rather than to the values themselves, so the object finishes
         this tween just short of the card — close enough to read as arrived,
         with a visible tenth still to give. Scale starts at 1, so 90% of the
         way to its target is 1 + (target-1)*APPROACH; y starts at 0, so it is
         simply target*APPROACH. */
      scale: function () {
        var t = travel(); if (!t) return 1;
        return 1 + (t.scale - 1) * APPROACH;
      },
      /* NO x. travel() pins it at 0 and the clip carries the horizontal
         alignment instead, so the descent is dead straight — the stage is the
         full viewport again (see style.css) and therefore contains the card,
         which is what lets an inset do this on its own. */
      y: function () { var t = travel(); return t ? t.y * APPROACH : 0; },
      /* Same origin as phase one — it must not change between the two, or the
         object would jump at the boundary. */
      transformOrigin: function () {
        var t = travel();
        return t ? (t.originX + 'px ' + t.originY + 'px') : '50% 50%';
      },
      /* Must match TRAVEL_END's definition above. 0.267 places the fall at
         65% -> 80% of the pin: a short, late punctuation after the close
         rather than a long descent.

         THIS TWEEN ONLY CARRIES THE OBJECT TO 90% OF ITS DESTINATION — see
         the settle below. The remaining tenth is a separate, slower beat. */
      duration: ((1 - CLOSE_END) + TAIL_SPAN * 0.8) * 0.72,
      ease: 'none'
    }, CLOSE_END);

    /* --- THE SETTLE, the last 10% ----------------------------------------
       The object arrives at ~90% of the way into the featured card's geometry
       on the tween above, and then eases the final tenth into place here.

       WHY SPLIT IT. A single tween to 100% means the object is still moving at
       full rate when it stops — it reaches its destination and simply ceases,
       which reads as the motion being cut off rather than the object coming to
       rest. Holding back the last tenth and giving it its own, slower beat
       with an easing out is what makes the arrival read as settling INTO
       position: the object approaches, slows, and seats itself.

       It is also the beat the reader needs in order to see the handover. The
       card's copy is resolving across this same stretch, so the last thing
       that happens is the object easing into place as it becomes the card,
       rather than both finishing on the same abrupt frame.

       The values are the same travel() solve — this is not a second
       destination, only the same one approached in two stages. */
    tl.to(source, {
      scale: function () { var t = travel(); return t ? t.scale : 1; },
      y: function () { var t = travel(); return t ? t.y : 0; },
      transformOrigin: function () {
        var t = travel();
        return t ? (t.originX + 'px ' + t.originY + 'px') : '50% 50%';
      },
      duration: ((1 - CLOSE_END) + TAIL_SPAN * 0.8) * 0.28,
      /* LINEAR, not eased — this is scrubbed, so an eased .to() does not just
         shape how the settle FEELS, it decouples the camera's position from
         the scrollbar for this whole stretch: scroll maps linearly to
         timeline progress, but power2.out then maps that progress non-linearly
         to scale/y, so the object stops tracking the wheel 1:1 and instead
         drifts ahead of or behind it before catching up at the end. With
         scrub:true and no other smoothing anywhere in this file, every other
         tween is deliberately ease:'none' for exactly this reason (see the
         note on the clip's ease, which only gets away with power1.inOut
         because it reshapes a boundary, not a position). The camera staying
         centred on the destination card while tracking scroll directly is
         the point of this tween, so it has to be none here too. */
      ease: 'none'
    }, CLOSE_END + ((1 - CLOSE_END) + TAIL_SPAN * 0.8) * 0.72);

    /* --- NO RISE ------------------------------------------------------
       There used to be a tween here pulling .cases__rise up from a large
       document-space offset — see the note above the removed riseDistance().
       It is gone. Case studies never leaves its own resting position: it sits
       immediately after the .p2c spacer, already exactly where the pinned
       #process is covering, and is exposed by the camera's clip opening
       rather than by travelling into place itself.

       .cases__rise remains in the markup as a plain, untransformed wrapper —
       harmless, and left alone rather than restructuring the DOM for a change
       that is purely about motion. */

    /* travel() and destRect() read live geometry against the trigger, which
       is not attached yet on this first pass through build() — refreshing
       once here forces GSAP to re-solve against the real, final layout.
       invalidateOnRefresh keeps it correct after every resize thereafter. */
    tl.scrollTrigger.refresh();

    /* --- THE SECTION FADES UP *WITH* THE SHRINK -------------------------

       The travel ends at 0.16 + 0.84 + TAIL_SPAN*0.62. Both fades below are
       solved against that same figure rather than hard-coded, so the text is
       arriving THROUGHOUT the shrink and settles as the composition reaches
       card size — one continuous movement, not a section that finishes
       assembling while the object beside it is still visibly compressing.

       Previously these ran 0.42->0.72 and 0.52->0.85 against a travel that
       carried on to ~1.4: the copy was fully at rest for the last third of
       the shrink, so the reader watched a finished section sitting next to a
       still-shrinking object.

       They come up as a VISIBLE ARRIVAL, not in place. The y offsets used to
       be 18px and 22px, which resolve to a fade at reading distance — and a
       fade cannot tell the eye that the surrounding section is moving INTO
       the space the process visual is releasing. The distances below are
       large enough to be read as movement and still short enough to stay
       restrained.

       THEY BELONG TO PHASE TWO. Both start after CLOSE_END, so phase one is
       the contained frame alone on screen with nothing else competing for
       attention — which is what lets the containment read as its own event —
       and the section then assembles during the travel, around an object that
       is already card-shaped and visibly on its way to its place. */

    /* THE LEFT RAIL AND RIGHT STACK STAY HIDDEN UNTIL THE CARD ARRIVES,
       THEN FADE IN SMOOTHLY ACROSS THE WHOLE APPROACH.

       Requested: nothing of Case studies' surrounding copy or cards should be
       visible while the camera is still closing in on itself (phase one) —
       they should only start appearing once the middle card is actually
       reaching its destination (phase two, CLOSE_END -> TRAVEL_END, plus the
       final settle beat after it) — and that appearance should read as a
       smooth, continuous fade across the whole of the arrival, not a sudden
       pop partway through it.

       REVEAL_IN starts a short beat BEFORE CLOSE_END rather than exactly on
       it. Gating the fade to start precisely at CLOSE_END left it almost the
       whole of its opacity change compressed into the short scroll distance
       phase two's approach tween covers before the settle takes over, which
       reads as a near-instant pop rather than a fade — there just was not
       enough scroll distance in that span for a gradual change to be visible.
       Starting a little earlier, still well inside "the card is now visibly
       moving" rather than during the static close, gives the opacity tween
       more scroll distance to ease across, which is what actually reads as
       smooth on a scrub-driven fade (there is no time-based smoothing here;
       "smooth" can only mean "more scroll pixels per unit of opacity change").

       The run still reaches all the way to END (the timeline's own final
       position, past TRAVEL_END and into the settle/tail), so the fade is
       still resolving as the card eases into its last few pixels rather than
       finishing early and leaving the card to settle alone afterward. */
    var REVEAL_IN = CLOSE_END - (CLOSE_END - CLOSE_IN) * 0.10;
    tl.fromTo(head,
      /* SUBTLE, FROM DIRECTLY BELOW — not a slide from either edge.

         The section is no longer arriving from off-screen (see the removed
         rise above), so there is nothing left for a horizontal entrance to
         reference — the copy is already roughly where it will end up,
         sitting under the closing camera. A small, plain vertical settle is
         what "already underneath and being revealed" actually looks like:
         opacity 0 -> 1 with a bare 15px of lift — a texture on content that
         is already in place, not a distance it is travelling. Anything larger
         reads as the section arriving from somewhere rather than being
         exposed where it already sits.

         ease power1.out rather than none: the opacity's own curve front-loads
         the change (steep at the start, tapering into the arrival) which is
         what keeps a scrub-driven fade from reading as linear/mechanical over
         a short span. */
      { opacity: 0, y: 15 },
      { opacity: 1, y: 0,
        duration: END - REVEAL_IN, ease: 'power1.out' },
      REVEAL_IN);
    /* The stack below shares REVEAL_IN and the same run, so the two sides
       are on one travel — see the note there. */

    /* THE RIGHT STACK SLIDES IN FROM THE RIGHT, BESIDE THE ARRIVING CARD.

       02, 03, 04 — x 60 -> 0 (not y), staggered, appearing WHILE the card
       reaches its slot. A horizontal entrance from the right reads correctly
       here specifically because these three cards sit in their own column to
       the RIGHT of the featured card — sliding in from further right is an
       entrance FROM the edge they already live near, rather than an arbitrary
       direction, and it visually pairs with the featured card arriving into
       the centre from the process composition above it. */
    if (support.length) {
      /* THE SAME TRAVEL AS THE RAIL — both sides arrive together, gated to
         the card's own approach and settle — see the note above REVEAL_IN
         for why the reveal starts just ahead of CLOSE_END and why the run
         needs the extra scroll distance to read as smooth rather than a pop.

         SUP_IN shares REVEAL_IN rather than being offset past it, so the left
         and the right are two halves of one section resolving together, not
         two separate entrances. */
      var SUP_IN = REVEAL_IN;
      var supRun = END - SUP_IN;
      tl.fromTo(support,
        { opacity: 0, x: 60 },
        {
          opacity: 1, x: 0, ease: 'power1.out',
          duration: supRun * 0.62,
          stagger: (supRun * 0.38) / Math.max(support.length - 1, 1)
        },
        SUP_IN);
    }

    /* --- the tail --------------------------------------------------------
       Empty duration that keeps the pin alive a little past the travel, so
       the reader has a beat with the landed object before the pin releases
       and ordinary scrolling resumes into Case studies' own content below.
       Without it the pin would release the instant the travel finished,
       cutting the settle short. */
    tl.to({}, { duration: TAIL_SPAN }, 1);

    /* --- the landing, at the very end ------------------------------------
       The composition is now sitting exactly in the destination card's box.
       Only here does the case copy come up INSIDE that same frame — the frame
       is continuous, so this reads as the object revealing what it became,
       not as a different card replacing it.

       The composition fades under the copy over the same beat. That fade is
       the one place opacity does any structural work, and it is doing it on
       two things occupying the identical rect after the travel has already
       carried the meaning: at no point was there a card underneath waiting to
       be swapped in, because .case__reveal was empty the whole way down.

       END itself is declared earlier now, beside TRAVEL_END — see the note
       there. */

    /* THE CAMERA NEVER FADES.

       It used to go opacity 1 -> 0 here while the card's content came up,
       which is a crossfade however it is timed: the object the reader has
       followed all the way down dissolves, and something else takes its
       place. The identity of the thing has to survive the landing.

       So the camera stays fully opaque and simply IS the featured card's
       visual from here on. What fades up is only the copy the camera cannot
       carry — the number, scope, title and figure — and it comes up INSIDE
       the geometry the camera is already occupying, over the darkened lower
       part of its own image. Nothing is swapped; the object gains its
       caption.

       The scrim is what keeps that copy legible over whatever the camera's
       last frame happens to be, and it belongs to the card rather than the
       camera so it arrives with the text. */
    /* THE BECOMING. Starts BEFORE the composition has fully stopped, but only
       just — the LAST beat of the approach, not the whole of it.

       This used to begin strictly after the travel was over: the object
       arrived, came to rest, and only then did the caption appear on top of
       it — two separate events, which made the last moment read as a card
       being labelled rather than the object turning into a card. Overlapping
       the reveal with the final approach fixes that: the copy is already
       resolving as the frame closes on its final geometry, so the shrink and
       the becoming are one continuous action.

       IT DOES NOT START AS EARLY AS CLOSE_END. That was tried — starting the
       caption's fade (and, to make it actually visible, raising Case studies'
       whole stacking context above the camera's) the instant phase two began
       — and it broke the one rule this file exists to enforce: at CLOSE_END
       the camera has only just begun its scale/y approach and is still, for
       a long stretch after that, a tall untransformed sliver nowhere near the
       destination's actual footprint. Making .cases__featured paint its own
       navy ground and outrank the camera at that same moment put a second,
       already-card-shaped object on screen — fully settled — while the real
       one (the camera) was still visibly mid-fall above it. Two objects, not
       one becoming the other.

       So the reveal stays LATE, gated on LAND below: by the time it starts,
       the camera's own scale/y tweens (phase two, above) have it at or very
       near travel()'s target, so there is only ever the one settling object
       for the caption to arrive on top of. */
    var LAND = TAIL_SPAN * 0.26;

    /* Long enough to close the gap after the two side columns finish, so the
       card's copy picks up as they settle rather than leaving a dead beat
       where nothing at all is resolving. Still ends at END and still overlaps
       the final approach — the copy has to resolve INSIDE the geometry the
       object already occupies, never in an empty box ahead of it. */
    /* HEAD_IN was renamed to REVEAL_IN, and the rail/support reveal now runs
       all the way to END rather than stopping at TRAVEL_END (see REVEAL_IN
       above), so SIDES_END is simply END. Kept as its own name rather than
       inlined so this formula still reads as "wherever the side content
       finishes" if that timing is retuned again. */
    var SIDES_END = END;
    var revealRun = Math.max(
      LAND * 0.55,
      (END - TRAVEL_END) + LAND * 0.5,
      END - SIDES_END
    );
    tl.to(reveal, { opacity: 1, duration: revealRun, ease: 'none' },
      END - revealRun);

    /* THE CARD'S GROUND RETURNS WITH ITS COPY.

       .cases--awaiting holds the destination card transparent so the reader
       sees an empty slot rather than a filled card the camera is visibly
       travelling towards. That class is only removed on teardown, though, so
       the card stayed transparent for the whole of normal scrolling and the
       ONLY thing painting the plate was the camera — which lands scaled to
       the card's WIDTH and therefore covers just the lower part of a tall
       frame. The plate consequently appeared to start well below the top of
       the supporting stack instead of level with it.

       Flipping this class at the same point the copy resolves gives the card
       its navy ground back for the full height of the frame, with the camera
       sitting inside it supplying the image — which is exactly what the
       .cases--awaiting comment in style.css already describes.

       Keyed to the reveal's RENDERED OPACITY, not to any tween's progress.
       Reading a tween meant trusting that the handle in scope was the one
       actually driving .case__reveal; it was not, so the ground came back at
       roughly half the pin — a fully painted, empty card sitting in the
       destination for a long stretch before the copy arrived, which is the
       "card waiting to be filled into" read this whole mechanism exists to
       avoid. The opacity is the thing we actually care about, so ask for it
       directly and the two can never disagree.

       This timeline is scrubbed and runs backwards as well as forwards, so
       the toggle is re-evaluated on every update rather than latched once. */
    tl.eventCallback('onUpdate', function () {
      /* MIRROR --wash ONTO THE SECTION.

         The wash is tweened on the camera, but the stage copy that fades with
         it (.process__list / .process__header, see style.css) sits in a
         sibling branch and cannot inherit a custom property from it. Copying
         the value up to #process — their common ancestor — lets that fade
         track the transition's own progress rather than being keyed to
         .is-morphing, which lands before the close is visible. */
      process.style.setProperty('--wash',
        gsap.getProperty(camera, '--wash') || 0);

      /* --close: how much of the inward CLOSE has actually played, 0 -> 1
         across CLOSE_IN -> CLOSE_END. The stage copy fades on this rather
         than on --wash, so it stays at full opacity while the frame beside
         it is still open and only goes as the boundary closes on it — see
         the note in style.css. */
      var cp = (tl.progress() - CLOSE_IN) / (CLOSE_END - CLOSE_IN);
      process.style.setProperty('--close',
        cp < 0 ? 0 : (cp > 1 ? 1 : cp.toFixed(4)));

      /* THE COPY IS CLIPPED BY THE SAME BOUNDARY, NOT FADED.

         .process__list is a SIBLING of the camera, not a child, so the
         camera's own clip-path cannot reach it — a clip only crops its own
         subtree. Mirroring the camera's current inset onto the section lets
         the list wear the identical rectangle, so the closing edge sweeps
         across the text exactly as it does across the picture and the two
         read as one boundary closing on one composition.

         Taken from the camera's rendered clip rather than re-solved, so the
         two can never drift apart. The camera is scaled and the list is not,
         so the inset is converted from the camera's local space into screen
         space (x scale, about the shared transform origin) before being
         handed over. */
      var cs = getComputedStyle(camera);
      var n = (cs.clipPath || '').match(/-?[\d.]+px/g);
      if (n && n.length >= 4) {
        var sc = parseFloat(gsap.getProperty(camera, 'scale')) || 1;
        var ox = parseFloat(cs.transformOrigin) || 0;
        var oy = parseFloat((cs.transformOrigin || '').split(' ')[1]) || 0;
        var T = parseFloat(n[0]), R = parseFloat(n[1]),
            B = parseFloat(n[2]), L = parseFloat(n[3]);
        var cam = camera.getBoundingClientRect();
        var uw = cam.width / sc, uh = cam.height / sc;

        /* HOW FAR THE CAMERA HAS CLOSED, AS A FRACTION.

           Mapping the camera's screen edges straight onto the list does not
           work: the camera closes toward the CARD, which sits to the right of
           the copy, so its left edge marched across the text and erased it
           while its right edge was still far outside the list's own box and
           clamped to zero. Measured: listClip went 160..710 -> 474..710 —
           one edge chasing the text, never containing it.

           What the copy needs is the same PROPORTION of containment applied
           about its own centre, so it draws in from both sides exactly as the
           picture does. */
        var openW = uw;
        var shutW = uw - L - R;
        var t01 = openW > 0 ? (1 - shutW / openW) : 0;
        if (t01 < 0) t01 = 0; if (t01 > 1) t01 = 1;

        var lr = list.getBoundingClientRect();

        /* CONTAIN ABOUT THE VISIBLE COPY, NOT THE COLUMN'S FULL BOX.

           .process__list's box is wider and vastly taller than the text on
           screen, so insets taken off its own dimensions bite the copy
           immediately (measured: at 3% closed the window already started 9px
           inside the title) and then barely move. Solving about the stage-5
           item's own rect makes the boundary reach the words at the same rate
           it reaches the picture, and leaves them fully visible until the
           close has actually begun. */
        var vr = items && items.length
          ? items[items.length - 1].getBoundingClientRect()
          : lr;
        var halfX = (vr.width / 2) * t01;

        /* VERTICALLY, CONTAIN AGAINST THE VIEWPORT, NOT THE LIST'S OWN BOX.

           The list is the whole five-stage column — measured 2790px tall,
           most of it far above the fold — so a proportional inset off its own
           height barely moves (55px at half-close) while the picture beside
           it is visibly drawing in. Closing about the VISIBLE band instead
           makes the copy contract at the same rate the reader sees the frame
           contract. Anchored on the stage-5 item, which is the only part on
           screen at this point. */
        var halfV = (vr.height / 2) * t01;
        var topIn = (vr.top - lr.top) + halfV;
        var botIn = (lr.bottom - vr.bottom) + halfV;

        /* NEVER WIDER THAN THE BOUNDARY ITSELF.

           The copy is inside the closing composition, so its window cannot
           extend past the camera's own painted edges — measured, the copy
           window's left edge lagged the camera's by up to 131px, and the text
           in that band rendered OUTSIDE the boundary as a stray sliver.
           Clamping both sides to the camera's edges keeps the text strictly
           within the shape that is closing on it. */
        var camL = ox + (L - ox) * sc;
        var camR = ox + ((uw - R) - ox) * sc;
        var leftIn  = Math.max((vr.left - lr.left) + halfX, camL - lr.left);
        var rightIn = Math.max((lr.right - vr.right) + halfX, lr.right - camR);

        process.style.setProperty('--copy-clip',
          'inset(' + topIn.toFixed(1) + 'px ' + rightIn.toFixed(1) + 'px ' +
                     botIn.toFixed(1) + 'px ' + leftIn.toFixed(1) + 'px)');
      }

      var op = parseFloat(gsap.getProperty(reveal, 'opacity')) || 0;
      cases.classList.toggle('cases--landed', op > 0.5);
      /* The camera stands down on the SAME threshold the card's ground comes
         back on — see the note in style.css. */
      process.classList.toggle('is-camera-done', op > 0.5);
      /* is-landed hides .process__captionPreview (see style.css) the instant
         the real .case__reveal starts fading in, so the handoff between the
         two is a single frame rather than a stretch with both, or neither,
         visible. */
      process.classList.toggle('is-landed', op > 0);
    });
  }

  /* Compact choreography. Same story — the composition stops, draws in, and
     hands over — but no long travel: an eight-card grid scaled down to phone
     width is unreadable well before it would land, so the shrink is shallow
     and the handover happens early. */
  function buildCompact() {
    var TAIL = 1.0;
    var dist = Math.round(window.innerHeight * (0.7 + TAIL));
    /* Same REVEAL_VH correction as the desktop path (see the note above it):
       without the pull, #case-studies only reaches the fold on the pin's
       final pixel of scroll. Compact's own reveal (HEAD_IN below, at 0.40 of
       the timeline) needs the section physically able to be on screen by
       then, not just an opacity tween running over a section still stuck
       below the fold. */
    section.style.height = dist + 'px';
    section.style.marginBottom = (-revealPull(dist)) + 'px';

    tl = gsap.timeline({
      scrollTrigger: {
        trigger: process,
        start: 'bottom bottom',
        end: '+=' + dist,
        pin: process,
        pinSpacing: false,
        pinType: 'fixed',
        anticipatePin: 1,
        scrub: true,
        invalidateOnRefresh: true,
        onToggle: function (self) {
          process.classList.toggle('is-morphing', self.isActive);
          if (self.progress > 0) openCamera(); else closeCamera();

        }
      }
    });

    tl.to({}, { duration: 0.15 });
    /* NO CLIP ON COMPACT. openCamera() seeds an open inset() here too, but
       nothing animates it, so it stays inset(0) — the full frame — for the
       whole pin and is cleared on release.

       That is deliberate. The containment reads because the frame closes onto
       a tall plate sitting beside two other columns; at phone width there are
       no columns, the plate is nearly the full width of the screen, and the
       four edges would have almost nothing to travel. What is left is the
       shallow compress-and-hand-over below. */
    tl.to(source, {
      scale: 0.88, y: function () { return window.innerHeight * 0.10; },
      transformOrigin: '50% 0%', duration: 0.45, ease: 'none'
    }, 0.15);
    /* Finishes at 0.60, the same point the scale/y move above finishes —
       so the reveal is still visibly changing for the whole of the card's
       own move instead of completing early and leaving the card to finish
       its shift alone. Previously ran 0.40->0.65, ending after the move. */
    tl.fromTo(head, { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.30, ease: 'none' }, 0.30);
    tl.fromTo(reveal, { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.25, ease: 'none' }, 0.55);
    /* Same handover as the desktop path: the card's own ground returns with
       its copy, so the plate is a filled frame at rest rather than staying
       transparent and letting only the camera paint it. Compact builds its
       own timeline, so it needs its own toggle. */
    tl.eventCallback('onUpdate', function () {
      var op = parseFloat(gsap.getProperty(reveal, 'opacity')) || 0;
      cases.classList.toggle('cases--landed', op > 0.5);
      /* The camera stands down on the SAME threshold the card's ground comes
         back on — see the note in style.css. */
      process.classList.toggle('is-camera-done', op > 0.5);
      process.classList.toggle('is-landed', op > 0);
    });
    /* Compact keeps the same rule: the camera does not fade out, the copy
       comes up inside it. */
    if (support.length) {
      tl.fromTo(support, { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.20, ease: 'none', stagger: 0.04 }, 0.68);
    }
    tl.to({}, { duration: TAIL / 0.7 }, 1);
  }

  function teardown() {
    if (tl) {
      if (tl.scrollTrigger) tl.scrollTrigger.kill(true);
      tl.kill();
      tl = null;
    }
    /* The source especially: it is a REAL section of the page, so anything
       left on it would persist as a visible defect rather than just breaking
       an animation. clearProps puts it back to exactly what the stylesheet
       says. */
    gsap.set([source, reveal, head], { clearProps: 'all' });
    closeCamera();
    if (support.length) gsap.set(support, { clearProps: 'all' });
    /* cases.style.marginTop is no longer written by build() or
       buildCompact() — Case studies never leaves its normal document position
       via its OWN margin — but clearing it stays cheap insurance against any
       earlier build's value surviving a teardown. section.style.height and
       section.style.marginBottom (the REVEAL_VH pull, see above) are both
       real and always set together, so both always need resetting. */
    cases.style.marginTop = '';
    section.style.height = '';
    section.style.marginBottom = '';
    cases.classList.remove('cases--awaiting');
    cases.classList.remove('cases--landed');
    section.classList.remove('p2c--live');
    process.classList.remove('is-morphing');
  }

  /* Rebuild on a real width change only. A vertical-only resize is almost
     always mobile browser chrome collapsing, and rebuilding there would make
     the composition jump mid-scroll. ScrollTrigger's own refresh handles the
     height change. Same policy as doubts.js. */
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

  /* If the reader turns reduced motion on mid-session, drop the whole thing
     rather than leaving a pin they did not ask for. */
  if (reduce.addEventListener) {
    reduce.addEventListener('change', function (e) { if (e.matches) teardown(); });
  }

  build();

  /* The pin distance and the FLIP solve both depend on measured heights,
     which are not final until the webfonts have swapped and the eight process
     images have decoded. */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
}());
