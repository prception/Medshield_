/* ==========================================================================
   MedShield — hero.js
   No dependencies, no scroll library, no GSAP, no Lenis. Native scroll only.
     1. header hide/show on scroll direction
     2. hero entrance reveal (fonts-gated) + character split
     3. hero video autoplay/loop, plus the --hero-progress custom property
        that drives the CSS exit motion (headline, annotations, scrim)
     3b. wheel-driven smooth scroll
     4. overlay menu: focus trap + Escape to close
   ========================================================================== */

(function () {
  'use strict';

  /* --- 1. Header scroll state ------------------------------------------- */

  var header = document.getElementById('site-header');

  if (header) {
    var STUCK_AT = 80;
    var ticking = false;
    var lastY = window.scrollY;

    /* How long the scroll must be quiet before the bar returns. 260ms is
       past the tail of a trackpad flick or a momentum fling, so the bar does
       not flash back in during the coast, but is short enough that it feels
       like a response to stopping rather than a delayed animation. */
    var IDLE_MS = 260;
    var idleTimer = 0;

    /* The bar hides on scroll MOTION and returns when the scroll goes quiet:

         scrolling (either way) -> hide  (translateY(-100%))
         scroll idle for 260ms  -> show

       A small threshold stops sub-pixel scroll jitter and trackpad momentum
       from flickering the bar. */
    var MOTION_THRESHOLD = 6;

    /* Which section is under the bar, and is it dark?

       Dark sections are marked in the HTML with data-bar-ink="light" — one
       source of truth, rather than a selector list here that silently rots
       the next time a section is added or restyled.

       The probe point is 28px down: half the bar's height, so the ink flips
       as a section boundary crosses the vertical MIDDLE of the bar (level
       with the logo) rather than its very top edge. Sampling is a walk over
       the marked elements rather than elementFromPoint, because the bar
       itself — and the open overlay — sit at that point and would be the hit.

       Not cached: .doubts and the hero are scroll-scrubbed and change height
       as they animate, so the rects have to be live. */
    function isDeepUnderBar() {
      var PROBE = 28;
      var deep = document.querySelectorAll('[data-bar-ink="light"]');
      for (var i = 0; i < deep.length; i++) {
        var r = deep[i].getBoundingClientRect();
        if (r.top <= PROBE && r.bottom > PROBE) return true;
      }
      return false;
    }

    function syncHeader() {
      ticking = false;
      var y = window.scrollY;

      // No .is-stuck any more: the bar is transparent at every scroll
      // position. STUCK_AT survives only as the "still at the top" threshold
      // that keeps the bar pinned open near y=0.

      /* Ink inversion. The bar has no background, so its ink must match the
         section actually behind it at this scroll position.

         This used to test one thing — "has the hero scrolled past?" — and
         assumed everything below the hero was pale. It is not: .process,
         .cta-band and .site-footer are all deep navy, so past the hero the
         bar flipped to dark ink and the wordmark and hamburger rendered
         navy-on-navy. The test is now the REAL section under the bar. */
      header.classList.toggle('is-on-light', !isDeepUnderBar());

      var delta = y - lastY;
      if (Math.abs(delta) < MOTION_THRESHOLD) return;
      lastY = y;

      /* Hide WHILE scrolling, reappear once it STOPS.

         Not a direction test any more. The bar used to hide on scroll-down
         and return on scroll-up, which meant that scrolling down the page
         left the logo and the menu off screen for as long as the gesture
         continued — the control was unreachable without reversing first.

         Now any scroll motion in either direction clears the bar out of the
         way, and IDLE_MS after the last movement it comes back. The user
         gets unobstructed content while moving and a reachable menu the
         moment they settle, which is when they might actually want it. */
      if (isPinnedOpen()) {
        header.classList.remove('is-hidden');
      } else {
        header.classList.add('is-hidden');
      }

      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(function () {
        header.classList.remove('is-hidden');
      }, IDLE_MS);
    }

    /* Two states where the bar must never hide, even mid-scroll: at the very
       top of the page (the hero is never revealed with a missing brand), and
       while the overlay menu is open (the bar carries the close control). */
    function isPinnedOpen() {
      var toggle = document.getElementById('nav-toggle');
      var menuOpen = toggle && toggle.getAttribute('aria-expanded') === 'true';
      return window.scrollY <= STUCK_AT || menuOpen;
    }

    // rAF-throttled: the listener itself does no layout work.
    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(syncHeader);
      }
    }, { passive: true });

    /* Let the overlay menu (section 4) pin the bar open. The timer lives in
       this closure, so cancelling it needs a handle exposed from here. */
    window.__medshieldHeader = {
      show: function () {
        window.clearTimeout(idleTimer);
        header.classList.remove('is-hidden');
      }
    };

    syncHeader(); // correct on a reload that restores scroll position
  }

  /* --- 2. Hero entrance --------------------------------------------------- */

  /* The reveal is gated on the webfont, not on DOMContentLoaded. The headline
     is set at ~8.4vw in Rubik; revealing against the fallback face and then
     swapping would visibly reflow a 120px headline. .hero-anim is added
     immediately (hiding the elements), .hero-ready once the font has settled
     — and unconditionally after 900ms so a font failure can never leave the
     hero invisible. Neither class is in the HTML, so a no-JS or JS-error page
     renders the hero fully visible at its final state. */

  var root = document.documentElement;
  var heroEl = document.querySelector('.hero');

  if (heroEl) {
    root.classList.add('hero-anim');

    /* Annotation entrance start state, set inline because script owns these
       two transforms end to end (see applyAnnotations). Mirrors the
       reference's paragraph reveal: in from the right, scaled up. */
    var annoReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    var annoWide = window.matchMedia('(min-width: 860px)');
    if (!annoReduce.matches && annoWide.matches) {
      ['.hero__label-t', '.hero__note-t'].forEach(function (sel) {
        var el = document.querySelector(sel);
        if (!el) return;
        el.classList.add('is-entering');   // enables the 1.75s transition
        el.style.transform = 'translateX(100%) scale(0.5)';
      });
    }

    var revealed = false;
    function reveal() {
      if (revealed) return;
      revealed = true;
      // Two frames: one for .hero-anim to be committed as the start state,
      // the next to flip to .hero-ready so the transition actually runs
      // rather than being collapsed into a single style recalculation.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          root.classList.add('hero-ready');
          // Release the annotations to their resting position, then DROP the
          // transition once it has run. Leaving it live would keep a
          // CSSTransition on `transform` running, and that holds the element
          // at its interpolated value — overriding even an !important inline
          // transform and freezing the scroll fly-out.
          if (!annoReduce.matches && annoWide.matches) {
            ['.hero__label-t', '.hero__note-t'].forEach(function (sel) {
              var el = document.querySelector(sel);
              if (!el) return;
              el.style.transform = 'translateX(0%) scale(1)';
              window.setTimeout(function () {
                el.classList.remove('is-entering');
                el.style.transform = '';
              }, 1850);   // 1.75s duration + margin
            });
          }
        });
      });
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(reveal);
    }
    window.setTimeout(reveal, 900); // hard floor — never leave it hidden
  }

  /* --- 2b. Character split ------------------------------------------------ */

  /* A minimal SplitText equivalent — no GSAP, no dependency. Each row's text
     node is replaced by one <span class="hero__char"> per character so the
     scroll handler can move characters independently.

     Done in JS rather than in the markup on purpose: the H1 in the HTML stays
     one clean sentence for screen readers, crawlers and copy-paste, and the
     split simply never happens if script does not run. The wrapper is marked
     aria-hidden and the original text restored to an .visually-hidden node,
     so assistive tech reads the sentence once, not letter by letter. */

  var chars = [];   // { el, row, i, n } for every character
  var rowsEls = [];

  function splitRows() {
    var rows = document.querySelectorAll('.hero__row-t');
    if (!rows.length) return;

    // Capture the full sentence BEFORE splitting, so the accessible name is
    // always whatever the markup actually says.
    var srText = Array.prototype.map.call(rows, function (n) {
      return n.textContent.trim();
    }).join(' ').replace(/\s+/g, ' ').trim();

    Array.prototype.forEach.call(rows, function (node, rowIndex) {
      var text = node.textContent;
      // Spaces are kept as their own span (white-space: pre in CSS) so word
      // gaps survive the split intact.
      var frag = document.createDocumentFragment();
      var list = [];

      // Each character gets a MASK wrapper plus the character itself, which
      // is what SplitText's mask:"chars" produces. The mask clips; the inner
      // span slides in from the right. Without the wrapper the entrance is a
      // plain slide and looks nothing like the reference.
      for (var i = 0; i < text.length; i++) {
        var mask = document.createElement('span');
        mask.className = 'hero__cmask';

        var span = document.createElement('span');
        span.className = 'hero__char';
        span.textContent = text.charAt(i);

        mask.appendChild(span);
        frag.appendChild(mask);
        list.push(span);
      }

      node.textContent = '';
      node.appendChild(frag);
      // aria-hidden must go on the ROW, not on this inner node: hiding only
      // the inner node still leaves the row exposed, and the H1's accessible
      // name ends up containing the sentence twice. The .visually-hidden copy
      // added below is the single source of the name.
      var row = node.parentNode;
      (row && row.classList.contains('hero__row') ? row : node)
        .setAttribute('aria-hidden', 'true');

      rowsEls.push(node);

      /* Entrance stagger, matching the reference exactly:
           stagger { each: .125 } per character,
           and each ROW starting .1s after the previous one ("<.1").

         The reference's stagger is per-character-each, so a long row takes
         proportionally longer. At MedShield's row lengths (9-12 chars) a
         literal .125 each would run 1.5s of stagger on top of a 1.5s
         duration, so the TOTAL per-row stagger is capped and distributed —
         the visual cadence is preserved without the last character of a row
         arriving three seconds late. */
      var ROW_OFFSET = 0.1;                        // reference "<.1"
      var perChar = Math.min(0.125, 0.6 / Math.max(1, list.length - 1));

      list.forEach(function (el, i) {
        el.style.transitionDelay = (rowIndex * ROW_OFFSET + i * perChar).toFixed(3) + 's';
        chars.push({ el: el, row: rowIndex, i: i, n: list.length });
      });
    });

    /* One clean, uncut copy of the sentence for assistive technology.

       Built by READING the rows rather than hardcoding a string: a literal
       here silently goes stale the moment the headline copy changes, and the
       failure is invisible to sighted testing — the page shows one sentence
       while screen readers announce the previous one. Collected before the
       rows were split, so it is the original text, in order. */
    var h1 = document.querySelector('.hero__display');
    if (h1 && !h1.querySelector('.hero__sr') && srText) {
      var sr = document.createElement('span');
      sr.className = 'hero__sr visually-hidden';
      sr.textContent = srText;
      h1.insertBefore(sr, h1.firstChild);
    }
  }

  // Split only once the font is settled: splitting against the fallback face
  // and then swapping would measure and lay out every character twice.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(splitRows);
  } else {
    splitRows();
  }
  window.setTimeout(function () { if (!chars.length) splitRows(); }, 900);

  /* --- 3. Hero video + scroll progress ------------------------------------ */

  /* The video AUTOPLAYS and loops on its own clock. It is no longer scrubbed
     by scroll position — playback is independent of the scrollbar, so the
     ocean keeps moving while the user reads.

     Scroll still drives --hero-progress, which powers the headline's
     horizontal exit, the annotations and the scrim fade. Those are unchanged;
     only the video's relationship to scroll has been removed. */

  var video = document.getElementById('hero-video');
  var videoB = document.getElementById('hero-video-b');

  if (heroEl) {
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var wideEnough = window.matchMedia('(min-width: 860px)');
    var source = video ? video.querySelector('source') : null;
    var sourceB = videoB ? videoB.querySelector('source') : null;

    // Two independent reasons to stay on the poster:
    //   - narrow viewport: the video is desktop dressing, not content, and
    //     mobile data should never pay 15MB for it
    //   - reduced-motion: an explicit request for no movement, and an
    //     autoplaying loop is exactly the kind of motion that request means
    // The <source> carries data-src rather than src, so in either case the
    // bytes are never requested at all — not requested-then-cancelled.
    function videoWanted() {
      return !!video && wideEnough.matches && !reduceMotion.matches;
    }

    /* Crossfade loop.
       Native `loop` cuts hard to frame 0 the instant playback reaches the
       end — visible as a jump whenever the source's last frame doesn't
       match its first. Instead: two copies of the same clip stacked in the
       same box (see .hero__video in CSS). The back copy is pre-rolled from
       t=0 and faded IN while the front copy is faded OUT over its last
       CROSSFADE_S seconds, then the roles swap. The dissolve hides the seam
       regardless of how the two endpoints actually match up. */
    var CROSSFADE_S = 0.6;
    var swapping = false;

    // The other of the pair — video/videoB only ever swap opacity roles via
    // .is-active, never identity, so this stays a fixed lookup.
    function other(el) { return el === video ? videoB : video; }

    function armLoop(el) {
      if (!el) return;
      el.addEventListener('timeupdate', function () {
        if (swapping || !el.duration || isNaN(el.duration)) return;
        if (el.duration - el.currentTime > CROSSFADE_S) return;
        swapping = true;

        var incoming = other(el);
        if (incoming) {
          incoming.currentTime = 0;
          var attempt = incoming.play();
          if (attempt && typeof attempt.catch === 'function') {
            attempt.catch(function () { /* poster stands in */ });
          }
          incoming.classList.add('is-active');
        }
        el.classList.remove('is-active');

        window.setTimeout(function () {
          el.pause();
          el.currentTime = 0;
          swapping = false;
        }, CROSSFADE_S * 1000);
      });
    }
    armLoop(video);
    armLoop(videoB);

    function enableVideo() {
      if (!source || source.hasAttribute('src')) return;
      source.setAttribute('src', source.getAttribute('data-src'));
      if (sourceB) sourceB.setAttribute('src', sourceB.getAttribute('data-src'));
      // Set muted on the element too, not just the attribute: some engines
      // refuse autoplay unless the property is known-true at play() time.
      // This encode carries an audio track, so it genuinely matters here.
      video.muted = true;
      video.load();
      if (videoB) { videoB.muted = true; videoB.load(); }

      var attempt = video.play();
      if (attempt && typeof attempt.catch === 'function') {
        // A rejected autoplay promise is not an error worth surfacing: the
        // poster is a real frame of this video, so the fallback is the design.
        attempt.catch(function () { /* poster stands in */ });
      }
    }

    /* Normalised hero progress.
       0 while the hero is fully in view; 1 once it has completely left.
       Tied to the hero's real position so it stays correct if anything is
       ever inserted above it. */
    function progress() {
      var span = heroEl.offsetHeight;
      if (!span) return 0;
      var p = 1 - (heroEl.getBoundingClientRect().bottom / span);
      return p < 0 ? 0 : p > 1 ? 1 : p;
    }

    var lastProgress = -1;

    /* The two annotations' transform is written here rather than in CSS.

       Each combines a load-time reveal offset (in from the right, scaled up —
       the reference's xPercent:100, scale:.5) with the scroll-driven
       horizontal fly-out (-125% left, +300% right, its exact values). Every
       CSS expression of that combination resolved to an invalid transform in
       Chromium, so script owns it. */
    var labelT = document.querySelector('.hero__label-t');
    var noteT  = document.querySelector('.hero__note-t');
    var annotationsWide = window.matchMedia('(min-width: 860px)');

    // Writes an X offset, cancelling any transition still interpolating this
    // element's transform. A live CSSTransition holds the element at its own
    // value and overrides even !important inline styles.
    function setX(el, pct) {
      if (!el) return;
      if (typeof el.getAnimations === 'function') {
        el.getAnimations().forEach(function (a) {
          if (a.transitionProperty === 'transform') a.cancel();
        });
      }
      el.classList.remove('is-entering');
      el.style.transform = 'translateX(' + pct.toFixed(2) + '%)';
    }

    function applyAnnotations(p) {
      if (!annotationsWide.matches || reduceMotion.matches) {
        if (labelT) labelT.style.transform = '';
        if (noteT)  noteT.style.transform  = '';
        return;
      }
      // -125% / +300%: the reference's paragraph exit values verbatim.
      setX(labelT, p * -125);
      setX(noteT,  p *  300);
    }

    function onScroll() {
      var p = progress();
      if (p === lastProgress) return;
      lastProgress = p;

      // Drives the CSS exit motion (headline rows, rail, media, scrim).
      root.style.setProperty('--hero-progress', p.toFixed(4));

      // The annotations are driven directly — see applyAnnotations.
      applyAnnotations(p);
    }

    var scrollQueued = false;
    function onScrollRaf() {
      if (scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(function () {
        scrollQueued = false;
        onScroll();
      });
    }

    function syncVideo() {
      if (videoWanted()) {
        enableVideo();
      } else {
        if (video) video.pause();
        if (videoB) videoB.pause();
      }
      onScroll();
    }

    window.addEventListener('scroll', onScrollRaf, { passive: true });
    window.addEventListener('resize', onScrollRaf, { passive: true });

    syncVideo();

    // Re-evaluate if the user changes the preference or resizes across the
    // breakpoint. Only ever adds the source; never re-downloads.
    [reduceMotion, wideEnough].forEach(function (mq) {
      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', syncVideo);
      }
    });
  }

  /* --- 3b. Smooth scroll -------------------------------------------------- */

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

    var WHEEL_MULTIPLIER = 0.75;   // reference value
    var DURATION = 1.25;           // reference value, seconds
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

      // Frame-rate independent exponential approach. lambda is chosen so the
      // remaining distance decays by 1/e over DURATION seconds.
      var lambda = 1 / DURATION;
      var alpha = 1 - Math.exp(-lambda * dt * 6);
      sPos += (sTarget - sPos) * alpha;

      if (Math.abs(sTarget - sPos) < 0.4) {
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

      if (!sRunning) { sPos = window.scrollY; frame.last = 0; }
      sTarget = Math.max(0, Math.min(maxScroll(), sTarget + delta * WHEEL_MULTIPLIER));

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
    window.__medshieldScroll = {
      stop: function () { sRunning = false; sTarget = window.scrollY; sPos = sTarget; },
      start: function () { sTarget = window.scrollY; sPos = sTarget; }
    };
  }

  /* --- 4. Mobile nav drawer ---------------------------------------------- */

  var toggle = document.getElementById('nav-toggle');
  var nav = document.getElementById('site-nav');
  var scrim = document.getElementById('nav-scrim');

  if (toggle && nav && scrim) {
    var FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
    var lastFocused = null;

    function isOpen() {
      return toggle.getAttribute('aria-expanded') === 'true';
    }

    function openNav() {
      lastFocused = document.activeElement;
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Close menu');

      /* Force the bar visible and cancel any pending hide.

         The menu can be opened while the bar is mid-hide from a scroll that
         has not yet gone idle, and openNav sets body overflow:hidden — which
         stops further scroll events, so the idle timer that would normally
         bring the bar back never gets rearmed. Without this the overlay
         opens with its own close control slid off screen. */
      if (window.__medshieldHeader) window.__medshieldHeader.show();

      // hidden must come off BEFORE the class: a display:none element cannot
      // transition, and cannot take focus.
      nav.hidden = false;
      scrim.hidden = false;
      document.body.style.overflow = 'hidden';
      // Freeze the smooth-scroll engine behind the overlay, as the reference
      // calls lenis.stop() on open.
      if (window.__medshieldScroll) window.__medshieldScroll.stop();

      // Next frame, so the browser has a painted "closed" state to animate
      // away from rather than collapsing both states into one recalc.
      window.requestAnimationFrame(function () {
        nav.classList.add('is-open');
      });

      var first = nav.querySelector(FOCUSABLE);
      if (first) first.focus();

      document.addEventListener('keydown', onKeydown);
    }

    function closeNav() {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
      nav.classList.remove('is-open');
      scrim.hidden = true;
      document.body.style.overflow = '';
      // Re-seed and resume — the reference's lenis.start().
      if (window.__medshieldScroll) window.__medshieldScroll.start();

      document.removeEventListener('keydown', onKeydown);

      // Wait for the fade before removing it from the a11y tree, so the
      // transition is actually seen. Cut short under reduced motion, where
      // there is no transition to wait for.
      var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.setTimeout(function () {
        if (toggle.getAttribute('aria-expanded') !== 'true') nav.hidden = true;
      }, reduced ? 0 : 1000);

      // Return focus where the user left it, not to the top of the page.
      if (lastFocused && typeof lastFocused.focus === 'function') {
        lastFocused.focus();
      }
    }

    function onKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeNav();
        return;
      }

      if (event.key !== 'Tab') return;

      // Focus trap. The toggle is the close control and sits BEFORE the nav
      // in the DOM, so it leads the cycle — appending it instead would let
      // Tab escape into browser chrome from the last link.
      var items = [toggle].concat(
        Array.prototype.slice.call(nav.querySelectorAll(FOCUSABLE))
      ).filter(function (el) {
        return el.offsetParent !== null || el === toggle;
      });
      if (!items.length) return;

      var first = items[0];
      var last = items[items.length - 1];
      var active = document.activeElement;

      // If focus has slipped outside the drawer entirely, pull it back.
      if (items.indexOf(active) === -1) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    toggle.addEventListener('click', function () {
      if (isOpen()) { closeNav(); } else { openNav(); }
    });

    scrim.addEventListener('click', closeNav);

    // Following a link should close the drawer behind it.
    nav.addEventListener('click', function (event) {
      if (event.target.closest('a') && isOpen()) closeNav();
    });

    // NOTE: there is deliberately no "close on resize to desktop" handler any
    // more. The overlay is now the only route to the navigation at EVERY
    // width, so closing it on a resize past 860px would dismiss the menu the
    // user is actively reading rather than tidying up a mobile-only drawer.
  }

  /* --- 5. Scroll reveal --------------------------------------------------- */

  /* The reference drives its section entrances with GSAP ScrollTrigger. This
     is the same behaviour on an IntersectionObserver: elements animate once,
     as they enter, and are then unobserved so scrolling back up never replays
     them (ScrollTrigger's `once: true`).

     Fail-visible, like the hero: the start states live behind .reveal-on,
     which is added HERE. If this script never runs, throws earlier, or the
     user asked for reduced motion, the class is absent and every element
     renders at its final state. Nothing is hidden by the markup itself.

     Three authoring hooks, all opt-in from the HTML:
       [data-reveal]          fade up
       [data-reveal-line]     mask + slide (its text is wrapped here)
       [data-reveal-stagger]  container; its [data-reveal-item] children get
                              an increasing --reveal-delay and reveal together */

  var revealReduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  if ('IntersectionObserver' in window && !revealReduce.matches) {
    root.classList.add('reveal-on');

    /* ---- Splitting ------------------------------------------------------

       A minimal SplitText equivalent, as in section 2b. Two modes, matching
       the two the reference uses:

         splitChars  -> setTitles      (.title.--fill)
         splitWords  -> setDescriptions (.wysiwyg)

       Both are done in JS, not markup, for the same reason as the hero: the
       source stays one clean sentence for screen readers, crawlers and
       copy-paste, and no split happens at all if script does not run. Each
       split container is marked aria-hidden with one visually-hidden copy of
       the original text restored alongside, so assistive tech reads the
       sentence once rather than word by word. */

    function addSrCopy(host, text) {
      if (!text || host.querySelector('.reveal__sr')) return;
      var sr = document.createElement('span');
      sr.className = 'reveal__sr visually-hidden';
      sr.textContent = text;
      host.insertBefore(sr, host.firstChild);
    }

    // Splits every text node under `host` into spans of `cls`, preserving
    // spaces as their own nodes so word gaps and wrapping survive intact.
    function split(host, cls, byWord) {
      var walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, null);
      var nodes = [];
      var n;
      while ((n = walker.nextNode())) {
        if (n.nodeValue.trim()) nodes.push(n);
      }

      var out = [];
      nodes.forEach(function (node) {
        // Split to words or to characters. The word regex keeps the
        // whitespace runs as captured pieces rather than discarding them.
        var pieces = byWord
          ? node.nodeValue.split(/(\s+)/)
          : node.nodeValue.split('');
        var frag = document.createDocumentFragment();

        pieces.forEach(function (piece) {
          if (!piece) return;
          if (/^\s+$/.test(piece)) {
            frag.appendChild(document.createTextNode(piece));
            return;
          }
          var s = document.createElement('span');
          s.className = cls;
          s.textContent = piece;
          frag.appendChild(s);
          out.push(s);
        });

        node.parentNode.replaceChild(frag, node);
      });
      return out;
    }

    /* ---- setTitles: scrubbed character brightening ----------------------

       Reference values, verbatim:
         opacity .05 -> 1, ease "none", stagger .02, duration .2,
         scrollTrigger { start: "top 90%", end: "bottom 60%", scrub: true }

       ScrollTrigger's start/end map to a progress ramp: 0 when the element's
       top is at 90% of viewport height, 1 when its bottom reaches 60%. With
       `scrub`, progress follows the scrollbar in BOTH directions — so this is
       recomputed on every scroll frame rather than latched once.

       Per-character timing reproduces GSAP's stagger+duration on a normalised
       timeline: with stagger .02 and duration .2, character i starts at
       i*.02 and finishes .2 later, over a total of (n-1)*.02 + .2. */

    var titles = [];
    Array.prototype.forEach.call(
      document.querySelectorAll('[data-scrub-title]'),
      function (el) {
        var text = el.textContent.replace(/\s+/g, ' ').trim();
        var chars = split(el, 'reveal__char', false);
        if (!chars.length) return;
        chars.forEach(function (c) { c.setAttribute('data-scrub-char', ''); });
        el.setAttribute('aria-hidden', 'true');
        // The <h2> itself hosts the accessible copy, not the split element.
        addSrCopy(el.closest('h1, h2, h3, p') || el, text);

        var STAGGER = 0.02, DURATION = 0.2;
        var total = (chars.length - 1) * STAGGER + DURATION;
        titles.push({ el: el, chars: chars, stagger: STAGGER, dur: DURATION, total: total });
      }
    );

    function scrubTitles() {
      if (!titles.length) return;
      var vh = window.innerHeight;
      titles.forEach(function (t) {
        var r = t.el.getBoundingClientRect();
        // start "top 90%" -> end "bottom 60%", exactly as configured.
        var startY = vh * 0.9;
        var endY = vh * 0.6;
        var span = (r.top - startY) - (r.bottom - endY);
        var p = span === 0 ? 1 : (r.top - startY) / span;
        p = p < 0 ? 0 : p > 1 ? 1 : p;

        var head = p * t.total;
        for (var i = 0; i < t.chars.length; i++) {
          var local = (head - i * t.stagger) / t.dur;   // 0..1 for this char
          local = local < 0 ? 0 : local > 1 ? 1 : local;
          // ease "none" — strictly linear, so opacity IS the progress.
          var o = 0.05 + local * 0.95;
          var c = t.chars[i];
          // Only touch the DOM when the value actually changes; a 200-char
          // headline otherwise writes 200 styles every frame.
          if (c.__o !== o) {
            c.__o = o;
            c.style.opacity = o.toFixed(3);
          }
        }
      });
    }

    /* ---- setDescriptions: word wipe, once -------------------------------

       Reference values, verbatim:
         from { y: "100%", clipPath: "inset(0% 0% 100% 0%)" }
         to   { y: "0%",   clipPath: "inset(0% 0% 0% 0%)",
                ease: "expo.out", duration: 1, stagger: .01 }
         ScrollTrigger { start: "top 90%", once: true } */

    Array.prototype.forEach.call(
      document.querySelectorAll('[data-word-reveal]'),
      function (host) {
        var text = host.textContent.replace(/\s+/g, ' ').trim();
        var words = split(host, 'reveal__word', true);
        if (!words.length) return;
        words.forEach(function (w, i) {
          w.setAttribute('data-word', '');
          w.style.setProperty('--reveal-delay', (i * 0.01).toFixed(3) + 's');
        });
        host.setAttribute('aria-hidden', 'true');
        addSrCopy(host.parentNode || host, text);
      }
    );

    /* ---- Observers ------------------------------------------------------ */

    /* ---- setItems: the magnet cards -------------------------------------

       Reference values, verbatim (app.min.js, setItems @138527 — the class
       that actually runs on their homepage: it also calls eval_initWebg and
       owns the hero->gridnumbers WebGL trigger):
         from { y: appStore.px(60), scale: .96, opacity: .0001 }
         to   { y: 0, scale: 1, opacity: 1,
                ease: "expo.out", duration: 1.2,
                delay: .00025 * el.getBoundingClientRect().left }

       px(t) = t/2400 * innerWidth, so px(60) is 2.5vw — viewport-relative,
       not a fixed 60px. The distance and duration live in the CSS transition
       on [data-magnet]; this block owns only the delay.

       The delay comes from the card's HORIZONTAL position, not its index, so
       the reveal sweeps across the viewport and the two offset rows
       interleave. Measured once, on first layout, and re-measured on resize
       for any card that has not yet fired. */

    var magnets = Array.prototype.slice.call(
      document.querySelectorAll('[data-magnet]')
    );

    function measureMagnets() {
      magnets.forEach(function (el) {
        if (el.classList.contains('is-in')) return;   // already committed
        var left = el.getBoundingClientRect().left + window.scrollX;
        el.style.setProperty('--reveal-delay', (0.00025 * left).toFixed(3) + 's');
      });
    }
    measureMagnets();
    window.addEventListener('resize', measureMagnets, { passive: true });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);   // ScrollTrigger once:true
      });
    }, {
      // start "top 90%" — fire when the element's top passes 90% of the
      // viewport, i.e. a 10% inset from the bottom edge.
      rootMargin: '0px 0px -10% 0px',
      threshold: 0
    });

    Array.prototype.forEach.call(
      document.querySelectorAll('[data-reveal], [data-word]'),
      function (el) { io.observe(el); }
    );

    /* The magnet cards use their own observer: the reference triggers them at
       start "top bottom" — the instant the card's top crosses the bottom edge
       — which is earlier than the "top 90%" used for text. */
    if (magnets.length) {
      var ioMagnet = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          ioMagnet.unobserve(entry.target);
        });
      }, { rootMargin: '0px', threshold: 0 });

      magnets.forEach(function (el) { ioMagnet.observe(el); });
    }

    /* ---- setParallax: the stats column drift ----------------------------

       The reference's gridnumbers component (class Os):

         timeline({ defaults: { ease: "none" },
           scrollTrigger: { trigger: .content-0,
                            start: "top bottom", end: "bottom top",
                            scrub: true } })
           .to(.content-1, { y: px(-480), ease: "none", duration: 1 }, 0)

       The trigger is .content-0 (the FIRST stat column) and the target is
       .content-1 (the SECOND, side-by-side column), which rests 10vw lower.
       As the first column crosses the viewport — top touching the bottom
       edge through to its bottom passing the top — the second travels
       upward, closing that gap. ease "none" + scrub means the offset is
       strictly linear in scroll position, and reverses on scroll-up.

       Desktop only, exactly as their set() gates it:
         this.$text && this.appStore.isDesktop && this.setParallax()
       Below 1020px our two columns stack into one vertical run (matching
       their own <1100px collapse), and a parallax there would just look
       like a layout bug. */

    var parallaxEl = document.querySelector('[data-parallax]');
    var parallaxTrigger = document.querySelector('[data-parallax-trigger]');
    var parallaxWide = window.matchMedia('(min-width: 1020px)');

    /* Their literal value is px(-480) — on their 2400px design width that is
       exactly -20vw, and their .content-1 sits 10vw lower to begin with. So
       the second column travels up by twice its own head start: it closes the
       gap and carries on past it, ending 10vw ABOVE flush.

       We take the distance from the gap the layout actually has, so the CSS
       clamp on .proof__col--1's margin-top stays the single source of truth
       and the two can never disagree. Same 2x relationship as theirs. */
    var PARALLAX_GAP_FACTOR = 2;

    function parallaxDistance() {
      // The resting margin-top of the travelling group, read back from layout
      // rather than duplicated here.
      var gap = parseFloat(
        getComputedStyle(parallaxEl).marginTop
      ) || 0;
      return -(gap * PARALLAX_GAP_FACTOR);
    }

    function applyParallax() {
      if (!parallaxEl || !parallaxTrigger) return;

      if (!parallaxWide.matches) {
        parallaxEl.style.setProperty('--parallax-y', '0px');
        return;
      }

      var r = parallaxTrigger.getBoundingClientRect();
      var vh = window.innerHeight;
      // start "top bottom" -> p=0 when the trigger's top is at the viewport
      // bottom; end "bottom top" -> p=1 when its bottom reaches the top.
      var span = r.height + vh;
      var p = span === 0 ? 0 : (vh - r.top) / span;
      p = p < 0 ? 0 : p > 1 ? 1 : p;

      parallaxEl.style.setProperty(
        '--parallax-y', (p * parallaxDistance()).toFixed(1) + 'px'
      );
    }

    /* The scrub runs on the same rAF-throttled scroll pattern as the hero.
       Titles are excluded from the observer entirely — they are position
       driven, not event driven. */
    if (titles.length || parallaxEl) {
      var scrubQueued = false;
      function runScrubs() {
        scrubTitles();
        applyParallax();
      }
      function onScrubScroll() {
        if (scrubQueued) return;
        scrubQueued = true;
        requestAnimationFrame(function () {
          scrubQueued = false;
          runScrubs();
        });
      }
      window.addEventListener('scroll', onScrubScroll, { passive: true });
      window.addEventListener('resize', onScrubScroll, { passive: true });
      // Correct on load and on a reload that restores a scroll position.
      runScrubs();
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(runScrubs);
      }
    }
  }
})();

