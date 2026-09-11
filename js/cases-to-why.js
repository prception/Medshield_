/* ==========================================================================
   MedShield — cases-to-why.js
   The transition from section 07 ("Case studies") into section 08
   ("Why MedShield").

   THE PRINCIPLE. Case studies TRAVELS UP off the top of the viewport, and
   the reel is what was behind it. The section itself is the moving thing: it
   slides bodily upward carrying its heading, its featured plate and its
   supporting stack with it, until it has cleared the fold entirely.

       the cases have said what happened  ->  and here is why it works

   THE OUTGOING LAYER MOVES; THE INCOMING ONE DOES NOT. That asymmetry is the
   whole effect and it lives in one rule: .why is never translated (see
   style.css .why.is-lifted-in). The reel is at its FINAL position from the
   first frame and simply stands there while Case studies leaves. If it rose
   to meet it, the two would read as one long scroll and nothing would have
   been revealed; because it is nailed to where it will finally sit, the eye
   reads "that was behind it all along".

   WHAT THIS IS NOT. It is not the page scrolling normally - the pin holds
   the document still and only .cases moves - and it is not a panel arriving
   from below the fold.

   WHY IT HAS ITS OWN SCROLL DISTANCE. Neither neighbour has any to give.
   Case studies is an ordinary block section with no rail of its own, and
   .why's 500svh is fully spent - why-scrub.js holds on frame 0 across the
   opening slice so the section settles before the camera moves, and parks
   the CTA across the last third. Taking the lift out of the front of that
   rail would spend the hold, and the reel would already be moving before the
   reveal had finished uncovering it. So the lift claims its own: .c2w, an
   empty section immediately after .cases, whose height IS the travel.

   WHERE IT STARTS. The bottom of .cases reaching the bottom of the fold -
   the last scroll position at which the section is still fully on screen. Up
   to that point Case studies behaves exactly as it did: it arrives out of
   the process morph, the reader reads it, and only once there is nothing
   left of it below the fold does the lift take over.

   ---------------------------------------------------------------------------
   THE THREE PIECES

   1. THE OUTGOING PANEL — .cases, made position:fixed by the pin at the
      position it already occupies, and then translated upward until it has
      cleared the top of the fold. It is not cloned and its resting layout is
      never touched; the class goes on at the pin and comes off the moment it
      releases.

   2. THE INCOMING PANEL — .why, made position:fixed for the pin only, at its
      FINAL position from the first frame, and simply uncovered. For that
      stretch only the first viewport of the rail is what there is to see,
      which is exactly what the sticky stage inside is already painting; the
      rail's real 500svh comes back the instant the class comes off, before
      any of its own scroll has been spent.

   3. THE SPACER — the empty .c2w section, which exists so the pin has
      somewhere to live in the document. pinSpacing is ScrollTrigger's here
      (see the note at the option), so the spacer itself carries no height.

   ---------------------------------------------------------------------------
   DESIGN NOTES

   A. CSS OWNS THE RESTING LAYOUT. If this file never runs — no GSAP, a
      throw, reduced motion — .c2w stays display:none, contributing no height,
      and .why follows .cases as an ordinary block. Nothing is missing and
      nothing is stranded off-screen. Same contract as process-to-cases.js
      and why-to-people.js.

   B. ONE VALUE, ONE WRITE. .cases and .why are siblings with no common
      element to hang a custom property off, so the single driven value is
      written to both, once per tick, from one source of truth. Two writes of
      the same number is not two animations: they cannot drift, because there
      is only one value.

   C. NO LAYOUT, EITHER SIDE. translate3d only; no height, no top, no margin
      anywhere. It is a compositor-level property on a promoted layer, so a
      scroll tick costs a composite rather than a re-layout of a full screen
      of content.

   D. scrub:true, NOT a number. The page runs its own scroll smoothing
      (hero.js, a Lenis-equivalent integrator), so the position ScrollTrigger
      reads is already eased. GSAP-side scrub smoothing on top of it is a
      second curve stacked on the first, and the panels then settle a beat
      after the wheel stops instead of sitting where the scroll says. Same
      reasoning, and the same value, as why-to-people.js.
   ========================================================================== */

