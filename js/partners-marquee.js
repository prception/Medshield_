/* ==========================================================================
   MedShield — partners-marquee.js
   Section 09, "Our network": the two counter-running logo bands.

   WHAT THIS IS. Two strips of logo plates translating steadily and forever —
   the top one to the LEFT, the lower one to the RIGHT. Neither is a carousel:
   nothing snaps, there is no current item, and there is no state the reader
   has to scroll to unlock.

   WHY IT IS NOT THE PROCESS BAND. js/process-marquee.js drives a SEQUENCE —
   five numbered stages that have to start at 01 — so it runs to an end, fades,
   rewinds and starts over. This band has no sequence: fifteen partners in no
   meaningful order, where the impression wanted is a field of names with no
   beginning and no end. So this one is the plain seamless wrap that the
   process band deliberately is not, and it needs none of that file's phase
   machine, hold or fade.

   HOW THE LOOP CLOSES. Each track holds its plates TWICE (see index.html —
   the second set is aria-hidden). The strip is translated between 0 and
   exactly the distance from the first plate to its own duplicate, then
   wrapped. Because the second half is pixel-identical to the first, the wrap
   lands on the same picture in the same place and the seam is invisible.
   Nothing is cloned at runtime and no element is ever moved in the DOM.

   THE RIGHT-RUNNING ROW starts at the far end and counts DOWN, so it is
   already full of plates on its first frame. Starting it at 0 and running
   backwards would drag the strip off its own left edge and show the reader an
   empty band travelling into view.

   TIME-BASED, NOT FRAME-BASED. The step comes from real elapsed milliseconds,
   so a pass takes the same time on a 60Hz laptop and a 144Hz monitor. A
   per-frame constant would run it 2.4x faster on the latter.

   RESTING CONTRACT. If this file never runs — no JS, a throw, reduced motion
   — .partners--live is never added and CSS leaves both bands as ordinary
   horizontal scrollers the reader swipes themselves, with the duplicate sets
   hidden so each partner appears exactly once. Nothing is missing from the
   page. Same contract as process-marquee.js / doubts.js / services.js.
   ========================================================================== */

