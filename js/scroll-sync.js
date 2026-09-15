/* ==========================================================================
   MedShield — scroll-sync.js
   Puts ScrollTrigger on the same clock as the page's scroll engine.

   THE PROBLEM. This page does not scroll natively. smooth-scroll.js cancels
   the browser's wheel scrolling outright and runs its own animation: a Lenis
   curve easing a virtual position toward the wheel target, written to the
   page with window.scrollTo from inside its own requestAnimationFrame loop.

   ScrollTrigger runs on GSAP's ticker, which is a SEPARATE requestAnimationFrame
   callback. Two rAF callbacks in the same frame run in registration order, and
   nothing here ever made that order deterministic:

       frame A   scroll engine writes scrollY   ->  ticker reads the NEW value
       frame B   ticker reads the OLD value     ->  scroll engine writes scrollY

   So on some frames every scrubbed section is a frame behind the scroll
   position, and on others it is current. The error is not a constant lag -
   a constant lag is invisible - it ALTERNATES, and alternating error at frame
   rate is read as jitter. It is worst exactly where the eye is most sensitive
   to it: slow, deliberate scrolling, which is how the pinned sections are
   meant to be read.

   THE FIX, and it is the standard one for a smooth-scrolling page. Stop
   letting ScrollTrigger poll on its own schedule; tell it to update at the
   one moment the scroll position is known to be fresh - immediately after the
   engine has written it.

       ScrollTrigger.update()          called from the engine's own loop
       ScrollTrigger.scrollerProxy()   not needed: the engine drives the REAL
                                       window scroll, so ScrollTrigger's own
                                       reads are already correct - they were
                                       only ever MISTIMED, not wrong.

   This is why there is no scrollerProxy here and no transform on the scroller.
   The page genuinely scrolls; the only defect was the phase between two
   animation loops, so the phase is all this file corrects.

   WHY IT IS A SEPARATE FILE. smooth-scroll.js loads BEFORE gsap.min.js (it is
   shared with the inner pages, several of which load no GSAP at all), so it
   cannot reference ScrollTrigger at parse time without either a load-order
   change on every page or a guard that lies about the dependency. This file
   loads immediately after ScrollTrigger.min.js and before any section script,
   so both halves are present and every trigger built afterwards is synced from
   its first frame.

   IT BENEFITS EVERY SCRUBBED SECTION, not just the one that prompted it. The
   deck, the reel, and all three panel hand-offs read scroll position through
   ScrollTrigger, so they were all sampling on the same mistimed clock.

   NO-OP WHEN THE ENGINE IS OFF. smooth-scroll.js disables itself on touch and
   under prefers-reduced-motion, and marks that by adding .has-smooth-scroll to
   <html> only when it is live. Without the engine the page scrolls natively,
   ScrollTrigger's own scroll listener is already correctly timed, and taking
   it off its ticker would be a regression - so this file does nothing at all.

   Depends on: gsap.min.js, ScrollTrigger.min.js (js/vendor/), smooth-scroll.js.
   ========================================================================== */
(function () {
  'use strict';

  if (!window.gsap || !window.ScrollTrigger) return;

  /* The engine's own signal that it is driving the scroll. Set inside the
     smoothOK gate in smooth-scroll.js, so it is present only when the wheel
     is actually being intercepted. */
  if (!document.documentElement.classList.contains('has-smooth-scroll')) return;

  gsap.registerPlugin(ScrollTrigger);

  /* HAND ScrollTrigger THE CLOCK.

     ScrollTrigger normally listens for scroll events and updates on its own
     ticker. Both are the wrong moment on this page: the scroll events are
     ours (the engine dispatches them by calling window.scrollTo) and the
     ticker is a different rAF callback from the one that writes the position.

     ScrollTrigger.update is idempotent and cheap - it reads the scroller
     position and advances whatever the change implies - so calling it once
     per engine frame is exactly the contract it wants. */
  var raf = window.requestAnimationFrame;

  /* THE HOOK IS rAF ITSELF, and that is deliberate.

     The alternative is a callback registered with the engine, which would
     mean smooth-scroll.js growing an observer list and every page that loads
     it carrying that weight. Wrapping rAF for the duration of the engine's
     frame is smaller and, more importantly, ORDER-CORRECT BY CONSTRUCTION:
     the update runs after the callback that wrote the scroll position, in the
     same frame, without either file knowing about the other.

     SCOPED TO THE ENGINE'S OWN LOOP, BY IDENTITY. smooth-scroll.js drives its
     animation from a single named function - `frame` - which it re-submits to
     rAF on every tick and from each of its gesture handlers. That one function
     is the only callback that writes a scroll position, so it is the only one
     an update needs to follow.

     The page's other rAF users are marquees and reveal probes that move their
     own elements and never touch scroll; running an update after them would be
     pure redundant work at frame rate. Matching on the callback's name keeps
     this to the loop that matters and passes everything else straight through.

     The name is the contract between the two files, so it is asserted rather
     than assumed: if smooth-scroll.js ever renames that function this stops
     matching, and the console says so instead of the page quietly going back
     to the mistimed clock it had before. */
  var SYNC_FN = 'frame';
  var matched = false;

  window.requestAnimationFrame = function (cb) {
    if (typeof cb !== 'function' || cb.name !== SYNC_FN) {
      return raf.call(window, cb);
    }

    matched = true;

    return raf.call(window, function (t) {
      cb(t);

      /* AFTER the callback, so the position it just wrote is the one read.
         Wrapped because a throw from a mid-scrub trigger must not take the
         scroll engine's loop down with it - the page would stop scrolling
         entirely, which is a far worse failure than a stale frame. */
      try {
        ScrollTrigger.update();
      } catch (e) {}
    });
  };

  /* The assertion the note above promises. The engine only submits its loop
     once the reader actually scrolls, so this cannot run immediately - it is
     checked after a delay long enough for any real first gesture, and only
     complains if the wheel has moved the page without the hook ever matching. */
  setTimeout(function () {
    if (!matched && window.scrollY > 0) {
      console.warn(
        '[scroll-sync] never matched smooth-scroll.js\'s "' + SYNC_FN + '" loop; ' +
        'ScrollTrigger is running on its own clock. Has the function been renamed?'
      );
    }
  }, 8000);

  /* GSAP's own lag smoothing, OFF.

     lagSmoothing tells GSAP that a frame longer than a threshold was a stall
     and should be treated as a smaller time step, so animations do not jump.
     That is right for time-driven tweens and wrong for scroll-driven ones:
     a scrubbed timeline's position is a function of SCROLL, not of elapsed
     time, and pretending less time passed makes the scrub lag the scroll for
     a few frames after any hitch - a dropped frame during a pin then shows up
     as the deck sliding to catch up.

     The scrubbed sections on this page all read position, so there is nothing
     here for lag smoothing to protect. */
  gsap.ticker.lagSmoothing(0);
}());
