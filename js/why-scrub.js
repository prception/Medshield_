/* ==========================================================================
   WHY US — scroll-scrubbed reel
   ==========================================================================
   The section is a tall rail with a 100svh sticky stage inside it. The stage
   holds one <canvas>; scroll position picks which of the 240 drone frames is
   painted into it. Scrolling the rail flies the camera from the ship's deck
   up through the cloud layer.

   THE TAGLINE
   The copy is not part of the reel — it is a layer over it that DRIFTS
   continuously upward. It is NOT on screen when the section arrives: the
   drift is keyed to the pinned travel, not to the section entering the
   viewport, so the stage pins and holds on frame 0 with an empty frame, and
   the tagline only starts climbing into shot once the reader scrolls on
   into the reel. It rises from below, keeps travelling up as the camera
   pulls back, and leaves through the top. It never parks at a resting
   line.

   Everything here is a function of scroll position, but NOT of the raw one.
   The scroll position is a target and the drawn position eases toward it
   every frame (see THE LOOP, further down). Stop scrolling and the tagline
   glides the last fraction of its travel and settles, rather than stopping
   dead on the pixel the wheel left it at.

   That easing is deliberate and it is what makes the section feel fluid. A
   wheel notch is a single large jump in scroll position; slaved rigidly to
   it, the copy and the points teleported once per notch and stood still in
   between, which reads as stuttering no matter how cheap the frame is to
   draw. The ease turns each notch into a sweep across the frames that
   follow it. There is still no CSS transition or keyframe animation
   anywhere in this file - the smoothing is in the value, not in the
   stylesheet, which is what keeps it reversible and exactly scrubbable.

   --why-y is the drift, in viewport heights, written straight onto the
   element; --why-in is only the fade at the two ends so it does not pop in
   or clip out at the frame edge.

   THE HOLD
   The rail is longer than the scrub needs on purpose. The first HOLD of the
   travel paints frame 0 and nothing else, so the section arrives, pins, and
   sits still for a beat before the camera starts moving. Without it the
   reel is already mid-flight the instant the section touches the top of the
   viewport and the arrival reads as a jump cut.

   WHY A CANVAS AND NOT 240 STACKED <img>
   Swapping opacity on 240 layered images keeps every one of them live in the
   compositor; the browser holds 240 full-viewport layers and the section
   janks on any machine without a lot of VRAM. One canvas is one layer, and
   drawImage of an already-decoded bitmap is a blit — cheap enough to do
   every frame at 144Hz.

   WHY THE FRAMES ARE DECODED UP FRONT
   The single biggest cause of stutter in a scrubbed reel is decoding on the
   scroll thread. An <img> that has downloaded is NOT ready to paint — the
   first drawImage of it triggers a synchronous decode, which is exactly the
   hitch you feel as you scrub past a frame for the first time. So every
   frame is fetched AND decode()d before the reel is armed, and what is
   cached is the decoded bitmap. After that a scrub touches nothing but
   drawImage.

   LOADING ORDER
   Frames load sequentially, not all at once: 240 parallel requests saturate
   the connection and the first frame — the one actually needed to show
   anything — lands last. Sequential loading means frame 0 is ready almost
   immediately, so the stage can paint its first frame while the rest of the
   reel streams in behind it.

   The whole set only starts loading when the section is within a couple of
   viewports of being reached, so the reel never competes with the hero for
   bandwidth on first paint.

   LENIS
   smooth-scroll.js takes the page off native scrolling and re-emits a window
   'scroll' event on its own bus, so listening for 'scroll' is correct here
   and needs no special case — the same contract founders-scrub.js relies on.

   PROGRESSIVE ENHANCEMENT / REDUCED MOTION
   Without JS, and under prefers-reduced-motion, the stylesheet collapses the
   rail to a single viewport and shows the poster image instead. This file
   bails out in that case rather than fighting it.
   ========================================================================== */
