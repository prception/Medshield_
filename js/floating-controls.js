/* ==========================================================================
   Floating controls - WhatsApp pill + back-to-top gauge
   Shared by every page. The markup lives at the end of each <body>; the
   styling is in css/style.css (.wa-float / .to-top-fill), which all pages
   already load. Lifted out of index.html so the behaviour is identical
   everywhere rather than copied five times.
   ========================================================================== */
(function () {
  'use strict';

  var wa  = document.getElementById('wa-float');
  var top = document.getElementById('to-top');
  if (!wa && !top) return;

  // Each page names its opening section differently - .hero on the homepage,
  // .hero-svc on services, .c-hero on contact - and about/case-studies open
  // straight into a page header with no hero at all. Take the first that
  // exists and fall back to scroll depth when there is none.
  var hero = document.querySelector('.hero, .hero-svc, .c-hero, [data-float-anchor]');

  function reveal(on) {
    if (wa)  wa.classList.toggle('show', on);
    if (top) top.classList.toggle('show', on);
  }

  // IntersectionObserver over a scroll listener: the browser does the work off
  // the main thread, so this never fights the GSAP ScrollTriggers in 03/04.
  if (hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      reveal(!entries[0].isIntersecting);
    }, { threshold: 0 }).observe(hero);
  } else {
    // No hero on the page, or a browser without IO: fall back to scroll depth.
    var ticking = false;
    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        ticking = false;
        reveal(window.scrollY > window.innerHeight * 0.6);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Fill level. --p is a unitless number the stylesheet multiplies into a
  // percentage, so the gradient stop tracks how far down the page we are.
  if (top) {
    var pTicking = false;

    function paint() {
      pTicking = false;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      // A page shorter than the viewport has nothing to report - show it empty
      // rather than dividing by zero and filling the square outright.
      var p = max > 0 ? (window.scrollY / max) * 100 : 0;
      top.style.setProperty('--p', Math.max(0, Math.min(100, p)).toFixed(1));
    }

    window.addEventListener('scroll', function () {
      if (pTicking) return;
      pTicking = true;
      window.requestAnimationFrame(paint);
    }, { passive: true });

    // Sections 03/04 pin on scroll, so total height changes as they resolve.
    window.addEventListener('resize', paint, { passive: true });
    paint();

    top.addEventListener('click', function () {
      // smooth-scroll.js runs a wheel-driven engine on non-touch, non
      // reduced-motion setups. Where it is active it owns the scroll position:
      // a native smooth scrollTo fights its scroll listener and stalls partway,
      // so hand it the target and let its own loop drive.
      if (window.__medshieldScroll && window.__medshieldScroll.scrollTo) {
        window.__medshieldScroll.scrollTo(0);
        return;
      }
      // Engine absent (touch, or reduced motion): the browser handles it. The
      // stylesheet already drops smooth behaviour under reduced motion.
      var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    });
  }
})();
