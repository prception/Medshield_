/* ==========================================================================
   FOUNDERS — scroll-scrubbed reel
   ==========================================================================
   The section is a 200svh rail with a 100svh sticky stage inside it. As the
   rail passes under the viewport, progress runs 0..1; with two founders that
   is 0 = Desikan, 1 = Princi, and every value between is a partial state.

   All this file does is write numbers onto the section:

     --fnd-p          the raw progress, 0 .. (COUNT - 1)
     data-fnd-step    the nearest whole founder, for anything keyed off it
     --fnd-o/--fnd-y  per-bio opacity and lift (CSS has no abs() we can rely
                      on across the browsers this site targets, and the
                      cross-fade needs the *distance* from each bio's own
                      step, so it is computed here)

   Everything visible — the portrait sliding up out of its frame, the name
   reel running upward like a counter, the bios cross-fading — is CSS reading
   those values. That keeps the work here to a handful of style writes per
   frame, all on custom properties that feed transforms and opacity only.

   LENIS
   smooth-scroll.js takes the page off native scrolling and re-emits a
   window 'scroll' event on its own bus, so listening for 'scroll' is
   correct here and needs no special case.

   PROGRESSIVE ENHANCEMENT
   The section ships with --fnd-p:0 and data-fnd-step="0" inline, so without
   JS the first founder is shown complete. Under reduced motion and below
   900px the stylesheet collapses the rail and stacks both founders, and
   this file bails out rather than fighting it.
   ========================================================================== */
(function () {
  'use strict';

  /* How far a bio has to be from its own step before it is fully gone. A
     bio is at full strength only very near its step, which is what makes
     the swap read as a hand-off rather than a long dissolve. */
  var FADE = 0.45;

  /* How far a bio travels while it fades, in px. */
  var LIFT = 48;

  function init() {
    var section = document.querySelector('.wd-fnd');
    if (!section) return;

    var bios = [].slice.call(section.querySelectorAll('.wd-fnd__bio'));
    var count = section.querySelectorAll('.wd-fnd__slot').length;
    if (count < 2) return;

    var reduced = window.matchMedia &&
                  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var slots = [].slice.call(section.querySelectorAll('.wd-fnd__slot'));

    /* The reel's standing frame must be EXACTLY one entry tall, or two names
       show inside it at once. The stylesheet's calc() is a fallback built
       from the type metrics; this replaces it with the height the browser
       actually laid out. The slot is sized BY the frame, so its own box
       would just echo the current value - the natural height is the sum of
       its children, read with that constraint released. */
    function measure() {
      var tallest = 0;
      var i, j;

      for (i = 0; i < slots.length; i++) slots[i].style.height = 'auto';

      for (i = 0; i < slots.length; i++) {
        var kids = slots[i].children;
        var h = 0;
        for (j = 0; j < kids.length; j++) {
          var cs = window.getComputedStyle(kids[j]);
          h += kids[j].getBoundingClientRect().height +
               parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
        }
        if (h > tallest) tallest = h;
      }

      for (i = 0; i < slots.length; i++) slots[i].style.height = '';

      if (tallest > 0) {
        section.style.setProperty('--fnd-entry-h', Math.ceil(tallest) + 'px');
      }
    }

    var lastP = -1;
    var lastStep = -1;
    var ticking = false;

    function frame() {
      ticking = false;

      /* Matches the stylesheet's fallback: below this the rail is collapsed
         and both founders are stacked, so scrubbing would only fight it. */
      if (reduced || window.innerWidth <= 900) {
        if (lastP !== 0) {
          section.style.setProperty('--fnd-p', '0');
          lastP = 0;
        }
        return;
      }

      var rect = section.getBoundingClientRect();
      var travel = rect.height - window.innerHeight;
      if (travel <= 0) return;

      /* rect.top runs 0 -> -travel while the stage is pinned. */
      var t = -rect.top / travel;
      if (t < 0) t = 0;
      if (t > 1) t = 1;

      /* Spread the travel across the founders. */
      var p = t * (count - 1);

      /* Sub-pixel changes are not worth a style write. */
      if (Math.abs(p - lastP) < 0.0005) return;
      lastP = p;

      section.style.setProperty('--fnd-p', String(p));

      var step = Math.round(p);
      if (step !== lastStep) {
        lastStep = step;
        section.setAttribute('data-fnd-step', String(step));
      }

      for (var i = 0; i < bios.length; i++) {
        var d = p - i;                       /* signed distance from own step */
        var away = Math.abs(d) / FADE;
        if (away > 1) away = 1;
        bios[i].style.setProperty('--fnd-o', String(1 - away));
        /* Ahead of its step the bio waits below; behind it, it has lifted
           away. Same sign as the reel, so everything moves together. */
        bios[i].style.setProperty('--fnd-y', (-d * LIFT).toFixed(2) + 'px');
      }
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(frame);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () {
      measure();
      onScroll();
    }, { passive: true });

    measure();
    frame();

    /* The display face may still be loading, and it changes the entry
       height. Re-measure once it lands. */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(measure);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
