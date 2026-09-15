/* ==========================================================================
   MedShield — why-to-people.js
   The transition from section 08 ("Why MedShield") into section 08c
   ("The technology").

   THE NAME IS HISTORICAL. This file was written when the section after the
   reel was .people, and it is still the file that owns the curtain out of the
   reel - only the section on the other side of it has changed. The technology
   band now sits between the two, so the curtain reveals THAT and .people
   follows it as an ordinary block. The mechanism is unchanged and the spacer
   maths is target-agnostic; see THE REVEAL TARGET below.

   THE PRINCIPLE. The revealed section FILLS IN from the left edge of the
   viewport. It does not slide in, fade up, or arrive from off-screen: it is
   already at its final position from the first frame, and a clip edge opens
   from x=0 rightward until the whole screen is painted with it. The reel
   leaves to the left on the same value, so the screen is filled by the
   incoming section in the space the outgoing one gives up.

       the reel has said why  ->  and here is what the case runs on

   WHAT THIS IS NOT. It is not a panel travelling in from the right. The
   distinction is the whole effect and it lives in one rule: .why is CLIPPED
   away and the section behind it is never TRANSLATED. If the
   incoming content moved, the eye would track the moving type and read "a
   card slid in"; because the type is nailed to where it will finally sit
   and only the painted region grows, the eye reads "this section is being
   filled in". Adding a transform there - even one that ends in the same
   place - would undo the effect while leaving the clip apparently working.

   WHY IT HAS ITS OWN SCROLL DISTANCE. The why rail's 500svh is fully spent:
   why-scrub.js parks the CTA across the last third of it (CTA_END sits
   inside the rail, and the value is deliberately clamped at 1 so the button
   is still under the cursor when the reader reaches for it). Taking the push
   out of that rail would mean pushing the button off screen during the
   stretch it exists to be reachable in. So the push claims its own scroll,
   reserved by the pin itself (pinSpacing:true) at the document position that
   .w2p marks - an empty section immediately after .why. .w2p reserves no
   height of its own, and carries only the one-viewport lift that puts
   .people back on the release pixel; see THE SPACER below.

   WHERE IT STARTS. The exact pixel the sticky stage would stop sticking —
   .why's bottom reaching the bottom of the fold, which is the reel's last
   scroll with the CTA parked. The pin freezes the stage there rather than
   letting it slide away, so there is no seam between the reel ending and
   the push starting. Up to that point the section behaves exactly as it did.
   (See the note at the trigger: both a later and an earlier start are
   visibly wrong, in opposite ways.)

   ---------------------------------------------------------------------------
   THE THREE PIECES

   1. THE OUTGOING PANEL — .why-scrub__stage, the sticky stage that has been
      pinned for the whole rail. It is NOT re-pinned and NOT cloned: the pin
      here is on .why itself, and the stage keeps painting the reel the whole
      way out. The reader is watching the thing they were reading leave.

   2. THE INCOMING PANEL — .tech, an ORDINARY IN-FLOW SECTION that is never
      touched at all. It is already at its final position, so the clip edge
      opening left to right simply uncovers it. Nothing is added to it and
      nothing is animated on it; see THE REVEAL TARGET for why this one must
      not be made fixed the way .people was.

   3. THE SPACER — the empty .w2p section. It does NOT carry the pin's
      distance: pinSpacing is on, so ScrollTrigger reserves that itself, and
      height here would be that distance counted twice. What it does carry is
      a negative margin-bottom of one viewport, which lifts .people's resting
      top from below the pin's inserted padding onto the release pixel. See
      THE SPACER below — the geometry is written out there, because leaving
      the lift off is a blank screen and doubling it shows the section twice.

   ---------------------------------------------------------------------------
   DESIGN NOTES

   A. CSS OWNS THE RESTING LAYOUT. If this file never runs — no GSAP, a
      throw, reduced motion — .w2p stays display:none, contributing no height,
      and .people follows .why as an ordinary block. Nothing is missing and
      nothing is stranded off-screen. Same contract as process-to-cases.js.

   B. ONE VALUE, ONE WRITE. --w2p is written once, to .why, and CSS derives
      the curtain's clip from it. The revealed section reads no value at all,
      which is the strongest possible guarantee that the two layers cannot
      drift: there is nothing about the one underneath to animate.

   C. NO LAYOUT, EITHER SIDE. clip-path on the reel and nothing at all on
      the section behind it; no width, no left, no margin anywhere. Both are compositor-level
      properties on promoted layers, so a scroll tick costs a composite
      rather than a re-layout of a full screen of content.

   D. scrub:true, NOT a number. The page runs its own scroll smoothing
      (hero.js, a Lenis-equivalent integrator), so the position ScrollTrigger
      reads is already eased. GSAP-side scrub smoothing on top of it is a
      second curve stacked on the first, and the panels then settle a beat
      after the wheel stops instead of sitting where the scroll says. Same
      reasoning, and the same value, as process-to-cases.js.
   ========================================================================== */

