/* ==========================================================================
   ABOUT — arriving text / scroll reveal
   ==========================================================================
   Three behaviours, all driven by one IntersectionObserver:

     [data-ab-lines]   display headings, split into VISUAL lines and each line
                       masked so it slides up from behind its own clip
     [data-ab-reveal]  blocks that rise and fade in, staggered by --ab-d
     [data-ab-count]   stat numerals that count up to their printed value

   Deliberately vanilla and self-contained, matching js/nav.js: the inner
   pages do not load the homepage's GSAP vendor bundle and this must not be
   the reason they start. IntersectionObserver is the only modern API used.

   PROGRESSIVE ENHANCEMENT CONTRACT
   The hidden-state CSS in about.css is gated behind html.ab-anim. This file
   adds that class, synchronously at parse time (the <script> is NOT deferred
   for that one reason), and only when motion is wanted. So:
     - no JS, JS error, or reduce-motion  ->  class never lands, nothing hides
     - never a flash of hidden content, and never permanently-invisible text
   That ordering is the whole safety story; do not move the class add into
   DOMContentLoaded.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;

  var reduced = window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var supported = 'IntersectionObserver' in window;

  if (reduced || !supported) return;   /* leave everything in its final state */

  root.classList.add('ab-anim');

  /* --- line splitting ----------------------------------------------------
     Wraps each VISUAL line (not each <br>-delimited one) in
     .ab-line > .ab-line__i so the outer element can mask the inner slide.

     Lines are found by walking the text in word-sized spans and reading
     offsetTop: a change in offsetTop means the browser wrapped. This is the
     only reliable way to get real line boxes, since where a line breaks
     depends on the font, the width and the clamp() size — all unknown here.

     Cost is one forced layout per heading, paid once at startup on a handful
     of elements, which is why offsetTop is read in a single pass into an
     array before any DOM is written back. */

  function splitLines(el) {
    /* Existing <br> are honoured as hard breaks; everything else is words. */
    var source = el.innerHTML;
    var parts = source.split(/<br\s*\/?>/i);

    var probe = document.createElement('span');
    var i, j;

    /* Rebuild the heading as word spans, remembering hard breaks. */
    el.textContent = '';
    var words = [];
    for (i = 0; i < parts.length; i++) {
      var tmp = document.createElement('div');
      tmp.innerHTML = parts[i];
      var text = tmp.textContent.replace(/\s+/g, ' ').trim();
      if (!text) continue;
      var tokens = text.split(' ');
      for (j = 0; j < tokens.length; j++) {
        probe = document.createElement('span');
        probe.textContent = tokens[j];
        probe.style.display = 'inline-block';
        el.appendChild(probe);
        el.appendChild(document.createTextNode(' '));
        words.push({ node: probe, hardBreakAfter: (j === tokens.length - 1 && i < parts.length - 1) });
      }
    }
    if (!words.length) return 0;

    /* One read pass. */
    var tops = [];
    for (i = 0; i < words.length; i++) tops.push(words[i].node.offsetTop);

    /* Group into lines. */
    var lines = [];
    var current = [];
    for (i = 0; i < words.length; i++) {
      if (i > 0 && (tops[i] !== tops[i - 1] || words[i - 1].hardBreakAfter)) {
        lines.push(current);
        current = [];
      }
      current.push(words[i].node.textContent);
    }
    if (current.length) lines.push(current);

    /* One write pass. */
    el.textContent = '';
    for (i = 0; i < lines.length; i++) {
      var outer = document.createElement('span');
      outer.className = 'ab-line';
      var inner = document.createElement('span');
      inner.className = 'ab-line__i';
      inner.style.setProperty('--ab-i', String(i));
      inner.textContent = lines[i].join(' ');
      outer.appendChild(inner);
      el.appendChild(outer);
    }
    return lines.length;
  }

  /* Headings whose markup carries inline elements we must not destroy (an
     <em> accent, the .ab-split__lap letter) opt out of splitting via
     data-ab-lines="whole" and animate as a single masked block instead. */
  function splitWhole(el) {
    var inner = document.createElement('span');
    inner.className = 'ab-line__i';
    inner.style.setProperty('--ab-i', '0');
    while (el.firstChild) inner.appendChild(el.firstChild);
    var outer = document.createElement('span');
    outer.className = 'ab-line';
    outer.appendChild(inner);
    el.appendChild(outer);
  }

  /* --- count-up ----------------------------------------------------------
     The element's printed text IS the source of truth ("130+", "1,800+"),
     so the final frame restores it verbatim rather than re-formatting a
     number and risking a mismatch with what the page shipped. */

  function countUp(el) {
    var finalText = el.textContent;

    /* Match against the ORIGINAL string, digits and separators together, so
       the offsets below index the text we actually slice. Matching a
       comma-stripped copy and then searching for the result in the original
       silently fails on any grouped number ("1800" is not in "1,800+"),
       which sliced prefix/suffix wrong and printed both numbers at once. */
    var match = finalText.match(/[\d,]*\d/);
    if (!match) return;

    var target = parseInt(match[0].replace(/,/g, ''), 10);
    if (!isFinite(target) || target <= 0) return;

    var prefix = finalText.slice(0, match.index);
    var suffix = finalText.slice(match.index + match[0].length);
    var grouped = match[0].indexOf(',') !== -1;

    var DURATION = 1100;
    var start = null;

    function frame(now) {
      if (start === null) start = now;
      var t = Math.min((now - start) / DURATION, 1);
      /* easeOutCubic — fast off the mark, settles rather than stops dead. */
      var eased = 1 - Math.pow(1 - t, 3);
      var value = Math.round(target * eased);
      el.textContent = prefix +
        (grouped ? value.toLocaleString('en-US') : String(value)) + suffix;
      if (t < 1) {
        window.requestAnimationFrame(frame);
      } else {
        el.textContent = finalText;   /* restore the authored string exactly */
      }
    }
    window.requestAnimationFrame(frame);
  }

  /* --- wiring ------------------------------------------------------------ */

  function init() {
    var headings = document.querySelectorAll('[data-ab-lines]');
    var i;

    for (i = 0; i < headings.length; i++) {
      if (headings[i].getAttribute('data-ab-lines') === 'whole') {
        splitWhole(headings[i]);
      } else {
        splitLines(headings[i]);
      }
      /* A split heading is itself a reveal target, so one observer covers
         both mechanisms and the .is-in class drives whichever applies. */
      headings[i].setAttribute('data-ab-reveal', '');
    }

    /* Stagger siblings inside a shared container: each direct reveal child
       leaves a beat after the one before it, capped so a 12-cell wall does
       not take three seconds to finish arriving. */
    var groups = document.querySelectorAll('[data-ab-stagger]');
    for (i = 0; i < groups.length; i++) {
      var step = parseInt(groups[i].getAttribute('data-ab-stagger'), 10) || 70;
      var kids = groups[i].children;
      for (var k = 0; k < kids.length; k++) {
        if (kids[k].hasAttribute('data-ab-reveal') ||
            kids[k].hasAttribute('data-wd-reveal')) {
          kids[k].style.setProperty('--ab-d', Math.min(k * step, 640) + 'ms');
        }
      }
    }

    /* [data-wd-reveal] is the White-Desert-derived variant added in
       about.css. It uses its own keyframes but the same .is-in switch and the
       same --ab-d stagger, so one observer serves both. */
    var targets = document.querySelectorAll('[data-ab-reveal], [data-wd-reveal]');
    if (!targets.length) return;

    var io = new IntersectionObserver(function (entries) {
      for (var n = 0; n < entries.length; n++) {
        var entry = entries[n];
        if (!entry.isIntersecting) continue;

        entry.target.classList.add('is-in');

        /* querySelectorAll only finds DESCENDANTS, so a figure that is itself
           the reveal target — [data-wd-reveal][data-ab-count] on one element,
           as the stat stack uses — would never count. Check the target too. */
        var counters = [].slice.call(
          entry.target.querySelectorAll('[data-ab-count]'));
        if (entry.target.hasAttribute('data-ab-count')) {
          counters.push(entry.target);
        }

        for (var c = 0; c < counters.length; c++) {
          if (!counters[c].hasAttribute('data-ab-counted')) {
            counters[c].setAttribute('data-ab-counted', '');
            countUp(counters[c]);
          }
        }

        /* Arrive once. Re-animating on every pass makes a long page feel
           twitchy on the way back up. */
        io.unobserve(entry.target);
      }
    }, {
      /* Fire a little before the element's top edge reaches the fold, so the
         motion reads as the section arriving rather than catching up. */
      rootMargin: '0px 0px -12% 0px',
      threshold: 0.08
    });

    for (i = 0; i < targets.length; i++) io.observe(targets[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
