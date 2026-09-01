/* ==========================================================================
   SMOOTH SCROLL — shared
   ==========================================================================
   Extracted verbatim from js/hero.js, where it was written for the homepage,
   so that the inner pages get the identical scroll feel instead of the
   browser's raw wheel stepping. hero.js now loads this file rather than
   carrying its own copy: one engine, one behaviour, one place to tune it.

   Why the inner pages need it: without a smoothing layer the wheel moves the
   page in discrete jumps whose size the OS decides, so a mouse detent and a
   trackpad flick travel wildly different distances. That is the "sometimes
   fast, sometimes slow" feel. It is also what the reference build solves with
   Lenis; this is the same idea with no library added.

   MUST load before any script that calls window.__medshieldScroll (nav.js
   uses it to freeze the page behind the overlay menu).

   Guards, unchanged from the original: disabled on touch (native momentum is
   better than anything synthesised) and under prefers-reduced-motion. It only
   ever intercepts the wheel — keyboard, anchor and scrollbar scrolling stay
   native, and re-seed the engine through the scroll listener.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;

/* A native reimplementation of the reference's Lenis setup, with no library
   added. Their config is:

       new Lenis({ wheelMultiplier: 0.75, duration: 1.25 })

   Lenis works by cancelling the browser's own wheel scrolling and easing a
   virtual scroll position toward a target each frame. The exponential
   smoothing below is the same idea: `duration: 1.25` corresponds to the
   eased position closing ~63% of the remaining distance every 1.25s, which
   is what the LERP constant is derived from. Frame-rate independent, so it
   behaves identically at 60Hz and 144Hz.

   Deliberately NOT enabled for: touch devices (native momentum is better
   than anything synthesised), reduced-motion, and keyboard/anchor jumps.
   It only intercepts the wheel. */

