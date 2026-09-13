/* ==========================================================================
   MedShield — presence-card.js
   Section 10, "Presence & network": the per-city detail card.

   WHAT THIS IS. One small card that follows the pointer between pins on the
   India map, showing what that city is and what MedShield holds there. It is
   a tooltip in behaviour, not a panel: it never persists, never takes focus,
   and nothing on the page depends on it having been opened.

   ONE CARD, NOT SIXTEEN. The markup carries a single .presence__card which
   this file refills and repositions per pin. Sixteen cards in the DOM would
   be sixteen absolutely-positioned boxes the browser lays out on every
   resize, and sixteen blocks of duplicated text for a screen reader to walk.
   The data lives on each <li> as data-role / data-kind / data-services, so
   the markup stays the single source of truth and this file invents nothing.

   WHY IT IS NOT CSS-ONLY. A :hover rule on the pin could show a card with no
   script at all, and that is how the label plates already work. But the card
   is much wider than a pin, and pins near the right edge or the bottom of the
   map would push it outside the box and be clipped by .presence's overflow.
   Deciding which SIDE a card opens on needs a measurement, and CSS cannot
   measure. That single decision is the whole reason this file exists.

   FLIPPING. The card opens to the pin's right and vertically centred by
   default. If its right edge would pass the map box, it opens LEFT instead;
   if its top or bottom would pass, it is clamped back inside. The result is
   that every one of the sixteen is fully readable without any per-pin
   position being written by hand.

   POSITIONED IN PERCENTAGES, not pixels, and against the map box itself, so
   the card holds its place when the map is resized mid-hover and needs no
   resize listener at all. It is re-measured on each open, which is the only
   moment its own size can have changed.

   KEYBOARD. The pins are already tabbable (tabindex="0" in the markup), so
   focus opens the card exactly as hover does and Escape closes it. Nothing
   here is reachable by pointer alone.

   ACCESSIBILITY. The card is aria-hidden and is never announced. Everything
   in it is either already on the pin the reader is on (the city) or already
   in the section prose (the capability line), so announcing it would repeat
   what a screen reader user has just been given. The pin's own label remains
   the accessible record of the city, exactly as before this file existed.

   RESTING CONTRACT. If this file never runs — no JS, a throw, an old browser
   — the card stays [hidden] and the map behaves precisely as it did before:
   pins still highlight on hover and focus, because that is CSS. Nothing is
   missing from the page, matching the contract every other script here keeps.
   ========================================================================== */
(function () {
  'use strict';

  var map = document.querySelector('.presence__map');
  var card = document.getElementById('presence-card');
  if (!map || !card) return;

  var pins = map.querySelectorAll('.presence__pin');
  if (!pins.length) return;

  var city = card.querySelector('.presence__cardCity');
  var role = card.querySelector('.presence__cardRole');
  var kind = card.querySelector('.presence__cardKind');
  var services = card.querySelector('.presence__cardServices');

  /* The pin currently showing a card. Held so a second open on the same pin
     (pointerenter firing after focus, say) is a no-op rather than a reflow. */
  var current = null;

  /* How far the card sits from the dot, and how close it may come to the map
     box edge before it is pushed back in. Both in percent of the map box, so
     they scale with it like everything else in this section. */
  var OFFSET = 1.6;
  var MARGIN = 1.0;

  function close() {
    if (!current) return;
    current = null;
    card.hidden = true;
    card.classList.remove('is-open');
  }

  function open(pin) {
    if (current === pin) return;
    current = pin;

    /* Fill first, THEN measure: the card's height depends on how many lines
       the services row wraps to, and that is not known until the text is in. */
    var name = pin.querySelector('.presence__pinName');
    city.textContent = name ? name.textContent : '';
    role.textContent = pin.getAttribute('data-role') || '';
    /* innerHTML, not textContent: the kind line carries a &middot; separator
       written in the markup. The strings are ours, from this page's own HTML,
       and never come from a URL, a form or a network response. */
    kind.innerHTML = pin.getAttribute('data-kind') || '';
    services.textContent = pin.getAttribute('data-services') || '';

    /* Unhide before measuring — a [hidden] element has no box. It is still
       visually suppressed at this point because .is-open is what fades it in,
       so nothing flashes in the wrong place. */
    card.hidden = false;

    var box = map.getBoundingClientRect();
    if (!box.width || !box.height) { close(); return; }

    var w = (card.offsetWidth / box.width) * 100;
    var h = (card.offsetHeight / box.height) * 100;

    var x = parseFloat(pin.getAttribute('data-x'));
    var y = parseFloat(pin.getAttribute('data-y'));
    if (isNaN(x) || isNaN(y)) { close(); return; }

    /* SIDE. Right by default; left when the card would not fit on the right.
       If it fits on neither — a card wider than the map, which only happens
       at very small sizes — right wins and the clamp below pulls it in. */
    var left = x + OFFSET;
    if (left + w > 100 - MARGIN) {
      var flipped = x - OFFSET - w;
      if (flipped >= MARGIN) left = flipped;
    }
    if (left + w > 100 - MARGIN) left = 100 - MARGIN - w;
    if (left < MARGIN) left = MARGIN;

    /* Vertically centred on the dot, then clamped inside the box. */
    var top = y - h / 2;
    var max = 100 - MARGIN - h;
    if (top > max) top = max;
    if (top < MARGIN) top = MARGIN;
    /* A card taller than the map cannot satisfy both edges; pin it to the top
       so its heading is the part that stays readable. */
    if (max < MARGIN) top = MARGIN;

    card.style.left = left + '%';
    card.style.top = top + '%';

    /* Next frame, so the browser has a painted frame at the new position to
       transition FROM. Setting it in the same frame makes the fade a jump. */
    requestAnimationFrame(function () {
      if (current === pin) card.classList.add('is-open');
    });
  }

  for (var i = 0; i < pins.length; i++) {
    (function (pin) {
      /* pointerenter, not mouseenter: it covers pen and touch as well, and
         unlike mouseover it does not re-fire as the pointer crosses the
         pin's own children. */
      pin.addEventListener('pointerenter', function () { open(pin); });
      pin.addEventListener('pointerleave', function () { close(); });
      pin.addEventListener('focus', function () { open(pin); });
      pin.addEventListener('blur', function () { close(); });
    })(pins[i]);
  }

  /* A pointer that leaves the map entirely — moved off fast, or out of the
     window — can skip a pin's own pointerleave. This is the backstop. */
  map.addEventListener('pointerleave', close);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
  });

  /* Scrolling the map out from under a stationary pointer leaves a card open
     over nothing. Closing on scroll is cheaper and steadier than trying to
     track the pointer against a moving box. */
  window.addEventListener('scroll', close, { passive: true });
})();