/* ===========================================================================
   6. Theme ground — one painted element, one trigger line
   ===========================================================================

   The page's background colour is carried by ONE element, <main>, and never
   by the sections themselves. Each section that wants to own the ground
   declares a palette token:

     <section data-theme-ground="--accent-on-deep" data-theme-tier="brand">

   An IntersectionObserver whose rootMargin collapses the viewport to a
   single horizontal trigger line. A section only "intersects" while it
   straddles that line, so exactly one section owns the ground at any moment
   and the handoff happens at one precise scroll position. All of the
   smoothness comes from a single CSS rule — see `main` in style.css — not
   from a scroll-scrubbed value.

   WHERE THE LINE SITS. The reference puts it at 70% down the screen. Ours
   is at 92% (see TRIGGER_LINE below), which is near enough the bottom edge
   that a section owns the ground only once it has almost entirely left the
   viewport. That is what keeps the stats columns out of it: at 70% the
   ground flipped to the band's colour while three rows of stat boxes were
   still on screen, so the columns appeared to sit on the new ground. At 92%
   the stats strip has scrolled away before .positioning claims the ground,
   and the change happens against the gap between them.

   This structure is the whole point, and it is what two earlier attempts
   here got wrong. Painting the sections individually (first as a step, then
   as a scroll-scrubbed gradient fill climbing the stats strip) always
   leaves a real boundary between two differently coloured sections, and
   always reads as two staged changes: the stats section arriving at its
   colour, and only afterwards the positioning band arriving at its own.
   With one painted element there is no boundary in existence to see, and no
   second stage to sequence — the change is single and continuous by
   construction. It is also a fraction of the machinery.

   A consequence worth stating, because it was an explicit requirement: the
   stat cards, their figures, labels and rules do NOT change colour as the
   ground moves beneath them. Only <main> animates. The cards keep their own
   --surface-raised ground and on-light text throughout.

   Deliberately OUTSIDE the reduced-motion gate that wraps the reveal and
   scrub systems above. Reduced motion should suppress movement, not colour:
   if the ground never changed, .positioning's brand text tier would sit
   over the light page ground and fail contrast outright. Under reduced
   motion the ground still changes, the CSS transition is simply dropped
   (see the prefers-reduced-motion block beside `main` in style.css), so it
   cuts rather than eases. */
