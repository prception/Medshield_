/* ==========================================================================
   MedShield — why.js
   The automatic card carousel in section 07, "Why MedShield".

   Five cards live in one flex track inside a clipped viewport that is exactly
   three cards wide (one card wide on mobile). Every ~3.2s the track slides
   left by one card-step; the moment it lands, the card that just left the
   frame is moved to the END of the track and the track is snapped back to
   x:0 with the tween's own state — no visible jump, because at that instant
   the layout after the move is pixel-identical to the layout before it.

   That rotate-and-reset is the whole trick, and it is why the sequence is a
   genuine infinite loop rather than five slides and a rewind:

     01 02 03  ->  02 03 04  ->  03 04 05  ->  04 05 01  ->  05 01 02  ->  ...

   Each card is a single DOM node throughout. Nothing is cloned, so a card is
   never on screen twice and the content of the five cards is never touched.

   ---------------------------------------------------------------------------
   DESIGN NOTES

   1. CSS OWNS THE RESTING LAYOUT. The track's only inline state is a single
      x-translation that always returns to 0. If this script never runs — no
      GSAP, a throw, an old browser — the section renders as a static row of
      three cards with the other two clipped, which is a complete and legible
      state. Same contract as services.js and doubts.js.

   2. THE STEP IS MEASURED, NOT CALCULATED. Card width comes from
      getBoundingClientRect() on the first card plus the computed flex gap, so
      the distance is whatever the stylesheet actually produced at this
      viewport — clamp(), sub-pixel flex division and the three/one-up
      breakpoint all resolve themselves. Re-measured on resize.

   3. ONE CARD MOVES THE WHOLE ROW. Exit fade/scale is applied to the leaving
      card only, and it is reset before that card is re-appended, so a card
      returning from the back of the queue is always at full opacity and
      scale. The three cards that merely shift keep their size and opacity
      untouched — the brief is a row that travels, not a stack that pulses.

   4. IT DOES NOT RUN OFF-SCREEN. A single IntersectionObserver gates the
      timer, so the loop is idle (and costs nothing) while section 07 is out
      of view, and hover/focus pause it while a reader is actually reading a
      card.

   5. prefers-reduced-motion: the loop never starts. CSS turns the viewport
      into a snap-scroller in that case, so the remaining cards stay reachable
      by hand rather than becoming unreachable.
   ========================================================================== */

