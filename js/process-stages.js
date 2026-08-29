/* ==========================================================================
   MedShield — process-stages.js
   Section 05, "How our case runs".

   THE MECHANIC, and what it deliberately is NOT.

   It is NOT scroll-jacked. The page never stops, the reader is never held
   against their will, and there is no long pinned timeline that has to be
   scrubbed through before the page will move on. Everything below is
   ordinary scrolling with two effects layered on top of it.

   1. THE PIN. .process__camera — the single visual frame — is switched to
      still on screen for exactly as long as the stage list beside it is
      passing, then released. The list scrolls past it at normal speed.

      A TRANSLATE, NOT position:fixed, AND THIS IS LOAD-BEARING. #process is
      already the pinned element of a second, later ScrollTrigger
      (process-to-cases.js, the hand-off morph into Case studies), and GSAP's
      pinType:'fixed' stamps a base transform onto its pinned element at
      SETUP time — before either mechanism has engaged. Any transform makes
      that element a containing block for position:fixed descendants, so a
      fixed camera inside #process silently anchors to #process rather than
      to the viewport and scrolls away with the page. Measured and confirmed:
      the camera reported position:fixed while its screen-space top marched
      steadily negative.

      So the hold is a transform:translateY instead — the camera stays in
      normal flow and is pushed down by exactly as much as the page has
      scrolled since the hold began, which is what "not moving" means in
      screen space. It cannot be hijacked by an ancestor's containing block
      because it never relies on one, and being a transform it costs no
      layout, so nothing around it shifts at either end.

   2. THE PROGRESSIVE READ. Each stage title is split into per-letter spans
      once, at build. As an item crosses the reading line its letters are
      brought from dim to full, left to right, and dim again once it has
      passed. That is the left-column movement — a reading emphasis that
      tracks scroll, not a block of text being swapped in and out of a slot.

   3. THE SCENE. The illustration inside the held frame cross-dissolves
      between five stages, keyed to whichever item is currently nearest the
      reading line, so the picture and the copy are always talking about the
      same thing.

   CSS OWNS THE RESTING LAYOUT. If this file never runs — no JS, a throw, an
   old browser, reduced motion — the section is a header, five readable
   stages and one illustration, with nothing dimmed and nothing pinned. Same
   contract as why.js / doubts.js / services.js.
   ========================================================================== */

