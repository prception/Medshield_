/* ==========================================================================
   SERVICES — hero motion
   ==========================================================================
   Reproduces the reference hero (rioproperty.co.za/services) with the
   libraries this repo actually ships. Two behaviours:

     data-anim-load="…"   an entrance timeline that runs once, on load
     data-parallax        a scrubbed transform tied to scroll position

   The reference drives these off GSAP's SplitText plugin. SplitText is a
   paid Club GSAP plugin we hold no licence for and cannot ship, so the
   character and line splitting here is hand-rolled below. It reproduces the
   two behaviours the hero actually depends on — per-character spans, and
   per-VISUAL-line masks — and nothing else.

   Reference timings, matched deliberately rather than approximated:
     chars   xPercent 100 -> 0   1.5s  expo.out  stagger 0.125
     lines   yPercent 125 -> 0   2.0s  expo.out  stagger 0.1
     bg      scale 1.08 -> 1     1.8s  expo.out   + scrubbed 0 -> 20 yPercent

   PROGRESSIVE ENHANCEMENT CONTRACT
   The hidden-state CSS in services-hero.css is gated behind
   html.svc-hero-anim. That class is added by a tiny inline script in the
   HEAD of services.html — it has to run before first paint, which a defer'd
   file like this one cannot do — and it is REMOVED here the moment this file
   decides not to animate (GSAP missing, no hero on the page, reduce-motion).

   So the failure modes all land safely:
     - no JS at all         -> class never added, nothing hidden
     - JS but no GSAP       -> class removed below, nothing stays hidden
     - reduce-motion        -> class never added, and removed again here
     - this file throws     -> see the try/catch around the run, which
                               unhides everything before rethrowing
   The one state we must never reach is "hidden and never revealed", so
   every early return below is preceded by reveal().
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;

  /* Drop the head script's gate, unhiding everything the CSS was holding
     back. Called before every early return and from the catch below. */
  function reveal() { root.classList.remove('svc-hero-anim'); }

  var section = document.querySelector('[data-hero-svc]');
  if (!section) { reveal(); return; }

  var reduced = window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----------------------------------------------------------------------
     ACCORDION
     ----------------------------------------------------------------------
     Open/close is done entirely in CSS (grid-template-rows 0fr -> 1fr); all
     this does is flip the data attribute the stylesheet keys off, and keep
     aria-expanded in step so the state is announced, not merely shown.

     Deliberately NOT dependent on GSAP: it is a disclosure control, and it
     must keep working even if the animation library failed to load. It is
     wired up outside the GSAP guard for that reason. */

  function accordion() {
    document.querySelectorAll('[data-accordion-close-siblings]').forEach(function (wrap) {
      var closeSiblings = wrap.getAttribute('data-accordion-close-siblings') === 'true';

      function open(item) {
        setState(item, true);
        if (closeSiblings) {
          wrap.querySelectorAll('[data-accordion-status="active"]').forEach(function (other) {
            if (other !== item) setState(other, false);
          });
        }
      }

      wrap.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-accordion-toggle]');
        if (!btn || !wrap.contains(btn)) return;

        var item = btn.closest('[data-accordion-status]');
        if (!item) return;

        /* Whether this row counts as "already open" has to ignore an open
           that HOVER performed. Otherwise clicking the row the pointer is
           necessarily sitting on reads as a close, and the row the reader
           just clicked collapses under them.

           So: the first click after a hover-open PINS the row (it stays
           open); only a second click on an already-pinned row closes it. */
        var isOpen = item.getAttribute('data-accordion-status') === 'active';
        if (isOpen && pinned) setState(item, false);
        else open(item);

        /* A click is an explicit choice: from here on, pointer movement must
           not silently undo it. */
        pinned = true;
      });

      /* --- Hover to reveal ------------------------------------------------
         On a mouse, moving over a row opens it, so the six descriptions can
         be read by sweeping down the list rather than clicking six times.

         Three constraints this has to respect:
           - only for a real mouse. On touch, hover fires as a side effect of
             tapping and would fight the click handler, so it is gated behind
             a fine-pointer / hover-capable query.
           - keyboard focus does the same thing, so tabbing through the rows
             reveals the same content a mouse would.
           - once a row has been CLICKED, hover stops taking over: the reader
             has made a deliberate choice and it should stand until they
             click again. `pinned` tracks that. */
      var pinned = false;
      var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

      if (canHover) {
        wrap.querySelectorAll('[data-accordion-status]').forEach(function (item) {
          item.addEventListener('mouseenter', function () {
            if (pinned) return;
            open(item);
          });
          /* Focus follows the same rule, so the keyboard path matches the
             mouse path. Tab moves focus to the row button. */
          var btn = item.querySelector('[data-accordion-toggle]');
          if (btn) {
            btn.addEventListener('focus', function () {
              if (pinned) return;
              open(item);
            });
          }
        });

        /* Leaving the list entirely releases the pin, so the next sweep
           through behaves like the first. */
        wrap.addEventListener('mouseleave', function () { pinned = false; });
      }
    });
  }

  function setState(item, open) {
    item.setAttribute('data-accordion-status', open ? 'active' : 'not-active');
    var btn = item.querySelector('[data-accordion-toggle]');
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  /* ----------------------------------------------------------------------
     PROCESS — auto-advancing step pairs
     ----------------------------------------------------------------------
     Eight steps shown two at a time across four slides, advancing on their
     own. Deliberately CSS-driven: this only moves an `is-active` class, and
     the stylesheet does the cross-fade. That keeps it working with no GSAP
     and under reduced motion, where the transition shortens but the sequence
     must still play — it is content, not decoration.

     Two things it must not do:
       - advance while off-screen. An IntersectionObserver pauses it, so a
         reader arriving at the section always starts at slide 1 rather than
         partway through.
       - trap the keyboard. The dots are real buttons; focusing one pauses
         the timer, and clicking jumps to that pair and restarts the clock.

     It deliberately does NOT pause on hover: the section is nearly a full
     viewport tall, so the pointer is inside it whenever the reader is looking
     at it, and pausing there stops the rotation altogether. */

  function processCarousel() {
    document.querySelectorAll('[data-proc]').forEach(function (root) {
      var slides = root.querySelectorAll('[data-proc-slide]');
      var dots   = root.querySelectorAll('[data-proc-dot]');
      if (slides.length < 2) return;

      var interval = parseInt(root.getAttribute('data-proc-interval'), 10) || 5000;
      var index = 0;
      var timer = null;
      var paused = false;
      var visible = false;

      function show(next) {
        index = (next + slides.length) % slides.length;

        slides.forEach(function (sl, i) {
          var on = i === index;
          sl.classList.toggle('is-active', on);
          /* Hide the inactive pairs from assistive tech, so the section
             reads as one pair rather than all eight steps at once. */
          if (on) sl.removeAttribute('aria-hidden');
          else sl.setAttribute('aria-hidden', 'true');
        });

        dots.forEach(function (d, i) {
          var on = i === index;
          d.classList.toggle('is-active', on);
          if (on) d.setAttribute('aria-current', 'true');
          else d.removeAttribute('aria-current');
        });
      }

      function stop() { if (timer) { clearInterval(timer); timer = null; } }

      function start() {
        stop();
        if (paused || !visible) return;
        timer = setInterval(function () { show(index + 1); }, interval);
      }

      /* Restart the clock on any manual jump, so a dot press gives a full
         interval to read rather than whatever was left of the last one. */
      dots.forEach(function (d, i) {
        d.addEventListener('click', function () { show(i); start(); });
        d.addEventListener('focus', function () { paused = true; stop(); });
        d.addEventListener('blur',  function () { paused = false; start(); });
      });

      /* NO hover pause. This section is close to a full viewport tall, so a
         reader's cursor rests inside it for the whole time they are reading —
         pausing on hover therefore froze it on the first pair permanently,
         which is the opposite of the automatic behaviour intended. Only an
         explicit interaction (focusing a dot) pauses it now. */

      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          visible = entries[0].isIntersecting;
          if (visible) start(); else stop();
        }, { threshold: 0.35 }).observe(root);
      } else {
        visible = true;
        start();
      }

      show(0);
    });
  }

  processCarousel();

  /* Wire the accordion FIRST, before the GSAP guard below. It is a
     disclosure control, not decoration: it has to keep working when the
     animation library is absent and when the reader prefers reduced motion,
     both of which return early. */
  accordion();

  /* GSAP is loaded from js/vendor by two defer'd tags ahead of this one. If
     either is missing we must not leave the hero hidden. */
  if (reduced || !window.gsap) { reveal(); return; }

  var gsap = window.gsap;

  /* ----------------------------------------------------------------------
     SPLITTING
     ----------------------------------------------------------------------
     splitChars — one inline-block span per character. Spaces stay as plain
     text nodes so the browser keeps its own word-breaking; wrapping them
     would make every space an unbreakable box and destroy wrapping.

     &nbsp; (U+00A0) is preserved as-is: the markup uses it to keep "Cost
     control" on one line, and turning it into a normal space would undo
     that. */

  function splitChars(el) {
    var text = el.textContent;
    var frag = document.createDocumentFragment();
    var chars = [];

    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (ch === ' ') { frag.appendChild(document.createTextNode(' ')); continue; }
      var span = document.createElement('span');
      span.className = 'hero-svc__char';
      span.textContent = ch;
      frag.appendChild(span);
      chars.push(span);
    }

    el.textContent = '';
    el.appendChild(frag);
    return chars;
  }

  /* splitLines — wraps each VISUAL line in .hero-svc__lineMask >
     .hero-svc__lineInner, so the outer element masks the inner slide.

     Visual lines are found by walking the copy as word-sized spans and
     reading offsetTop: a change means the browser wrapped. That is the only
     reliable way to get real line boxes, since where a line breaks depends
     on the font, the width and the clamp() size — none of them known here.

     Cost is one forced layout per paragraph, paid once, which is why every
     offsetTop is read in a single pass into an array before any DOM is
     written back. (Same approach as js/about-reveal.js.) */

  function splitLines(el) {
    /* Cache the ORIGINAL markup the first time we touch this element. Every
       later call (resize) re-splits from that, not from our own output —
       otherwise the second pass would read the spans the first pass wrote
       and the <br> structure would be lost. */
    if (!el.hasAttribute('data-split-src')) {
      el.setAttribute('data-split-src', el.innerHTML);
    }
    var source = el.getAttribute('data-split-src');

    /* <br> are HARD breaks and must survive splitting: the markup uses them
       to set "Claims / Care / Compliance" as three deliberate lines. Split on
       them first, then let each segment wrap naturally. Anything else that is
       a tag (the underlined <span>) is flattened to its text — this splitter
       only promises to preserve line structure, not inline formatting. */
    var segments = source.split(/<br\s*\/?>/i);
    var probes = [];
    var i, j;

    el.textContent = '';
    for (i = 0; i < segments.length; i++) {
      var tmp = document.createElement('div');
      tmp.innerHTML = segments[i];
      var text = tmp.textContent.replace(/\s+/g, ' ').trim();
      if (!text) continue;
      var tokens = text.split(' ');
      for (j = 0; j < tokens.length; j++) {
        var probe = document.createElement('span');
        probe.textContent = tokens[j];
        probe.style.display = 'inline-block';
        el.appendChild(probe);
        el.appendChild(document.createTextNode(' '));
        probes.push({
          node: probe,
          /* the last word of a segment forces a break, unless it is the
             last segment overall */
          hardBreakAfter: (j === tokens.length - 1 && i < segments.length - 1)
        });
      }
    }
    if (!probes.length) return [];

    /* One read pass. */
    var tops = [];
    for (i = 0; i < probes.length; i++) tops.push(probes[i].node.offsetTop);

    /* Group into lines: a new line starts where the browser wrapped
       (offsetTop moved) OR where the markup demanded a break. */
    var lines = [];
    var current = [];
    for (i = 0; i < probes.length; i++) {
      if (i > 0 && (tops[i] !== tops[i - 1] || probes[i - 1].hardBreakAfter)) {
        lines.push(current);
        current = [];
      }
      current.push(probes[i].node.textContent);
    }
    if (current.length) lines.push(current);

    /* One write pass. */
    el.textContent = '';
    var inners = [];
    for (i = 0; i < lines.length; i++) {
      var mask = document.createElement('span');
      mask.className = 'hero-svc__lineMask';
      var inner = document.createElement('span');
      inner.className = 'hero-svc__lineInner';
      inner.textContent = lines[i].join(' ');
      mask.appendChild(inner);
      el.appendChild(mask);
      inners.push(inner);
    }
    return inners;
  }

  /* splitWords — one masked wrapper per WORD, so each can rise from behind
     its own edge. Unlike splitLines this needs no measuring: word boundaries
     are known from the text, not from where the browser wrapped. The mask is
     inline-block so several sit on a line and still wrap naturally. */

  function splitWords(el) {
    if (!el.hasAttribute('data-split-src')) {
      el.setAttribute('data-split-src', el.innerHTML);
    }
    var tmp = document.createElement('div');
    tmp.innerHTML = el.getAttribute('data-split-src');
    var text = tmp.textContent.replace(/\s+/g, ' ').trim();
    if (!text) return [];

    var tokens = text.split(' ');
    el.textContent = '';
    var inners = [];

    for (var i = 0; i < tokens.length; i++) {
      var mask = document.createElement('span');
      mask.className = 'hero-svc__wordMask';
      var inner = document.createElement('span');
      inner.className = 'hero-svc__wordInner';
      inner.textContent = tokens[i];
      mask.appendChild(inner);
      el.appendChild(mask);
      if (i < tokens.length - 1) el.appendChild(document.createTextNode(' '));
      inners.push(inner);
    }
    return inners;
  }

  /* ----------------------------------------------------------------------
     ENTRANCE
     ----------------------------------------------------------------------
     Built as one timeline so the whole hero shares a clock and the
     data-anim-load-delay values stay meaningful relative to each other.
     Every tween is positioned absolutely on that clock (the `delay` string
     argument), not chained, which is what lets the four headline lines
     overlap by 0.1s the way the reference's do. */

  function build() {
    var tl = gsap.timeline();

    section.querySelectorAll('[data-anim-load]').forEach(function (el) {
      var kind  = el.getAttribute('data-anim-load');
      var delay = parseFloat(el.getAttribute('data-anim-load-delay')) || 0;

      if (kind === 'chars') {
        var chars = splitChars(el);
        gsap.set(el, { visibility: 'visible' });
        if (!chars.length) return;
        tl.from(chars, {
          xPercent: 100,
          duration: 1.5,
          ease: 'expo.out',
          stagger: { each: 0.125 }
        }, delay);

      } else if (kind === 'lines') {
        var inners = splitLines(el);
        gsap.set(el, { visibility: 'visible' });
        if (!inners.length) return;
        tl.from(inners, {
          yPercent: 125,
          duration: 2,
          ease: 'expo.out',
          stagger: { each: 0.1 }
        }, delay);

      } else if (kind === 'scale') {
        gsap.set(el, { visibility: 'visible' });
        /* fromTo, not from: the scrubbed parallax below also writes to this
           element, and an unpinned `from` would take its start value from
           whatever the scrub had already applied. */
        tl.fromTo(el,
          { scale: 1.08 },
          { scale: 1, duration: 1.8, ease: 'expo.out' },
        delay);

      } else if (kind === 'fade') {
        gsap.set(el, { visibility: 'visible' });
        tl.from(el, { opacity: 0, duration: 1.2, ease: 'power2.out' }, delay);
      }
    });

    return tl;
  }

  /* ----------------------------------------------------------------------
     SCROLL-TRIGGERED ENTRANCES
     ----------------------------------------------------------------------
     The hero's data-anim-load runs once on load. Everything further down the
     page uses data-anim-scroll instead, which fires as the element reaches
     the viewport and RESETS when scrolled back past — the reference's
     toggleActions: "none play none reset", so a reader scrolling up and down
     sees the same entrance each time rather than a one-shot.

     Reference timings, matched:
       words   yPercent 115 -> 0   2.0s  expo.out  stagger 0.05
       lines   yPercent 125 -> 0   2.0s  expo.out  stagger 0.10 (delay .125)
       fade    opacity  0   -> 1   1.66s
     Shared trigger window: start "top bottom", end "top 90%". */

  var SCROLL_TRIGGER = {
    start: 'top bottom',
    end: 'top 90%',
    toggleActions: 'none play none reset'
  };

  function trig(el) {
    var o = { trigger: el };
    for (var k in SCROLL_TRIGGER) o[k] = SCROLL_TRIGGER[k];
    return o;
  }

  function buildScroll() {
    /* The reference skips ALL text splitting at 768px and below
       (`if (window.innerWidth <= 768) return` around its split routine),
       while leaving its scroll animations ungated. The net effect there is
       that on a phone the word/line entrances simply do not happen — the
       text is already in place — and only the opacity fades still run.

       Matched here explicitly rather than by accident: below the same
       breakpoint the split-based entrances are skipped and the elements are
       revealed outright. Splitting a heading into per-word masks is also the
       most expensive thing on the page for a phone to lay out, so this is
       the cheaper path as well as the faithful one. */
    var noSplit = window.matchMedia('(max-width: 48rem)').matches;   /* 768px */

    document.querySelectorAll('[data-anim-scroll="words"]').forEach(function (el) {
      if (noSplit) { gsap.set(el, { visibility: 'visible' }); return; }
      var words = splitWords(el);
      gsap.set(el, { visibility: 'visible' });
      if (!words.length) return;
      gsap.from(words, {
        yPercent: 115,
        duration: 2,
        ease: 'expo.out',
        stagger: { each: 0.05 },
        scrollTrigger: trig(el)
      });
    });

    document.querySelectorAll('[data-anim-scroll="lines"]').forEach(function (el) {
      if (noSplit) { gsap.set(el, { visibility: 'visible' }); return; }
      var inners = splitLines(el);
      gsap.set(el, { visibility: 'visible' });
      if (!inners.length) return;
      gsap.from(inners, {
        yPercent: 125,
        duration: 2,
        delay: 0.125,
        ease: 'expo.out',
        stagger: { each: 0.1 },
        scrollTrigger: trig(el)
      });
    });

    document.querySelectorAll('[data-anim-scroll="fade"]').forEach(function (el) {
      gsap.set(el, { visibility: 'visible' });
      gsap.from(el, {
        opacity: 0,
        duration: 1.66,
        scrollTrigger: trig(el)
      });
    });

    /* The accordion's 1px rules draw themselves in from the left. The
       reference animates the divider element itself rather than a child, at
       2s power1.inOut with a 0.1 stagger. */
    document.querySelectorAll('[data-anim-scroll="scaleX"]').forEach(function (el) {
      /* The reference animates [data-anim-target=scaleX] CHILDREN when the
         element has any, and falls back to the element itself when it does
         not. That is what lets one attribute on a grid draw every rule
         inside it, staggered, rather than scaling the grid as a whole. */
      var targets = el.querySelectorAll('[data-anim-target="scaleX"]');
      var subject = targets.length ? targets : el;

      gsap.from(subject, {
        scaleX: 0,
        duration: 2,
        ease: 'power1.inOut',
        stagger: { each: 0.1 },
        scrollTrigger: trig(el)
      });
    });

    /* Children rise and fade in, staggered. The reference prefers
       [data-anim-target] descendants when present and falls back to the
       element's own children, so one attribute on a grid animates its cards
       in sequence. */
    document.querySelectorAll('[data-anim-scroll="children-fade"]').forEach(function (el) {
      var targets = el.querySelectorAll('[data-anim-target]');
      var subject = targets.length ? targets : el.children;
      if (!subject.length) return;

      gsap.from(subject, {
        opacity: 0,
        yPercent: 15,
        duration: 1.66,
        ease: 'power3.out',
        stagger: { each: 0.125 },
        scrollTrigger: trig(el)
      });
    });

    /* A clip-path wipe from the top-left corner, opening diagonally across
       the element. Used on the backing layer of the peer-cards grid, so the
       1px hairlines between cards appear to draw themselves in.

       Set explicitly with fromTo rather than from: the start state must not
       be left in the stylesheet, or a failed/absent JS run would leave the
       layer permanently clipped to nothing. */
    document.querySelectorAll('[data-anim-scroll="mask-diagonal"]').forEach(function (el) {
      gsap.fromTo(el,
        { clipPath: 'polygon(-1% -1%, 0% 0%, 0% 0%)' },
        {
          clipPath: 'polygon(-1% -1%, 250% 0%, 0% 250%)',
          duration: 3.5,
          ease: 'power1.inOut',
          scrollTrigger: trig(el)
        }
      );
    });
  }

  /* ----------------------------------------------------------------------
     PARALLAX
     ----------------------------------------------------------------------
     Scrubbed yPercent on the image layer, start -> end as the hero travels
     from filling the viewport to leaving the top. Generic over
     data-parallax-start / -end so the attribute contract matches the
     reference's.

     Disabled on coarse/narrow viewports: the hero is height-auto there, the
     travel is negligible, and it is the single most expensive thing on the
     page to composite while scrolling on a phone. */

  function parallax() {
    if (!window.ScrollTrigger) return;
    if (window.matchMedia('(max-width: 40rem)').matches) return;

    gsap.registerPlugin(window.ScrollTrigger);

    /* Scroll restoration is disabled in the head of the page, before the
       browser can restore a position — see the comment there. It has to
       happen that early, so it is deliberately NOT done here. */

    /* Document-wide, not hero-only: the halves section below uses the same
       attribute contract for its counter-parallax columns. */
    document.querySelectorAll('[data-parallax="trigger"]').forEach(function (el) {
      /* Honour the reference's per-element disable flag. 'tablet' is the only
         value in use here; it maps to the same 60rem breakpoint the halves
         layout stacks at, so a stacked column never also parallaxes. */
      var off = el.getAttribute('data-parallax-disable');
      if (off === 'tablet' && window.matchMedia('(max-width: 60rem)').matches) return;

      var start = parseFloat(el.getAttribute('data-parallax-start'));
      var end   = parseFloat(el.getAttribute('data-parallax-end'));
      if (isNaN(start)) start = 0;
      if (isNaN(end))   end   = 20;

      /* The hero's image is the page's first paint and is pinned to the top
         of the document, so it scrubs against the viewport. Everything else
         scrubs against its own row travelling through the viewport. */
      var inHero = section.contains(el);

      /* immediateRender pins the start value at build time, so the layer is
         painted at yPercent:start no matter where the page happens to be
         sitting when this runs. invalidateOnRefresh re-reads that start on
         every refresh, so a resize or a late-loading image cannot bake in a
         stale offset either. */
      gsap.fromTo(el,
        { yPercent: start },
        {
          yPercent: end,
          ease: 'none',
          immediateRender: true,
          scrollTrigger: {
            trigger: inHero ? section : el,
            start: inHero ? 'top top'    : 'top bottom',
            end:   inHero ? 'bottom top' : 'bottom top',
            scrub: true,
            invalidateOnRefresh: true
          }
        }
      );
    });
  }

  /* ----------------------------------------------------------------------
     START
     ----------------------------------------------------------------------
     Gated on document.fonts.ready. Line splitting measures offsetTop, and
     measuring before the webfont swaps would group words against the
     fallback's metrics and produce line breaks that jump the moment Archivo
     lands. The reference gates on the same promise for the same reason.

     The .catch/absent-API path still runs the build, so a browser without
     the Font Loading API animates rather than sitting on hidden text. */

  function start() {
    try {
      build();
      buildScroll();
      parallax();
    } catch (e) {
      /* Never leave the hero hidden because of a scripting fault. Unhide
         first, then let the error surface normally for debugging. */
      reveal();
      throw e;
    }
    /* Re-measure once the layout has settled. Two reasons this is required,
       not just tidy:

       1. ScrollTrigger measured the hero while the entrance tween still had
          the image scaled up, so its end position was recorded against the
          wrong height.

       2. Browsers restore the previous scroll position on reload and on
          back/forward, and they do it AFTER scripts run. A scrub built
          before that restore lands keeps the progress it was born with, so
          the image layer stays translated even once the reader is back at
          the top — which is what leaves a band of bare ground under the
          header where the picture should be.

       ScrollTrigger.refresh() recomputes every start/end against the real
       current scroll position and re-applies the scrub, which corrects both.
       It is called again on `load` because the image's true height is only
       known once it has decoded. */
    if (window.ScrollTrigger) {
      var ST = window.ScrollTrigger;

      /* A refresh() alone is not enough here. The browser restores the old
         scroll position asynchronously, AFTER this file has run and after
         load has fired, and a scrub only re-evaluates when the scroll
         position next changes. Land at the top ourselves once that restore
         has had its chance, then refresh against it — that is what actually
         clears a scrub left sitting at its end value.

         requestAnimationFrame twice, not a timer: the restore is applied
         before the next paint, so two frames is enough to be after it while
         still being too fast for the reader to see a jump. */
      var settle = function () {
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            if (window.scrollY !== 0) window.scrollTo(0, 0);
            ST.refresh();
          });
        });
      };

      gsap.delayedCall(0.2, function () { ST.refresh(); });
      window.addEventListener('load', settle);
      /* pageshow fires for back/forward-cache restores, where no other event
         does and the stale-scrub problem is at its worst. */
      window.addEventListener('pageshow', function (e) {
        if (e.persisted) settle();
      });
    }
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(start).catch(start);
  } else {
    start();
  }

  /* Re-split on resize: visual line boxes are width-dependent, so a rotated
     phone or a dragged window would otherwise keep the old grouping. The
     entrance has already played by then, so this only needs to restore flat,
     correctly-grouped lines — not re-run the animation. */
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      section.querySelectorAll('[data-anim-load="lines"]').forEach(function (el) {
        var inners = splitLines(el);
        gsap.set(inners, { yPercent: 0, clearProps: 'transform' });
      });
      /* The halves section's scroll-split text needs the same treatment:
         visual line boxes are width-dependent, and a word mask's height is
         font-dependent. Re-split flat — these have already played, so this
         only has to restore correct grouping, not re-run the entrance. */
      /* Same 768px gate as buildScroll: below it these were never split, so
         re-splitting on resize would introduce the very masks the gate is
         there to avoid. */
      if (!window.matchMedia('(max-width: 48rem)').matches) {
        document.querySelectorAll('[data-anim-scroll="lines"]').forEach(function (el) {
          gsap.set(splitLines(el), { yPercent: 0, clearProps: 'transform' });
        });
        document.querySelectorAll('[data-anim-scroll="words"]').forEach(function (el) {
          gsap.set(splitWords(el), { yPercent: 0, clearProps: 'transform' });
        });
      }
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    }, 200);
  });

})();