(function () {
  'use strict';

  var root = document.querySelector('[data-why-carousel]');
  if (!root || !window.gsap) return;

  var track = root.querySelector('.why__track');
  var cards = track ? Array.prototype.slice.call(track.children) : [];
  if (!track || cards.length < 2) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var DURATION = 1.05;                       /* 1050ms — inside the 900-1200 band */
  var HOLD     = 3.2;                        /* seconds of stillness between steps */

  /* --- the easing curve --------------------------------------------------
     cubic-bezier(0.76, 0, 0.24, 1) — a deep symmetric in-out. GSAP core does
     not ship CustomEase, so rather than substitute a named approximation
     (power3.inOut is visibly shallower at the ends) the curve is solved here:
     Newton-Raphson on x to recover t, then evaluate y. Registered once as a
     named ease so every tween in this file shares the exact same curve. */
  var EASE = (function () {
    var x1 = 0.76, y1 = 0, x2 = 0.24, y2 = 1;
    function bez(a, b, t) {
      var u = 1 - t;
      return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
    }
    function slope(a, b, t) {
      var u = 1 - t;
      return 3 * u * u * a + 6 * u * t * (b - a) + 3 * t * t * (1 - b);
    }
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      var t = x, i, d;
      for (i = 0; i < 6; i++) {
        d = slope(x1, x2, t);
        if (Math.abs(d) < 1e-6) break;
        t -= (bez(x1, x2, t) - x) / d;
        if (t < 0) t = 0; else if (t > 1) t = 1;
      }
      return bez(y1, y2, t);
    };
  }());

  /* --- measurement -------------------------------------------------------
     One card plus one gap. Read from the DOM every time the geometry could
     have changed, never cached across a resize. */
  function step() {
    var first = track.children[0];
    if (!first) return 0;
    var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    return first.getBoundingClientRect().width + gap;
  }

  /* How many cards the viewport shows right now. Read from --why-visible so
     the three-up/one-up breakpoint lives in one place — the stylesheet — and
     the script never second-guesses it with its own media query. */
  function visibleCount() {
    var n = parseInt(getComputedStyle(track).getPropertyValue('--why-visible'), 10);
    return n > 0 ? n : 3;
  }

  var tween = null;
  var timer = null;
  var paused = false;
  var visible = false;

  function clearTimer() {
    if (timer) { clearTimeout(timer); timer = null; }
  }

  function schedule() {
    clearTimer();
    if (paused || !visible) return;
    timer = setTimeout(advance, HOLD * 1000);
  }

  /* --- one step ----------------------------------------------------------
     The track slides one card-step left while the outgoing card — the first
     one, the one that will cross the left edge — dims and shrinks slightly.
     The incoming card is the one that was already parked just outside the
     right edge, so it needs no entrance of its own beyond the shared slide;
     it gets a short fade/scale-up on top so it arrives rather than merely
     appears. */
  function advance() {
    var d = step();
    if (!d) { schedule(); return; }

    var outgoing = track.children[0];
    /* The card entering the frame is the first one currently parked outside
       the right edge — index == however many are visible. */
    var incoming = track.children[visibleCount()] || null;

    if (incoming) {
      gsap.fromTo(incoming,
        { opacity: 0.35, scale: 0.965 },
        { opacity: 1, scale: 1, duration: DURATION * 0.85, ease: EASE,
          transformOrigin: '50% 50%' });
    }

    gsap.to(outgoing, {
      opacity: 0,
      scale: 0.94,
      duration: DURATION,
      ease: EASE,
      transformOrigin: '50% 50%'
    });

    tween = gsap.to(track, {
      x: -d,
      duration: DURATION,
      ease: EASE,
      onComplete: function () {
        /* Rotate: the card that just left the frame goes to the back of the
           queue, and the track returns to 0. Both happen in the same frame,
           and the resulting layout is identical to the pre-move one shifted
           by exactly d — so nothing visible changes at this instant. */
        gsap.set(outgoing, { opacity: 1, scale: 1, clearProps: 'transform,opacity' });
        track.appendChild(outgoing);
        gsap.set(track, { x: 0 });
        tween = null;
        schedule();
      }
    });
  }

  /* --- pause on hover and on keyboard focus ------------------------------
     Focus matters as much as hover here: the card lists are readable content,
     and a card sliding out from under a keyboard user mid-read is worse than
     one that stops. */
  function pause() {
    paused = true;
    clearTimer();
  }
  function resume() {
    paused = false;
    if (!tween) schedule();
  }

  root.addEventListener('mouseenter', pause);
  root.addEventListener('mouseleave', resume);
  root.addEventListener('focusin', pause);
  root.addEventListener('focusout', resume);

  /* --- run only while on screen ----------------------------------------- */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) { if (!tween) schedule(); }
      else clearTimer();
    }, { threshold: 0.15 }).observe(root);
  } else {
    visible = true;
    schedule();
  }

  /* --- resize -------------------------------------------------------------
     The step distance is read fresh at the top of every advance(), so a
     resize needs no recomputation — it only needs the track parked at 0 so a
     mid-flight tween cannot leave it offset against the new geometry. */
  var resizeId;
  window.addEventListener('resize', function () {
    clearTimeout(resizeId);
    resizeId = setTimeout(function () {
      if (tween) { tween.kill(); tween = null; }
      gsap.set(track, { x: 0 });
      gsap.set(track.children, { clearProps: 'transform,opacity' });
      schedule();
    }, 150);
  });
}());
