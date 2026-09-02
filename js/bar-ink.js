/* ==========================================================================
   MedShield — bar-ink.js
   One source of truth for the header bar's INK COLOUR, shared by every page.

   The bar has no background of its own, so whatever section is behind it at
   the current scroll position decides whether the wordmark and hamburger have
   to be painted light or dark. Get that wrong and the control disappears:
   dark ink over a navy panel, or white ink over a white section.

   This file owns only that decision. Bar hide/show, the brand fade and the
   overlay menu stay where they were (hero.js on the homepage, nav.js on the
   inner pages); both call in here rather than each carrying their own guess
   at which sections are dark.

   HOW A SECTION DECLARES ITSELF
   -----------------------------
   Dark grounds — navy fills, brand-blue panels, and photographs, which are
   dark enough under their scrims to need light ink — are marked in the HTML:

       <section class="hero-svc" data-bar-ink="light">

   The attribute means "the bar needs LIGHT ink while it is over me". Anything
   unmarked is treated as a pale ground and gets dark ink. Keeping the marker
   in the markup rather than in a selector list here means a new or restyled
   section is a one-attribute change in one file, and the list can never rot
   out of sync with the CSS the way a hardcoded selector list does.

   Marking is not limited to whole sections: any element works, so a panel or
   a card that sweeps under the bar can carry it (index.html's .doubts__panel
   does exactly that).

   PHOTOGRAPHS ARE NOT MARKED
   --------------------------
   A flat fill can be classified once, in the markup, because its colour is a
   fact about the CSS. A photograph cannot: the answer depends on what is in
   the frame where the icon happens to land, and it differs from picture to
   picture in the SAME component. Measured across this site's photographs, the
   services images alone want dark ink on three and light on the fourth, and
   several sit close enough to the line (1.26 vs 2.29) that guessing from the
   selector would be wrong as often as right.

   So an unmarked IMAGE under the bar is not assumed pale. Its pixels are
   sampled -- see sampleImageInk below -- and the ink is whichever of the two
   actually contrasts better with what is there. Flat grounds never reach that
   path: they are settled by the markers above, which stay the cheap, explicit,
   reviewable source of truth for everything that has a fixed colour.
   ========================================================================== */

