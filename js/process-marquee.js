/* ==========================================================================
   MedShield — process-marquee.js
   Section 05, "How our case runs": the continuous left-running band.

   WHAT THIS IS. One strip of stage cards translating steadily to the LEFT at
   a constant rate, forever. It is not a carousel: there is no current slide,
   nothing snaps, nothing is paged, and there is no state the reader has to
   scroll to unlock. The five stages are simply always going past, and the
   reader reads whichever one is in front of them.

   HOW THE LOOP CLOSES. The track holds the five cards TWICE (see index.html —
   the second set is aria-hidden). The strip is translated from 0 to exactly
   minus-half its own width and then wrapped back to 0. Because the second
   half is pixel-identical to the first, the wrap lands on the same picture in
   the same place and the seam is invisible. Nothing is cloned at runtime and
   no element is ever moved in the DOM.

   WHY NOT A CSS ANIMATION. Two reasons, both about the hand-off into Case
   studies. A keyframed translate cannot be paused and resumed at an arbitrary
   sub-pixel offset without a visible jump, and it cannot be made to stop on
   the exact frame the morph finishes. Driving it from rAF costs one transform
   write per frame on an already-composited layer and gives both for free.

   TIME-BASED, NOT FRAME-BASED. The step is derived from the real elapsed
   milliseconds, so the band runs at the same speed on a 60Hz laptop and a
   144Hz monitor. A per-frame constant would run the strip 2.4x faster on the
   latter.

   IT KEEPS RUNNING THROUGH THE HAND-OFF, deliberately — see the note in
   style.css. Freezing the band the moment the morph engages would announce
   the transition a beat before it starts. It stops only once the camera is
   done and there is nothing left on screen for it to be doing.

   RESTING CONTRACT. If this file never runs — no JS, a throw, reduced motion
   — .process--live is never added and CSS leaves the band as an ordinary
   horizontal scroller the reader swipes themselves, with the duplicate set
   hidden so the five stages appear once. Nothing is missing from the page.
   Same contract as doubts.js / services.js / why.js.
   ========================================================================== */