(function () {
  'use strict';

  var spacer = document.querySelector('.c2w');
  var cases = document.getElementById('case-studies');
  var why = document.getElementById('why');
  if (!spacer || !cases || !why) return;

  if (!window.gsap || !window.ScrollTrigger) return;

  /* Reduced motion: no pin and no lift. The spacer never goes live, so the
     two sections simply follow one another as CSS authored them. */
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce.matches) return;

  gsap.registerPlugin(ScrollTrigger);

  /* THE TRAVEL DISTANCE, in viewport heights.

     The gesture covers one screen height, and it has to read as a deliberate
     displacement rather than a flick. 0.9 of a viewport puts the whole lift
     inside roughly one page-down: the reader completes it in one gesture and
     lands on the reel already settled and holding frame 0, which is what
     why-scrub.js's opening hold exists to give them.

     Matched to why-to-people.js's PUSH_VH on purpose. The two gestures are
     the same curtain and a reader who meets both should not feel one of them
     being slower than the other.

     IT IS EXACTLY ONE VIEWPORT, AND THAT IS A CONSTRAINT RATHER THAN A TASTE
     SETTING. The pin engages when .cases' bottom reaches the bottom of the
     fold, and that is precisely the scroll position at which .why's own flow
     top sits one viewport below the fold top. .why.is-lifted-in then shows it
     at inset:0 for the whole of the pin, so the two agree only if the pin
     runs for exactly that one viewport: at 0.9 the reel was being painted a
     tenth of a viewport - 90px at 1440x900, 108 at 1920x1080 - above where
     the document actually had it, and the class going on at the start and
     coming off at the end snapped it up and back by that much. That snap is
     what read as the section being cropped at the top edge and dropping back
     on the way out.

     So this is not free to retune on feel alone. Changing it re-opens that
     gap unless .why's resting position is moved to match; see the note at
     .why.is-lifted-in in style.css.

     Phones get the same one viewport for the same reason, where they used to
     get 0.7. The number is set by the geometry, not by the gesture length,
     and a short one there reintroduced the identical snap. */
  var LIFT_VH = 1;
  var LIFT_VH_SM = 1;

  function liftDistance() {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var f = window.innerWidth <= 860 ? LIFT_VH_SM : LIFT_VH;
    return Math.round(vh * f);
  }

  var tl = null;

  /* The single driven value. See note B. */
  var driver = { v: 0 };

  /* HOW FAR THE SECTION HAS TO TRAVEL TO CLEAR THE FOLD.

     Not a percentage and not a round viewport unit, because neither is
     correct here. A percentage resolves against .cases' own border box, and
     the section is TALLER than the viewport (1036px against 900 at
     1440x900), so -100% overshoots and throws it well past the top. -100vh
     undershoots for the opposite reason: the pin engages when the section's
     BOTTOM reaches the bottom of the fold, so part of it is already above
     the top edge by then, and a viewport of travel leaves its lower strip
     still on screen at the end.

     What actually has to be cleared is the distance from the top of the
     viewport down to the section's bottom edge - that is, everything still
     showing. At pin time the section's top is negative (it has scrolled
     partway off) and its bottom sits on the bottom of the fold, so that
     distance is exactly the viewport height. Derived from the measured
     geometry rather than assumed, so it stays right if the start ever moves.
     Rounded up, so a fractional viewport cannot leave a hairline behind.

     Read once per refresh rather than per tick: the pin freezes the layout
     for the whole gesture, so this cannot change while the lift is running,
     and getBoundingClientRect() in a scroll handler forces a reflow. */
  function travelDistance() {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var wrap = cases.parentElement;
    var box = (wrap && wrap.classList.contains('pin-spacer')) ? wrap : cases;
    var top = box.getBoundingClientRect().top +
              (window.scrollY || window.pageYOffset);
    /* Where the pin engages, and therefore where the section sits for the
       whole of the lift: its bottom edge on the bottom of the fold. */
    var startAt = top + cases.offsetHeight - vh;
    var topAtPin = top - startAt;             /* negative or zero */
    return Math.ceil(topAtPin + cases.offsetHeight);
  }

  function setTravel() {
    cases.style.setProperty('--c2w-travel', travelDistance() + 'px');
  }

  function write() {
    var v = driver.v.toFixed(5);
    cases.style.setProperty('--c2w', v);
    why.style.setProperty('--c2w', v);
  }

  /* THE SPACER PULLS .why UP, and reserves no height of its own.

     With pinSpacing:true ScrollTrigger inserts the pin's scroll distance
     itself, so height here would be that distance counted twice. But the pin
     ALSO holds .cases on screen for that distance without moving the document
     under it, so .why's resting top ends up one pin-distance below where the
     pin releases.

     Left alone that is not a subtle gap, it is the reveal undoing itself in a
     single frame: the curtain finishes, the pin releases, and .why snaps from
     top 0 straight back down to top 900 while the fully-visible Case studies
     section drops back over it. The reader completes the whole gesture and is
     returned to where they started. Measured at 1440x900: .why went 0 -> 900
     across one pixel of scroll, at 8620.

     So the spacer takes the correction as a NEGATIVE margin, exactly as .p2c
     does in process-to-cases.js and .w2p in why-to-people.js. .why follows
     the spacer immediately in the document, so pulling the spacer's bottom
     edge up pulls .why's resting top up with it - to the pixel the pin
     releases at, and no further. A fixed value for the whole pin, not an
     animated one: it is a resting-position correction, not part of the
     travel.

     TWO THINGS ARE BEING PULLED OUT, not one, which is why this is MEASURED
     rather than just -dist - the same shape as pullUp() in why-to-people.js,
     and for the same underlying reason.

     The pin's own distance is the obvious term. The other is the tail of
     .cases left below the release point: the pin engages when the section's
     bottom reaches the bottom of the fold and then runs for `dist`, so
     unless `dist` happens to equal a full viewport there is `vh - dist` of
     section still below the release. That is not a rounding error - it is
     90px at 1440x900, 108px at 1920x1080 and 354px at 820x1180, and it shows
     as .why sitting that far down the fold at the instant the pin lets go,
     jumping up into place as the reader scrolls on.

     Measuring .cases' real bottom against the release point catches both
     terms in one number and stays correct at any viewport, where either term
     alone does not. Clamped at 0: if a viewport ever makes the release land
     past the section's own bottom there is no tail to remove, and a negative
     term would push .why back down. */
  function pullUp(dist) {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var top = cases.getBoundingClientRect().top +
              (window.scrollY || window.pageYOffset);
    /* Where the pin releases, and where .cases actually ends. Read off the
       pin wrapper once it exists: ScrollTrigger moves .cases into a
       .pin-spacer whose own box is the section's document footprint, so past
       the first build the section's own rect is the fixed one and the
       wrapper is what still describes the flow position. */
    var wrap = cases.parentElement;
    var box = (wrap && wrap.classList.contains('pin-spacer')) ? wrap : cases;
    if (box !== cases) {
      top = box.getBoundingClientRect().top +
            (window.scrollY || window.pageYOffset);
    }
    var startAt = top + cases.offsetHeight - vh;
    var releaseAt = startAt + dist;
    var endsAt = top + cases.offsetHeight;
    var tail = endsAt - releaseAt;
    return dist + (tail > 0 ? tail : 0);
  }

  function sizeSpacer(dist) {
    spacer.style.height = '0px';
    spacer.style.marginBottom = (-pullUp(dist)) + 'px';
  }

  /* THE PIN WRAPPER HAS TO BE RAISED, NOT JUST THE SECTION.

     ScrollTrigger wraps .cases in a generated div.pin-spacer and copies the
     pinned element's computed z-index onto it. .cases carries z-index:0 in
     its base rule (it is the lower layer of the process morph above), so the
     wrapper is born position:relative; z-index:0 - a stacking context that
     traps .cases' own z-index:5 inside it. The wrapper then competes at 0
     against .why's 4 and loses, and the reel paints over a Case studies
     section that is fully visible and correctly clipped.

     style.css does this with `.pin-spacer:has(> .cases.is-lifting)`, which is
     the right place for it and is what runs in every browser that supports
     :has(). This is the same write done imperatively, because the effect is
     load-bearing rather than decorative: without it the reveal does not fail
     gracefully, it shows the wrong section entirely. Two cheap writes of the
     same value cost nothing and cannot disagree.

     The wrapper only exists while the pin does, so this is re-read on every
     toggle rather than cached. */
  function raiseSpacer() {
    var wrap = cases.parentElement;
    if (!wrap || !wrap.classList.contains('pin-spacer')) return;
    wrap.style.zIndex = cases.classList.contains('is-lifting') ? '5' : '';
  }

  function build() {
    var dist = liftDistance();
    sizeSpacer(dist);
    setTravel();

    tl = gsap.timeline({
      scrollTrigger: {
        /* .cases is the trigger and the pinned element.

           WHERE THE PIN HAS TO ENGAGE: the exact pixel Case studies stops
           being fully on screen, which is its bottom reaching the bottom of
           the fold. Not a pixel earlier, not a pixel later.

           A pixel LATER (triggering on the top of .c2w itself) and the
           section scrolls up out of the viewport under its own steam before
           the lift starts, so the reader gets a screen of bare page ground
           where the cases used to be and the reel then uncovers behind THAT.
           A pixel EARLIER and the lift starts while there is still case
           content below the fold the reader has not reached. */
        trigger: cases,
        start: 'bottom bottom',
        /* THE PIN MUST END WHERE .why BEGINS. With pinSpacing:true
           ScrollTrigger reserves exactly this distance as document height of
           its own, so the lift's own length IS the distance and the reel
           lands immediately after it, with nothing to reconcile. */
        end: '+=' + dist,
        pin: cases,
        /* SPACING IS SCROLLTRIGGER'S, NOT THE SPACER'S.

           Same reasoning as why-to-people.js, and for a stronger reason
           here: .cases is an ordinary block with no rail of its own to
           donate, so with pinSpacing:false there would be no reserved height
           at all for the pin to consume and ScrollTrigger would compensate by
           translating the pinned section down by the pin distance - leaving
           Case studies covering the top of the fold after the lift had
           finished, with the reel showing dimly underneath it. */
        pinSpacing: true,
        /* The page jumps to anchors with window.scrollTo and has no
           scroll-smoothing library of the kind that needs a transform pin —
           matching doubts.js, process-to-cases.js and why-to-people.js. */
        pinType: 'fixed',
        /* NO anticipatePin HERE, unlike every other pin on the page.

           anticipatePin engages the pin slightly BEFORE its start, scaled by
           scroll velocity, so a fast gesture does not catch a frame of the
           element still in flow before it goes fixed. That is the right trade
           for a pin whose element does not move at the moment it engages.

           This one does. .why goes position:fixed; inset:0 the instant the
           pin toggles, which lifts it a full lift-distance up the viewport in
           one frame (812px -> 0 at 1440x900). Firing that toggle off a
           VELOCITY ESTIMATE rather than off the scroll position means the
           threshold moves from gesture to gesture, and near the boundary it
           lands on either side of the same pixel on consecutive frames: the
           pin turned on at 7806, off at 7808, on again at 7812 while the
           start stayed at 7810 the whole time. Each of those toggles is the
           reel jumping 812px and back, which is the flicker the section shows
           when the top edge is approached and re-approached.

           Without it the toggle is a pure function of scroll position and is
           monotonic across the boundary - measured false through 7808, true
           from 7810 on, with no oscillation in either direction. The frame
           anticipatePin exists to save is not worth a jump this large. */
        /* Direct. See note D above. */
        scrub: true,
        invalidateOnRefresh: true,
        /* The pinned-only styling, on for exactly the stretch the pin is
           engaged and off the instant it releases. Scoped to the toggle
           rather than to a class present from load: a fixed panel left on for
           the whole page would sit over everything below it. */
        onToggle: function (self) {
          if (self.isActive) {
            cases.classList.add('is-lifting');
            why.classList.add('is-lifted-in');
            raiseSpacer();
            /* Re-measured on entry, not just at build: the pin wrapper only
               exists once ScrollTrigger has built it, and the section's own
               rect is the fixed one from here on. Cheap, and it runs twice
               per full page scroll rather than per tick. */
            setTravel();
            return;
          }

          /* BOTH ENDS ARE SYMMETRICAL HERE, which is the one place this
             differs from why-to-people.js and the reason it needs no
             .is-spent equivalent.

             There, .why is a 500svh rail that still physically covered the
             fold after its push had finished, so it had to be hidden past
             the end. Here the outgoing section is an ordinary block sitting
             ABOVE .why in the document: past the pin it is simply scrolled
             off the top like any other section, and the reel below is in its
             own resting position with nothing over it. So both classes come
             off at either end, and the value is only parked at the end it
             left through - 1 past the bottom so a re-entry from below finds
             the curtain fully drawn, 0 off the top so scrolling back into the
             cases finds the section whole. */
          cases.classList.remove('is-lifting');
          why.classList.remove('is-lifted-in');
          raiseSpacer();
          driver.v = self.progress > 0.5 ? 1 : 0;
          write();
        }
      }
    });

    tl.to(driver, { v: 1, ease: 'none', onUpdate: write }, 0);
  }

  build();

  /* Re-solve on resize. The spacer's height is a plain style write rather
     than a function-based tween value, and the pin's end is a plain string,
     so both have to be redone BEFORE ScrollTrigger re-measures — refreshInit
     fires at exactly that point, so the measurement that follows picks them
     up and no second refresh is needed. ScrollTrigger's own debounce handles
     the rate. */
  ScrollTrigger.addEventListener('refreshInit', function () {
    if (!tl) return;
    var dist = liftDistance();
    sizeSpacer(dist);
    setTravel();
    var st = tl.scrollTrigger;
    if (st) st.vars.end = '+=' + dist;
  });

  /* The spacer only becomes real once the pin above is actually built. Doing
     this last means a throw anywhere in build() leaves the page laid out as
     CSS authored it, with no orphaned gap where the lift would have been. */
  spacer.classList.add('c2w--live');
  ScrollTrigger.refresh();
}());