(function () {
  'use strict';

  var section = document.getElementById('partners');
  if (!section) return;

  var frames = section.querySelectorAll('.partners__frame');
  if (!frames.length) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce.matches) return;

  /* THE RATE, in px per second.

     Deliberately slower than the process band's 34. That band asks the reader
     to READ each card; this one asks them to recognise marks they already
     know, which happens at a glance — so the band can afford to be calm, and
     a calm band is what keeps a logo wall from reading as an advertisement. */
  var SPEED = 26;

  /* One entry per row. Kept in an array rather than closed over individually
     so a single rAF drives both — two independent loops would each pay their
     own callback and could drift apart under load. */
  var rows = [];

  for (var i = 0; i < frames.length; i++) {
    var frame = frames[i];
    var track = frame.querySelector('.partners__track');
    if (!track) continue;
    rows.push({
      frame: frame,
      track: track,
      /* -1 runs the strip left (offset grows, transform is negative);
         +1 runs it right. Read from the markup so the direction stays a
         content decision and this file needs no per-row special case. */
      dir: frame.getAttribute('data-dir') === 'right' ? 1 : -1,
      cycle: 0,
      offset: 0
    });
  }
  if (!rows.length) return;

  /* HOW FAR ONE FULL CYCLE IS.

     The distance from the first plate to its own duplicate — i.e. exactly one
     set of plates plus the gaps between them. Measured from the plates rather
     than halving the track's scrollWidth, so the flex gap and any sub-pixel
     rounding are already inside it by construction and the wrap is exact.

     offsetLeft, not getBoundingClientRect: it is unaffected by the transform
     this file is currently writing, so there is no need to clear it first. */
  function measure() {
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var plates = row.track.children;
      var half = plates.length / 2;
      row.cycle = (plates.length >= 2 && half === Math.floor(half))
        ? plates[half].offsetLeft - plates[0].offsetLeft
        : 0;
      if (!(row.cycle > 0)) row.cycle = 0;

      /* THE RIGHT-RUNNING ROW STARTS FULL. Its transform is
         -(cycle - offset), so at offset 0 it would sit at -cycle — one whole
         set of plates to the left of where it belongs, i.e. a band that is
         empty on the right and fills in as it travels. Seeding the offset at
         the end of the cycle puts it at transform 0 on the first frame, with
         plates already across the full width. */
      if (row.dir > 0 && row.offset === 0) row.offset = row.cycle;
      if (row.cycle > 0) row.offset = row.offset % row.cycle;
    }
  }

  function write() {
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      /* Both directions are expressed as a NEGATIVE translate of a strip that
         is two sets long: running right is simply approaching the start of
         the second set from the far end rather than leaving the first. That
         keeps the visible window inside the duplicated region in both cases,
         which is what makes the wrap invisible either way. */
      var x = row.dir < 0 ? -row.offset : -(row.cycle - row.offset);
      /* translate3d, not translateX: the z keeps each strip on its own
         compositor layer on every engine, so this stays a transform-only
         write with no paint behind it. */
      row.track.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
    }
  }

  /* --- the run ----------------------------------------------------------- */

  var last = 0;
  var running = false;
  var rafId = 0;

  function tick(now) {
    if (!running) return;
    rafId = requestAnimationFrame(tick);

    var dt = now - last;
    last = now;

    /* A TAB THAT WAS IN THE BACKGROUND HANDS BACK A HUGE dt.

       rAF is throttled or stopped outright while the tab is hidden, so the
       first frame after it returns can carry several seconds. Advancing by
       that would jump the strips most of a cycle in one frame — a hard cut
       the moment the reader comes back. Clamped to ~4 frames' worth: enough
       to smooth an ordinary hitch, short enough that a real gap simply
       resumes where it left off. */
    if (dt > 64) dt = 64;
    if (dt < 0) dt = 0;

    var step = SPEED * (dt / 1000);
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      if (!(row.cycle > 0)) continue;
      row.offset += step;
      /* while, not if: a clamped dt cannot overshoot a whole cycle, but a
         re-measure to a much shorter one can. */
      while (row.offset >= row.cycle) row.offset -= row.cycle;
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
     Bands running in a section two viewports away are transform writes every
     frame for something nobody can see. The margin is generous on purpose so
     the strips are already up to speed by the time the section is genuinely
     in view — starting them at the exact edge would show a stationary band
     for the first frame.

     UNLIKE THE PROCESS BAND there is no arrival seeding here: that one has to
     start at stage 01 because five numbered stages are a sequence. Fifteen
     logos in no particular order have no first item, so meeting this band
     mid-stride is not merely acceptable, it is the intended impression. */
  var visible = false;

  /* PAUSED WHILE THE READER IS ON IT. A band that keeps sliding under the
     cursor is telling the reader they cannot have the plate they just reached
     for. Both rows hold together — pausing only the hovered one would leave
     the other running and draw the eye off the thing being inspected. */
  var paused = false;

  function sync() {
    if (visible && !paused && !document.hidden) start(); else stop();
  }

  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      sync();
    }, { rootMargin: '100% 0px' }).observe(section);
  } else {
    visible = true;
  }

  /* THE HOVER ITSELF.

     On each frame rather than on each plate, so crossing the gap between two
     plates is not a stutter of resume-and-pause; and on pointerenter/leave
     rather than mouseover/out, so it does not re-fire on every child element
     the pointer crosses inside a band.

     TOUCH IS EXCLUDED. A finger's pointerenter fires on tap and its
     pointerleave may never arrive, which would leave the bands stopped for
     the rest of the visit. */
  for (var f = 0; f < rows.length; f++) {
    (function (frame) {
      if (window.PointerEvent) {
        frame.addEventListener('pointerenter', function (e) {
          if (e.pointerType === 'touch') return;
          paused = true; sync();
        });
        frame.addEventListener('pointerleave', function (e) {
          if (e.pointerType === 'touch') return;
          paused = false; sync();
        });
      } else {
        frame.addEventListener('mouseenter', function () { paused = true; sync(); });
        frame.addEventListener('mouseleave', function () { paused = false; sync(); });
      }
    }(rows[f].frame));
  }

  /* Hidden tab: stop outright rather than relying on rAF's own throttling, so
     a backgrounded page costs nothing at all. */
  document.addEventListener('visibilitychange', sync);

  /* --- run ---------------------------------------------------------------
     .partners--live GOES ON FIRST, AND THAT ORDER MATTERS. The resting
     stylesheet hides the duplicate sets (.partners__plate--clone
     { display:none }) because an un-driven strip must show each partner once,
     not twice — so while the class is off, the clones have no box at all and
     the cycle measured from them comes back as 0. The class is applied first,
     the strips are measured with their real two-set layout, and it is taken
     back off only if the measurement turns out unusable. Nothing paints in
     between: both writes happen in the same task, before the next frame. */
  function build() {
    section.classList.add('partners--live');
    measure();
    if (rows[0].cycle > 0) {
      write();
      return true;
    }
    /* Unusable measurement: hand the bands back to the reader as ordinary
       swipeable strips rather than leaving dead ones that cannot move. */
    section.classList.remove('partners--live');
    return false;
  }

  if (build()) sync();

  var lastW = window.innerWidth;
  var resizeTimer;
  window.addEventListener('resize', function () {
    /* Width only. A mobile browser collapsing its address bar fires resize on
       every scroll with an unchanged width, and re-measuring there would
       reset both offsets mid-run. */
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (build()) sync();
    }, 200);
  }, { passive: true });

  /* The plates are fixed-width, so a font swap does not move them — but the
     logo images settling does finalise each track's real width, and the cycle
     has to be exact or the wrap shows a seam. */
  window.addEventListener('load', function () {
    if (build()) sync();
  });

  /* If the reader turns reduced motion on mid-session, hand the bands back to
     them rather than leaving them running. */
  if (reduce.addEventListener) {
    reduce.addEventListener('change', function (e) {
      if (!e.matches) return;
      stop();
      section.classList.remove('partners--live');
      for (var r = 0; r < rows.length; r++) rows[r].track.style.transform = '';
    });
  }
}());
