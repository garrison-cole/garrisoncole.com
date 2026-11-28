/* reveal: sections fade up once as they come on screen.
   Replaces the old scroll-linked version, which re-drew pieces on every
   scroll frame and flickered on phones. Each piece now plays one short
   fade the first time it shows, then is left completely alone.
   - Only opacity and transform are animated.
   - Anything that is, holds or sits inside a scallop mask or drop shadow
     is never animated.
   - A piece is only touched when it is about to come on screen, so the
     page carries no waiting animations for things far down the page.
   - With no script, an old browser or reduced motion turned on,
     everything is simply visible. */
(function () {
  'use strict';
  if (!('IntersectionObserver' in window) || !Element.prototype.animate) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var SEL = '.rv,.rvi,.rvl,.rvb';
  var SKIP = '.shd,.scal,.mir,.scring,.f-scal,.f-tick,.hmk';
  var EASE = 'cubic-bezier(.2,.7,.2,1)';
  var KIND = {
    rv:  { ms: 800, kf: [{ opacity: 0, transform: 'translateY(22px)' }, { opacity: 1, transform: 'translateY(0)' }] },
    rvi: { ms: 900, kf: [{ opacity: 0 }, { opacity: 1 }] },
    rvl: { ms: 900, kf: [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }] },
    rvb: { ms: 900, kf: [{ opacity: 0, transform: 'scale(.6) rotate(-30deg)' }, { opacity: 1, transform: 'scale(1) rotate(0deg)' }] }
  };
  var state = new WeakMap(); // el -> { anim, started }

  function vh() { return window.innerHeight || document.documentElement.clientHeight; }

  function play(el) {
    var s = state.get(el);
    if (!s || !s.anim || s.started) return;
    s.started = true;
    s.anim.play();
  }

  function playWhenPhotoReady(el) {
    // a photo fades in after it has loaded, so it never fades in as an empty box
    var img = el.querySelector('img');
    if (!img || (img.complete && img.naturalWidth)) { play(el); return; }
    var go = function () { play(el); };
    img.addEventListener('load', go, { once: true });
    img.addEventListener('error', go, { once: true });
    setTimeout(go, 2500);
  }

  // step 2: the piece has reached the screen, so run its fade
  var onScreen = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      onScreen.unobserve(e.target);
      playWhenPhotoReady(e.target);
    });
  }, { threshold: 0 });

  // step 1: the piece is within 160px of the bottom of the screen, so get it ready
  var nearScreen = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target;
      nearScreen.unobserve(el);
      if (state.has(el)) return;
      if (e.boundingClientRect.top < vh() - 8) { state.set(el, { started: true }); return; } // already showing: leave it alone
      var kind = el.classList.contains('rvi') ? 'rvi' : el.classList.contains('rvl') ? 'rvl' : el.classList.contains('rvb') ? 'rvb' : 'rv';
      var k = KIND[kind];
      var anim = el.animate(k.kf, { duration: k.ms, easing: EASE, fill: 'backwards' });
      anim.pause(); // holds the first frame while the piece is still below the screen
      state.set(el, { anim: anim, started: false });
      onScreen.observe(el);
    });
  }, { rootMargin: '0px 0px 160px 0px', threshold: 0 });

  var list = document.querySelectorAll(SEL);
  for (var i = 0; i < list.length; i++) {
    var el = list[i];
    if (el.closest(SKIP) || el.querySelector(SKIP)) continue; // masked or shadowed: never animated
    if (el.getBoundingClientRect().top < vh()) continue;      // on screen at load: leave as is
    nearScreen.observe(el);
  }

  // safety net: never leave a piece hidden while it is on screen
  function sweep() {
    var all = document.querySelectorAll(SEL), h = vh();
    for (var j = 0; j < all.length; j++) {
      var s = state.get(all[j]);
      if (!s || s.started) continue;
      var r = all[j].getBoundingClientRect();
      if (r.top < h && r.bottom > 0) play(all[j]);
    }
  }
  window.addEventListener('pageshow', sweep);
  document.addEventListener('visibilitychange', sweep);
})();