var smoothOK = !('ontouchstart' in window || navigator.maxTouchPoints > 0) &&
               !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (smoothOK) {
  // Tells the stylesheet to drop `scroll-behavior: smooth`, which would
  // otherwise re-animate every scrollTo this engine performs.
  root.classList.add('has-smooth-scroll');

  /* --- Matched to rioproperty.co.za ----------------------------------

     This was previously tuned against tresmarescapital.com, which runs Lenis
     with no options at all, so the target was simply Lenis's defaults
     (multiplier 1.0, a fixed per-frame lerp).

     The services build is matched to rioproperty.co.za instead, which
     constructs Lenis explicitly:

         new Lenis({ wheelMultiplier: 0.75, duration: 1.25 })

     so both of those numbers are reproduced below, and the fixed lerp is
     replaced by Lenis's duration-based easing. See the constants. */

  /* One scroll speed, two input devices.

     The goal is that a trackpad and a mouse move the page at the SAME rate:
     the mouse feel is the target, and the trackpad should match it. What
     differs is only the shape of the event stream each one emits.

       mouse wheel — a few large discrete detents (~100px each), a handful
                     per second. 1.0 is correct: one detent moves what the
                     OS says a detent moves.

       trackpad    — a continuous stream of small deltas, 60-120 per second.
                     Their SUM is already the pixel distance the fingers
                     travelled, because the OS has done that conversion
                     before the event is dispatched. So the multiplier here
                     is also 1.0 — scaling it down would make the trackpad
                     SLOWER than the mouse, which is not what is wanted.

     What actually made the trackpad feel out of control is not the per
     event scale, it is the momentum tail: after the fingers lift, the OS
     keeps firing decaying deltas for up to a second or so, and every one of
     them piles more distance into sTarget with no gesture behind it. A
     mouse cannot produce that. So the tail is what gets bounded, NOT the
     speed — see the pending clamp in the wheel handler.

     Note this is not what stock Lenis does: it applies one multiplier to
     both and simply accumulates (`targetScroll + delta`), so on a trackpad
     it runs away in the same way. The clamp below is the part it lacks. */
  /* --- Matched to the reference build ---------------------------------

     rioproperty.co.za constructs Lenis as:

         new Lenis({ wheelMultiplier: 0.75, duration: 1.25 })

     Both numbers are reproduced here, because together they ARE the feel:

     WHEEL_MULTIPLIER 0.75 — every wheel and trackpad delta is scaled to
     three quarters before it is added to the target. One multiplier for
     both devices, exactly as Lenis does: it has no notion of which device
     produced an event.

     DURATION 1.25 — the wall-clock time Lenis takes to (asymptotically)
     close the gap to the target. This is the important one, and it is NOT
     the same model as a fixed per-frame lerp.

       fixed lerp     closes a constant FRACTION of the gap each frame, so
                      the speed it travels at is proportional to how far it
                      still has to go. A long throw starts fast, a short
                      nudge starts slow — which is the inconsistency this
                      is being changed to fix.

       duration mode  normalises against the duration, so a gesture of any
                      size settles over the same 1.25s. Long throws and
                      short nudges feel like the same page.

     Lenis's own integration is
         t = 1 - exp(-dt / (duration / 6.9078))
     where 6.9078 = -ln(0.001), i.e. the gap is 99.9% closed after exactly
     `duration` seconds. That constant is reproduced verbatim below rather
     than approximated, so the curve matches rather than merely resembling. */
  var WHEEL_MULTIPLIER = 0.75;
  var DURATION = 1.25;
  /* -ln(0.001): the gap is 99.9% closed after DURATION seconds. */
  var LENIS_LN = 6.907755278982137;

  /* Trackpads get the SAME multiplier as the wheel — Lenis has no notion of
     which device produced an event, and scaling them differently is what
     makes a trackpad feel unlike a mouse. */
  var TRACKPAD_MULTIPLIER = WHEEL_MULTIPLIER;

  /* One thing kept that stock Lenis does NOT do. After the fingers lift, the
     OS keeps firing decaying wheel events for up to a second; Lenis adds all
     of them, so a trackpad swipe travels ~2.4x the distance the gesture
     actually asked for while an identical mouse gesture travels 1x. That
     device-to-device mismatch is itself an inconsistency, so the tail is
     damped to bring the two into line. Live finger movement is untouched —
     only the post-release decay is attenuated. */
  var TAIL_DAMP = 0.35;


  /* --- Device detection -----------------------------------------------

     There is no API that reports the pointing device, so it is inferred
     from the shape of the event stream, and re-inferred continuously — a
     laptop user with a mouse plugged in switches between the two mid
     session and must not be locked to whichever arrived first.

     Three tells, any one of which means trackpad:
       - a fractional deltaY. Wheels emit whole numbers; trackpads routinely
         emit values like 4.5 from pixel-precise scrolling.
       - a small deltaY. A wheel detent is ~100px (>=40 in practice after OS
         scaling); trackpad deltas during a swipe are typically single or
         low double digits.
       - events arriving faster than a wheel physically can (<30ms apart)
         while the delta stays small.

     A wheel detent that happens to be small AND arrives fast would be
     misread, so the classification is sticky: it takes a clear wheel-shaped
     event (large, whole-numbered) to switch back. */
  var isTrackpad = false;
  var lastWheelAt = 0;
  // Largest delta seen in the current gesture, used to spot the decay that
  // marks the momentum tail. Reset whenever a new gesture begins.
  var tailPeak = 0;

  function classify(delta, now) {
    var abs = Math.abs(delta);
    var gap = now - lastWheelAt;
    lastWheelAt = now;

    // Unmistakably a wheel detent: large and a whole number of pixels.
    if (abs >= 50 && delta % 1 === 0) { isTrackpad = false; return; }
    // Unmistakably a trackpad: sub-pixel precision, or a fast stream of
    // small deltas that no wheel could produce. `gap < 30 || !gap` so the
    // first event of a burst, which has no previous timestamp to measure
    // against, is judged on its size alone rather than defaulting to wheel.
    if (delta % 1 !== 0 || (abs < 40 && (gap < 30 || !lastWheelAt))) {
      isTrackpad = true;
    }
  }

  /* No frame-rate rebasing constant is needed: the easing above is a
     function of real elapsed time, so it is frame-rate independent by
     construction. */
  // NOTE: these are deliberately s-prefixed. The video-scrub block above
  // declares its own `target` (a playhead time in SECONDS) in this same
  // function scope; sharing the name meant the scrub overwrote the scroll
  // target with ~0 every frame and the page always crawled back to the top.
  var sTarget = window.scrollY;
  var sPos = sTarget;
  var sRunning = false;
  // Timestamp of our last programmatic scroll. A boolean one-shot flag is
  // not enough: several scroll events can be dispatched for a single
  // scrollTo, and any we fail to swallow re-seed `sTarget` from the position
  // we are sRunning away from, dragging the animation back to its start.
  var selfScrollAt = 0;

  function maxScroll() {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  function frame(now) {
    var dt = Math.min(0.064, (now - (frame.last || now)) / 1000);
    frame.last = now;

    /* Lenis's duration-based easing, verbatim:

           t = 1 - exp(-dt / (duration / 6.9078))

       Frame-rate independent by construction (it is a function of real
       elapsed time, not of frame count), so it behaves identically at 60Hz
       and 144Hz without the separate rebasing a fixed lerp needs.

       This replaced a fixed per-frame lerp, which closed a constant fraction
       of the remaining gap each frame and therefore travelled at a speed
       proportional to the distance left — fast after a big flick, slow after
       a small one. Normalising against a duration is what makes every
       gesture settle at the same rate.

       No velocity cap. The reference has none, and a cap is what makes a
       long throw feel like it hits a wall partway down. */
    var alpha = 1 - Math.exp(-dt / (DURATION / LENIS_LN));
    sPos += (sTarget - sPos) * alpha;

    /* 1.5px, not 0.4px. Window scroll position is integer-quantised, so a
       sub-pixel gap is invisible yet still costs ~0.3s of 1-2px-per-frame
       crawl on every single stop — the "takes a moment to settle in" feel.
       Landing at 1.5px is imperceptible and lands cleanly. */
    if (Math.abs(sTarget - sPos) < 1.5) {
      sPos = sTarget;
      sRunning = false;
      frame.last = 0;
      selfScrollAt = now;
      window.scrollTo(0, sPos);
      return;
    }
    selfScrollAt = now;
    window.scrollTo(0, sPos);
    requestAnimationFrame(frame);
  }

  window.addEventListener('wheel', function (e) {
    // Let the browser handle zoom and horizontal intent untouched.
    if (e.ctrlKey || e.defaultPrevented) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

    // DOM_DELTA_LINE (1) reports lines, not pixels — normalise before use.
    var delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;

    e.preventDefault();

    var evtAt = e.timeStamp || performance.now();
    var absDelta = Math.abs(delta);
    var sinceLast = evtAt - lastWheelAt;
    // A pause longer than the tail could survive means a new gesture.
    if (sinceLast > 120) tailPeak = 0;

    classify(delta, evtAt);
    var mult = isTrackpad ? TRACKPAD_MULTIPLIER : WHEEL_MULTIPLIER;

    if (!sRunning) { sPos = window.scrollY; frame.last = 0; }
    /* `applied` is what the clamp actually let through, which is NOT the
       same as `delta * mult` once the target is parked against either end
       of the page. The tail damping below rolls back a fraction of a
       momentum event, and it must roll back only the part that landed —
       see the comment there. */
    var beforeClamp = sTarget;
    sTarget = Math.max(0, Math.min(maxScroll(), sTarget + delta * mult));
    var applied = sTarget - beforeClamp;


    /* Trackpad only: damp the OS momentum tail.

       The finger movement itself is honoured at full 1:1, so a swipe moves
       the page exactly as far as the same-sized wheel gesture would. What
       is attenuated is only what arrives AFTER the fingers lift, which is
       the part with no gesture behind it. Measured against a typical swipe
       (450px of finger travel) the tail was adding another 650px — the page
       travelled 2.4x the distance actually asked for, which is what reads
       as running away.

       The tail is recognised by its shape rather than by any event flag,
       because none is exposed: it is a fast stream (<40ms apart) of deltas
       that are monotonically SHRINKING. During real finger movement the
       deltas fluctuate up and down as the swipe accelerates; only the decay
       after release is consistently downward. */
    if (isTrackpad) {
      var falling = absDelta < tailPeak * 0.98 && sinceLast < 40;
      if (falling) {
        /* Roll back most of what this tail event ACTUALLY contributed.

           Rolling back `delta * mult` instead was a real bug at the top of
           the page: scrolling up, delta is negative, so subtracting it ADDS
           downward travel. Mid-page that is a correct undo of the add above.
           Parked at the hero it is not — the clamp had already discarded
           that add, so there was nothing to undo and the rollback invented
           ~75px of downward target out of nothing. The page then eased down
           and the section below peeked in, which is the bounce readers hit
           when flicking up to the top (one calm scroll never showed it: it
           takes a momentum tail landing ON the boundary).

           `applied` is 0 against either end, so the rollback correctly
           becomes a no-op there and the page parks. */
        sTarget = Math.max(0, Math.min(maxScroll(),
                  sTarget - applied * (1 - TAIL_DAMP)));
      } else {
        // Live finger movement: track the peak so the decay is measured
        // against the strongest part of the gesture, decaying the reference
        // slowly so a brief dip mid-swipe is not mistaken for release.
        tailPeak = Math.max(tailPeak * 0.6, absDelta);
      }
    }


    if (!sRunning) {
      sRunning = true;
      requestAnimationFrame(frame);
    }
  }, { passive: false });

  /* Anything that moves the page by other means (anchor click, keyboard,
     scrollbar drag) must re-seed the sTarget, or the next wheel event would
     resume from a stale position.

     The `selfScroll` flag is essential: our own window.scrollTo() inside
     frame() fires this listener synchronously, and without the guard the
     listener would immediately overwrite `sTarget` with the position we are
     sRunning AWAY from — the animation then eases back to where it
     started, which is exactly the bug this guard fixes. */
  window.addEventListener('scroll', function () {
    // Ignore anything within a frame of our own write, and ignore
    // everything while the engine is running.
    if (sRunning || (performance.now() - selfScrollAt) < 100) return;
    sTarget = window.scrollY;
    sPos = sTarget;
  }, { passive: true });

  window.addEventListener('resize', function () {
    sTarget = Math.max(0, Math.min(maxScroll(), sTarget));
  }, { passive: true });

  // Expose a stop/start pair so the overlay menu can freeze the page
  // behind it, exactly as the reference calls lenis.stop()/start().
  /* --- Click-drag scrolling --------------------------------------------
     The other half of the reference's scroll behaviour: press and drag
     anywhere on the page to pull it, and on release it carries on with an
     inertia flick. Its implementation, translated to this engine:

         pointerdown   record y, stop the engine
         pointermove   once past a 6px threshold, treat as a drag:
                       target = startScroll - 1.25 * (y - startY)
                       and track velocity with a 0.92 exponential average
         pointerup     if |velocity| > 0.4, throw a further
                       6 * -velocity * 60 pixels

     The 1.25 factor means the page moves slightly further than the cursor,
     which is what makes dragging feel like it has weight rather than being
     stuck to the pointer.

     Excluded, as in the reference: touch devices (native panning already
     does this, and hijacking it would break it). Also excluded here, which
     the reference does NOT do: drags that begin on a link, a button, or a
     text selection, so dragging never swallows a click or prevents the
     reader selecting a paragraph. */
  var dragging = false;      /* pointer is down */
  var moved = false;         /* passed the threshold, so it is a real drag */
  var startY = 0;
  var startScroll = 0;
  var lastY = 0;
  var lastT = 0;
  var vel = 0;

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    root.style.userSelect = '';

    if (moved) {
      moved = false;
      /* Only throw if the pointer was still moving at release. */
      if (Math.abs(vel) > 0.4) {
        var throwPx = 6 * -vel * 60;
        sTarget = Math.max(0, Math.min(maxScroll(), sTarget + throwPx));
        if (!sRunning) {
          sPos = window.scrollY;
          frame.last = 0;
          sRunning = true;
          requestAnimationFrame(frame);
        }
      }
    }
  }

  window.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    /* Never start a drag on something the reader is trying to use. */
    if (e.target.closest('a, button, input, textarea, select, label, [role="button"]')) return;

    dragging = true;
    moved = false;
    startY = lastY = e.clientY;
    lastT = performance.now();
    startScroll = sTarget;
    vel = 0;
  }, { passive: true });

  window.addEventListener('pointermove', function (e) {
    if (!dragging) return;

    var dy = e.clientY - startY;
    if (!moved) {
      if (Math.abs(dy) <= 6) return;      /* still a click, not a drag */
      moved = true;
      root.style.userSelect = 'none';
    }

    var now = performance.now();
    var v = (e.clientY - lastY) / Math.max(1, now - lastT);
    vel = 0.92 * vel + v * 0.08;          /* exponential average, as reference */
    lastY = e.clientY;
    lastT = now;

    sTarget = Math.max(0, Math.min(maxScroll(), startScroll - 1.25 * dy));
    if (!sRunning) {
      sPos = window.scrollY;
      frame.last = 0;
      sRunning = true;
      requestAnimationFrame(frame);
    }
  }, { passive: true });

  window.addEventListener('pointerup', endDrag, { passive: true });
  window.addEventListener('pointercancel', endDrag, { passive: true });

  window.__medshieldScroll = {
    stop: function () { sRunning = false; sTarget = window.scrollY; sPos = sTarget; },
    start: function () { sTarget = window.scrollY; sPos = sTarget; },

    /* Programmatic scroll that goes THROUGH the engine rather than around
       it. A native window.scrollTo({behavior:'smooth'}) would be re-seeded
       out from under itself by the scroll listener above on every step of
       its animation, so back-to-top stalled or snapped back. Setting
       sTarget and running the same frame loop keeps one source of truth. */
    scrollTo: function (y) {
      sTarget = Math.max(0, Math.min(maxScroll(), y));
      if (!sRunning) {
        sPos = window.scrollY;
        frame.last = 0;
        sRunning = true;
        requestAnimationFrame(frame);
      }
    }
  };
}
})();
