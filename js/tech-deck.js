/* ==========================================================================
   MedShield — tech-deck.js
   The card deck in section 08c ("The technology").

   THE PRINCIPLE. The section heading and the cards are ONE pinned object.
   When the stage reaches the top of the fold it locks there: the masthead
   holds still at the top for the whole run, and the cards STACK UP in the
   space beneath it, one at a time.

   Each card rises from below the fold and LANDS on its own slot, a little
   lower than the card before it. It then stops, for good:

       card 01 lands  ->  card 02 rises over it, landing lower
                      ->  card 03 rises over BOTH, landing lower again

   So scrolling DOWN builds the pile. Nothing ever leaves: a card that has
   been read stays on screen as a visible strip under the ones that followed
   it, which is what makes the section read as an accumulating stack rather
   than as a carousel. At the end all four are on screen at once, offset down
   the fold, and the reader can see the whole set they were shown.

   WHY EACH CARD IS OPAQUE. The old deck was glass - translucent, blurred,
   with only ever one card readable at the reading spot. A stack cannot be:
   four translucent panes laid over one another compound into mud, and every
   card here stays on screen to the end. So the surface is solid, and depth is
   carried by the slot offset, the shadow each card casts on the one beneath,
   and a slight dim on the buried layers.

   WHY A PIN. The heading has to stay still while the cards move through the
   space under it, so the stage is pinned for the length of the run and the
   scroll that would have moved the page drives the deck instead. One card
   leaves per unit of progress, so the reader spends the same gesture on each.

   WHAT IS PINNED, AND WHY IT IS NOT THE SECTION. .tech is the reveal target
   of the why->tech curtain (why-to-people.js), which makes the SECTION
   position:fixed for the length of that transition and clips .why away over
   the top of it. A ScrollTrigger pin on the same element would contend with
   that for position and transform. So this pins .tech__stage, an inner
   wrapper holding BOTH the masthead and the cards, exactly as doubts.js pins
   .doubts__stage rather than .doubts. The two mechanisms then never touch the
   same element:

       .why        pinned by why-to-people.js   (the curtain)
       .tech       fixed by that same file      (the reveal target)
       .tech__stage pinned by THIS file         (header + cards)

   ORDERING. The curtain finishes before this pin starts: the deck's trigger
   is 'top top' on the stage, which cannot be reached until .tech is an
   ordinary block again, which is exactly what the curtain releasing means.
   Nothing here needs to know about the curtain beyond not fighting it.

   PROGRESSIVE ENHANCEMENT. html.tech-deck-on is added only when this file is
   going to drive the deck. Everything that stacks the cards lives behind
   that class in style.css, so with no JS, no GSAP, a throw in here, or
   prefers-reduced-motion the header sits above an ordinary column of four
   cards and the section reads as a normal block. Nothing is ever hidden by
   CSS that only JS can bring back.

   NO CONTROLS. The deck is driven by scroll alone - there are no arrows or
   dots. A control would need state of its own, or would have to seek the
   scroll position behind the reader's back; the scrub is the single source
   of truth and nothing else is allowed to move the deck.

   Depends on: gsap.min.js, ScrollTrigger.min.js (js/vendor/, loaded before
   this file in index.html).
   ========================================================================== */
