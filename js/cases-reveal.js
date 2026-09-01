/* ==========================================================================
   CASE STUDIES — scroll reveal
   ==========================================================================
   Drives the arrival of the case studies index: the masthead, each case row,
   and the Load more control. One IntersectionObserver, one class (.is-in),
   with the hidden-state CSS living under .cx-anim in css/inner.css.

   Vanilla and self-contained, matching js/about-reveal.js and js/nav.js: the
   inner pages do not load the homepage's GSAP vendor bundle and this must not
   become the reason they start.

   PROGRESSIVE ENHANCEMENT CONTRACT
   The hidden-state CSS is gated behind html.cx-anim, which this file adds
   synchronously at parse time (the <script> is NOT deferred, for that one
   reason) and only when motion is wanted. So:
     - no JS, a JS error, or reduce-motion  ->  the class never lands, and
       nothing is ever hidden
     - no flash of hidden content, and no permanently invisible cards
   That ordering is the whole safety story; do not move the class add into
   DOMContentLoaded.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;

  var reduced = window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var supported = 'IntersectionObserver' in window;

  /* Nothing to gate against on other pages - the selectors below simply find
     nothing - but bailing early keeps the class off every page but this one. */
  if (reduced || !supported) return;
  if (!document.querySelector('.csx, .wtl')) return;

  root.classList.add('cx-anim');

  /* --- The stagger -------------------------------------------------------
     Each row leaves a beat after the one before it. The delay is assigned by
     the row's index in the stack rather than by arrival order, so a reader
     who lands mid-page (a deep link, a reload part-way down) sees the same
     rhythm as one who scrolled from the top.

     Capped: past a few hundred milliseconds a stagger stops reading as
     choreography and starts reading as lag. */
  /* 140ms is services.js's own card stagger, carried over verbatim (see the
     0.14 in its card timeline). The cap keeps a long stack from turning that
     choreography into lag. */
  var STEP = 140;
  var CAP = 420;

  function stagger(nodes) {
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].style.setProperty('--cx-d', Math.min(i * STEP, CAP) + 'ms');
    }
  }

  function init() {
    var head = document.querySelector('.csx__head');
    var i;

    /* The masthead's own blocks rise in sequence ahead of the first card. */
    if (head) {
      var headKids = head.children;
      for (i = 0; i < headKids.length; i++) {
        headKids[i].setAttribute('data-cx-reveal', '');
      }
      stagger(headKids);
    }

    /* Every case row is in the markup, so the stagger runs across all of
       them. Rows arrive as they are scrolled to, so the cap matters more than
       the count: see STEP/CAP above. */
    var rows = document.querySelectorAll('.csx-case');
    stagger(rows);

    /* One observer over both mechanisms: a row and a [data-cx-reveal] block
       both just need .is-in, and which rules apply is settled in CSS. */
    var targets = [];
    var generic = document.querySelectorAll('.csx [data-cx-reveal]');
    for (i = 0; i < generic.length; i++) targets.push(generic[i]);
    for (i = 0; i < rows.length; i++) targets.push(rows[i]);

    /* The Why MedShield timeline. The container is observed so the spine can
       draw itself down as the section is reached, and each step separately so
       the six arrive in turn on the way past rather than all at once. */
    var tl = document.querySelector('[data-wtl]');
    if (tl) {
      targets.push(tl);
      var steps = tl.querySelectorAll('.wtl-step');
      for (i = 0; i < steps.length; i++) targets.push(steps[i]);
    }

    if (!targets.length) return;

    var io = new IntersectionObserver(function (entries) {
      for (var n = 0; n < entries.length; n++) {
        if (!entries[n].isIntersecting) continue;
        entries[n].target.classList.add('is-in');
        /* Arrive once. Re-animating on every pass makes a long page feel
           twitchy on the way back up. */
        io.unobserve(entries[n].target);
      }
    }, {
      /* Fire a little before the element's top edge reaches the fold, so the
         motion reads as the card arriving rather than catching up with the
         scroll. */
      /* -12% puts the release at 88% of the viewport height, which is the
         same point services.js waits for before starting its card timeline. */
      rootMargin: '0px 0px -12% 0px',
      threshold: 0.06
    });

    for (i = 0; i < targets.length; i++) io.observe(targets[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
