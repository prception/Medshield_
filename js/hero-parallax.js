/* ==========================================================================
   HERO PARALLAX — the reference's hero-to-next-section glide
   ==========================================================================
   This is the effect where the first section appears to slide up OVER the
   hero rather than pushing it off. On white-desert.com it is not a sticky
   hero and not a scroll-snap; it is three scrubbed tweens on the hero's own
   layers, read verbatim off their bundle (chunks/d26eea3877528282.js):

     gsap.to(bg,      {y: "100svh",   ease:"none", scrollTrigger:{...}})
     gsap.fromTo(fade,{opacity:0}, {opacity:.8, ease:"none", ...})
     gsap.fromTo(content,{y:"0svh"},{y:"-20svh", ease:"none", ...})

   every one of them with:

     scrollTrigger: { trigger: hero, start:"top top", end:"bottom top",
                      scrub: true }

   So across exactly one viewport of scrolling: the background drifts DOWN a
   full 100svh (it lags the page, which is what reads as parallax), a black
   veil fades in to 80%, and the text lifts 20svh. Meanwhile the next section
   scrolls up over the top of it normally — their `section{position:relative}`
   puts every following section above the hero in the stacking order.

   `ease:"none"` + `scrub:true` means progress is linear in scroll position:
   the effect is driven by WHERE the page is, not by a timed animation. That
   is reproduced here by reading scrollY directly, so no GSAP or ScrollTrigger
   is needed — this page does not load them.

   The smoothness of it comes from Lenis (js/smooth-scroll.js), which eases
   the scroll position itself; this file just maps that position onto the
   layers.

   PROGRESSIVE ENHANCEMENT
   Does nothing under reduced motion, and nothing if the hero is absent. The
   hero is fully readable with this file never running.
   ========================================================================== */
(function () {
  'use strict';

  var reduced = window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  function init() {
    var hero = document.querySelector('.wd-hero');
    if (!hero) return;

    var bg      = hero.querySelector('.wd-hero__bg');
    var fade    = hero.querySelector('.wd-hero__fade');
    var content = hero.querySelector('.wd-hero__content');
    if (!bg || !fade || !content) return;

    var ticking = false;

    function frame() {
      ticking = false;

      /* Their trigger is start:"top top" -> end:"bottom top", i.e. progress
         runs 0..1 while the hero travels its own height past the top edge. */
      var h = hero.offsetHeight || 1;

      /* Read the hero's own rect rather than window.scrollY. Lenis moves the
         page on its own timeline and window.scrollY can lag a frame behind
         it, which shows up as the layers juddering against the scroll. The
         rect is whatever the compositor is actually about to paint. */
      var p = -hero.getBoundingClientRect().top / h;
      if (p < 0) p = 0;
      if (p > 1) p = 1;

      /* Past the end there is nothing to paint: the hero has left the screen
         and the layers would only be doing work behind the section above it. */
      if (p >= 1) {
        bg.style.transform = 'translate3d(0,100svh,0)';
        fade.style.opacity = '0.8';
        content.style.transform = 'translate3d(0,-20svh,0)';
        return;
      }

      bg.style.transform      = 'translate3d(0,' + (p * 100) + 'svh,0)';
      fade.style.opacity      = String(p * 0.8);
      content.style.transform = 'translate3d(0,' + (p * -20) + 'svh,0)';
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
