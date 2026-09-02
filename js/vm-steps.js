/* ==========================================================================
   VISION / MISSION — scroll-driven step switch
   ==========================================================================
   The section is a 200svh rail with a 100svh sticky stage inside it. As the
   rail passes under the viewport, progress runs 0..1; the first half is step
   0 (Vision), the second half step 1 (Mission).

   All this file does is write data-vm-step="0|1" onto the section. Every
   visible change — the dimmed label, the copy cross-fade, the background
   swap and its zoom — is a CSS transition reacting to that attribute, so the
   work here stays to one attribute write per change.

   PROGRESSIVE ENHANCEMENT
   The section ships with data-vm-step="0", so without JS (or under reduced
   motion, where the transitions are disabled anyway) it simply shows Vision
   and stays readable. Below 900px the CSS collapses the rail and shows both
   steps stacked, and this file leaves the attribute alone in that case.
   ========================================================================== */
(function () {
  'use strict';

  var STEPS = 2;

  function init() {
    var section = document.querySelector('.wd-vm');
    if (!section) return;

    var current = -1;
    var ticking = false;

    function frame() {
      ticking = false;

      /* Matches the CSS breakpoint: below it the rail is collapsed and both
         panes are shown, so stepping would only fight the stylesheet. */
      if (window.innerWidth <= 900) return;

      var rect = section.getBoundingClientRect();
      var travel = rect.height - window.innerHeight;
      if (travel <= 0) return;

      /* rect.top runs from 0 down to -travel while the stage is pinned. */
      var p = -rect.top / travel;
      if (p < 0) p = 0;
      if (p > 1) p = 1;

      var step = Math.min(STEPS - 1, Math.floor(p * STEPS));
      if (step === current) return;

      current = step;
      section.setAttribute('data-vm-step', String(step));
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(frame);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    frame();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