(function () {
  'use strict';

  var section = document.getElementById('process');
  if (!section) return;

  var body = section.querySelector('.process__body');
  var pinWrap = section.querySelector('.process__pinWrap');
  var camera = section.querySelector('.process__camera');
  var frame = section.querySelector('.process__frame');
  var list = section.querySelector('.process__list');
  var items = [].slice.call(section.querySelectorAll('.process__item'));
  var scenes = [].slice.call(section.querySelectorAll('.process__sceneStage'));
  if (!body || !pinWrap || !camera || !list || !items.length || !scenes.length) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce.matches) return;

  /* --- split the titles into letters ------------------------------------
     Once, at build. Spaces are kept as plain text nodes so the browser can
     still break lines normally — wrapping a space in a span is what makes
     split text refuse to wrap where it should. Each word is its own span so
     a line break never lands mid-word. */
  var letterGroups = items.map(function (item) {
    var el = item.querySelector('[data-split]');
    if (!el) return [];
    var text = el.textContent;
    el.textContent = '';
    var letters = [];
    text.split(/(\s+)/).forEach(function (chunk) {
      if (!chunk) return;
      if (/^\s+$/.test(chunk)) {
        el.appendChild(document.createTextNode(chunk));
        return;
      }
      var word = document.createElement('span');
      word.className = 'process__word';
      word.style.whiteSpace = 'nowrap';
      for (var i = 0; i < chunk.length; i++) {
        var s = document.createElement('span');
        s.className = 'process__letter';
        s.textContent = chunk[i];
        word.appendChild(s);
        letters.push(s);
      }
      el.appendChild(word);
    });
    return letters;
  });

  var DIM = 0.28;

  /* --- the pin ----------------------------------------------------------
     Measured, not guessed, and re-measured on resize. The camera is fixed
     while the pin window is on screen and parked at either end of it
     otherwise, so scrolling back up retraces exactly. */
  var geo = null;

  /* THE HOLD IS A TWO-COLUMN EFFECT ONLY.

     Below 1040px the frame and the list are stacked in one column, so there
     is no "beside" for the frame to be held next to — holding it there just
     translates the picture down over the copy that is flowing underneath it.
     On that breakpoint the frame is simply part of the page: it scrolls, the
     stages scroll, and only the letter-lighting and the scene cross-dissolve
     remain. Matches the stylesheet's own 1040px two-column switch. */
  function twoColumn() { return window.innerWidth >= 1040; }

  function measure() {
    if (!twoColumn()) { setHold(0); geo = null; return; }

    /* Everything is read with the camera at its NATURAL offset — a leftover
       hold would fold this frame's translate back into the next measurement
       and the window would creep on every resize. */
    setHold(0);

    var camRect = camera.getBoundingClientRect();
    var scrollY = window.scrollY;

    var camH = camRect.height;
    /* Where the held frame sits on screen: centred in the space under the
       fixed site header, so it is optically in the middle of the viewport
       rather than crowding either edge.

       Clamped to a MINIMUM of the header height. A frame taller than the
       space available would otherwise produce a negative centring offset and
       the top of the picture would sit above the fold — the one thing a held
       visual must never do, since it is the element the reader is being
       asked to keep looking at. .process__frame's own width-from-height cap
       keeps it inside the fold in the first place; this is the backstop. */
    var headerH = 84;
    var top = Math.max(headerH, headerH + (window.innerHeight - headerH - camH) / 2);

    /* THE HOLD WINDOW, in document coordinates.

       start  the scroll position at which the camera has arrived at `top`
              and the hold begins
       end    the scroll position at which the hold lets go — and this has to
              be the moment the MORPH takes over, not a moment earlier.

       WHY end IS THE SECTION'S BOTTOM AT THE FOLD. process-to-cases.js pins
       #process when its bottom reaches the fold, and from that instant the
       camera belongs to the morph. Anything that releases the hold before
       then drops the frame back into flow and it scrolls away, leaving a
       stretch with no held visual at all — measured with the earlier
       `bodyRect.bottom - top - camH`, which let go ~793px early and produced
       exactly that gap right where the reader is finishing the last stage.

       Handing straight over means the inward close begins from the same view
       the reader has been looking at the whole way down, which is the entire
       premise of the transition. */
    /* PUBLISH THE HELD GEOMETRY.

       The hand-off turns the camera into the whole viewport (see style.css),
       which changes what the frame inside would be sized and centred against.
       Writing the numbers it is actually held at lets the frame keep exactly
       that box for the transition, so the picture is pixel-identical either
       side of the hand-over and only the boundary around it moves.

       Screen-relative, because during the transition the camera IS the
       screen. `top` is where the frame will BE once held, not where it is
       measured (measure() runs with the hold cleared), so the held screen
       position is the camera's held top plus the frame's fixed offset inside
       it. */
    if (frame) {
      var fr = frame.getBoundingClientRect();
      section.style.setProperty('--held-x', Math.round(fr.left) + 'px');
      section.style.setProperty('--held-y',
        Math.round(top + (fr.top - camRect.top)) + 'px');
      section.style.setProperty('--held-w', Math.round(fr.width) + 'px');
    }

    var start = camRect.top + scrollY - top;
    var end = section.getBoundingClientRect().bottom + scrollY - window.innerHeight;

    geo = (end > start) ? { start: start, end: end, top: top, height: camH } : null;
  }

  /* The camera's current translate, in px. Written only when it changes, so
     a still frame costs nothing. */
  var held = 0;

  /* Exposed so process-to-cases.js can drop the hold at the exact frame its
     pin engages. The hold's own release runs on scroll, which is too late —
     the pin engages between scroll events and a ~2600px stale translate
     would survive into the transition and drag the closing object off
     screen. See openCamera() there. */
  window.__medshieldReleaseProcessHold = function () { setHold(0); };

  function setHold(y) {
    y = Math.round(y);
    if (y === held) return;
    held = y;
    camera.style.transform = y ? 'translate3d(0,' + y + 'px,0)' : '';
  }

  /* --- the progressive read ---------------------------------------------
     One item's own progress is where its box sits against the reading line:
     0 just before the item reaches it, 1 once the item has carried past.
     Letters are lit in order across that span, with a short per-letter ramp
     so the edge of the lit region is a soft sweep rather than a hard
     boundary. */
  /* THE LAST ITEM READS FASTER, ON PURPOSE.

     Every other stage has the next one coming up behind it, so it can afford
     to finish lighting only once it has fully carried past the line — its
     own height plus a run-out. Stage 05 has nothing behind it but the
     hand-off, and that budget was costing ~968px of scroll between the stage
     arriving and the close starting: the reader had finished reading and was
     still scrolling, watching the picture drift down with nothing happening.

     So the final item is scored against a much shorter span — it is lit by
     the time it is comfortably on screen, not after it has left. That is
     what lets the tail below shrink to the point where the close begins
     almost as soon as the last title is done. */
  function readProgress(item, isLast) {
    var r = item.getBoundingClientRect();
    var line = window.innerHeight * 0.62;
    var span = isLast
      ? window.innerHeight * 0.34
      : r.height + window.innerHeight * 0.28;
    return (line - r.top) / span;
  }

  function paint() {
    var scrollY = window.scrollY;

    /* 1. the hold. Between the window's two edges the camera is pushed down
       by exactly what has been scrolled since the hold began, so it does not
       move on screen. Outside the window it is parked at whichever edge it
       belongs to, which is what makes scrolling back up retrace exactly.

       HANDS OFF ONCE THE MORPH OWNS THE CAMERA. process-to-cases.js pins
       #process and takes the camera over for the transition into Case
       studies, sizing it to the full viewport and driving its own clip and
       transform. A translate still being written here would be composed with
       that transform every frame and drag the closing object off screen —
       measured: the camera's top marched to -2264px mid-morph. .is-morphing
       is the signal that the camera is no longer ours; the hold lets go of
       it entirely for that stretch and picks it back up on the way out. */
    if (geo) {
      if (section.classList.contains('is-morphing')) {
        /* Clear it rather than merely stopping: a translate left behind from
           the last frame before the pin engaged would still be composed with
           the morph's own transform for the whole transition. */
        setHold(0);
      } else {
        var y = scrollY < geo.start ? 0
              : (scrollY > geo.end ? geo.end - geo.start : scrollY - geo.start);
        setHold(y);
      }
    }

    /* 2. the letters, and 3. which scene the frame should be showing */
    var best = 0, bestScore = -Infinity;

    for (var i = 0; i < items.length; i++) {
      var p = readProgress(items[i], i === items.length - 1);
      var letters = letterGroups[i];
      var n = letters.length;

      if (n) {
        /* clamp for the sweep, but keep the raw value for scoring */
        var cp = p < 0 ? 0 : (p > 1 ? 1 : p);
        /* The lit edge travels a little past the end so the last letter has
           room to finish rather than snapping on at the boundary. */
        var edge = cp * (n + 6) - 3;
        for (var j = 0; j < n; j++) {
          var t = edge - j;                 /* >0 once the edge has passed j */
          var o = t <= 0 ? 0 : (t >= 3 ? 1 : t / 3);
          letters[j].style.opacity = (DIM + (1 - DIM) * o).toFixed(3);
        }
      }

      /* The item nearest the reading line owns the frame. Score peaks at
         p == 0.5 (the item squarely on the line) and falls off either side,
         so the scene changes over as one item hands to the next. */
      var score = 1 - Math.abs(p - 0.5);
      if (score > bestScore) { bestScore = score; best = i; }
    }

    /* 3. cross-dissolve the scene.
       The active scene is full, its neighbour fades in as the hand-over
       approaches, everything else is off — one continuous picture changing,
       never a hard cut. */
    var pActive = readProgress(items[best], best === items.length - 1);
    var nextIdx = pActive > 0.5 ? best + 1 : best - 1;
    var blend = Math.min(1, Math.max(0, (Math.abs(pActive - 0.5) - 0.25) / 0.35));

    for (var s = 0; s < scenes.length; s++) {
      var op = 0;
      if (s === best) op = 1 - blend * 0.5;
      else if (s === nextIdx) op = blend;
      scenes[s].style.opacity = op.toFixed(3);
    }
  }

  /* --- run --------------------------------------------------------------
     rAF-gated: scroll and resize only ever mark the frame dirty, and all the
     reading and writing happens once per frame. The site already runs a
     smooth-scroll integrator (hero.js) that writes window.scrollTo every
     frame, so anything doing layout work per scroll EVENT would be doing it
     several times a frame for no benefit. */
  var ticking = false;

  function request() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      paint();
    });
  }

  measure();
  paint();

  window.addEventListener('scroll', request, { passive: true });

  /* Re-measure on a real width change only. A vertical-only resize is almost
     always mobile browser chrome collapsing, and re-measuring there would
     make the frame jump mid-scroll. Same policy as doubts.js. */
  var lastW = window.innerWidth;
  var resizeTimer;
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      measure();
      paint();
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    }, 200);
  }, { passive: true });

  /* If the reader turns reduced motion on mid-session, drop the whole thing
     rather than leaving a pin and a set of dimmed letters they did not ask
     for. */
  if (reduce.addEventListener) {
    reduce.addEventListener('change', function (e) {
      if (!e.matches) return;
      window.removeEventListener('scroll', request);
      setHold(0);
      letterGroups.forEach(function (g) {
        g.forEach(function (l) { l.style.opacity = ''; });
      });
      scenes.forEach(function (s, i) { s.style.opacity = i === 0 ? '' : '0'; });
    });
  }

  /* Measurements are not final until the webfonts have swapped — a title
     that reflows from two lines to one moves every edge this file solved
     against. */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { measure(); paint(); });
  }
  window.addEventListener('load', function () { measure(); paint(); });
}());
