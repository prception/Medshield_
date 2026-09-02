/* Standalone mobile nav drawer for inner pages (About, Services, Case
   Studies, Contact). Mirrors the open/close/focus-trap behaviour in
   hero.js's "Mobile nav drawer" section, minus the homepage's smooth-scroll
   engine and header-ink probing, which these plain pages do not use. */
(function () {
  'use strict';

  var toggle = document.getElementById('nav-toggle');
  var nav = document.getElementById('site-nav');
  var scrim = document.getElementById('nav-scrim');
  var header = document.getElementById('site-header');
  if (!toggle || !nav || !scrim) return;

  var FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
  var lastFocused = null;
  // Assigned by the scroll block below (it owns the idle timer). A no-op
  // until then, and on pages where the block never runs.
  var showBar = function () {};

  function isOpen() {
    return toggle.getAttribute('aria-expanded') === 'true';
  }

  function openNav() {
    lastFocused = document.activeElement;
    showBar();
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');

    nav.hidden = false;
    scrim.hidden = false;
    document.body.style.overflow = 'hidden';

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

    document.removeEventListener('keydown', onKeydown);

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(function () {
      if (toggle.getAttribute('aria-expanded') !== 'true') nav.hidden = true;
    }, reduced ? 0 : 1000);

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

    var items = [toggle].concat(
      Array.prototype.slice.call(nav.querySelectorAll(FOCUSABLE))
    ).filter(function (el) {
      return el.offsetParent !== null || el === toggle;
    });
    if (!items.length) return;

    var first = items[0];
    var last = items[items.length - 1];
    var active = document.activeElement;

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

  nav.addEventListener('click', function (event) {
    if (event.target.closest('a') && isOpen()) closeNav();
  });

  // Bar behaviour on scroll, matching hero.js's header block so every page's
  // bar feels identical: the logo belongs to the hero composition and
  // dissolves once the page has scrolled past it, leaving the hamburger
  // alone; the bar itself clears out of the way while a scroll is in motion
  // and returns when it settles.
  //
  // Ink colour is NOT decided here. bar-ink.js owns that probe for every
  // page, driven by data-bar-ink="light" markers in the HTML, and is
  // repainted from inside this same rAF pass. That replaced a
  // single-boundary "has the one dark hero scrolled past?" test, which was
  // wrong on every inner page that has a second dark section further down
  // (the navy CTA bands, the brand-blue case row, the footer): past the hero
  // the bar flipped to dark ink and the hamburger rendered navy-on-navy.
  if (header) {
    var ticking = false;

    // Same constants as hero.js's header block, so the two bars share one
    // feel: pinned open near the top, faded brand past STUCK_AT, hidden
    // while scrolling and back IDLE_MS after the motion stops.
    var STUCK_AT = 80;
    var MOTION_THRESHOLD = 6;
    var IDLE_MS = 260;
    var lastY = window.scrollY;
    var idleTimer = 0;

    // Never hide the bar at the very top of the page, or while the overlay
    // menu is open — the bar carries the close control.
    function isPinnedOpen() {
      return window.scrollY <= STUCK_AT || isOpen();
    }

    function paint() {
      ticking = false;
      var y = window.scrollY;

      if (window.__medshieldBarInk) window.__medshieldBarInk.paint();

      // Brand fade. .site-header.is-scrolled .brand (style.css) drops the
      // wordmark's opacity and pointer-events while keeping the anchor in the
      // tab order, so "back to top" stays reachable by keyboard.
      header.classList.toggle('is-scrolled', y > STUCK_AT);

      var delta = y - lastY;
      if (Math.abs(delta) < MOTION_THRESHOLD) return;
      lastY = y;

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

    // Opening the menu mid-scroll must not leave the close control off
    // screen, so openNav() pins the bar back open through this.
    showBar = function () {
      window.clearTimeout(idleTimer);
      header.classList.remove('is-hidden');
    };

    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(paint);
    }, { passive: true });
    window.addEventListener('resize', paint, { passive: true });
    paint();
  }
})();