(function () {
  'use strict';

  var section = document.getElementById('process');
  if (!section) return;

  var frame = section.querySelector('.process__frame');
  var track = section.querySelector('.process__track');
  if (!frame || !track) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce.matches) return;

  /* THE RATE, in px per second.

     Slow enough to read a card's copy while it is on screen, fast enough that
     the band is unmistakably moving rather than drifting. At ~23rem cards a
     given card takes roughly 10s to cross a 1440 viewport, which is about
     twice as long as it takes to read the three lines on it. */
  var SPEED = 34;

  /* HOW FAR ONE FULL CYCLE IS.

     Half the track's scroll width — i.e. exactly one set of five cards plus
     the gaps between them. Measured rather than computed from card widths, so
     the flex gap and any sub-pixel rounding are already included and the wrap
     is exact.

     Re-measured on a real width change only, and after the webfonts have
     swapped: a title that reflows changes nothing about the card's width
     here (the cards are fixed-width plates), but the images loading does
     settle the layout, so load is worth one more read. */
  var cycle = 0;

  /* px travelled, always in [0, cycle). Declared before measure() uses it —
     `var` hoists the binding but not the value, so reading it from a call
     placed above the assignment would give undefined and turn the modulo
     below into NaN. */
  var offset = 0;

  function measure() {
    /* The header's height feeds .process__body's min-height, which decides
       where the band sits — so it has to be published BEFORE the band's own
       offset is read below, or that offset is a frame stale. */
    readHeaderHeight();

    /* MEASURED FROM THE CARDS, NOT FROM THE TRACK'S WIDTH.

       cycle used to be track.scrollWidth / 2, which was exact while the strip
       was a bare row of ten cards. The track now carries a left padding — the
       lead-in that puts card 01 under the heading (see style.css) — and that
       padding exists on the LEFT only, so it is inside the first half of the
       scroll width and absent from the second. Halving the total would fold
       half a gutter into the cycle and the wrap would drift by that much
       every lap, which accumulates into a visible jump.

       The cycle is the distance from card 01 to its own duplicate, so measure
       exactly that: the gap between the first card's left edge and the sixth
       card's left edge. Padding, gap and sub-pixel rounding are all already
       inside it by construction, and it stays correct whatever furniture is
       added around the strip.

       Offsets, not rects: offsetLeft is unaffected by the transform this file
       is currently writing, so there is no need to clear it first. */
    var cards = track.children;
    var half = cards.length / 2;
    cycle = (cards.length >= 2 && half === Math.floor(half))
      ? cards[half].offsetLeft - cards[0].offsetLeft
      : 0;
    if (!(cycle > 0)) cycle = 0;
    /* The offset is a position within the cycle, so a shorter cycle must not
       leave it parked past the end. */
    if (cycle > 0) offset = offset % cycle;
    readBandOffset();
  }

  /* --- the run ----------------------------------------------------------- */

  var last = 0;            /* timestamp of the previous frame */
  var running = false;
  var rafId = 0;

  function write() {
    /* translate3d, not translateX: the z keeps the strip on its own
       compositor layer on every engine, which is what makes this a
       transform-only write with no paint behind it. */
    track.style.transform = 'translate3d(' + (-offset).toFixed(2) + 'px,0,0)';
  }

  function tick(now) {
    if (!running) return;
    rafId = requestAnimationFrame(tick);

    var dt = now - last;
    last = now;

    /* A TAB THAT WAS IN THE BACKGROUND HANDS BACK A HUGE dt.

       rAF is throttled or stopped entirely while the tab is hidden, so the
       first frame after it comes back can carry several seconds. Advancing by
       that would jump the strip most of a cycle in one frame — visible as a
       hard cut the moment the reader returns. Clamped to ~4 frames' worth,
       which is enough to smooth an ordinary hitch and short enough that a
       real gap simply resumes where it left off. */
    if (dt > 64) dt = 64;
    if (dt < 0) dt = 0;

    offset += SPEED * (dt / 1000);
    if (cycle > 0) {
      /* while, not if: a clamped dt cannot overshoot a whole cycle, but a
         re-measure to a much shorter cycle can. */
      while (offset >= cycle) offset -= cycle;
    }
    write();
  }

  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  /* --- only while it is on screen ----------------------------------------
     A band running in a section three viewports away is a transform write
     every frame for something nobody can see. The observer is generous on
     purpose (a full viewport of margin either side) so the strip is already
     up to speed by the time the section is genuinely in view — starting it at
     the exact edge would show the reader a stationary band for the first
     frame. */
  var visible = false;

  function sync() {
    if (visible && !document.hidden) start(); else stop();
  }

  /* THE BAND STARTS FROM CARD 01, WHEN THE READER ARRIVES.

     Without this the strip begins running the moment the page loads, so by
     the time the reader has scrolled down through four sections it is already
     most of a cycle in and they meet the band mid-stride — usually on stage
     03 or 04, with stage 01 long gone off the left edge. The five stages are
     a SEQUENCE, so the first thing the reader sees has to be the first one.

     So the offset is rewound to 0 the first time the section genuinely comes
     into view, which puts card 01 flush at the left edge with the band then
     running 01 -> 05 in order. The wrap back to 01 after that is the
     duplicate set's job and is invisible (see the cycle note above), so the
     sequence simply restarts from the left with no seam.

     REWOUND ONCE, not on every entry. Re-seeding it each time the section
     re-enters the viewport would snap the band backwards under a reader who
     scrolled up a little and back down — a visible jump, and one that would
     happen mid-transition on the way into Case studies. First arrival only. */
  var seeded = false;

  if (window.IntersectionObserver) {
    /* TWO OBSERVERS, TWO DIFFERENT QUESTIONS.

       The run/idle observer below is deliberately generous (a full viewport
       of margin) so the band is already up to speed by the time it is really
       on screen. That same margin is far too early to answer "has the reader
       arrived at the section" — it fires a whole screen before the band is
       visible, and the rewind would be spent long before it could be seen.

       This one asks the narrow question, with no margin: is the band actually
       in the viewport. */
    new IntersectionObserver(function (entries) {
      if (!seeded && entries[0].isIntersecting) {
        seeded = true;
        offset = 0;
        write();
      }
    }, { rootMargin: '0px', threshold: 0.01 }).observe(frame);

    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      sync();
    }, { rootMargin: '100% 0px' }).observe(frame);
  } else {
    visible = true;
  }

  /* Hidden tab: stop outright rather than relying on rAF's own throttling,
     so a backgrounded page costs nothing at all. */
  document.addEventListener('visibilitychange', sync);

  /* --- THE HAND-OFF INTO CASE STUDIES ------------------------------------

     Two jobs, both of them about geometry the morph cannot work out for
     itself.

     1. --band-y. While the morph is engaged, .process__camera becomes the
        whole pinned viewport and .process__frame is absolutely positioned
        inside it (see style.css). It has to land on the exact screen row it
        occupied the instant the pin engaged, or the band jumps at the
        hand-over — the same defect the old design solved with --held-y.
        Measured here, from the real rect, at the frame .is-morphing appears.

     2. THE STOP. The band keeps running all through the close, which is the
        point — the object folding inward is the live thing the reader was
        just looking at. It stands down only once .is-camera-done says the
        camera has handed over to the real case card, and picks back up if
        the reader scrolls back up out of it.

     Watched with a MutationObserver on the class attribute rather than by
     polling: process-to-cases.js owns those classes and writes them from its
     own scrubbed timeline, so this reacts on the frame they change and never
     between. */
  /* THE BAND'S RESTING OFFSET INSIDE #process, cached from the NORMAL layout.

     It has to be read while the section is unmorphed. Once .is-morphing is
     applied, .process__camera becomes position:absolute and therefore the
     frame's offsetParent, so walking the offset chain from the frame stops at
     the camera (offsetTop 0) and never reaches .process__body's 304px —
     measured, that is exactly why the first attempt at this returned 0 and
     the band snapped to the top of the closing card.

     Refreshed by measure(), which runs at build and on every real width
     change, so it is always the current layout's number and never a stale
     one. */
  var bandOffset = 0;

  /* PUBLISH THE HEADER'S REAL HEIGHT.

     .process__body's min-height is "one viewport minus the furniture above
     it", and that furniture is the header — whose height is not a constant:
     the display line wraps to three lines on a phone and to one on a wide
     monitor. A hard-coded value left the section short of the fold at exactly
     the widths where the heading is tallest, which re-armed the immediate-pin
     bug the min-height exists to prevent (see the note in style.css).

     Written as a custom property rather than an inline height so CSS keeps
     ownership of the arithmetic and the resting stylesheet still works, with
     its own fallback, on the frame before this runs. */
  var header = section.querySelector('.process__header');

  function readHeaderHeight() {
    if (!header) return;
    section.style.setProperty('--process-head-h',
      Math.round(header.getBoundingClientRect().height) + 'px');
  }

  function readBandOffset() {
    var off = frame.offsetTop;
    var el = frame.offsetParent;
    while (el && el !== section) {
      off += el.offsetTop;
      el = el.offsetParent;
    }
    /* Only trust a reading taken from the resting layout. */
    if (!section.classList.contains('is-morphing')) bandOffset = off;
  }

  function readBandY() {
    /* SOLVED, NOT MEASURED LIVE.

       The MutationObserver callback runs AFTER .is-morphing has been applied,
       so any rect read here is already the morphing geometry. The screen row
       the band occupied at the instant the pin engaged is derived instead
       from two numbers that do not depend on when this runs:

         bandOffset  where the band sits inside #process, in the section's own
                     coordinate space — a layout constant, cached above from
                     the resting layout.
         camOffset   how much of the section sits ABOVE its final viewport,
                     i.e. sectionHeight - innerHeight. This is exactly what
                     process-to-cases.js cancels when it crops the camera (see
                     measureCamera there), and it is what turns a
                     section-space offset into a screen row.

       Clamped at 0: a section shorter than the viewport has nothing above the
       fold to cancel. */
    var camOffset = Math.max(0, section.offsetHeight - window.innerHeight);
    var y = Math.max(0, Math.round(bandOffset - camOffset));
    section.style.setProperty('--band-y', y + 'px');
  }

  if (window.MutationObserver) {
    var wasMorphing = false;
    new MutationObserver(function () {
      var morphing = section.classList.contains('is-morphing');
      if (morphing && !wasMorphing) readBandY();
      wasMorphing = morphing;

      /* Stopped only at the very end of the transition, never at its start. */
      if (section.classList.contains('is-camera-done')) stop();
      else sync();
    }).observe(section, { attributes: true, attributeFilter: ['class'] });
  }

  /* --- run ---------------------------------------------------------------
     .process--live is the signal to CSS that the strip is being driven, which
     is what turns the resting swipeable scroller into a marquee. Added only
     after the first measure succeeds, so a zero-width track (fonts still
     blocking, images not yet laid out) never leaves the reader with a band
     that cannot move and cannot be scrolled either. */
  /* .process--live GOES ON FIRST, AND THAT ORDER MATTERS.

     It used to be added only after measure() had returned a usable cycle, on
     the reasoning that a band which cannot move should be left as the plain
     swipeable strip. That is a deadlock: the resting stylesheet hides the
     duplicate set (.process__card--clone { display:none }) because an
     un-driven strip must show the five stages once, not twice — so while the
     class is off, the clones have no box at all, and the cycle measured from
     them comes back as 0 or negative. Measured: offsetLeft was 0 for all five
     duplicates and offsetParent was null.

     So the class is applied first, the strip is measured with its real ten-
     card layout, and it is taken back off only if the measurement turns out
     to be unusable. Nothing paints in between — both writes happen in the
     same task, before the next frame. */
  section.classList.add('process--live');
  measure();
  if (cycle > 0) {
    write();
    sync();
  } else {
    /* Unusable measurement: hand the band back to the reader as the ordinary
       swipeable strip rather than leaving a dead one that cannot move. */
    section.classList.remove('process--live');
  }

  var lastW = window.innerWidth;
  var resizeTimer;
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      /* Same ordering as the initial run: the class has to be on for the
         duplicate set to have a box to measure. */
      section.classList.add('process--live');
      measure();
      if (cycle > 0) write();
      else section.classList.remove('process--live');
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    }, 200);
  }, { passive: true });

  /* The cards are fixed-width plates, so a font swap does not move them — but
     the images settling does finalise the track's own scrollWidth, and the
     cycle length has to be exact or the wrap shows a seam. */
  window.addEventListener('load', function () {
    section.classList.add('process--live');
    measure();
    if (cycle > 0) { write(); sync(); }
    else section.classList.remove('process--live');
  });

  /* If the reader turns reduced motion on mid-session, hand the band back to
     them rather than leaving it running. */
  if (reduce.addEventListener) {
    reduce.addEventListener('change', function (e) {
      if (!e.matches) return;
      stop();
      section.classList.remove('process--live');
      track.style.transform = '';
    });
  }
}());