(function () {
  'use strict';

  var spacer = document.querySelector('.w2p');
  var why = document.getElementById('why');
  /* THE REVEAL TARGET IS .tech, the technology section immediately after .why.

     The mechanism wants "the section immediately after .why in the document".
     For a while that was .people, because the technology band was parked in a
     <template>; it is live again, so the target moves back with it and
     .people follows it as an ordinary block.

     IT IS REVEALED AS A STATIC, IN-FLOW SECTION - no .is-pushed-in, and that
     is the important difference from the .people target. .people is a rail, a
     roster and a panel, far taller than a fold, so it had to be made
     position:fixed with its own inner scroll to be reachable while the pin
     held. .tech is exactly 100svh and has a ScrollTrigger pin of its own on
     .tech__stage inside it, and giving it either of those things broke both:
     the fixed ancestor left the stage with no honest document position, so
     the masthead was revealed low in the fold and snapped to the top when the
     pin engaged, and the fixed box's overflow let the reader scroll INSIDE
     the pinned section, showing the masthead twice.

     So nothing is done to this section at all. The curtain clips .why away
     over the top of it and what is behind it is simply the finished section
     in its own document position - which is exactly what the curtain wants
     (see the note on the revealed layer in style.css), and it leaves
     tech-deck.js the only thing positioning anything inside .tech.

     The spacer maths is target-agnostic - it lifts whatever follows .why onto
     the release pixel (see THE SPACER) - so nothing else here changes. */
  var target = document.getElementById('tech');
  if (!spacer || !why || !target) return;

  var stage = why.querySelector('.why-scrub__stage');
  if (!stage) return;

  if (!window.gsap || !window.ScrollTrigger) return;

  /* Reduced motion: no pin and no push. The spacer never goes live, so the
     two sections simply follow one another as CSS authored them. */
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce.matches) return;

  gsap.registerPlugin(ScrollTrigger);

  /* THE TRAVEL DISTANCE, in viewport heights.

     The gesture covers one screen width, and it has to be readable as a
     deliberate displacement rather than a swipe, so it wants meaningfully
     less scroll than the reel's four-viewport rail but more than a flick.
     0.9 of a viewport puts the full push inside roughly one page-down: the
     reader completes it in one gesture and lands on people already settled.

     Phones get a shorter one for the same reason .why's rail is shorter
     there — a flick covers far more of the page per gesture, so the same
     number reads as an interminable horizontal drag. */
  var PUSH_VH = 0.9;
  var PUSH_VH_SM = 0.7;

  function pushDistance() {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var f = window.innerWidth <= 860 ? PUSH_VH_SM : PUSH_VH;
    return Math.round(vh * f);
  }

  var tl = null;

  /* The single driven value. .people is a SIBLING of .why, not a descendant,
     so there is no common element to hang one custom property off - it is
     written to both, once per tick, from this one source of truth. Two
     writes of the same number is not two animations: they cannot drift,
     because there is only one value. That is what keeps the reel's trailing
     edge and the fill's leading edge locked together. */
  var driver = { v: 0 };
  var isSpent = false;

  function write() {
    var v = driver.v.toFixed(5);
    why.style.setProperty('--w2p', v);
    /* ONLY the curtain reads the value now. It used to be written to the
       revealed panel as well, from this one source so the two could not
       drift. With .tech revealed in place and untouched there is nothing
       there to animate - which is the strongest guarantee it cannot drift at
       all - so the second write is gone rather than left writing a property
       no rule consumes. */

    /* SPENT is driven from the VALUE, not from the pin's toggle.

       It was on onToggle, and it silently did nothing at the one scroll
       position it most needed to work: the pin is still active at
       progress 1 - the toggle fires when the trigger enters and leaves, not
       when it reaches its end - so the class was never added at the moment
       the push finished, and .why's rail went on covering the fold.

       The completed push is a fact about the value, so it is read off the
       value, on every tick that writes one. */
    var spent = driver.v > 0.999;
    if (spent !== isSpent) {
      isSpent = spent;
      if (spent) why.classList.add('is-spent');
      else why.classList.remove('is-spent');
    }
  }

  /* THE SPACER PULLS .people UP BY (vh + dist), and reserves no height.

     ("people" here means whatever section follows .why - now .tech. The
     arithmetic is the same for either; only the name in this note is older
     than the target.)

     THE GEOMETRY. Measured in Chrome at 1440x900, where the pin runs
     start 11410 -> end 12220, so dist = 810 and vh = 900:

       .why's rail   top 8620, height 4500 (500svh)
       pin-spacer    ScrollTrigger wraps .why and adds padding-bottom: 810
       release       12220, .why's bottom back at the fold's bottom

     TWO separate things push .people below that release pixel, and missing
     either one is visible:

       1. vh   - the pin holds .why on screen for `dist` WITHOUT moving the
                 document under it, and .why is 500svh of rail whose bottom
                 only reaches the fold at the release. .people follows the
                 rail, so its resting top starts a full viewport low.
       2. dist - the pin-spacer's padding-bottom sits BELOW .why in the
                 document, so it pushes .w2p and .people down by the pin's
                 whole distance on top of that.

     Uncorrected, .people's top lands at release + 1710. Correcting only vh
     leaves exactly `dist` behind, and 810px of residual is not a subtle
     misalignment: the curtain finishes with .people filling the fold, then
     at the release it DROPS back down ~800px and climbs up again over the
     next screen of scroll - the section revealed in place, then arriving a
     second time from below. That was the reported bug, and it is why this
     takes both terms.

     With the full lift the hand-off is continuous: .people sits at top 0 on
     the last pinned frame and top -1 one pixel past the release, which is
     the reveal simply carrying on into ordinary scrolling. Verified at
     1440x900, 1920x1080 and 390x844.

     And NO height, because ScrollTrigger reserves the pin's distance itself
     (pinSpacing:true). Height here would be that distance counted twice - a
     screen of dead scroll after the push.

     A fixed value for the whole pin, not an animated one: it is a
     resting-position correction, not part of the travel. */
  /* BOTH TERMS, AND THE REVEAL IS WHAT DECIDES IT.

     The two terms correct two different things (written out above):

       vh    .why is 500svh of rail whose bottom only reaches the fold at the
             release, so whatever follows it starts a full viewport low.
       dist  the pin-spacer's padding-bottom sits BELOW .why and pushes the
             following section down by the pin's whole distance as well.

     Both are needed because THE CURTAIN HAS TO REVEAL A COMPOSED SECTION. The
     whole effect is that the reel is cut away and the finished section is
     already standing there, filling the fold, from the first frame of the
     reveal to the last. Correcting only `vh` leaves `dist` of residual: the
     curtain then cuts away to the TOP of .tech sitting 810px low - blank page
     ground where the masthead should be - and the section climbs into place
     afterwards. Measured at 1440x900 the masthead was 900px below the fold at
     the curtain's release.

     (That was tried, to make the deck's `top top` fire at the release rather
     than at the curtain's opening pixel. It fixes the pin and breaks the
     reveal. The deck's start is solved in tech-deck.js instead, from the
     curtain's own end value - see the note there - which leaves this free to
     do the one thing it is for.) */
  function pullUp(dist) {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    return vh + dist;
  }

  /* THE RELEASE PIXEL, PUBLISHED.

     tech-deck.js pins .tech__stage inside the section this curtain reveals,
     and that pin must start where this one ends - otherwise the two share an
     opening pixel and the deck runs its first 810px behind a reel that is
     still painting, so the curtain cuts away to a stack with card 01 already
     departing.

     It cannot read the number off the stage's own position: with the full
     lift above, the stage is at the top of the fold from the curtain's FIRST
     frame (that is the point of the lift), so a `top top` start fires at the
     opening pixel. The honest source is this trigger's end, which is exactly
     the release. Published as a function so a resize re-solves both together,
     and following the window.__medshield* convention used by hero.js,
     bar-ink.js and smooth-scroll.js.

     Returns null until the pin is built, and if this file bails - reduced
     motion, no GSAP, a throw - it is never defined at all; tech-deck.js falls
     back to its own `top top` in both cases, which is correct when there is
     no curtain to clear. */
  window.__medshieldWhyRelease = function () {
    if (!tl || !tl.scrollTrigger) return null;

    /* THE RELEASE PLUS WHAT IS LEFT OF THE LIFT.

       The release is where the curtain stops, but it is NOT where the
       revealed section comes to rest. The push is 0.9 of a viewport
       (PUSH_VH), and the lift above is a whole viewport plus that push - so
       at the release the section still has exactly (vh - push) of travel
       before its own top reaches the top of the fold.

       Measured, the arithmetic is exact at every size:

           1440x900   push 810  vh  900   residual  90
           1440x1080  push 972  vh 1080   residual 108
           1280x800   push 720  vh  800   residual  80

       The deck's pin must engage where the stage is genuinely AT the fold,
       not 90px short of it, or it freezes that residual into the whole run
       and the masthead sits low for the entire section. Those last pixels are
       not a gap: the curtain has finished and the composed section simply
       settles the last fraction of a viewport into place, which reads as the
       reveal carrying on into ordinary scrolling.

       Returned from here rather than computed in tech-deck.js because both
       terms - the end and the push - are this file's, and a copy over there
       would drift the moment PUSH_VH is retuned. */
    var vh = window.innerHeight || document.documentElement.clientHeight;
    return tl.scrollTrigger.end + (vh - pushDistance());
  };

  function sizeSpacer(dist) {
    spacer.style.height = '0px';
    spacer.style.marginBottom = (-pullUp(dist)) + 'px';
  }

  function build() {
    var dist = pushDistance();
    sizeSpacer(dist);

    tl = gsap.timeline({
      scrollTrigger: {
        /* .why is the trigger and the pinned element. The stage inside it is
           already sticky and already the reader's viewport; pinning .why
           holds that arrangement still while the push runs across it.

           WHERE THE PIN HAS TO ENGAGE: the exact pixel .why-scrub__stage
           stops being sticky, which is .why's bottom reaching the bottom of
           the fold. Not a pixel earlier, not a pixel later — and getting
           this wrong is visible either way.

           A pixel LATER (triggering on .w2p's own top) and the stage
           un-sticks and scrolls up out of the viewport under its own steam
           before the push starts, so the reader gets a screen of bare page
           ground where the reel used to be and the people section then
           pushes THAT out. A pixel EARLIER and the push eats scroll the reel
           still needs.

           At this seam the stage is still stuck at top:0, the reel has
           played out, and the CTA has been parked and held. Pinning .why
           here freezes that arrangement instead of letting it slide, and the
           push takes over the very next pixel. */
        trigger: why,
        start: 'bottom bottom',
        /* THE PIN MUST END WHERE .people BEGINS, not a round distance after
           the start. The two are only the same number if the push happens to
           be exactly the leftover rail, and when they differed by even 90px
           the result was a visible sliver: the pin released, .why's own dark
           rail was still the thing under the fold, and .people had not
           reached the top of it yet - a dark band with the people copy
           ghosted over it, between the push finishing and the section
           arriving.

           With pinSpacing:true ScrollTrigger reserves exactly this distance
           as document height of its own, so the push's own length IS the
           distance and .people lands immediately after it. Nothing has to be
           reconciled against .why's leftover rail. */
        end: '+=' + dist,
        pin: why,
        /* SPACING IS SCROLLTRIGGER'S, NOT .w2p's.

           This was pinSpacing:false, copying process-to-cases.js, where the
           .p2c element genuinely IS the spacer and carries the pin distance
           as its own height. It is the wrong borrow here: the push's
           distance comes mostly out of .why's own leftover rail, so .w2p's
           height is small and often 0, and there is then no reserved height
           for the pin to consume. ScrollTrigger compensated by translating
           the pinned .why DOWN by the pin distance - and because .why is
           500svh of dark ground, that left the rail (and its poster)
           covering the top of the viewport after the push had finished, with
           .people showing dimly underneath it.

           Letting ScrollTrigger add its own spacing means .why is released
           where it belongs and .people follows it with nothing on top. */
        pinSpacing: true,
        /* The page jumps to anchors with window.scrollTo and has no
           scroll-smoothing library of the kind that needs a transform pin —
           matching doubts.js and process-to-cases.js, which share this page. */
        pinType: 'fixed',
        anticipatePin: 1,
        /* Direct. See note D above. */
        scrub: true,
        invalidateOnRefresh: true,
        /* The pinned-only styling, on for exactly the stretch the pin is
           engaged and off the instant it releases. Scoped to the toggle
           rather than to a class present from load, so during ordinary
           scrolling people keeps its authored position — a fixed panel left
           on for the whole page would sit over everything below it. */
        onToggle: function (self) {
          if (self.isActive) {
            why.classList.add('is-pushing');
            return;
          }

          /* THE TWO ENDS ARE NOT SYMMETRICAL, and treating them as one is
             what put the reel back on screen at the end of the push.

             .tech needs nothing doing to it at either end: it is an
             ordinary section in its own document position throughout, which
             is exactly where the pin releases it, so there is no swap to be
             visible.

             .why does NOT, and this is the part that took several passes to
             get right. The rail is 500svh of #05121D and the pin engages one
             viewport before its bottom edge, so at the moment the push
             finishes the rail STILL PHYSICALLY COVERS THE FOLD - .people has
             been pulled up underneath it (see pullUp) but .why is painted
             over it, dark ground and poster and all. Taking the transform
             off the stage there is not enough, because it is the section's
             own background doing the covering, not the stage's.

             So past the end .why is taken out of the picture entirely by
             .is-spent (see write(), which drives it off the value, and
             style.css, which hides it). That is safe precisely because the
             push has finished and there is nothing left in it to see. The
             stage keeps its pushed-out transform underneath, so nothing has
             to move if the reader scrolls straight back.

             Off the TOP the reader has scrolled back up into the reel and
             the section has to be its ordinary self again, so everything
             comes off and the value returns to 0. */
          var pastEnd = self.progress > 0.5;

          if (pastEnd) {
            why.classList.add('is-pushing');
            driver.v = 1;
          } else {
            /* Off the top everything comes off. .is-pushing in particular:
               it carries position:fixed and a raised z-index that only make
               sense while the pin holds the section, and leaving them on a
               section the reader has scrolled back into is asking for a
               stacking bug later even though --w2p being 0 makes it look
               right today. */
            why.classList.remove('is-pushing');
            driver.v = 0;
          }
          write();
        }
      }
    });

    tl.to(driver, { v: 1, ease: 'none', onUpdate: write }, 0);
  }

  build();

  /* Re-solve on resize. Both properties are plain style writes rather than
     function-based tween values, so they have to be restated BEFORE
     ScrollTrigger re-measures — refreshInit fires at exactly that point. The
     values no longer depend on the viewport, but the write still has to
     happen: it is what puts the spacer back to a true no-op against anything
     a previous pass (or a stale build) may have left on it.
     ScrollTrigger's own debounce handles the rate. */
  ScrollTrigger.addEventListener('refreshInit', function () {
    if (tl) sizeSpacer(pushDistance());
  });

  /* And re-solve the pin's end for the new viewport, since the end is a
     plain string rather than a function-based value. refreshInit fires
     before ScrollTrigger re-measures, so setting it there is picked up by
     the measurement that follows and needs no second refresh of its own. */
  ScrollTrigger.addEventListener('refreshInit', function () {
    var st = tl && tl.scrollTrigger;
    if (st) st.vars.end = '+=' + pushDistance();
  });

  /* The spacer only becomes real once the pin above is actually built. Doing
     this last means a throw anywhere in build() leaves the page laid out as
     CSS authored it, with no orphaned gap where the push would have been. */
  spacer.classList.add('w2p--live');
  ScrollTrigger.refresh();
}());