(function () {
  'use strict';

  var header = document.getElementById('site-header');
  if (!header) return;

  /* The toggle is the only ink in the bar that flips -- the brand is a
     full-colour PNG -- so it is the element the probe measures. Looked up
     once; the element never changes, only its box, which is read live. */
  var toggle = header.querySelector('.nav-toggle');

  /* The bars are narrower than their 44px tap target, and it is the BARS that
     have to stay legible. Insetting to the visible glyph stops a panel edge
     that only clips the invisible padding from counting as "covering" it. */
  var GLYPH_INSET = 10;

  /* Half the bar's height. Sampling at the bar's vertical MIDDLE (level with
     the logo) means the ink flips as a boundary crosses the middle of the
     control rather than its very top edge, which is what the eye reads as
     "the icon is now on the other section". */
  var PROBE_Y = 28;

  /* A marked element's RECT can be under the bar while the element itself is
     no longer VISIBLE there, because a later, opaque section has been dealt
     up over it. The homepage does exactly this: .doubts__panel is a navy fill
     on a pinned stage, and .doubts-cover (z-index 5, opaque ground) slides up
     and covers it while the panel stays pinned in place. Its rect still spans
     the bar long after the navy has stopped being what the eye sees, so a
     rect-only test left the hamburger painted WHITE on the white cover -- all
     but invisible.

     So a rect hit is confirmed by asking the browser what is actually on top
     at that point. The bar is lifted out of the hit-test first (it sits at
     the probe point and would otherwise be the answer), and the marked
     element counts only if it is the top element there or an ancestor of it
     -- an ancestor because the topmost hit is usually a child painted inside
     the marked section (a heading, a card, an image), which is still that
     section's ground as far as the bar is concerned.

     The hit may also be an ANCESTOR of the marked element rather than the
     element itself or a descendant of it. .site-footer__deep-probe is exactly
     that case: it is `pointer-events: none` (it must never eat clicks, being
     an invisible overlay across the whole footer), so the hit test returns the
     <footer> that contains it. Rejecting that would paint dark ink on the
     near-black footer -- the very thing the probe exists to prevent. An
     ancestor hit means nothing opaque came between the two, so the marked
     element is still what is being painted there.

     What this DOES reject is the case it was added for: a hit that is neither
     the element, inside it, nor outside-and-containing it -- i.e. a separate
     branch of the tree painted on top, like .doubts-cover over the pinned
     .doubts__panel.

     elementFromPoint replaces nothing above: the rect walk is still what
     finds the CANDIDATES, since a marked section is often not the topmost
     element anywhere. This only rejects candidates that are covered. */
  function isVisibleAt(el, x) {
    var prev = header.style.pointerEvents;
    header.style.pointerEvents = 'none';
    var hit = document.elementFromPoint(x, PROBE_Y);
    header.style.pointerEvents = prev;
    if (!hit) return false;
    return hit === el || el.contains(hit) || hit.contains(el);
  }

  /* Is a dark-marked element under the probe point right now?

     A walk over the marked elements, not elementFromPoint: the bar itself --
     and the open overlay -- sit at that point and would be the hit.

     Both axes are tested. Most marked elements are full-bleed sections where
     the horizontal test is always true, but a partial-width panel (the
     homepage's .doubts__panel starts at left:50% and sweeps left) is genuinely
     not under the bar for part of its travel, and a top/bottom-only test
     reported it as covering the bar the whole time.

     The horizontal test demands the panel span the glyph's FULL width rather
     than merely contain its centre point. No current section clips the glyph
     part-way -- every marked element either clears it or covers it outright --
     so today the two tests agree. The full-width rule is the safe one to hold
     if that changes: a panel edge landing mid-glyph keeps the dark ink that is
     still correct for the pale ground the rest of it sits on, instead of
     flipping the whole icon to white the moment the edge passes the centre.

     Nothing is cached: scrubbed sections change height and width as they
     animate, so every rect has to be read live. */
  function isOverDark() {
    var box = toggle && toggle.getBoundingClientRect();
    var left, right;
    if (box) {
      left = box.left + GLYPH_INSET;
      right = box.right - GLYPH_INSET;
    } else {
      left = window.innerWidth - 40;
      right = window.innerWidth - 20;
    }

    var mid = (left + right) / 2;
    var marked = document.querySelectorAll('[data-bar-ink="light"]');
    for (var i = 0; i < marked.length; i++) {
      var r = marked[i].getBoundingClientRect();
      if (r.top <= PROBE_Y && r.bottom > PROBE_Y && r.left <= left && r.right >= right) {
        if (isVisibleAt(marked[i], mid)) return true;
      }
    }
    return false;
  }

  /* --- Photographs -------------------------------------------------------

     The two ink colours, as relative luminance, so contrast can be compared
     against a sampled pixel. These mirror --text-primary and --text-on-deep
     as they resolve in style.css; they are only ever used to decide WHICH of
     the two to use, never to paint, so a small drift in the tokens changes
     nothing but a borderline decision. */
  var INK_DARK_L = 0.0221;   /* #142231 */
  var INK_LIGHT_L = 0.9614;  /* #FAFBFD */

  function relLuminance(r, g, b) {
    var c = [r, g, b].map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  function contrast(a, b) {
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }

  /* One reusable canvas; the sample is a handful of pixels, so the cost is a
     drawImage of a small source rect, not a full-page read. */
  var canvas = null;
  var ctx2d = null;

  /* Does this image want LIGHT ink under the glyph?

     The image is drawn into a tiny canvas, cropped to the strip the glyph
     actually crosses, and the two candidate inks are scored against the
     darkest and lightest tenth of that strip. Whichever holds up better on
     its WORST pixel wins -- an icon has to stay readable across the whole
     stroke, not on the average.

     Returns null when it cannot know: an image still loading, one with no
     intrinsic size yet, or -- the common case in production -- a cross-origin
     file, which taints the canvas and makes getImageData throw. Null means
     "no opinion", and the caller falls back to the markers, so a CORS-blocked
     photograph behaves exactly as it did before this existed. */
  function sampleImageInk(img, left, right) {
    if (!img.complete || !img.naturalWidth) return null;

    var r = img.getBoundingClientRect();
    if (!r.width || !r.height) return null;

    /* Map the glyph's strip from page space into the image's own pixels. The
       image is object-fit: cover in most of these components, so the source
       box is derived from the displayed box rather than assumed to be the
       whole file. */
    var scale = Math.max(r.width / img.naturalWidth, r.height / img.naturalHeight);
    var dw = img.naturalWidth * scale;
    var dh = img.naturalHeight * scale;
    var offX = (dw - r.width) / 2;
    var offY = (dh - r.height) / 2;

    var sx = (Math.max(left, r.left) - r.left + offX) / scale;
    var sw = (Math.min(right, r.right) - Math.max(left, r.left)) / scale;
    var sy = (PROBE_Y - r.top + offY) / scale;
    if (sw <= 0) return null;

    /* A band a few source pixels tall around the probe line, clamped inside
       the image so a glyph overhanging the edge still samples something. */
    var sh = Math.max(1, 8 / scale);
    sy = Math.max(0, Math.min(img.naturalHeight - sh, sy - sh / 2));
    sx = Math.max(0, Math.min(img.naturalWidth - 1, sx));
    sw = Math.max(1, Math.min(img.naturalWidth - sx, sw));

    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = 16;
      canvas.height = 4;
      ctx2d = canvas.getContext('2d', { willReadFrequently: true });
    }
    if (!ctx2d) return null;

    var data;
    try {
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);
      ctx2d.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      data = ctx2d.getImageData(0, 0, canvas.width, canvas.height).data;
    } catch (e) {
      return null;   /* tainted canvas (cross-origin image) */
    }

    var lums = [];
    for (var i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;          /* skip transparent pixels */
      lums.push(relLuminance(data[i], data[i + 1], data[i + 2]));
    }
    if (!lums.length) return null;

    lums.sort(function (a, b) { return a - b; });
    var lo = lums[Math.floor(lums.length * 0.1)];
    var hi = lums[Math.floor(lums.length * 0.9)];

    var darkScore = Math.min(contrast(INK_DARK_L, lo), contrast(INK_DARK_L, hi));
    var lightScore = Math.min(contrast(INK_LIGHT_L, lo), contrast(INK_LIGHT_L, hi));
    return lightScore > darkScore;
  }

  /* The topmost <img> under the glyph, if the ground there is a photograph at
     all. Uses the same lifted hit test as isVisibleAt: whatever is painted at
     the probe point, then up through its ancestors, because the hit is often
     a caption or overlay sitting on the picture rather than the <img> itself. */
  function imageUnderGlyph(x) {
    var prev = header.style.pointerEvents;
    header.style.pointerEvents = 'none';
    var hit = document.elementFromPoint(x, PROBE_Y);
    header.style.pointerEvents = prev;

    for (var el = hit; el && el !== document.body; el = el.parentElement) {
      if (el.tagName === 'IMG') return el;
      /* A picture/figure wrapper whose own image is the thing being painted. */
      var img = el.tagName === 'PICTURE' || el.tagName === 'FIGURE'
        ? el.querySelector('img') : null;
      if (img) return img;
    }
    return null;
  }

  /* .is-on-light is the DARK-ink state ("the bar is sitting on a light
     ground"), so it is the inverse of the probe. style.css hangs the flipped
     wordmark and hamburger colours off it.

     Order matters. The markers win when one applies, because they are the
     deliberate, reviewed answer for the flat grounds and for the pinned/
     scrubbed compositions whose layering the pixels alone would misread.
     Sampling only decides the case the markers cannot: an unmarked photograph
     under the glyph. If sampling has no opinion (null) the marker result
     stands unchanged. */
  function paintInk() {
    var dark = isOverDark();

    if (!dark) {
      var box = toggle && toggle.getBoundingClientRect();
      if (box) {
        var left = box.left + GLYPH_INSET;
        var right = box.right - GLYPH_INSET;
        var img = imageUnderGlyph((left + right) / 2);
        if (img) {
          var wantsLight = sampleImageInk(img, left, right);
          if (wantsLight !== null) dark = wantsLight;
        }
      }
    }

    header.classList.toggle('is-on-light', !dark);
  }

  /* Published for the two bar scripts, which already run their own
     rAF-throttled scroll pass and call this from inside it -- one layout read
     per frame across the whole bar rather than two competing listeners.

     The self-driven listener below is the fallback for any page that loads
     this file without one of those scripts, so the ink still tracks. It is
     rAF-throttled the same way, and a page that has a bar script simply
     paints the same class twice with the same value, which is a no-op. */
  window.__medshieldBarInk = { paint: paintInk };

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      ticking = false;
      paintInk();
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  /* Images and webfonts change section heights as they land, which moves the
     boundaries out from under the probe. Repaint when the page has finished
     settling as well as right now, so a reload that restores a scroll position
     mid-page is correct from the first frame. */
  paintInk();
  window.addEventListener('load', paintInk);
})();