(function () {
  /* Position of the trigger line as a percentage down the viewport. The
     rootMargin below is derived from it, so this is the single number to
     move if the handoff should happen earlier or later. Raising it delays
     the change (a section must scroll further before it owns the ground);
     lowering it makes the change happen while more of the section is still
     visible. */
  var TRIGGER_LINE = 92;

  var main = document.querySelector('main');
  var targets = Array.prototype.slice.call(
    document.querySelectorAll('[data-theme-ground]')
  );
  if (!main || !targets.length || !('IntersectionObserver' in window)) return;

  /* Resolve each declared token to a real colour once, up front. The
     attribute names a custom property rather than carrying a hex, so the
     palette stays defined in one place — the stylesheet. A token that does
     not resolve is left null and skipped at paint time, so a typo drops
     that one section's handoff instead of painting the page an empty
     string. */
  var rootStyles = getComputedStyle(document.documentElement);
  targets.forEach(function (el) {
    var token = (el.getAttribute('data-theme-ground') || '').trim();
    var value = token ? rootStyles.getPropertyValue(token).trim() : '';
    el.__themeGround = value || null;
    el.__themeTier = el.getAttribute('data-theme-tier') || 'light';
  });


  /* ---- Guarded handoff -------------------------------------------------

     A section can name elements that must be clear of the screen before it
     is allowed to take the ground:

       <section data-theme-ground="..." data-theme-guard=".proof__item">

     This exists because a trigger line alone is not sufficient here. The
     line fires off the section's LAYOUT rect, but the stats strip's second
     column carries a 10vw top margin that the parallax closes by
     translating the column UPWARD — so the cards it contains are drawn well
     outside where the section's box says they are, and one column sits
     lower than the other by design. The result was the reported bug: the
     ground turned brand blue while opaque white cards were still on screen,
     leaving them floating as bright rectangles with a ragged, staggered
     edge because the two columns are offset.

     Measuring the guarded elements directly solves that at the source. It
     reads their real painted position — transform included, since
     getBoundingClientRect reflects it — so the boundary sits at whatever is
     actually visible rather than at a box that no longer describes it.

     SYMMETRY. The guard is not a veto on one section painting; it is the
     position of the BOUNDARY itself, and both sections read it the same
     way. A veto was the first thing tried here and it made the ground
     change at two different scroll positions — late going down (waiting for
     the cards to clear) but at the trigger line coming back up, because
     nothing held the section above from reclaiming the ground early.
     Mirroring the veto onto that section was worse still: .proof would then
     be blocked by its own cards, so scrolling up through the stats strip
     left the ground stuck on the brand colour for the whole section.

     Instead: while any guarded element is on screen, the ground belongs to
     the section ABOVE the boundary; once they are all clear of the top
     edge, it belongs to the section BELOW. One predicate, evaluated the
     same in both directions, so the switch lands on the same scroll
     position whichever way you are going.

     The stats cards therefore never change colour and are never seen on the
     new ground; the change happens in the empty gap once the lowest card
     has left the viewport. */
  var GUARD_MARGIN = 8; // px of clearance below the lowest guarded element

  /* True once every guarded element is clear of the viewport's top edge.
     Document-scoped: the elements belong to the section above the boundary,
     which is exactly the content that must not be caught mid-change. */
  function guardsClear(sel) {
    var guarded = document.querySelectorAll(sel);
    for (var i = 0; i < guarded.length; i++) {
      var r = guarded[i].getBoundingClientRect();
      // Ignore anything with no box (hidden, or collapsed at this
      // breakpoint) — it cannot be visibly caught by the change.
      if (r.width === 0 && r.height === 0) continue;
      if (r.bottom > -GUARD_MARGIN) return false;
    }
    return true;
  }

  /* Resolves which section should own the ground, given the one the trigger
     line currently points at. If that section declares a guard and the
     guard is not yet clear, the ground stays with the section above it —
     the same answer the upward scroll produces at that position, which is
     what makes the boundary a single place rather than two. */
  function resolve(section) {
    var sel = section.getAttribute('data-theme-guard');
    if (!sel || guardsClear(sel)) return section;
    var i = targets.indexOf(section);
    return i > 0 ? targets[i - 1] : section;
  }


  function paint(section) {
    if (!section || !section.__themeGround) return;
    main.style.backgroundColor = section.__themeGround;
    // Drives the text tiers in CSS (main[data-theme="..."]), so the tier
    // and the ground are one change on one element.
    main.setAttribute('data-theme', section.__themeTier);
  }

  /* The section the trigger line currently points at, held so a scroll that
     clears the guards can re-resolve the boundary. The observer does not
     fire again once a section has stopped crossing the line, so without
     this the deferred half of the handoff would never land. */
  var current = null;

  function tryPaint(section) {
    current = section;
    paint(resolve(section));
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) tryPaint(entry.target);
      });
    },
    // Top and bottom insets sum to 100%, which is what collapses the
    // viewport to a zero-height band — the trigger line itself.
    { rootMargin: '-' + TRIGGER_LINE + '% 0% -' + (100 - TRIGGER_LINE) + '% 0%' }
  );

  targets.forEach(function (el) { observer.observe(el); });

  /* Re-resolve the boundary as the guarded elements move. The observer only
     fires when a section crosses the trigger line, but a guarded boundary
     also moves when the guards themselves scroll clear — that is the second
     half of the handoff, and without this it would never land.

     rAF-throttled on the same passive-listener pattern as the rest of the
     file, and only does work while a guarded section is the current one. */
  var queued = false;
  window.addEventListener('scroll', function () {
    if (!current || queued || !current.getAttribute('data-theme-guard')) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      if (current) paint(resolve(current));
    });
  }, { passive: true });
})();
