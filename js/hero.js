/* ==========================================================================
   MedShield — hero.js
   Three jobs, no dependencies, no scroll library:
     1. header transparent → solid past 80px
     2. hero video: respect prefers-reduced-motion, never play on mobile
     3. mobile nav drawer: focus trap + Escape to close
   ========================================================================== */

(function () {
  'use strict';

  /* --- 1. Header scroll state ------------------------------------------- */

  var header = document.getElementById('site-header');

  if (header) {
    var STUCK_AT = 80;
    var ticking = false;

    function syncHeader() {
      header.classList.toggle('is-stuck', window.scrollY > STUCK_AT);
      ticking = false;
    }

    // rAF-throttled: the listener itself does no layout work.
    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(syncHeader);
      }
    }, { passive: true });

    syncHeader(); // correct on a reload that restores scroll position
  }

  /* --- 2. Hero video ----------------------------------------------------- */

  var video = document.getElementById('hero-video');

  if (video) {
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var wideEnough = window.matchMedia('(min-width: 860px)');
    var source = video.querySelector('source');

    // Two independent reasons to stay on the poster:
    //   - narrow viewport: the video is desktop dressing, not content, and
    //     mobile data should never pay 2.6MB for it
    //   - reduced-motion: an explicit request for no movement
    // The <source> carries data-src rather than src, so in either case the
    // bytes are never requested at all — not requested-then-cancelled.
    function shouldPlay() {
      return wideEnough.matches && !reduceMotion.matches;
    }

    function enableVideo() {
      if (!source || source.hasAttribute('src')) return;
      source.setAttribute('src', source.getAttribute('data-src'));
      video.load();
      video.muted = true; // some browsers refuse autoplay unless known-muted

      // A rejected autoplay promise is not an error worth surfacing: the
      // poster is a real frame of this video, so the fallback is the design.
      var attempt = video.play();
      if (attempt && typeof attempt.catch === 'function') {
        attempt.catch(function () { /* poster stands in */ });
      }
    }

    function sync() {
      if (shouldPlay()) {
        enableVideo();
      } else {
        video.pause();
      }
    }

    sync();

    // Re-evaluate if the user changes the preference or resizes across the
    // breakpoint. Only ever adds the source; never re-downloads.
    [reduceMotion, wideEnough].forEach(function (mq) {
      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', sync);
      }
    });
  }

  /* --- 3. Mobile nav drawer ---------------------------------------------- */

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
      nav.classList.add('is-open');
      scrim.hidden = false;
      document.body.style.overflow = 'hidden';

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

      document.removeEventListener('keydown', onKeydown);

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

    // Resizing up to desktop must not strand an open drawer with a locked body.
    var desktop = window.matchMedia('(min-width: 860px)');
    var onDesktopChange = function (event) {
      if (event.matches && isOpen()) closeNav();
    };
    if (typeof desktop.addEventListener === 'function') {
      desktop.addEventListener('change', onDesktopChange);
    }
  }
})();