(function () {
  'use strict';

  /* Frame count and the path template. Both sets are the same length; only
     the width differs. */
  var COUNT = 240;
  var DIR_LG = 'assets/why-us/scrub/';
  var DIR_SM = 'assets/why-us/scrub-sm/';

  /* Fraction of the rail's travel spent parked on frame 0 before the camera
     moves. Kept very short deliberately: the reel is meant to START as the
     section is reached, so the reader sees the camera moving straight away
     and the tagline arrives over footage that is already in motion. A long
     hold here put a still frame on screen for most of a viewport and made
     the section look frozen on arrival. */
  var HOLD = 0.02;

  /* Fraction of travel held on the LAST frame, so the reel finishes and
     settles before the section releases and scrolls away. */
  var TAIL = 0.08;

  /* Below this width the 720px set is used instead of the 1280px one. */
  var SM_MAX = 900;

  /* How far ahead of the section (in viewports) loading begins. */
  var PRELOAD_MARGIN = 2;

  /* The tagline's drift, in viewport heights. 0.62 below the centre line is
     clear of the bottom edge, so at the start of its travel the copy is
     genuinely off screen rather than merely transparent — nothing is
     visible when the section arrives and pins.

     Negative is up: the element is translated by (from -> to) as the drift
     runs 0 -> 1, so it enters low and leaves high. */
  var DRIFT_FROM = 0.62;
  var DRIFT_TO = -0.62;

  /* The slice of the PINNED travel the drift occupies.

     ORDER MATTERS: the reel starts first, the tagline follows. DRIFT_START
     sits after HOLD, so by the time the copy begins to climb the camera is
     already moving and the text arrives over live footage rather than over
     a still. The frame is therefore empty on arrival, the reel plays, and
     the tagline comes up out of the bottom edge a scroll or two later.

     The travel here is 400svh (a 500svh rail less the one-viewport stage),
     so on a 900px viewport a wheel notch of ~100px is about 0.028 of it.
     0.04 puts the start early in the second notch.

     SPEED. The window is deliberately SHORT — a quarter of the travel, not
     all of it. The copy has ~1.25 viewports to cross either way; spread
     across the whole section that worked out to a few pixels per notch and
     read as barely moving. Compressed into 0.04..0.30 it covers the same
     distance in a quarter of the scrolling, so it visibly flies up past the
     reel and is gone, and the rest of the section belongs to the footage.
     Past DRIFT_END the drift is clamped at 1, which parks the copy above
     the frame — off screen and faded out, so nothing is left hanging. */
  var DRIFT_START = 0.04;
  var DRIFT_END = 0.30;

  /* THE POINTS. They begin as the tagline is halfway through its own exit,
     so the display block is already climbing out of the middle of the frame
     when the first group fades up under it. PTS_START is therefore set
     against the drift window above, not independently: at 0.5 of the way
     between DRIFT_START and DRIFT_END the copy is mid-flight.

     From there the three groups divide the rest of the section between
     them, each fading up, holding while the reel plays behind it, and
     fading out as the next takes over. */
  var PTS_START = 0.5;   /* fraction of the DRIFT window - the halfway point */
  var PTS_END = 0.66;    /* The whole sequence is DONE by two thirds of the
                            pinned travel. At 0.94 the points ran almost to
                            the section's end, so each pair crept and the
                            last one was still arriving as the band was
                            about to release. Finishing here packs the same
                            nine points into a shorter window - so they move
                            visibly faster per scroll - and leaves the final
                            stretch of the reel to play out on its own, the
                            camera rising through the cloud layer with the
                            frame already clear. */

  /* Hull tracking. The points sit just outside the ship, and the ship
     narrows as the drone climbs, so the anchor cannot be a constant - see
     the note on .why-pt in the stylesheet.

     The hull is measured off the painted canvas: decks are WARM (red
     channel clearly above blue), while the wake either side is bright but
     neutral, so the two separate cleanly on that test alone. Sampling one
     row at the vertical middle of the stage is enough - the hull runs
     vertically up the frame, so its half-width barely varies row to row,
     and one row costs a fraction of a millisecond.

     Only re-measured when the painted frame actually changes, which is at
     most once per scroll tick and never during the holds. */
  var HULL_WARM = 12;      /* how much redder than blue a deck pixel is */
  var HULL_MIN_LUM = 60;   /* below this it is shadow, not deck */
  var HULL_FALLBACK = 66.3;/* the widest case, used until a frame is read */
  var HULL_ROWS = 9;       /* rows sampled per frame; the widest one wins */

  /* The width the hull is measured at, in pixels, regardless of how big the
     stage actually is.

     getImageData on the live stage canvas is the single most expensive call
     in this file: it is a GPU->CPU readback, so it flushes the paint
     pipeline, and on a DPR-2 desktop stage it hands back ~2560 pixels per
     row before any JS has run. Done inside the scroll rAF that is felt
     directly as the reel snagging every time the frame index moves.

     The measurement does not need that resolution. It is looking for the
     outermost warm pixel to about half a percent of the frame, so the frame
     is blitted once into a small offscreen canvas and read back from THERE.
     At 160px a row is sixteen times cheaper to scan, the readback is off a
     canvas the compositor never touches, and the answer is the same to
     within a pixel of the stage. */
  var HULL_W = 160;

  /* How much of a point's own slot is spent fading rather than solid. The
     point is off screen at both ends of its travel anyway, so this only
     softens its arrival and exit. */
  var PTS_FADE = 0.22;

  /* How much of its neighbour's slot each pair overlaps. Raised from 0.45:
     at that value a pair had left the top before the next appeared at the
     bottom, so the pairs read as separated by a gap of empty water. At 0.9
     the next pair is already climbing into frame as the last one leaves,
     which closes the distance between them without speeding either up. */
  var PTS_OVERLAP = 1.35;
  var PTS_OVERLAP_SM = 0.15;   /* phones: see the note where it is used */

  /* Fade in and out, as fractions of the (now short) drift window. Both are
     kept small so the copy is solid for most of its run: over a window this
     brief a long fade would leave it faint for the whole crossing. */
  var FADE_IN = 0.10;
  var FADE_OUT = 0.18;

  /* THE CLOSE. The CTA that ends the section rises as the last pair of
     points is clearing the top, and then stays.

     CTA_START is expressed against PTS_END rather than as a bare number, so
     retuning the point sequence carries this with it. Slightly BEFORE
     PTS_END, not after: the two overlap for a moment, which is the same
     handoff every other beat in this section uses - the frame is never
     empty between them.

     CTA_END leaves the whole last third of the rail with the button parked
     on screen. That stretch was the reel playing out alone, and it is
     exactly the room a control needs: the reader arrives at the CTA with
     scroll still in hand, so it has to be sitting still well before the
     section releases. Past CTA_END the value is clamped at 1 - it does NOT
     drift out the way the points do. */
  var CTA_START = PTS_END - 0.06;
  var CTA_END = PTS_END + 0.08;

  function pad(n) {
    /* 1 -> "001". The encoder wrote three-digit names. */
    return (n < 10 ? '00' : n < 100 ? '0' : '') + n;
  }

  function init() {
    var section = document.querySelector('[data-why-scrub]');
    if (!section) return;

    var canvas = section.querySelector('.why-scrub__canvas');
    var stage = section.querySelector('.why-scrub__stage');
    if (!canvas || !stage) return;

    var copy = section.querySelector('.why-scrub__copy');
    var points = [].slice.call(section.querySelectorAll('.why-pt'));
    var cta = section.querySelector('[data-why-cta]');

    var reduced = window.matchMedia &&
                  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* The stylesheet ships --why-in:0 so the copy cannot flash in at rest
       before this file runs. That default is only safe while this file is
       actually going to drive it — under reduced motion nothing will, so
       hand the copy back to CSS before bailing out. */
    if (reduced) {
      if (copy) {
        copy.style.setProperty('--why-in', '1');
        copy.style.setProperty('--why-y', '0');
      }
      /* The stylesheet returns the points to normal flow under reduced
         motion; they still need their presence set or they stay at the CSS
         default of 0. */
      for (var g = 0; g < points.length; g++) {
        points[g].style.setProperty('--why-pt-o', '1');
      }
      /* Same contract as the copy above: the stylesheet's 0 default is only
         safe while this file is driving the value. */
      if (cta) cta.style.setProperty('--why-cta', '1');
      return;
    }

    /* alpha:false lets the compositor skip blending the canvas against what
       is behind it — the frames are fully opaque, so there is nothing to
       blend, and it is the one context flag here that is a pure win.

       NOT desynchronized:true. It sounds right for a scrubber — it lets the
       browser skip a compositing step — but it takes the canvas off the
       normal commit path, and on some mobile compositors the painted frame
       then never reaches the screen: the bitmap is correct, readback is
       correct, and the section renders as flat ground. Not worth the risk
       for a step this cheap. */
    var ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    var dir = window.innerWidth <= SM_MAX ? DIR_SM : DIR_LG;

    /* Decoded bitmaps, indexed 0..COUNT-1. Sparse until loading finishes. */
    var frames = new Array(COUNT);
    var loadedTo = -1;          /* every frame 0..loadedTo is decoded */
    var started = false;
    var armed = false;          /* true once frame 0 can be painted */

    /* Nearest frame the scrubber WANTS. Painted as soon as it exists; until
       then the last frame that does exist stands in, so the reel degrades to
       a lower frame rate while loading rather than going blank. */
    var wanted = 0;
    var painted = -1;

    /* ---- sizing -------------------------------------------------------
       The canvas backing store is sized to the stage in device pixels and
       the frame is drawn to COVER it, cropping the overflow — the same
       geometry as background-size:cover, done by hand because a canvas has
       no object-fit.

       DPR is capped at 2. A full-viewport canvas at DPR 3 on a phone is
       ~4x the fill rate of DPR 1.5 for no visible gain on source footage
       that is only 720px wide to begin with. */
    var cw = 0, ch = 0;

    function resize() {
      var r = stage.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(1, Math.round(r.width * dpr));
      var h = Math.max(1, Math.round(r.height * dpr));
      if (w === cw && h === ch) return false;
      cw = canvas.width = w;
      ch = canvas.height = h;
      return true;
    }

    function paint(img) {
      if (!img) return;
      var iw = img.naturalWidth || img.width;
      var ih = img.naturalHeight || img.height;
      if (!iw || !ih) return;

      /* cover: scale so the image fills both axes, then centre the overflow. */
      var scale = Math.max(cw / iw, ch / ih);
      var dw = iw * scale;
      var dh = ih * scale;
      ctx.drawImage(img, (cw - dw) * 0.5, (ch - dh) * 0.5, dw, dh);
    }

    /* Paints `wanted` if it is decoded, else the nearest earlier frame that
       is. Returns nothing; cheap enough to call every rAF. */
    function render() {
      var i = wanted;
      if (!frames[i]) {
        /* Fall back to the newest frame we actually have. */
        i = loadedTo;
        if (i < 0) return;
      }
      if (i === painted) return;
      painted = i;
      paint(frames[i]);
    }

    /* ---- loading ------------------------------------------------------
       One request at a time, in order. decode() resolves only once the
       bitmap is ready to paint, so nothing enters `frames` until it can be
       blitted without a synchronous decode on the scroll thread.

       decode() is not in every browser this site targets, and it rejects on
       some of them for images that will in fact paint fine, so the fallback
       is to accept the image on load and let the first paint pay the decode
       — degraded, not broken. */
    function loadNext() {
      var i = loadedTo + 1;
      if (i >= COUNT) return;

      var img = new Image();
      img.decoding = 'async';
      img.src = dir + 'f-' + pad(i + 1) + '.webp';

      function accept() {
        frames[i] = img;
        loadedTo = i;

        if (!armed) {
          armed = true;
          section.setAttribute('data-scrub-ready', '');
          resize();
          render();
        } else if (i === wanted || wanted > loadedTo) {
          /* The scrubber is ahead of the loader — repaint as frames land so
             the reel visibly catches up instead of freezing. */
          render();
        }

        loadNext();
      }

      function fail() {
        /* Skip the bad frame rather than stalling the whole chain; the
           renderer already tolerates gaps. */
        loadedTo = i;
        loadNext();
      }

      if (img.decode) {
        img.decode().then(accept, function () {
          /* decode() rejected — it may still be a perfectly good image. */
          if (img.complete && img.naturalWidth) accept();
          else { img.onload = accept; img.onerror = fail; }
        });
      } else {
        img.onload = accept;
        img.onerror = fail;
      }
    }

    function startLoading() {
      if (started) return;
      started = true;
      loadNext();
    }

    /* ---- hull tracking --------------------------------------------------
       Reads the painted frame and reports the hull's half-width as a
       percentage of the stage, so the points can sit just outside it. */
    var lastHullFrame = -1;
    var lastHullPct = -1;

    /* The small offscreen the frame is sampled from. Created once, never
       attached to the document, and never composited - so reading it back
       costs nothing but the copy. */
    var hullCv = document.createElement('canvas');
    var hullCtx = hullCv.getContext('2d', { alpha: false, willReadFrequently: true });

    function measureHull() {
      if (!hullCtx || painted < 0 || painted === lastHullFrame) return;
      var img = frames[painted];
      if (!img) return;
      lastHullFrame = painted;

      var iw = img.naturalWidth || img.width;
      var ih = img.naturalHeight || img.height;
      if (!iw || !ih || !cw || !ch) return;

      /* Sample the SOURCE bitmap through the same cover geometry the stage
         uses, so the measurement describes the hull exactly as the reader
         sees it - just at a sixteenth of the width. Drawing from the decoded
         frame rather than from the stage canvas also keeps this off the
         live canvas entirely: no readback from a surface the compositor is
         using, which is what made this call stall the scroll. */
      var hw = HULL_W;
      var hh = Math.max(1, Math.round(hw * (ch / cw)));
      if (hullCv.width !== hw || hullCv.height !== hh) {
        hullCv.width = hw;
        hullCv.height = hh;
      }

      var scale = Math.max(hw / iw, hh / ih);
      var dw = iw * scale;
      var dh = ih * scale;
      hullCtx.drawImage(img, (hw - dw) * 0.5, (hh - dh) * 0.5, dw, dh);

      var half = hw / 2;
      var widest = 0;
      var data;
      try {
        /* ONE readback for the whole strip instead of one per row: the call
           overhead dominates at this size, so nine separate reads cost far
           more than a single band read and nine offsets into it. */
        var y0 = Math.round(hh * 0.12);
        var y1 = Math.round(hh * 0.88);
        var bandH = Math.max(1, y1 - y0);
        data = hullCtx.getImageData(0, y0, hw, bandH).data;
      } catch (e) {
        return;                 /* tainted or zero-sized: keep the fallback */
      }

      /* SUB-PIXEL, and that matters more than it looks. `widest` is an
         index into a 160px-wide canvas, so a whole-pixel answer can only
         land on multiples of 100/160 = 0.625% of the stage - about 10px on
         a wide one. The measurement then re-quantises every frame and can
         sit flipping between two adjacent buckets, which feeds the anchor a
         square wave for the ease downstream to chew on. That is the other
         half of the settling shake: not the easing, the INPUT to it.

         So the edge is refined against the test that found it. `soft` is
         how far into the outermost warm pixel the boundary actually falls,
         estimated from how strongly its neighbour just outside fails the
         warmth test - a partly-warm pixel at the hull's edge sits partway
         between, and interpolating recovers that fraction. The answer moves
         continuously as the ship narrows instead of in 10px stairs. */
      for (var ri = 0; ri < HULL_ROWS; ri++) {
        var row = Math.round((bandH - 1) * (ri / (HULL_ROWS - 1)));
        var base = row * hw * 4;
        for (var x = 0; x < hw; x++) {
          var i4 = base + x * 4;
          var r = data[i4], g = data[i4 + 1], b = data[i4 + 2];
          if (r - b > HULL_WARM && (r + g + b) / 3 > HULL_MIN_LUM) {
            var d = Math.abs(x - half);
            if (d > widest) {
              /* The pixel one step further OUT from the centre - the first
                 one that failed - and how far short of the threshold it
                 fell. Clamped into 0..1 so a noisy neighbour can never push
                 the edge more than one pixel either way. */
              var xo = x < half ? x - 1 : x + 1;
              var soft = 0;
              if (xo >= 0 && xo < hw) {
                var o4 = base + xo * 4;
                var ow = data[o4] - data[o4 + 2];
                /* How much of the way from the outside pixel's warmth up to
                   the threshold this edge sits. */
                var span = (r - b) - ow;
                if (span > 0) {
                  soft = (HULL_WARM - ow) / span;
                  if (soft < 0) soft = 0;
                  if (soft > 1) soft = 1;
                }
              }
              widest = d + soft;
            }
          }
        }
      }
      if (widest <= 0) return;

      /* Half-width as a percentage of the full stage width. */
      var pct = (widest / hw) * 100 + 50;
      if (pct < 45) pct = 45;              /* never hug the centreline */
      if (pct > HULL_FALLBACK) pct = HULL_FALLBACK;

      /* The anchor is fed through the same easing the travel uses rather
         than being written raw. Measured frame to frame the hull edge jitters
         by a few tenths of a percent - foam, a mast, a crop edge catching the
         warm test - and written straight to CSS that jitter shows up as the
         points twitching sideways while they rise. Easing toward the reading
         absorbs it, and the hull's real change across the reel is slow
         enough that trailing it by a few frames is invisible. */
      hullTarget = pct;
      if (lastHullPct < 0) { hullPos = pct; commitHull(pct); }
    }

    /* The eased anchor. Written as --why-hull-d, the signed DISTANCE from
       the fallback, which the stylesheet folds into each point's transform.

       It used to write --why-hull, the absolute percentage, into
       `left`/`right`. That made every write a layout pass, which is why it
       was rationed behind a 0.06% threshold - and that rationing is what
       shook. A thresholded value does not move smoothly, it STAIRCASES: it
       holds still for several frames, then jumps the whole accumulated
       drift at once, up to ~10px on a wide stage. While a point is climbing
       fast that is lost in the travel; the moment it settles, the vertical
       motion nearly stops and the lateral staircase is the only thing left
       moving, so it reads as a shake at exactly the wrong moment.

       As a transform term there is no layout and therefore no reason to
       ration it, so it is written every frame it changes at all - the ease
       below is free to be continuous, and the anchor now glides. */
    var hullTarget = HULL_FALLBACK;
    var hullPos = HULL_FALLBACK;

    function commitHull(pct) {
      lastHullPct = pct;
      section.style.setProperty('--why-hull-d', (pct - HULL_FALLBACK).toFixed(3));
    }

    /* ---- the entry curve ------------------------------------------------
       How far a point is pushed sideways, away from the hull, as a 0..1
       magnitude: 0 at its resting line, 1 at either end of its travel.

       WHY THIS IS COMPUTED HERE AND NOT IN calc()

       It used to be a var() chain in the stylesheet built from even powers
       of the distance - d^2, then d^4, then a blend of the two. Every one of
       those is a POLYNOMIAL, and that is the whole problem: a polynomial
       that is flat at the resting line gets steeper all the way out, so the
       point is still accelerating sideways at the instant it leaves the
       frame. Measured on the blend, the slope ran 0 -> 3.0 and the
       acceleration 1 -> 7 across the approach. That is what reads as the
       harsh, snatched finish - the motion never eases off, it just stops.

       A raised cosine is flat at BOTH ends. Its slope starts at zero,
       peaks gently in the middle of the approach and returns to zero at the
       extreme, so the point drifts out of its resting line, crosses at an
       even rate, and settles into the edge instead of being flung at it.
       Peak slope is 1.57 against 3.0, and the acceleration never changes
       sign - which is the difference between a curve that flows and one
       that lunges and checks itself.

       Smoothstep was the other candidate and is worse here: it is flat at
       both ends too, but it reverses its acceleration hard in the last
       third (+5 to -24), and that reversal is felt as a distinct hitch just
       before the point exits.

       It is done in JS because CSS cos() is from the same values-4 set as
       the sqrt() and pow() this file already avoids for baseline reasons,
       whereas Math.cos is available everywhere. It also collapses the whole
       calc() chain into one number, so the stylesheet does less work per
       frame, not more. */
    function bow(u) {
      /* Distance either side of the resting line, 0..1. */
      var d = (u - 0.5) * 2;
      if (d < 0) d = -d;
      if (d > 1) d = 1;
      return 0.5 - 0.5 * Math.cos(Math.PI * d);
    }

    /* The tilt, -1..+1, signed: negative below the resting line, positive
       above. The stylesheet turns it into a couple of degrees of rotation.

       Eased for the same reason the bow is. Raw distance is LINEAR, so the
       tilt turns at a constant rate the whole way past - it is still
       rotating at full speed as the point exits the frame, and it sweeps
       through the resting line without ever settling at it. A quarter-sine
       has zero rate of change at both extremes, so the block eases into its
       maximum lean, holds it as it leaves, and passes through level in the
       middle instead of pivoting hardest exactly where it should look
       composed. */
    function tilt(u) {
      var d = (u - 0.5) * 2;
      if (d < -1) d = -1;
      if (d > 1) d = 1;
      /* A HALF-cosine of the signed distance, not a quarter-sine of it.

         The quarter-sine is flat at the two extremes but at its STEEPEST
         exactly at d = 0 - the resting line. So the one moment the block is
         meant to look composed and level was the moment it was rotating
         fastest, and the lean it had built up on the way in was wiped off
         in a single beat. That snap through level is the "harsh flattening"
         - the rotation arriving at zero at full speed rather than easing
         into it.

         sign(d) * (1 - cos(pi*|d|)) / 2 is flat at BOTH extremes AND at
         zero: the block eases out of its incoming lean, crosses level with
         almost no angular velocity, and eases into the outgoing one. Peak
         rate is in the quarter of the travel either side of the middle,
         where the point is moving anyway and the turn is not read as a
         separate event. */
      var a = d < 0 ? -d : d;
      var e = 0.5 - 0.5 * Math.cos(Math.PI * a);
      return d < 0 ? -e : e;
    }

    /* ---- the vertical travel ---------------------------------------------
       The rise used to be raw progress: the stylesheet multiplied (0.5 - u)
       by the travel height and that was the whole of it. Linear is right for
       the TAGLINE, which has no resting state - it drifts through and out.
       A point does have one. The copy sits beside the ship for a beat, and
       at a constant rate it never actually sits: it sweeps through its
       resting line at the speed it entered at, which reads as the block
       being carried past rather than set down.

       So the position is warped - never the timeline's endpoints. This is a
       monotonic reparametrisation, so the choreography is unchanged: the
       sequence still starts where it started and ends where PTS_END says.
       What changes is the DISTRIBUTION of rate through the run.

       WHY THIS WARPS THE SHARED RUN AND NOT EACH POINT'S OWN SLOT

       The obvious version of this applies the easing to `u`, each point's
       own 0..1 progress through its slot. That settles a point beautifully
       and quietly WRECKS THE SPACING between them, which is why it is not
       what this does.

       The gap you see between two pairs is the difference of their
       POSITIONS. Warp each point against its own slot and the two pairs on
       screen at any moment are at different places in that warp - one is
       near its resting line and slowed, the other is out at an end and sped
       up - so the warp does not cancel out of their difference. Measured on
       the four-pair layout, a linear rise holds the gap at a constant 0.4255
       of the travel; the per-slot warp made it breathe between 0.209 and
       0.476 and pulled the mean down to 0.309. The pairs bunched up, worst
       at exactly the moment one was settling and being read.

       Warping the SHARED run position fixes it for free. Every point on
       screen reads the same clock, so the warp shifts them all together and
       drops straight out of the difference between them: the separation
       stays pinned at 0.4255, exactly as the linear version had it, while
       the rate still varies. Same settle, no bunching.

       The period is one pair-to-pair beat (see the note at the call site for
       the rounding that keeps a whole number of them across the run), so
       every pair gets an identical rate profile and they all settle in the
       same place in their travel. Built as pr plus a sine bump, which is
       zero at both ends of the run, so the sequence still starts and ends
       exactly where it did and only the rate between changes. The
       derivative is 1 + DWELL*cos(...), which is DWELL
       below linear at the resting line, DWELL above it at the hand-overs,
       and never negative for DWELL < 1 - so the run can never stall or back
       up, whatever the depth is.

       At 0.4 the block crosses its resting line at 0.6x the linear rate and
       covers the hand-overs at 1.4x. Deeper than this is available but not
       wanted: the rate at rest is 1 - DWELL, so approaching 1 approaches a
       dead stop, and a parked block of copy reads as a caption stuck on the
       footage rather than something drifting past. */
    var PT_DWELL = 0.4;

    /* The fade, 0..1. Was two straight ramps, which put a CORNER in the
       opacity at each end of the fade window - the point brightened at a
       constant rate and then stopped brightening in one frame. Smoothstep
       over the same window rounds both corners off, so the arrival reads as
       the block coming up out of the water rather than a light switching on
       part-way through its climb. */
    function fadeOf(u) {
      var f;
      if (u <= 0 || u >= 1) return 0;
      if (u < PTS_FADE) f = u / PTS_FADE;
      else if (u > 1 - PTS_FADE) f = (1 - u) / PTS_FADE;
      else return 1;
      return f * f * (3 - 2 * f);
    }

    /* ---- scrub ---------------------------------------------------------
       THE LOOP, AND WHY IT IS NOT A SCROLL HANDLER ANY MORE

       This used to compute everything straight from the scroll position
       inside a rAF fired by the 'scroll' event. That is the obvious way to
       build a scrubber and it is why the points read as steppy: the copy
       and the points were slaved rigidly to a value that only changes when
       an event lands. A wheel notch is a jump, so the blocks jumped with
       it; between notches nothing moved at all. Two frames of a big step,
       then eight frames of stillness, is exactly the "stuck then lurch"
       feel - and no amount of easing INSIDE that step fixes it, because the
       step is the whole travel.

       So the raw scroll position is now a TARGET, and a position eases
       toward it every frame on a continuous rAF. Scroll far in one notch
       and the blocks sweep the distance over the following frames instead
       of teleporting; stop scrolling and they glide the last of it and
       settle. That is the flowing quality - it comes from decoupling what
       is drawn from what the wheel just did.

       The smoothing is frame-rate independent (the exponential below is
       solved against elapsed time, not applied per frame), so it feels the
       same at 60Hz and 144Hz rather than being twice as slack on a fast
       display.

       The loop parks itself when the position has caught up with the target
       and nothing is on screen to move, and any scroll event wakes it. So
       an idle page is not burning a rAF for a section nobody is looking
       at. */

    /* THE FOLLOW, AND WHY IT IS A SPRING RATHER THAN AN EXPONENTIAL

       This was `tPos += gap * (1 - e^(-dt/tau))`. That is frame-rate
       independent and it does turn a wheel notch into a sweep, but it has
       one flaw you can feel: its VELOCITY is discontinuous. The speed it
       moves at is proportional to the gap, so the instant a scroll event
       lands and the gap jumps from nothing to something, the drawn position
       goes from stationary to its fastest IN ONE FRAME, then decays from
       there. Every burst of scrolling therefore starts with an instant of
       infinite acceleration - a flick. Stack a few wheel notches, which is
       what ordinary scrolling is, and those flicks land on top of a decaying
       tail: the result is a position whose speed keeps jumping, which is
       exactly the jagged, snatched quality left in the motion.

       A critically-damped spring fixes it by keeping VELOCITY as state.
       Acceleration is what the gap sets, not speed, so a new target can no
       longer move the drawn position discontinuously - it can only start
       bending the velocity it already had. Motion eases INTO a burst and
       out of the end of one, and consecutive notches blend into a single
       continuous sweep instead of a sequence of kicks.

       Critically damped (damping ratio exactly 1) is the specific choice:
       it is the fastest approach that CANNOT overshoot. Under-damping would
       let the copy sail past its resting line and swing back, which on a
       block of text reads as a wobble; over-damping would just be slack.

       Integrated semi-implicitly, which is unconditionally stable for this
       system - the naive explicit form blows up when dt*omega gets large,
       and dt spikes whenever the main thread is busy, which is precisely
       when a blow-up would be seen. */
    /* Angular frequency of the follow. The 1/e time of a critically damped
       spring is about 1/omega, so this is the direct analogue of the old
       tau: 1/0.085 ~ 11.8. Tuned a little slower because the spring's
       eased onset already makes it feel more responsive than the
       exponential did at the same nominal speed. */
    var EASE_W = 11.0;

    /* Same idea for the hull anchor, but much slower: it drives layout, and
       it is absorbing measurement jitter rather than input steps. */
    var HULL_TAU = 0.28;

    /* Below this the eased position is treated as having arrived, so the
       loop can park instead of chasing an ever-smaller remainder forever.
       Both must hold: near the target AND barely moving. */
    var SETTLE = 0.00002;
    var SETTLE_V = 0.0004;   /* units of t per second */

    /* How long the reel must hold still before a point will accept the
       cursor. Long enough that it cannot arm in the lull between two
       flicks of a trackpad or in the tail of a momentum scroll, short
       enough that a reader who has genuinely stopped to read does not
       notice waiting for it. */
    var STILL_MS = 260;

    var tTarget = 0;            /* where the scroll says we are */
    var tPos = 0;               /* where we are actually drawing */
    var tVel = 0;               /* and how fast it is currently moving */
    var seeded = false;         /* first frame snaps rather than eases in */
    var running = false;
    var lastT = 0;
    var lastD = -1;
    var lastCta = -1;
    var ctaOn = false;
    var wasLifting = false;
    var lastPts = [];
    /* Whether each point currently carries the layer-promotion hint. */
    var ptOn = [];
    /* Whether each point is inside its hover window (cursor-catching, card
       openable), and which way its card is currently set to open. */
    var ptRest = [];
    var ptFlip = [];
    /* THE STILL GATE. A card may only open while the reel has actually
       STOPPED - not merely while a point happens to be near its resting
       line. Two things make that strict rather than approximate.

       First, `settled` below goes true the instant the eased position
       catches its target, which happens between two flicks of a trackpad
       or in the lull of a momentum scroll that is still running. Opening a
       card in that gap puts a panel under the cursor a tenth of a second
       before the footage moves again, and it is gone before it can be read.
       So stillness has to be a DWELL: the position must have held for
       STILL_MS without changing.

       Second, the flag lives on the SECTION, not on a point. The card is
       shown by a CSS rule that requires both - the section still and the
       point at rest - so a scroll starting anywhere closes every open card
       on the same frame, without the script touching nine elements. */
    var stillTimer = 0;
    var isStill = false;
    /* Which pair each point belongs to, read off the markup so the pairing
       is authored in HTML rather than inferred from index order here. */
    var pairOf = [];
    var pairCount = 0;
    for (var pi = 0; pi < points.length; pi++) {
      var pn = parseInt(points[pi].getAttribute('data-why-pair'), 10) || 0;
      pairOf.push(pn);
      if (pn + 1 > pairCount) pairCount = pn + 1;
      lastPts.push(-1);
      ptOn.push(false);
    }
    if (pairCount < 1) pairCount = 1;

    /* Reads the scroll position and returns the raw 0..1 through the rail,
       or -1 if the section is not measurable yet. Nothing is drawn here -
       this only sets the target the loop eases toward. */
    function readTarget() {
      var rect = section.getBoundingClientRect();

      /* Begin fetching while the section is still a couple of viewports out,
         so the reel is armed — ideally fully loaded — by the time it pins. */
      if (!started && rect.top < window.innerHeight * (1 + PRELOAD_MARGIN)) {
        startLoading();
      }

      var travel = rect.height - window.innerHeight;
      if (travel <= 0) return -1;

      /* rect.top runs 0 -> -travel while the stage is pinned. */
      var t = -rect.top / travel;
      if (t < 0) t = 0;
      if (t > 1) t = 1;
      return t;
    }

    /* Draws one frame at the eased position `t`. */
    function apply(t) {

      /* --- the tagline drift --------------------------------------------
         Keyed to t, the PINNED travel — not to the section entering the
         viewport. That is what keeps the frame empty on arrival: while the
         section is still coming up the screen t is 0, the drift is 0, and
         the copy sits DRIFT_FROM below the centre line, off screen. It only
         begins to climb once the reader scrolls past DRIFT_START into the
         pinned section, and from there it moves continuously — so it is
         still travelling while the reel plays and stops the moment the
         reader stops. */
      if (copy) {
        var d = (t - DRIFT_START) / (DRIFT_END - DRIFT_START);
        if (d < 0) d = 0;
        if (d > 1) d = 1;

        /* Linear, deliberately: an eased drift would slow to a near-stop in
           the middle and read as the parked headline this is meant not to
           be. Constant travel per pixel scrolled is the whole effect. */
        var y = DRIFT_FROM + (DRIFT_TO - DRIFT_FROM) * d;

        /* Fade only at the two ends. */
        var o = 1;
        if (d < FADE_IN) o = d / FADE_IN;
        else if (d > 1 - FADE_OUT) o = (1 - d) / FADE_OUT;
        if (o < 0) o = 0;
        if (o > 1) o = 1;

        /* Written every frame it has actually changed at all, with no
           minimum step. The old guard skipped writes below 0.0008 of the
           window - about a pixel and a half of travel - which was intended
           as a saving but is what put a visible staircase on a slow drift:
           the copy would hold still for several frames and then hop. Now
           that the position is eased rather than snapped, the value moves a
           little every frame by design, and quantising it here would throw
           away precisely the smoothness the ease exists to create. */
        if (d !== lastD) {
          /* Promote the copy onto its own layer ONLY while it is on screen
             and moving. Left standing, that layer is re-composited against
             the canvas for the whole rail and costs more than it saves —
             see the note on .why-scrub__copy in the stylesheet. */
          var lifting = o > 0;
          if (lifting !== wasLifting) {
            wasLifting = lifting;
            if (lifting) section.setAttribute('data-why-lifting', '');
            else section.removeAttribute('data-why-lifting');
          }
          lastD = d;
          copy.style.setProperty('--why-y', y.toFixed(4));
          copy.style.setProperty('--why-in', o.toFixed(3));
        }
      }

      /* --- the points ---------------------------------------------------
         A slot per PAIR, not per point: both halves of a pair read the same
         value, so the left and right arrive together on the same beat and
         travel in lockstep. Slots overlap their neighbour so one pair is
         always arriving as the last leaves.

         The value is the POSITION of the pair's upward travel; CSS turns it
         into the rise and the entry curve. A separate fade keeps them from
         being cut off at either edge. Because it is all a function of t,
         they move only while the reader moves.

         PTS_START is expressed against the DRIFT window, so the first pair
         is tied to the tagline being halfway out rather than to a fixed
         offset - retune the tagline and this follows it. */
      if (points.length) {
        /* Keep the anchor in step with the frame under the copy. */
        measureHull();

        var ps = DRIFT_START + (DRIFT_END - DRIFT_START) * PTS_START;
        var pr = (t - ps) / (PTS_END - ps);
        if (pr < 0) pr = 0;
        if (pr > 1) pr = 1;

        /* The LAST pair must finish at PTS_END, not overrun it. A slot is
           longer than a step (that is what the overlap is), so laying
           `pairCount` steps end to end leaves the final slot hanging past
           the window by the difference. Dividing the run by that total
           instead pulls every slot back inside it - so the sequence really
           does end where PTS_END says, and the tail of the reel is clear. */
        /* The overlap has to shrink on a phone. There, a pair stacks
           vertically instead of flanking the ship, so one pair already
           claims most of the viewport height - two overlapping pairs
           collide. Wide screens put the pair side by side, where a
           generous overlap costs nothing. */
        var overlap = window.innerWidth <= 860 ? PTS_OVERLAP_SM : PTS_OVERLAP;
        var slotUnits = pairCount + overlap;
        var step = 1 / slotUnits;
        var slot = step * (1 + overlap);

        /* THE SETTLE. Warp the shared run position, once, before any point
           reads it - see the long note on PT_DWELL above for why it has to
           happen here and not inside the loop.

           The period count is `slotUnits` ROUNDED - one sine period per step,
           near enough - so each pair gets the same rate profile and settles
           at the same place in its travel.

           Rounded, and not the raw value, because the count has to be a
           WHOLE number of periods across the run. slotUnits is
           pairCount + overlap = 5.35 on desktop, and at a fractional count
           the sine does not close: it leaves a residue at pr = 1 that
           carried the run 1% past its end, pushing the last pair beyond
           PTS_END and into the CTA's window. At a whole count the bump is
           zero at both ends of the run and the sequence finishes exactly
           where PTS_END says it does. */

        /* Because every point below reads this one warped value, the warp
           shifts them together and cancels out of the gaps between them -
           the spacing stays exactly what the linear version produced. */
        var wn = 2 * Math.PI * Math.max(1, Math.round(slotUnits));
        var prw = pr + PT_DWELL * Math.sin(wn * pr) / wn;

        for (var qi = 0; qi < points.length; qi++) {
          var u = (prw - pairOf[qi] * step) / slot;

          var po = fadeOf(u);

          /* Clamped: past its slot a point stays parked off screen
             rather than continuing to travel forever. */
          var uc = u < 0 ? 0 : (u > 1 ? 1 : u);

          /* No minimum step, and for this one it matters more than it does
             for the tagline. The position drives the bow and the tilt as
             well as the rise, so a step in u that is invisible vertically
             still shows up as a sideways or rotational jerk - and it shows
             up worst at the hand-overs, where the warped run is moving at
             its fastest and the next pair is arriving, which is the moment
             the reader is watching it. The old 0.002 gate is what made the
             curve read as a series of small corners instead of an arc.

             Skip only when the point is genuinely parked: off screen at
             either end of its slot with nothing to show. */
          /* The layer hint is set BEFORE the point becomes visible and
             dropped only once it is fully gone, rather than being toggled
             on the same frame the motion starts. Promoting an element to
             its own layer while it is already moving costs a paint on that
             frame, which lands as a hitch at exactly the moment the point
             arrives. Keyed to the unclamped `u` with a margin either side,
             so the promotion leads the motion instead of coinciding with
             it, and tracked in its own array rather than being inferred
             from the last written position - which is clamped, and so
             cannot tell "just below its slot" from "parked at 0". */
          var near = u > -0.2 && u < 1.2;
          if (near !== ptOn[qi]) {
            ptOn[qi] = near;
            if (near) points[qi].setAttribute('data-why-on', '');
            else points[qi].removeAttribute('data-why-on');
          }

          /* THE HOVER WINDOW. Each point carries a card that opens on
             hover, and the stylesheet restores pointer-events for exactly
             as long as data-why-rest is set. That window is deliberately
             narrower than the point's visible slot: a block still climbing
             through the frame is not something to aim at, and - more to the
             point - an element that catches the cursor mid-travel steals
             the scroll gesture that is driving the reel. So the cursor is
             handed the point only across the middle of its run, where it is
             sitting near its resting line and fully opaque, and taken back
             the moment it starts leaving.

             u runs 0 (below the fold) -> 1 (gone off the top), with 0.5
             level with the middle of the stage. */
          var rest = u > 0.3 && u < 0.72;
          if (rest !== ptRest[qi]) {
            ptRest[qi] = rest;
            if (rest) points[qi].setAttribute('data-why-rest', '');
            else {
              points[qi].removeAttribute('data-why-rest');
              /* A point that leaves while focused would keep its card open
                 through :focus-within, parked off screen and still in the
                 tab order's way. Hand focus back to the page. */
              if (points[qi] === document.activeElement) points[qi].blur();
            }
          }

          /* WHICH WAY THE CARD OPENS. It hangs below the point by default,
             but a point sitting low in the frame has no room down there -
             the card would run off the bottom of the stage and the reader
             would be hovering something they cannot finish reading. Those
             open upward instead.

             MEASURED, not assumed. The obvious version of this rule is a
             constant - flip above the halfway mark - but where a point
             actually sits depends on the viewport: the travel is 125svh,
             so the same u puts a point in very different places on a tall
             desktop and a short laptop, and the card's own height varies
             with how long that point's copy is. A fixed threshold is
             therefore wrong on most screens in one direction or the other.

             So the space is computed. The point's own top is the stage's
             mid-line plus its current travel offset - the same arithmetic
             the transform in the stylesheet does - and its card needs its
             height plus the gap below that. No getBoundingClientRect: this
             runs per point per frame, and the two heights it needs are
             cached off a resize instead of read live. */
          var ptTop = stageMid + (0.5 - uc) * travelPx;
          var flip = ptTop + ptH[qi] + cardH[qi] + CARD_GAP > stageBottom;
          if (flip !== ptFlip[qi]) {
            ptFlip[qi] = flip;
            if (flip) points[qi].setAttribute('data-why-flip', '');
            else points[qi].removeAttribute('data-why-flip');
          }

          if (uc !== lastPts[qi]) {
            lastPts[qi] = uc;
            var el = points[qi];
            el.style.setProperty('--why-pt', uc.toFixed(5));
            el.style.setProperty('--why-pt-o', po.toFixed(3));
            el.style.setProperty('--why-bow', bow(uc).toFixed(5));
            el.style.setProperty('--why-tilt', tilt(uc).toFixed(5));
          }
        }
      }

      /* --- the close ----------------------------------------------------
         One value, one write, and it only ever goes up. The points needed a
         slot each and a fade at both ends because they pass through; this
         rises once and holds, so the whole of it is a clamped ramp. */
      if (cta) {
        var c = (t - CTA_START) / (CTA_END - CTA_START);
        if (c < 0) c = 0;
        if (c > 1) c = 1;

        if (c !== lastCta) {
          /* Promoted only while it is moving. Parked at 1 it is static over
             a canvas that is still being repainted for the rest of the
             rail, and a layer there would be re-composited the whole way -
             the same reason the tagline's and the points' hints are scoped. */
          var ctaMoving = c > 0 && c < 1;
          if (ctaMoving !== ctaOn) {
            ctaOn = ctaMoving;
            if (ctaMoving) cta.setAttribute('data-why-cta-on', '');
            else cta.removeAttribute('data-why-cta-on');
          }
          lastCta = c;
          cta.style.setProperty('--why-cta', c.toFixed(4));
        }
      }

      /* Remap so the reel holds on frame 0 for HOLD, runs across the middle,
         and holds on the last frame for TAIL. */
      var span = 1 - HOLD - TAIL;
      var p = span > 0 ? (t - HOLD) / span : t;
      if (p < 0) p = 0;
      if (p > 1) p = 1;

      var next = Math.round(p * (COUNT - 1));
      if (next !== wanted) {
        wanted = next;
        if (armed) render();
      }
    }

    /* ---- card geometry -------------------------------------------------
       What the flip decision needs, measured once per resize rather than
       per point per frame. Each of these IS a layout read, which is exactly
       why they are not done in the loop: nine points x sixty frames a
       second of getBoundingClientRect would cost more than the reel does.

       Cards are measured while forced open and off-screen-safe: the card is
       visibility:hidden at rest, and a hidden element still has a layout
       box, so offsetHeight reports its real height without it ever being
       shown. */
    var CARD_GAP = 14;          /* the card's own margin, plus a little air */
    var stageMid = 0;           /* the stage's centre line, in viewport px */
    var stageBottom = 0;
    var travelPx = 0;           /* the 125svh the points travel over */
    var ptH = [];
    var cardH = [];

    function measureCards() {
      var r = stage.getBoundingClientRect();
      /* The stage is one viewport tall and pinned, so its own box IS the
         frame the card has to fit inside. Taken relative to the stage
         rather than the document: the points are positioned against it. */
      stageMid = r.height * 0.5;
      stageBottom = r.height;
      /* Matches the 125svh in the stylesheet's transform. svh, not vh:
         on a phone the two differ by the browser chrome, and the points
         are laid out in the former. */
      travelPx = r.height * 1.25;
      for (var mi = 0; mi < points.length; mi++) {
        ptH[mi] = points[mi].offsetHeight;
        var card = points[mi].querySelector('.why-pt__more');
        cardH[mi] = card ? card.offsetHeight : 0;
      }
    }

    /* Arm the hover gate once the reel has held still long enough to count
       as paused, and disarm it the moment anything moves again. Disarming
       is immediate and unconditional: a card must never survive into a
       scroll, and blurring the focused point closes one that was opened by
       keyboard or tap as well. */
    function setStill(v) {
      if (v === isStill) return;
      isStill = v;
      if (v) {
        section.setAttribute('data-why-still', '');
      } else {
        section.removeAttribute('data-why-still');
        if (section.contains(document.activeElement) &&
            document.activeElement.classList &&
            document.activeElement.classList.contains('why-pt')) {
          document.activeElement.blur();
        }
      }
    }

    function stillPending() {
      if (stillTimer) window.clearTimeout(stillTimer);
      stillTimer = window.setTimeout(function () {
        stillTimer = 0;
        setStill(true);
      }, STILL_MS);
    }

    function stillBreak() {
      if (stillTimer) { window.clearTimeout(stillTimer); stillTimer = 0; }
      setStill(false);
    }

    /* ---- the loop ------------------------------------------------------
       One rAF, running only while there is something to move. */
    function tick(now) {
      running = true;

      var dt = lastT ? (now - lastT) / 1000 : 0;
      lastT = now;
      /* A tab that was backgrounded, or a long main-thread block, hands back
         a huge dt. Clamped, or the eased position jumps the whole gap in one
         frame and the smoothing it exists to provide is skipped exactly when
         the reader would notice it most. */
      if (dt > 0.05) dt = 0.05;

      var raw = readTarget();
      if (raw >= 0) {
        tTarget = raw;
        if (!seeded) { seeded = true; tPos = raw; tVel = 0; }
      }

      /* Critically-damped spring, semi-implicit: the velocity is updated
         from the CURRENT gap first, then the position from the new
         velocity. Doing it in that order is what makes it stable at large
         dt rather than exploding.

         a = -w^2 * x - 2w * v, for x = the remaining gap (negated below,
         since `gap` is measured toward the target rather than away). */
      var gap = tTarget - tPos;
      if (dt > 0) {
        var w = EASE_W;
        tVel += (w * w * gap - 2 * w * tVel) * dt;
        tPos += tVel * dt;
      } else {
        tPos = tTarget;
        tVel = 0;
      }

      /* Arrived only when the gap has closed AND the spring has run out of
         speed. Testing the gap alone would cut the motion off while it was
         still travelling through the target at its fastest - a hard stop in
         place of the glide the spring exists to produce. */
      if (Math.abs(tTarget - tPos) < SETTLE && Math.abs(tVel) < SETTLE_V) {
        tPos = tTarget;
        tVel = 0;
      }

      apply(tPos);

      /* The hull anchor rides its own, slower ease toward whatever the last
         measurement said. Committed only on a real move: it drives left /
         right, so a write here is a layout pass. */
      var hk = dt > 0 ? 1 - Math.exp(-dt / HULL_TAU) : 1;
      hullPos += (hullTarget - hullPos) * hk;
      /* Committed on any real change now that it is a compositor property.
         The guard is only against writing a value that would round to the
         same string - it is a no-op filter, not the coarse motion-rationing
         threshold it replaced. */
      if (Math.abs(hullPos - lastHullPct) >= 0.0005) commitHull(hullPos);

      /* Park when the position has caught up AND nothing is mid-travel, so
         an idle page costs nothing. A scroll event restarts it. */
      var settled = tPos === tTarget && tVel === 0 &&
                    Math.abs(hullTarget - hullPos) < 0.0005;
      if (settled) {
        running = false;
        lastT = 0;
        /* Caught up - start counting the dwell. If the reader is only
           between flicks, the next scroll event cancels it before it
           fires and no card ever opens. */
        stillPending();
        return;
      }
      window.requestAnimationFrame(tick);
    }

    function wake() {
      if (running) return;
      running = true;
      lastT = 0;
      window.requestAnimationFrame(tick);
    }

    /* Bound to scroll directly rather than folded into wake(): wake() is a
       no-op while the loop is already running, and a scroll DURING a run is
       exactly when the gate most needs to be shut. */
    window.addEventListener('scroll', function () {
      stillBreak();
      wake();
    }, { passive: true });
    window.addEventListener('resize', function () {
      /* A resize changes the backing store, which clears it — force a
         repaint of whatever frame is current. */
      if (resize()) { painted = -1; lastHullFrame = -1; render(); }
      /* Unconditional, unlike the canvas resize above: the stage can change
         height (and the cards can re-wrap to a different height) on a width
         change that leaves the backing store the same size. */
      measureCards();
      wake();
    }, { passive: true });

    resize();
    measureCards();
    /* The cards' heights depend on the webfont: measured against the
       fallback they come out short, and a point near the bottom would then
       be told it has room it does not have. Re-measured once the real face
       is in. Guarded - document.fonts is absent on older browsers, and the
       first measurement is a workable approximation there. */
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(measureCards);
    }
    wake();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