(function () {
  'use strict';

  var section = document.getElementById('tech');
  if (!section) return;

  var stage = section.querySelector('[data-tech-stage]');
  var cards = section.querySelectorAll('.tech__card');
  if (!stage || cards.length < 2) return;

  if (!window.gsap || !window.ScrollTrigger) return;

  var reduce = window.matchMedia &&
               window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  gsap.registerPlugin(ScrollTrigger);

  var n = cards.length;
  var area = section.querySelector('.tech__cards');
  if (!area) return;

  /* THE GEOMETRY IS MEASURED, NOT AUTHORED.

     Every earlier version spent a CSS --slot clamp per breakpoint, and every
     one of them was wrong somewhere: the step cut through the tag list or the
     paragraph on one width, ran the last card off the bottom of the area on
     another. The numbers it depends on - how tall each card's content is,
     where its number and title end, how much room is left under the
     masthead - are only known after layout, so they are read here.

       slot     the step between cards: the identity line (number + title)
                plus a little air, so a buried strip ends in the gap under the
                title rather than through a line of type. It tightens toward
                the bare identity line when the fold is short.

     NOTHING IS EVER RAISED TO MAKE IT FIT. An earlier version lifted the
     whole pile when the front card ran long, which slid card 01's top edge
     and brand rule under the clip box - the top line disappearing. If the
     stack cannot hold every card at the tightest step, the deck is not used
     and the section stays an ordinary column. */
  var geo = { slot: 0, h: [], hide: 0, fits: true };

  /* How far past a covering card's top edge a buried card stays painted.
     Larger than the card radius, so the covering card's rounded corners still
     show the card beneath them. */
  var OVERLAP = 24;

  function px(v) { return parseFloat(v) || 0; }

  function measure() {
    var cs = getComputedStyle(area);
    var padT = px(cs.paddingTop);
    var inner = area.clientHeight - padT - px(cs.paddingBottom);
    var ident = 0;
    var air = 0;
    var tallest = 0;

    /* Natural heights first: drop the fill-down floor set below. */
    for (var r = 0; r < n; r++) cards[r].style.minHeight = '';

    for (var i = 0; i < n; i++) {
      var c = cards[i];
      geo.h[i] = c.offsetHeight;
      if (geo.h[i] > tallest) tallest = geo.h[i];

      /* offsetTop is relative to the card (it is the positioned ancestor) and
         ignores transforms, so this reads the same mid-flight as at rest. */
      var num = c.querySelector('.tech__cardNum');
      var title = c.querySelector('.tech__cardTitle');
      var b = 0;
      if (num) b = Math.max(b, num.offsetTop + num.offsetHeight);
      if (title) b = Math.max(b, title.offsetTop + title.offsetHeight);
      if (b > ident) ident = b;

      var pt = px(getComputedStyle(c).paddingTop);
      if (pt > air) air = pt;
    }

    var want = Math.ceil(ident + air * 0.6);
    var least = Math.ceil(ident + 4);
    var cap = Infinity;
    for (var k = 1; k < n; k++) cap = Math.min(cap, (inner - geo.h[k]) / k);
    geo.slot = Math.max(least, Math.floor(Math.min(want, cap)));

    /* SNAPPED TO THE COPY'S LINES, wherever the paragraph sits beside the
       title (the wide row) and so crosses the strip's lower edge. The step
       becomes the copy's top plus a whole number of lines, so the next
       card's edge falls in the leading between two lines: a buried card
       keeps its paragraph visible, cut cleanly after a full line. */
    var copy = cards[1].querySelector('.tech__cardCopy');
    if (copy && copy.offsetTop < ident) {
      var lh = px(getComputedStyle(copy).lineHeight);
      if (lh > 0) {
        var snapped = copy.offsetTop +
          Math.max(1, Math.ceil((least - copy.offsetTop) / lh)) * lh;
        if (snapped <= cap) geo.slot = Math.round(snapped);
      }
    }

    /* Parked fully below the clip box. */
    geo.hide = area.clientHeight - padT + 24;
    geo.fits = tallest <= inner && cap >= least;

    /* FILLED DOWN TO THE FOOT OF THE AREA. Each card is stretched from its
       slot to the bottom of the card area, so whichever card is in front its
       ground runs all the way down - no band of bare page under a short
       card. Only ever a floor: a card taller than its share keeps its own
       height. A buried card's extra length is clipped under the card above. */
    /* Past the area's own bottom padding and the card radius, so the ground
       runs off the foot of the fold with no rounded corners or page showing. */
    var under = px(cs.paddingBottom) + 24;
    if (geo.fits) {
      for (var f = 0; f < n; f++) {
        var fill = Math.floor(inner - f * geo.slot + under);
        if (fill > geo.h[f]) {
          cards[f].style.minHeight = fill + 'px';
          geo.h[f] = fill;
        }
      }
    }
  }

  /* A FOLD TOO SHORT FOR THE STACK (landscape phones) gets the plain column.
     The class has to be on to measure the stacked layout, so it goes on, the
     stack is measured, and it comes straight back off if it cannot work -
     all before the first paint, since this file is deferred. */
  document.documentElement.classList.add('tech-deck-on');
  measure();
  if (!geo.fits) {
    document.documentElement.classList.remove('tech-deck-on');
    return;
  }

  /* SCROLL PER CARD. One unit of scroll buys one card's arrival, which is the
     rate that reads as "one at a time" rather than as a pile dropping at once.

     EVERY CARD GETS A UNIT NOW, INCLUDING THE LAST. This is the substantive
     change from the deck that discarded cards: there, card 04 had no
     departure of its own - it was what was left standing - so the run was
     (n-1) units long. In a stack card 04 has an ARRIVAL like every other, and
     it is the arrival that completes the composition, so the run is n-1
     travels (cards 02, 03 and 04 rising; card 01 is already landed) plus a
     tail in which the finished stack is held.

     Phones get a shorter unit for the same reason .why's rail is shorter
     there: a flick covers far more of the page per gesture. */
  var PER_CARD_VH = 0.60;
  var PER_CARD_VH_SM = 0.50;

  /* THE TAIL. The stack is only complete on the pixel the last card lands, and
     landing on the same pixel the pin releases gives the reader no moment to
     see the finished set. This is the hold in which all four cards sit
     stacked, still, before the section lets go.

     write() already reserves the last 12% of the scrubbed value as a hold, so
     what is added here is spent after that with nothing moving. 0.35 keeps
     the release clear of the final landing without a screen of dead pinned
     scroll. */
  var TAIL_VH = 0.35;

  /* THE STAGE'S OWN HEIGHT, NOT window.innerHeight.

     The stage is `height: 100svh` - the SMALL viewport measure, the fold with
     the mobile URL bar SHOWING. window.innerHeight is the LARGE measure, the
     fold with it hidden. They are equal on desktop and differ by the height
     of that bar on mobile, and the run was measured in one unit while the
     thing being pinned was laid out in the other: every card's travel was
     scaled against a box that was never that tall, and the surplus showed up
     as pinned scroll with nothing left to move.

     style.css has the same trap documented on .doubts, which buys its way out
     with a 96px overshoot. Reading the pinned element's real measured height
     needs no allowance at all - it is the number the CSS actually resolved. */
  function stageH() {
    return stage.getBoundingClientRect().height ||
           window.innerHeight ||
           document.documentElement.clientHeight;
  }

  function unit() {
    var f = window.innerWidth <= 860 ? PER_CARD_VH_SM : PER_CARD_VH;
    return stageH() * f;
  }

  function runDistance() {
    return Math.round(unit() * (n - 1) + stageH() * TAIL_VH);
  }

  /* No startPixel() any more. The stage is now a bare full-viewport child of
     the section, so 'top top' means exactly what it says: pin when the stage
     - the pile itself - reaches the top of the fold. The masthead above it is
     ordinary scrolling content, which is what makes the reader see the
     section's heading and the first card BEFORE anything pins.

     Every earlier attempt to compute this as a number was working around the
     stage being nested under the masthead inside a section that is itself a
     fixed-position curtain target. With the stage lifted out, the geometry is
     honest and the keyword is correct. */

  /* THE DRIVER. One value, 0..1 across the whole run, converted per card to
     that card's own 0..1 arrival. Card k rises across the (k-1)-th unit:

         deck * (n-1)  ->  a position along the stack, 0 .. n-1
         card k's rise =   1 - clamp(position - k + 1, 0, 1)

     so at position 1.4 card 01 is landed, card 02 is landed, card 03 is 40%
     of the way up, and card 04 has not started. That is what makes them
     arrive in sequence off ONE scrubbed value, with no per-card timeline to
     keep in step and nothing that can drift.

     The card's transform is authored in style.css; this writes only the
     numbers. */
  var driver = { v: 0 };

  /* THE WHOLE PILE AT ONE POSITION.

     pos is where the stack is, in card units: 0 = only card 01 landed,
     1.5 = card 02 landed and card 03 halfway up. For card k:

         landed = clamp(pos - k + 1, 0, 1)    0 waiting .. 1 on its slot

     and its offset from the top of the area is

         y = slot*k + (1 - landed) * (hide - slot*k)

     Three things are published per card, all in px or 0..1:

       --card-y     the offset above.
       --card-clip  a buried card is cut OVERLAP px under the top edge of the
                    card covering it. The cards differ in height, and a taller
                    buried card otherwise paints its lower edge in the open
                    below a shorter card on top of it - the stray border lines
                    the stack used to show. The cut always sits under the
                    opaque card above, so it is never itself visible.
       --card-fade  everything but the number and title fades as the next
                    card arrives, so a buried strip shows the card's identity
                    and never a line of copy sliced at the strip's edge. */
  function landedAt(k, pos) {
    var l = pos - k + 1;
    return l < 0 ? 0 : (l > 1 ? 1 : l);
  }

  function place(pos) {
    var y = [];
    var landed = [];
    var k;

    for (k = 0; k < n; k++) {
      landed[k] = landedAt(k, pos);
      var rest = geo.slot * k;
      y[k] = rest + (1 - landed[k]) * (geo.hide - rest);
    }

    for (k = 0; k < n; k++) {
      var card = cards[k];
      var next = k + 1 < n ? landed[k + 1] : 0;

      var cut = 0;
      if (k + 1 < n && next > 0) {
        var shown = y[k + 1] - y[k] + OVERLAP;
        cut = Math.max(0, geo.h[k] - Math.max(shown, 0));
      }

      /* Done before the next card lands, so no half-faded line is ever
         left meeting the seam. */
      var fade = (next - 0.4) / 0.45;
      fade = fade < 0 ? 0 : (fade > 1 ? 1 : fade);

      card.style.setProperty('--card-y', y[k].toFixed(2) + 'px');
      card.style.setProperty('--card-clip',
        cut > 0 ? 'inset(-64px -64px ' + cut.toFixed(2) + 'px -64px)' : 'none');
      card.style.setProperty('--card-fade', fade.toFixed(4));

      /* 'buried' takes a covered card out of hit-testing so a click lands on
         the card actually in front; 'waiting' is still below the fold. */
      var state = landed[k] < 0.001 ? 'waiting'
                : (next > 0.02 ? 'buried' : 'active');
      card.setAttribute('data-card-state', state);

      /* Paint order is document order: each card lands ON TOP of the one
         before it, including mid-flight. */
      card.style.setProperty('--card-z', String(10 + k));
    }
  }

  /* THE OPENING FRAME, seeded before the first paint: card 01 on its slot,
     02-04 below the fold - exactly what write() produces at driver.v = 0, so
     there is no jump when the pin engages. */
  place(0);

  function write() {
    /* THE LEAD-IN AND THE TAIL.

       The run opens and closes with a hold. The lead-in is what lets card 01
       be seen alone on its slot before anything rises to cover it - the
       opening view of the section. The tail is what lets the COMPLETED stack
       be seen, all four cards stepped down the fold, before the pin releases
       and the page moves on. Both holds are carved out of the scrubbed value
       before it is turned into a position, so the travel stays linear.

       The tail is the larger of the two and stays that way: the finished
       stack is the thing this section exists to show, and it is the last
       thing the reader sees before .people. */
    var LEAD_IN = 0.045;
    var TAIL = 0.12;
    var span = 1 - LEAD_IN - TAIL;
    var v = (driver.v - LEAD_IN) / span;
    v = v < 0 ? 0 : (v > 1 ? 1 : v);

    place(v * (n - 1));
  }

  var tl = null;

  function build() {
    tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        /* THE START IS THE CURTAIN'S RELEASE PIXEL, AS A NUMBER.

           It cannot be the `top top` keyword. why-to-people.js lifts this
           section onto the fold for the whole of its curtain - that is what
           makes the reveal uncover a COMPOSED section rather than blank
           ground - so the stage's top is at the top of the fold from the
           curtain's FIRST frame, and `top top` fires there: the two pins
           share an opening pixel and this deck spends the curtain's whole
           distance running behind a reel that is still painting. Measured,
           card 01 was 75% departed by the time the curtain finished.

           NOR CAN IT BE AN OFFSET ON THE KEYWORD. Both signs were measured
           and both are wrong, because with pinType 'fixed' ScrollTrigger pins
           the element at the viewport offset it has WHEN THE TRIGGER FIRES -
           so the offset moves the frozen position with it:

             'top top+=810'  fires 810px EARLIER: start 11410 -> 10600.
             'top top-=810'  fires at the right pixel, 12220, but freezes the
                             stage at top:-810 - the masthead 788px ABOVE the
                             fold for the entire run.

           The same fault is in this file's history as 'top top-=450'.

           A NUMERIC START HAS NEITHER PROBLEM. ScrollTrigger takes a plain
           number as an absolute scroll position, and at that position the
           stage is already exactly at the top of the fold (the lift put it
           there), so the pin freezes it flush at top:0 with nothing to
           correct - and the run begins on the pixel the curtain hands over.

           THE NUMBER IS THE SECTION'S RESTING PIXEL, NOT THE CURTAIN'S END.
           They differ by (vh - push): the push is 0.9 of a viewport and the
           lift is a viewport plus the push, so at the release the section
           still has that much travel left before its top reaches the fold.
           why-to-people.js adds the term and publishes the sum, because both
           halves of it are that file's to know.

           FUNCTION-BASED so it re-solves on every refresh, and it falls back
           to 'top top' if why-to-people.js never built its pin (reduced
           motion, no GSAP, a throw) - correct, because then there is no
           curtain to clear and no lift either. */
        trigger: stage,
        start: function () {
          var release = (typeof window.__medshieldWhyRelease === 'function')
            ? window.__medshieldWhyRelease()
            : null;
          return (typeof release === 'number') ? release : 'top top';
        },
        /* FUNCTION-BASED, so ScrollTrigger re-evaluates it on every refresh
           itself. It used to be a plain string restated from a refreshInit
           listener, which was working around a limitation that does not
           exist: a function end is the supported way to say "re-measure
           this", and it runs at the right point in the refresh without a
           listener that has to be kept in step with invalidateOnRefresh. */
        end: function () { return '+=' + runDistance(); },
        pin: stage,
        /* ScrollTrigger reserves the run as document height of its own. The
           section has no rail of its own to spend (unlike .why), so there is
           nothing here for the pin to eat and the spacing must be added. */
        pinSpacing: true,
        /* A TRANSFORM PIN, NOT A FIXED ONE, AND THE UPSTREAM LIFT IS WHY.

           doubts.js and process-to-cases.js both pin 'fixed' on this page and
           are right to: they pin an element sitting in ordinary flow, so the
           viewport offset ScrollTrigger freezes IS the top of the fold.

           This stage is not in ordinary flow at the moment its pin engages.
           why-to-people.js lifts the whole section by a viewport plus the
           push (its spacer carries margin-bottom: -1710px at 1440x900) so the
           curtain can reveal a composed section, and at the release the stage
           is still travelling through that lift. A fixed pin freezes the
           offset it finds AT THAT INSTANT - measured, it wrote
           top:-810.078px and held the masthead 788px above the fold for the
           entire run, which is a blank screen where the deck should be.

           A transform pin translates the stage relative to its own pin-spacer
           instead of writing a viewport offset, so it cannot inherit a
           half-spent lift. Measured with this change the stage holds a single
           steady position for the whole run, and the deck scrubs underneath a
           masthead that does not move.

           The usual objection to a transform pin is a scroll-smoothing
           library that writes its own transforms; this page has none. hero.js
           drives real window.scrollTo, which a transform pin is indifferent
           to - it is the ELEMENT that is transformed, not the scroller.

           ---------------------------------------------------------------
           DO NOT CHANGE THIS TO 'fixed'. IT HAS NOW BEEN TRIED TWICE.

           The argument for flipping it is superficially strong and it is
           wrong. It goes: every other pin on the page is 'fixed'; doubts.js
           even says at its own pinType that "a transform pin would fight that
           engine's per-frame writes"; and the note above claims the page has
           no transform-writing scroll library, which is stale, because the
           engine was only moved out of hero.js into smooth-scroll.js.

           All of that is true and none of it applies, because it addresses
           the wrong half of the setup. What forces 'transform' here is not
           what writes the scroll - it is WHAT THIS PARTICULAR ELEMENT SITS
           INSIDE. .w2p carries margin-bottom of -(vh + push), about -1710px
           at 1440x900, and that negative margin is live geometry at the
           moment this trigger fires. A fixed pin SNAPSHOTS the stage's
           viewport offset at engage time and freezes it, so it captures the
           lift and parks the stage off the top of the fold - and the reader
           reaches the section to find it blank, flickering in and out as the
           progress value crosses back over its own thresholds. That is the
           top:-810.078px fault above, observed again.

           THE NUMERIC START DOES NOT RETIRE THIS. That was the reasoning the
           second attempt rested on, and the distinction it missed is worth
           stating plainly: the numeric start fixed WHEN the pin fires. It did
           nothing about WHERE the stage sits when it does, which is still
           inside the lift. The two are independent, and only the second one
           is what pinType has to survive.

           tech-deck is legitimately the odd one out on this page because its
           pinned element is the only one in lifted rather than ordinary flow.
           If the shiver this was meant to cure comes back, the suspect is
           js/scroll-sync.js forcing ScrollTrigger.update() from inside the
           scroll engine's own rAF - which recomputes a transform pin's
           cancelling translate against a just-written position, one frame
           out of step with paint. Test by removing that file from index.html,
           not by touching this line. */
        pinType: 'transform',
        anticipatePin: 1,
        /* DIRECT, NOT A NUMBER - the same answer as every other scrubbed
           section on this page, and for the same reason.

           This was 0.65, reached by tuning against the symptom: 0.5 read as
           "mechanical", so the number went up. That was treating a lag as if
           it were an easing, and it is not. `scrub: n` is a SMOOTHING LAG -
           the timeline chases the scroll position over n seconds. It buys
           softness only when the position being chased is raw.

           IT IS NOT RAW HERE. smooth-scroll.js cancels the browser's wheel
           scrolling outright and eases its own position toward the wheel on a
           Lenis curve (1 - exp(-dt / (DURATION / LENIS_LN)), DURATION 1.25),
           writing it with window.scrollTo. So the position ScrollTrigger
           samples has ALREADY been through one exponential curve, and a
           numeric scrub puts a second one in series with it.

           Two exponential curves stacked is exactly the feel being reported:
           the deck does not track the wheel, it drifts after it and then
           catches up when the scroll stops. The ends of each card's travel
           are the worst of it, because that is where both curves are at their
           flattest and the residual is largest.

           scrub:true removes GSAP's curve entirely and makes the timeline a
           pure function of scroll position. The softness does not go away -
           it comes from the page's own smoothing, which is the single place
           this page eases scroll and the reason why-to-people.js,
           cases-to-why.js and process-to-cases.js all pass `true` with this
           same note. The deck was the one section that did not, and it is the
           one section that reads as unsmooth.

           It also restores the property the numeric scrub quietly broke:
           every state is reachable by HOLDING STILL at a scroll position,
           because position now maps to progress with nothing in between. */
        scrub: true,
        invalidateOnRefresh: true
      }
    });

    tl.to(driver, { v: 1, onUpdate: write }, 0);
  }

  build();
  write();

  /* RE-MEASURED ON EVERY REFRESH - resize, font swap, image decode - so the
     step and the clip always match the layout actually on screen. */
  ScrollTrigger.addEventListener('refresh', function () {
    measure();
    write();
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { measure(); write(); });
  }
}());
