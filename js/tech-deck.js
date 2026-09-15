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

  /* THE RESTING POSITIONS, SEEDED BEFORE THE FIRST PAINT.

     THE FIRST VIEW IS THE PRIORITY, and it is decided here rather than by the
     first scrub tick. Card 01 is landed on its slot and cards 02-04 are still
     below the fold, which is exactly what write() produces at driver.v = 0 -
     so the first scrub tick confirms this frame instead of correcting it, and
     there is no jump when the pin engages.

     This matters more here than it would elsewhere, because the curtain
     reveals this section already in its initial state: the reader sees card
     01 sitting alone under the masthead, which is the honest opening for a
     stack that is about to build on top of it. */
  for (var i = 0; i < n; i++) {
    setCard(cards[i], i, 0);
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

  /* ONE CARD, ONE POSITION. Publishes the two properties the stylesheet
     spends, plus the paint order and the state attribute.

     pos is where the stack is, in card units: 0 = only card 01 landed,
     1.5 = card 02 landed and card 03 halfway up. For card k:

         rel = pos - k + 1    <= 0  -> still waiting below the fold
                              0..1  -> rising into its slot
                              >= 1  -> landed, and it never moves again

     --card-rise is 1 while waiting and 0 once landed, so the stylesheet
     spends it directly on the travel: a card at rise 1 sits a full card-height
     below its slot, and at rise 0 it is on it.

     --card-depth is how many cards have landed ON TOP of this one, which is
     what lets the stylesheet dim the buried layers a little without ever
     hiding them - the whole point of the stack is that they stay visible. */
  function setCard(card, k, pos) {
    var rel = pos - k + 1;

    var landed = rel;
    if (landed < 0) landed = 0;
    if (landed > 1) landed = 1;

    var rise = 1 - landed;

    /* HOW MANY ARE ON TOP. Every card after this one that has itself landed
       is sitting over it. Fractional while that card is still on its way, so
       the dim comes on smoothly rather than stepping as each one arrives. */
    var depth = 0;
    for (var j = k + 1; j < n; j++) {
      var d = pos - j + 1;
      depth += d < 0 ? 0 : (d > 1 ? 1 : d);
    }

    card.style.setProperty('--card-rise', rise.toFixed(4));
    card.style.setProperty('--card-depth', depth.toFixed(4));

    /* Three states. Nothing is ever 'gone' - that is the whole change: a
       card that has been read stays on screen as part of the stack. 'buried'
       marks a landed card with others on top of it, which is what takes it
       out of hit-testing so a click lands on the card actually in front. */
    var state = rise > 0.999 ? 'waiting'
              : (depth > 0.02 ? 'buried' : 'active');
    card.setAttribute('data-card-state', state);

    /* PAINT ORDER IS DOCUMENT ORDER, and in a stack that is all it can be:
       each card lands ON TOP of the one before it, so card 04 must paint over
       03 over 02 over 01, at every moment including mid-flight. A rising card
       is already above everything below it, which is correct - it is passing
       in front of them on its way to its slot. */
    card.style.setProperty('--card-z', String(10 + k));
  }

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

    var pos = v * (n - 1);

    for (var k = 0; k < n; k++) {
      setCard(cards[k], k, pos);
    }
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
           to - it is the ELEMENT that is transformed, not the scroller. */
        pinType: 'transform',
        anticipatePin: 1,
        /* A LITTLE MORE SOFTNESS, NOT LAG. The page runs its own wheel
           smoothing (hero.js), so the position ScrollTrigger reads is already
           eased; GSAP's scrub adds a second, shorter curve on top. 0.5 tracked
           the scroll almost rigidly and the card movement read as mechanical -
           it started and stopped exactly with the wheel. 0.65 rounds the ends
           of each movement without the deck visibly trailing the scrollbar.

           Deliberately small. A large scrub here is the "card catches up
           several moments later" failure: the scroll must stay the source of
           truth, and every state must still be reachable by holding still at
           a scroll position. */
        scrub: 0.65,
        invalidateOnRefresh: true
      }
    });

    tl.to(driver, { v: 1, onUpdate: write }, 0);
  }

  /* The class goes on only now, immediately before the pile is built, so a
     throw anywhere above leaves the cards as an ordinary column. */
  document.documentElement.classList.add('tech-deck-on');
  build();
  write();
}());
