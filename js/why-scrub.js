/* ==========================================================================
   WHY US — scroll-scrubbed reel
   ==========================================================================
   The section is a tall rail with a 100svh sticky stage inside it. The stage
   holds one <canvas>; scroll position picks which of the 381 drone frames is
   painted into it. Scrolling the rail flies the camera from the ship's deck
   up through the cloud layer.

   The frames come from an all-keyframe mp4 that is never added to the DOM
   and never played — it is seeked, and each landed frame is blitted to the
   canvas. See THE SOURCE IS A VIDEO, below, for why it is encoded that way
   and what breaks if it is not.

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

   WHY A CANVAS AND NOT A VISIBLE <video>
   A <video> cannot be made to cover the stage the way these frames must
   without object-fit games, and more importantly the reader would be able to
   hit its controls and its own playback state. Painting to a canvas keeps
   the element inert and the geometry ours — the cover crop in paint() is the
   same one background-size:cover would do.

   SEEKING, NOT DECODING UP FRONT
   The image version decoded all 240 bitmaps before arming, which made every
   scrub a pure blit but cost 240 requests and ~16MB. Here the decoder does
   the work on demand: render() asks for a time, 'seeked' paints what landed.
   Only one seek is ever in flight — see render() for why assigning
   currentTime during a seek is what makes a fast scrub go still.

   LOADING
   One request, streamed, started when the section is within a couple of
   viewports. The reel arms on the first decoded frame rather than waiting
   for the whole file, so the stage fills early and the rest buffers behind
   it — which is the behaviour the 240-file version could not have.

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

  /* Frame count, and the two encodes. Same footage and same frame count;
     only the width differs. */
  var COUNT = 381;
  var SRC_LG = 'assets/why-us/scrub-1920.mp4';
  var SRC_SM = 'assets/why-us/scrub-1280.mp4';

  /* THE SOURCE IS A VIDEO, NOT 240 IMAGES.

     It used to be 240 separate .webp frames. That decoded to an array of
     bitmaps and scrubbing was a blit out of memory — ideal to paint, but it
     meant 240 HTTP requests and ~16MB before the reel could run end to end,
     and on GitHub Pages the section spent most of its time on the poster
     waiting for them. The same 8 seconds of footage as H.264 streams, so the
     browser can paint early and keep buffering.

     FRAME COUNT. The source is 24fps — 192 frames, which is 48 FEWER than
     the webp set it replaced, and over a 4500px rail that is ~23px of scroll
     per frame. Coarse enough to read as stepping when scrubbing slowly,
     which is exactly when the reader is paying attention. Both encodes are
     therefore motion-interpolated to 48fps (381 frames, ~12px of scroll
     each) before the keyframe pass. Interpolation is safe on this footage:
     it is a slow continuous pull-back with no cuts and no fast local motion,
     which is the case optical flow handles well — the wake stays clean.

     The catch, and the reason this was images in the first place, is that
     seeking a normal video is not frame-accurate. Video compresses by
     storing most frames as deltas from an earlier one, so setting
     currentTime lands the decoder on the nearest KEYFRAME and it must then
     decode forward to the target. With a keyframe every 2s a backward scrub
     re-decodes dozens of frames and the reel stutters exactly where the
     reader is being most deliberate.

     So both files are encoded with EVERY frame a keyframe (-g 1
     -keyint_min 1 -sc_threshold 0). That throws away inter-frame
     compression — which is why 5.4MB rather than ~1MB — but it buys random
     access: every currentTime lands on a frame that stands alone and needs
     no history to decode. Re-encoding from a normal 4-keyframe mp4 is not
     optional; the seek behaviour is the whole point.

     This is also why the files are not as small as a normal web video of the
     same length: every frame is an I-frame, so the usual 10x win from
     inter-frame compression is unavailable. Budget accordingly — dropping
     CRF to claw back size costs visible quality fast.

     If these files are ever regenerated, keep those flags. A plain
     `ffmpeg -i in.mp4 -vf scale=1280:-2 out.mp4` will look identical in a
     player and scrub visibly worse here. The exact commands:

       ffmpeg -i video.mp4 -an          -vf "minterpolate=fps=48:mi_mode=mci:mc_mode=aobmc:vsbmc=1"          -c:v libx264 -profile:v high -pix_fmt yuv420p          -g 1 -keyint_min 1 -sc_threshold 0 -crf 21          -preset slow -movflags +faststart scrub-1920.mp4
       (add scale=1280:-2 and use -crf 22 for scrub-1280.mp4)

     RESOLUTION AND THE TRADE IT MAKES. Desktop is the source's full
     1920x1080 at CRF 21; mobile is 1280 at CRF 22. Earlier passes at
     1280/CRF27 and 1440/CRF24 were chosen to keep the files small and both
     read as soft on a full-bleed stage — the canvas covers the viewport, so
     anything below the display width is being upscaled before compression
     is even considered.

     This is a DELIBERATE trade against scrub rate, and it is worth being
     explicit about because it is the opposite of what the image version
     optimised for. Every frame scrubbed past is decoded on demand, and
     decode cost scales with resolution: measured in Chromium, ~28ms/frame
     at 1280 (~34fps) against ~57ms at 1920 (~18fps). The 240-webp version
     scrubbed at ~60fps because its frames were already decoded — painting
     was a blit. Caching decoded frames to get that back was measured and
     rejected: 381 ImageBitmaps at 1080p is ~3GB, and even a 60-frame
     rolling window is ~475MB and cannot refill ahead of a scroll.

     So the reel is sharp and scrubs at roughly a third of the frame
     version's rate. If it ever needs to feel smoother instead, the lever is
     resolution, not code — drop SRC_LG to the 1280 encode and the rate
     roughly doubles.

     COUNT must match the interpolated frame count, not the source's. If the
     fps above changes, change COUNT with it or the reel will run short of
     the footage or off the end of it.

     THE HOST MUST SUPPORT RANGE REQUESTS. Seeking needs HTTP 206; on a
     server that answers plain 200 the browser reports video.seekable as an
     empty range, every currentTime assignment silently clamps to 0, and the
     reel sits on frame 0 forever with no error anywhere. GitHub Pages does
     support ranges. Python's http.server does NOT — so testing this section
     over `python -m http.server` reproduces exactly that dead-scrub symptom
     and the code is not at fault. */

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

    var src = window.innerWidth <= SM_MAX ? SRC_SM : SRC_LG;

    /* The reel source. Never added to the DOM: it is only ever a drawImage
       source, so it needs no box, no styling and no compositor layer. The
       canvas is still what the reader sees.

       playsinline + muted: iOS refuses to load or seek an inline video
       without both, and treats a bare <video> as fullscreen-on-play. There
       is no audio track in either file, but muted is what unlocks the
       autoplay/seek policy, so it is set regardless.

       preload=auto because the whole point is to have frames ready to seek
       to before the reader arrives. */
    var video = document.createElement('video');
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.preload = 'auto';

    var duration = 0;           /* seconds; from metadata */
    var started = false;
    var armed = false;          /* true once the first frame can be painted */
    var seeking = false;        /* a seek is in flight */
    var pendingT = -1;          /* time requested while one was in flight */

    /* Nearest frame the scrubber WANTS, and the one currently on the canvas.
       Kept in FRAME units, as when this was an image sequence, so everything
       downstream — the hull tracker, the repaint guard — is unchanged. */
    var wanted = 0;
    var painted = -1;

    /* Frame index -> the time to seek to. Aimed at the MIDDLE of the frame's
       slot rather than its leading edge: landing exactly on a boundary is
       ambiguous once floating point is involved and can decode either side
       of it, which shows up as the reel flickering between two frames while
       the scroll position is not even moving. */
    function timeOf(i) {
      if (!duration) return 0;
      var t = (i + 0.5) * (duration / COUNT);
      return t < 0 ? 0 : t > duration - 1e-3 ? duration - 1e-3 : t;
    }

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
      var iw = img.videoWidth || img.naturalWidth || img.width;
      var ih = img.videoHeight || img.naturalHeight || img.height;
      if (!iw || !ih) return;

      /* cover: scale so the image fills both axes, then centre the overflow. */
      var scale = Math.max(cw / iw, ch / ih);
      var dw = iw * scale;
      var dh = ih * scale;
      ctx.drawImage(img, (cw - dw) * 0.5, (ch - dh) * 0.5, dw, dh);
    }

    /* Asks the decoder for `wanted`.

       ONE SEEK AT A TIME. Assigning currentTime while a seek is already
       running makes the browser abandon the first — during a fast scrub that
       is a stream of cancelled seeks and the picture stops updating
       altogether. So a seek in flight parks the newest request in pendingT
       and 'seeked' fires it. Intermediate positions are DROPPED, not queued:
       the reader only wants the frame they landed on, and replaying a queue
       would run the reel behind the scroll.

       The canvas keeps showing the previous frame while a seek resolves,
       which is the same graceful degradation the image version had while
       frames were still loading — a lower frame rate, never a blank stage. */
    function render() {
      if (!armed) return;

      if (wanted !== painted) {
        var t = timeOf(wanted);
        if (seeking) {
          pendingT = t;
        } else {
          seeking = true;
          painted = wanted;
          try { video.currentTime = t; } catch (e) { seeking = false; }
        }
      }
    }

    /* ---- painting on the decoder's own cadence --------------------------
       'seeked' fires once the seek RESOLVES, but the decoder often has a new
       frame up before that — and during a fast scrub, where requests are
       being coalesced, waiting only for 'seeked' means the canvas holds one
       stale frame across several dropped positions. That is the stepping the
       reel is trying not to do.

       requestVideoFrameCallback fires whenever a new frame is actually
       presented, which is the earliest moment there is something new to
       blit. Painting from here instead of only from 'seeked' turns those
       coalesced seeks into a continuous sweep: every frame the decoder
       manages to produce reaches the canvas, rather than only the ones a
       completed seek happened to land on.

       Not available everywhere (Firefox, older Safari). Where it is missing
       the 'seeked' handler alone still paints every landed frame, which is
       the behaviour this section already shipped with — so this is a pure
       upgrade, never a dependency. */
    var hasRVFC = typeof video.requestVideoFrameCallback === 'function';
    function onVideoFrame() {
      if (armed) {
        paint(video);
        measureHull();
      }
      video.requestVideoFrameCallback(onVideoFrame);
    }

    /* The decoder has landed on a frame: put it on the canvas, then chase
       the scroll if it moved on while we were seeking. */
    video.addEventListener('seeked', function () {
      seeking = false;
      paint(video);
      measureHull();
      if (pendingT >= 0) {
        var t = pendingT;
        pendingT = -1;
        seeking = true;
        try { video.currentTime = t; } catch (e) { seeking = false; }
      }
    });

    /* ---- loading ------------------------------------------------------
       One file, streamed. 'loadedmetadata' gives the duration the frame ->
       time mapping needs; 'seeked' (above) arms the reel the first time a
       real frame is on the canvas.

       Nothing is ever played. The video is a seekable bitmap source and the
       scroll position is the only thing that moves it. */
    function startLoading() {
      if (started) return;
      started = true;
      video.src = src;
      video.load();
    }

    video.addEventListener('loadedmetadata', function () {
      duration = video.duration || 0;
      if (!duration || !isFinite(duration)) return;
      resize();
      /* Seek to frame 0 rather than trusting the poster frame: a video that
         has metadata has not necessarily decoded anything paintable yet, and
         drawImage of an undecoded video is a no-op that leaves the canvas
         black. The first 'seeked' is what arms the section. */
      seeking = true;
      try { video.currentTime = timeOf(0); } catch (e) { seeking = false; }
    });

    /* First paintable frame. data-scrub-ready is what the stylesheet uses to
       cross the poster out, so it must not be set until something is
       genuinely on the canvas. */
    function armOnce() {
      if (armed || !duration) return;
      armed = true;
      section.setAttribute('data-scrub-ready', '');
      resize();
      paint(video);
      measureHull();

      /* The reel almost always finishes loading AFTER the loop has run and
         settled — the spring reaches its target while the video is still
         streaming, then the loop sleeps. Nothing else would wake it, so the
         frame the reader is actually parked on would never be requested and
         the stage would sit on frame 0 until the next scroll event.

         painted is deliberately left at -1 by the arming paint: it records
         what has been REQUESTED, and frame 0 was only ever a placeholder to
         get something on the canvas. Leaving it unset is what makes the
         render() below a real request rather than a no-op. */
      if (wanted !== 0) render();
      if (hasRVFC) video.requestVideoFrameCallback(onVideoFrame);
      wake();
    }
    video.addEventListener('seeked', armOnce);
    video.addEventListener('loadeddata', function () {
      /* Some browsers deliver a decoded first frame without ever firing
         'seeked' for the initial currentTime assignment. */
      if (video.readyState >= 2) armOnce();
    });

    /* A video that cannot load leaves the poster in place — the section
       degrades to the still, exactly as it does with JS off. */
    video.addEventListener('error', function () {
      section.removeAttribute('data-scrub-ready');
    });

    /* ---- hull tracking --------------------------------------------------
       Reads the painted frame and reports the hull's half-width as a
       percentage of the stage, so the points can sit just outside it. */
    var lastHullFrame = -1;
    var lastHullPct = -1;

    /* THE HULL READING PER FRAME, and why the anchor has to come from here
       rather than from the live eased value.

       measureHull() below produces one reading per distinct painted frame,
       and the frame index is a pure function of the scroll position (see
       the remap at the end of apply()). So `frame -> hull width` is fixed
       footage data: frame 120 measures the same ship whichever way the
       reader arrived at it.

       The EASED value is not. hullPos trails hullTarget through a per-frame
       ease, so what it reads at any instant depends on the path taken to
       get there - and sampling it on the `near` edge made the anchor
       direction-dependent twice over. A pair crosses that edge at opposite
       ends of its slot depending on direction (u ~ -0.2 descending, ~ 1.2
       ascending), so it sampled at different reel frames: descending, pair
       1 entered against a wide hull; ascending, it re-entered once the
       drone had climbed and the ship had narrowed, and both its points
       froze that much closer to the centreline. Measured down-vs-up at the
       same progress, every matched sample differed - worst 197px.

       Keyed by frame, the anchor is a function of progress alone. */
    var hullByFrame = [];

    /* The frame a given pinned position t paints. The same arithmetic as
       the remap in apply(), kept in step with it by construction. */
    function frameAt(t) {
      var span = 1 - HOLD - TAIL;
      var p = span > 0 ? (t - HOLD) / span : t;
      if (p < 0) p = 0;
      if (p > 1) p = 1;
      return Math.round(p * (COUNT - 1));
    }

    /* The hull at a frame, LATCHED once that frame has been measured.

       The nearest-measured-frame scan this replaces was still
       direction-dependent, just more subtly than the eased value was. Only
       frames the reader has actually painted carry a reading, and which
       frames those are differs between a downward pass and an upward one -
       seeks coalesce differently depending on scrub speed and direction. So
       a pair whose own frame had not been painted yet resolved to whichever
       neighbour happened to be present at that moment, and to a different
       one on the way back: measured down-vs-up, 9 of 132 matched samples
       still disagreed, worst 25px.

       Latching fixes that by making the answer settle exactly once. Until
       a pair's canonical frame has been read the anchor is HULL_FALLBACK -
       the widest case, which is where the static layout already sits, so
       the points simply start at their resting width. The first time that
       frame is measured the reading is kept, and from then on it is a
       constant for the rest of the session: the same frame, the same hull,
       the same lateral distance, whichever way the reader travels. */
    var hullLatch = [];
    function hullAt(frame) {
      if (hullLatch[frame] === undefined) {
        if (hullByFrame[frame] === undefined) return HULL_FALLBACK;
        hullLatch[frame] = hullByFrame[frame];
      }
      return hullLatch[frame];
    }

    /* The small offscreen the frame is sampled from. Created once, never
       attached to the document, and never composited - so reading it back
       costs nothing but the copy. */
    var hullCv = document.createElement('canvas');
    var hullCtx = hullCv.getContext('2d', { alpha: false, willReadFrequently: true });

    function measureHull() {
      if (!hullCtx || painted < 0 || painted === lastHullFrame) return;
      if (!armed || video.readyState < 2) return;
      var img = video;
      lastHullFrame = painted;

      var iw = img.videoWidth;
      var ih = img.videoHeight;
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
         how far past the outermost warm pixel the boundary actually falls,
         found by treating warmth as linear between that pixel and the first
         one outside it that fails, and solving for where it crosses the
         threshold - a partly-warm pixel at the hull's edge sits partway
         between, and interpolating recovers that fraction. The answer moves
         continuously as the ship narrows instead of in 10px stairs.

         Which END that fraction is measured from is not a detail: get it
         backwards and the refinement reverses the measurement between pixel
         boundaries, which is a slow inward pull with a snap back out. See
         the note at the calculation itself. */
      for (var ri = 0; ri < HULL_ROWS; ri++) {
        var row = Math.round((bandH - 1) * (ri / (HULL_ROWS - 1)));
        var base = row * hw * 4;
        for (var x = 0; x < hw; x++) {
          var i4 = base + x * 4;
          var r = data[i4], g = data[i4 + 1], b = data[i4 + 2];
          if (r - b > HULL_WARM && (r + g + b) / 3 > HULL_MIN_LUM) {
            var d = Math.abs(x - half);
            /* >=, not >. The sub-pixel term below can only ever ADD to d, so
               a pixel at the same whole-pixel distance as the current best
               can still refine it upward - and with a strict > it could not,
               because the integer compared is the one WITHOUT the fraction
               while the value stored has it. The two are not the same
               quantity, and comparing across them is what let a later row
               lose a refinement an earlier one had already found. */
            if (d >= widest) {
              /* THE SUB-PIXEL EDGE, and it has to be solved in the right
                 direction or it runs BACKWARDS.

                 This is a linear crossing: warmth falls from wIn at this
                 pixel to wOut at the first failing one just outside, and the
                 real boundary is wherever that line passes HULL_WARM. So the
                 fraction is how far from THIS pixel the crossing sits,
                 (wIn - HULL_WARM) / (wIn - wOut).

                 It used to be (HULL_WARM - wOut) / (wIn - wOut), which is
                 the distance measured from the WRONG END - it says how far
                 the crossing sits from the outside pixel, then adds that to
                 the inside one. The two only agree when the crossing is
                 exactly halfway.

                 That sign error is what made the points swim toward the
                 ship. As the hull grows within one pixel, wIn rises while
                 wOut stays at sea level, so the old fraction SHRANK as the
                 edge advanced: the measurement crept inward across the whole
                 pixel, then jumped outward past the truth when the boundary
                 finally crossed into the next one and the fraction reset
                 near 1. On a smoothly widening hull that is a sawtooth once
                 per pixel - measured on a synthetic ramp, 90 backward steps
                 across a 30px growth, each up to 1.2px, which the anchor's
                 ease turns into a soft inward drift and recovery rather than
                 a visible jump. Solved from the correct end the sequence is
                 monotonic - zero backward steps on the same ramp - and lands
                 within 0.28px of the true edge.

                 Clamped into 0..1 so a noisy neighbour can never push the
                 edge more than one pixel either way. */
              var xo = x < half ? x - 1 : x + 1;
              var soft = 0;
              if (xo >= 0 && xo < hw) {
                var o4 = base + xo * 4;
                var wIn = r - b;
                var wOut = data[o4] - data[o4 + 2];
                var span = wIn - wOut;
                if (span > 0) {
                  soft = (wIn - HULL_WARM) / span;
                  if (soft < 0) soft = 0;
                  if (soft > 1) soft = 1;
                }
              }
              var cand = d + soft;
              if (cand > widest) widest = cand;
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
      /* Recorded against the frame it was measured from, so the points can
         look their anchor up by progress instead of sampling whatever the
         ease happens to hold. */
      hullByFrame[lastHullFrame] = pct;
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

       What is wanted instead is a curve that is flat at BOTH ends, so the
       point drifts out of its resting line, crosses at an even rate, and
       settles into the edge instead of being flung at it. A raised cosine
       was the first version of that and it fixed the polynomial's problem,
       but only in the slope - see the note on ease(), below, for the
       curvature corners it left at the extremes and at the resting line,
       and why the shape is now smootherstep.

       Plain smoothstep was the other candidate and is worse than either: it
       is flat at both ends in slope too, but it reverses its acceleration
       hard in the last third (+5 to -24), and that reversal is felt as a
       distinct hitch just before the point exits.

       It is done in JS and not in the stylesheet because it collapses the
       whole calc() chain into one number, so the stylesheet does less work
       per frame, not more - and, as a plain polynomial, it needs nothing
       from the values-4 set (cos(), sqrt(), pow()) that this file avoids for
       baseline reasons. */
    /* The shape both the bow and the tilt are built from: a 0..1 distance in,
       a 0..1 magnitude out, flat at BOTH ends.

       This is smootherstep, 6a^5 - 15a^4 + 10a^3, and it replaces the raised
       cosine that used to be here. The cosine is flat at both ends in SLOPE,
       which is what the note above was after, but its CURVATURE is not: it
       arrives at a = 0 and a = 1 carrying |accel| 19.7 and then drops to zero
       the instant the value is clamped or mirrored. Those are corners, and
       both of them sit exactly where the motion is supposed to look calm.

       At the extremes the point is parked - clamped off screen at either end
       of its slot - so a curve that reaches park still curving lurches out of
       it on the frame it wakes. At the resting line the two mirrored halves
       meet, and the cosine's curvature does not change sign smoothly across
       that join; it snaps. That snap is the flattening reading as an event
       rather than a settle.

       Smootherstep is C2: slope AND curvature are zero at a = 0 and a = 1, so
       the join and the clamp are both invisible. Measured across the travel,
       curvature at the ends falls 19.7 -> 1.4 and the sign change at the
       resting line falls from +/-19.7 to +/-4.5.

       It costs a slightly brisker middle - peak slope 3.75 against the
       cosine's 3.14. That is the trade and it is the right way round: the
       extra rate lands in the quarter either side of the resting line, where
       the point is travelling fast and the reader is not reading the turn as
       a separate move, and it buys the stillness at the three places they
       are. Same reasoning as the tilt's peak placement, below.

       Polynomial, so no Math call at all, and the endpoint values are
       unchanged - 0 at the resting line, 1 at either extreme - so the
       choreography, the magnitudes in the stylesheet and the hull anchoring
       all carry over untouched. */
    function ease(a) {
      return a * a * a * (a * (a * 6 - 15) + 10);
    }

    /* ---- THE HOLD, and why the smooth curve alone was not enough --------
       A curve that is flat at both ends fixed the harshness and introduced a
       different complaint: the points looked like they were swimming to the
       centre and back. That was not a bug in the easing, it was a
       consequence of it, and the fade window is what exposes it.

       A point is fully opaque from u = 0.22 to u = 0.78 and visible either
       side of that. So the reader sees very nearly the WHOLE of its bow
       sweep. Measured on the shapes this file has carried:

         d^2/d^4 polynomial   37% of the swing on screen   126px round trip
         raised cosine        79%                          160px
         smootherstep         84%                          169px

       The polynomial got away with a 12vw amplitude precisely because it was
       flat near the resting line and only bowed hard out at the extremes,
       where the fade had already hidden the block. Each smoother curve moved
       more of that same swing INTO full view. Nothing regressed in the
       motion's quality - the reader simply started seeing all of it, and
       169px of continuous lateral travel across the middle of the run reads
       as the block being pulled toward the ship and released.

       So the curve keeps a DEAD ZONE around the resting line. Inside it the
       bow is exactly zero, which means the point does not merely pass
       through its resting line at reduced speed - it actually stops beside
       the ship and holds there for a third of its visible run, which is what
       the copy wants if it is going to be read.

       The join costs nothing. smootherstep has zero slope AND zero curvature
       at a = 0, so splicing it onto a flat stretch inherits that flatness -
       measured at the boundary, slope 1.5e-6 and curvature 0.03, which is
       continuous to the precision that matters. This is the one reason the
       hold can exist at all: the same property that fixed the extremes is
       what lets the middle be clamped without putting a corner back.

       HOLD and the amplitude are tuned together. A hold alone compresses the
       whole sweep into less travel, which triples peak curvature - one
       complaint traded for another. Pulling the amplitude back to 5.5vw at
       the same time keeps the peak rate where the ungated curve had it while
       still shortening the visible round trip to ~108px, near the
       polynomial's 126px that nobody objected to. It also halves the
       off-screen overrun the 7vw version had at 1200px, from 33px to 15px. */
    var BOW_HOLD = 0.25;

    function bow(u) {
      /* Distance either side of the resting line, 0..1. */
      var d = (u - 0.5) * 2;
      if (d < 0) d = -d;
      if (d > 1) d = 1;
      /* Parked beside the ship: no lateral motion at all through the middle
         of the visible run. */
      if (d <= BOW_HOLD) return 0;
      /* Re-based onto the travel that is left, so the curve still reaches a
         full 1 at the extremes rather than being scaled down. */
      var a = (d - BOW_HOLD) / (1 - BOW_HOLD);

      /* CURVED OUTSIDE, STRAIGHT ON THE FINAL APPROACH.

         Plain smootherstep is S-shaped across the WHOLE span, so its
         curvature is greatest through the middle of the approach - that
         mid-span bulge is what reads as the point swinging in on an arc
         rather than tracking a line, the ")" shape instead of the "\".

         Blending it toward a straight ramp fixes the near half without
         touching the far one. The weight is a^3, so it vanishes fast as the
         point nears its resting line: measured on the blend, slope is 1.000
         and curvature -0.00 at a = 0.02, which is a straight line to the
         precision the eye can resolve, while the outer portion keeps real
         bend (curvature 1.31 at a = 0.5, against smootherstep's 1.75).

         The transition cannot kink, and that is a property of the weight
         rather than a tuning. Both pieces are C-infinity, and a^3 is zero
         in value, slope AND curvature at a = 0, so the blend leaves the
         linear end with no discontinuity in any of the three - the curve
         simply loses its bend on the way in. The endpoints are exactly
         preserved: 0 at the resting line and 1 at either extreme, so the
         hold zone, the choreography and the hull anchoring are unchanged. */
      var w = a * a * a;
      return w * ease(a) + (1 - w) * a;
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
      /* The MIRRORED ease of the signed distance, not a quarter-sine of it.

         The quarter-sine is flat at the two extremes but at its STEEPEST
         exactly at d = 0 - the resting line. So the one moment the block is
         meant to look composed and level was the moment it was rotating
         fastest, and the lean it had built up on the way in was wiped off
         in a single beat. That snap through level is the "harsh flattening"
         - the rotation arriving at zero at full speed rather than easing
         into it.

         sign(d) * ease(|d|) is flat at BOTH extremes AND at zero: the block
         eases out of its incoming lean, crosses level with almost no angular
         velocity, and eases into the outgoing one. Peak rate is in the
         quarter of the travel either side of the middle, where the point is
         moving anyway and the turn is not read as a separate event.

         The mirroring is also why ease() has to be flat in CURVATURE at zero
         and not merely in slope. This is the one place the shape is reflected
         through the origin, so whatever curvature it carries into d = 0
         arrives on the far side with the sign flipped - the rotation reverses
         its bend in a single frame. The raised cosine that used to be here
         did exactly that, at +/-19.7, and it is the sharper half of the
         harsh flattening. Smootherstep crosses at +/-4.5. */
      /* Held level across the same dead zone the bow uses, and for the same
         reason: the rotation was sweeping a continuous 3.35deg across the
         window where the point is fully opaque, so the block was still
         turning the whole time it was being read. Sharing BOW_HOLD means the
         lean and the offset start and stop together - the point arrives,
         squares up, sits, and leans away again as one move rather than two
         overlapping ones. */
      var a = d < 0 ? -d : d;
      if (a <= BOW_HOLD) return 0;
      var e = ease((a - BOW_HOLD) / (1 - BOW_HOLD));
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
    /* The anchor string each point currently CARRIES, so a re-seed can never
       leave one half of a pair holding a stale one. The write below is gated
       on uc changing, and uc is CLAMPED - parked past the end of its slot it
       pins at 1 and stops changing, while `near` (keyed to the unclamped u)
       is still live and can still release and re-sample the pair's anchor.
       That gap is what let a reversed scroll give one half a fresh reading
       and the other the old one - a 38px break in the mirror. Tracked here,
       the write fires on a change to EITHER input. */
    var lastHd = [];
    /* Whether each point currently carries the layer-promotion hint. */
    var ptOn = [];
    /* Whether each point is inside its hover window (cursor-catching, card
       openable), and which way its card is currently set to open. */
    var ptRest = [];
    var ptFlip = [];
    /* THE FROZEN ANCHOR, one per point, and the reason it is per point
       rather than one value on the section.

       The hull anchor tracks the ship's measured width, which narrows as
       the drone climbs. Read LIVE that is a value which keeps changing
       after the reader stops: the scroll spring settles, but the reel's own
       ease is still landing on its final frame, so measureHull() keeps
       reporting a narrower hull and hullPos keeps gliding toward it. Since
       the distance is always <= 0 and is multiplied by --why-side, a
       narrowing hull pulls BOTH columns inward - the points slide back
       toward the centre while standing still, which is exactly the drift
       this array exists to stop.

       So the anchor is sampled ONCE, on the frame a point enters its slot,
       and held for as long as that point is on screen. Within a single
       point's travel the term is then a constant: its lateral position is
       a pure function of its own bow curve, so where the scroll leaves it
       is where it stays. -1 means "not yet sampled".

       KEYED BY PAIR, NOT BY POINT, and that is what keeps a pair mirrored.
       Both halves read the same u (it is derived from pairOf, so the bow
       and the tilt are already identical across a pair) and sit on the same
       mirrored layout anchor - so the anchor sample was the one term that
       could differ between them. Sampled per point it could: the two halves
       cross the entry edge on the same frame in principle, but hullPos is
       re-eased every tick and measureHull() runs inside the same loop, so
       any frame where one half transitioned and the other did not froze two
       different widths - one point hugging the ship while its partner
       floated further out. Indexed by pair, the first half to arrive takes
       the reading and the second reads that same number back, so the
       magnitude is shared by construction and only --why-side mirrors it. */
    var ptHull = [];
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
      lastHd.push('');
      ptOn.push(false);
    }
    if (pairCount < 1) pairCount = 1;
    /* One slot per PAIR, not per point - see the note on ptHull above. */
    for (var hi = 0; hi < pairCount; hi++) ptHull.push(-1);

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

          /* THE ANCHOR, RESOLVED FROM PROGRESS - not sampled on an event.
             This is what makes the lateral path retrace itself.

             It used to freeze hullPos on the `near` edge above. Two things
             made that direction-dependent, and the reverse-scroll centre
             pull was the sum of them. hullPos is the EASED follower of the
             measurement, so what it holds at any instant depends on the
             path taken to reach it. And `near` is keyed to the unclamped u,
             so a pair crosses it at u ~ -0.2 descending but u ~ 1.2
             ascending - opposite ends of its slot, therefore different reel
             frames, therefore a different hull. Descending, pair 1 froze
             against a wide hull; ascending it re-entered once the drone had
             climbed and the ship had narrowed, and both its points sat that
             much closer to the centreline.

             Keyed to the pair's slot start instead, the anchor is a pure
             function of progress: tPair inverts the run mapping at the
             UNWARPED run-position pairOf*step, which is a constant per
             pair, so the same pair resolves the same frame and the same
             hull whichever way the reader is travelling. Still one value
             per pair, so both halves share one magnitude and the mirror
             holds; still frozen across the pair's own travel, so a stopped
             scroll cannot move it.

             Resolved every frame rather than cached on first use. The
             lookup is a bare array hit, and caching it would put back the
             very thing being removed: hullAt() falls back to the nearest
             frame that has actually been measured, so a pair resolved
             before the reel had read much would pin an early, too-wide
             reading and keep it for the rest of the session. Recomputed, it
             simply tracks the footage data as it fills in, and once a
             frame has been read its answer never changes again. */
          ptHull[pairOf[qi]] = hullAt(frameAt(ps + pairOf[qi] * step * (PTS_END - ps)));

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

          /* The pair's frozen anchor, resolved before the gate: it is half
             of what decides whether this point needs a write. */
          var hd = ptHull[pairOf[qi]];
          var hdw = (hd < 0 ? 0 : hd - HULL_FALLBACK).toFixed(3);

          if (uc !== lastPts[qi] || hdw !== lastHd[qi]) {
            lastPts[qi] = uc;
            var el = points[qi];
            el.style.setProperty('--why-pt', uc.toFixed(5));
            el.style.setProperty('--why-pt-o', po.toFixed(3));
            /* Written twice under two names, and the duplication is load
               bearing. --why-bow is `inherits: false` so each point keeps
               its own; --why-bow-i is the inheriting mirror the point's
               three layers read for the layered approach, because a child
               reading the non-inheriting original gets its initial 0. Same
               number, same frame, so the layers can never lag the block
               they belong to. */
            var bw = bow(uc).toFixed(5);
            el.style.setProperty('--why-bow', bw);
            el.style.setProperty('--why-bow-i', bw);
            el.style.setProperty('--why-tilt', tilt(uc).toFixed(5));

            /* The frozen anchor, written onto the POINT so it shadows the
               inherited section value the transform used to read. Written
               inside this block deliberately: it changes only when the
               point enters its slot, so re-writing the same number every
               frame would be pure cost - but it has to be re-asserted
               whenever the point's other driven values are, because a point
               that re-enters gets a fresh sample and must carry it before
               its next transform resolves.

               The point is a pure function of uc now: every term in its
               transform - the rise, the bow, the tilt, this - is keyed to
               its own travel and nothing else. Stop the scroll and all four
               stop with it. */
            lastHd[qi] = hdw;
            el.style.setProperty('--why-hull-d', hdw);
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
      } else if (armed && wanted !== painted) {
        /* Same index, but the canvas is not showing it yet — the reel armed
           mid-flight, or a seek was dropped during a fast scrub. Ask again;
           render() is a no-op once the two agree. */
        render();
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
