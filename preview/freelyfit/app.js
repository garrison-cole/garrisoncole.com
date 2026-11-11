/* FreelyFit Coaching site script. Vanilla JS, no dependencies.
   Order: settings, pure functions with worked test cases, data, tracking, wing system, interactive pieces, init. */
(function () {
  'use strict';

  /* ---------- settings: paste IDs to turn tracking on ---------- */
  var GA4_ID = '';      // e.g. G-XXXXXXX  [Garrison]
  var CLARITY_ID = '';  // e.g. abcd1234   [Garrison]
  var SITE_BASE = '';   // leave empty; the GHL paste build rewrites links to Kaboodle paths

  /* =====================================================================
     PURE FUNCTIONS
     ===================================================================== */

  /* triedItAll: turns the chips a visitor tapped into the sentence she sees.
     selected: array of chip labels. other: free text from the "other" chip (may be empty).
     Returns { state, count, lead, rest }. lead is set in the hand font, rest in Poppins. */
  function triedItAll(selected, other) {
    var list = (selected || []).filter(function (s) { return s && s !== 'other'; });
    var extra = (other || '').trim().slice(0, 40);
    if (extra) list.push(extra);
    var n = list.length;
    var hasTemplate = list.indexOf('a coach who sent a template') !== -1;
    var out = { state: 'empty', count: n, lead: 'tap a few.', rest: 'then see what we\'d tell you.' };
    if (n === 0) return out;
    if (n <= 2) {
      out.state = 'few';
      out.lead = list.join(' and ') + '.';
      out.rest = 'you tried, it didn\'t stick, and you\'re still out here looking for the thing that will, which is exactly the kind of woman we love coaching.';
    } else if (n <= 5) {
      out.state = 'some';
      out.lead = n + ' different plans.';
      out.rest = 'every one of them asked you to eat less and want it more, and you showed up for every single one, so effort like that deserves a plan built around your actual week.';
    } else {
      out.state = 'many';
      out.lead = n + ' different plans, which is years.';
      out.rest = 'years of showing up, and you\'re still here reading, which tells us a lot about how you\'d do once you finally have real support in your corner.';
    }
    if (hasTemplate) out.rest += ' and that template one always stings, which is why your protocol gets written for your week and rewritten whenever your week changes.';
    return out;
  }
  /* Test cases, worked by hand:
     triedItAll(['keto','75 Hard','macro tracking','a coach who sent a template'])
       -> state 'some', count 4, lead '4 different plans.', rest ends with the template line.
     triedItAll([]) -> state 'empty', lead 'tap a few.'
     triedItAll(['fasting']) -> state 'few', lead 'fasting.'
     triedItAll(['keto','other'], 'the soup diet') -> state 'few', lead 'keto and the soup diet.'
     triedItAll(seven chips) -> state 'many', lead '7 different plans, which is years.' */

  function countBucket(n) { return n === 0 ? '0' : n <= 2 ? '1-2' : n <= 5 ? '3-5' : '6+'; }
  /* countBucket(0) '0', countBucket(2) '1-2', countBucket(4) '3-5', countBucket(9) '6+' */

  /* timelineView: everything the Story Timeline needs to draw one position.
     story: an entry from STORIES. index: the stop the handle sits on (clamped).
     Returns { index, stop, lit, img, fill, hash, last }. */
  function timelineView(story, index) {
    var max = story.stops.length - 1;
    var i = Math.max(0, Math.min(max, Math.round(Number(index) || 0)));
    var lit = story.stops.map(function (_, k) { return k <= i; });
    var img = story.stops[i].img;
    for (var k = i; img == null && k >= 0; k--) img = story.stops[k].img;
    return {
      index: i, stop: story.stops[i], lit: lit, img: img == null ? 0 : img,
      fill: max === 0 ? 100 : Math.round((i / max) * 100),
      hash: 'story=' + story.id + '&at=' + i, last: i === max
    };
  }
  /* Test cases:
     timelineView(STORIES.olivia, 99) -> index 4 (clamped to the last stop), last true, fill 100,
       stop.text is the "fat loss phase hasn't even started yet" line, and no stop in Olivia's story has kind 'scale'.
     timelineView(STORIES.olivia, -3) -> index 0, fill 0, img 0.
     timelineView(STORIES.jauc, 2) -> img 2 (the building phase photo), lit [true,true,true,false]. */

  function parseHash(h) {
    var o = {};
    (h || '').replace(/^#/, '').split('&').forEach(function (p) { var kv = p.split('='); if (kv[0]) o[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || ''); });
    return o;
  }
  /* parseHash('#story=olivia&at=6') -> { story: 'olivia', at: '6' }; parseHash('') -> {} */

  function splitColumns(items, n) {
    var cols = []; for (var c = 0; c < n; c++) cols.push([]);
    items.forEach(function (it, i) { cols[i % n].push(it); });
    return cols;
  }
  /* splitColumns([a,b,c,d,e], 3) -> [[a,d],[b,e],[c]] */

  /* =====================================================================
     DATA (only what FreelyFit has posted; source on every story)
     ===================================================================== */
  var STORIES = {
    olivia: {
      id: 'olivia', name: 'Olivia', coach: '', title: '"I\'m not sure I\'m capable" turned bloat free baddie',
      meta: 'overnight nurse, over a year with us',
      quote: 'the mentality to believe that I am capable of achieving my fitness goals', quoteNote: 'from her application, on what was stopping her',
      imgs: ['client-olivia-01', 'client-olivia-02'],
      stops: [
        { when: 'when she applied', text: 'an overnight nurse working long shifts with PCOS and limited time, running on fumes.', kind: 'life', img: 0 },
        { when: 'her application', text: 'she wasn\'t sure she was capable of reaching her goals, and she wrote that down in almost those exact words.', kind: 'mind' },
        { when: 'along the way', text: 'she went through a breakup, a cross country move and a few job changes, and not one of them stopped her.', kind: 'life' },
        { when: 'the food', text: 'she\'s eating 1,200+ more calories a day and training on a structured 3 day split.', kind: 'food', img: 1 },
        { when: 'over a year in', text: 'and her fat loss phase hasn\'t even started yet.', kind: 'next', img: 1 }
      ],
      source: 'freelyfitcoaching.com/transformations'
    },
    maddie: {
      id: 'maddie', name: 'Maddie', coach: '', title: 'Down 30lbs & ditched her meds',
      meta: 'started as a beginner',
      imgs: ['client-maddie-01', 'client-maddie-02'],
      stops: [
        { when: 'when she started', text: 'a beginner who grew up in a chronic dieting household and wanted strength and fat loss without ever feeling restricted.', kind: 'life', img: 0 },
        { when: 'the first several months', text: 'we spent those months on sleep, overall calories and movement outside the gym so the foundation came first.', kind: 'training' },
        { when: 'along the way', text: 'she navigated a job transition, a surgery, seasons of mental health struggles and coming off her medications.', kind: 'life' },
        { when: 'the food', text: 'she learned that all foods fit and tried several new fruits and veggies she never thought she would.', kind: 'food', img: 1 },
        { when: 'now', text: 'she\'s 30 lbs down and off several medications.', kind: 'scale', img: 1 }
      ],
      source: 'freelyfitcoaching.com/transformations'
    },
    jauc: {
      id: 'jauc', name: 'Jauc', coach: 'Kae', title: 'Recomp queen',
      meta: 'three phases',
      imgs: ['client-jauc-01', 'client-jauc-02', 'client-jauc-03', 'client-jauc-05'],
      stops: [
        { when: 'when she joined', text: 'she\'d already done her own building phase and came in ready for a deficit.', kind: 'training', img: 0 },
        { when: 'deficit one, with Kae', text: 'she and Kae ran her first deficit together and she lost 20 lbs.', kind: 'scale', img: 1 },
        { when: 'building phase', text: 'she gained 15 back on purpose, kept 5 of the 20 off and looks incredibly different.', kind: 'training', img: 2 },
        { when: 'now', text: 'she\'s halfway through her second deficit, 3 lbs above her previous low with a lot more muscle.', kind: 'scale', img: 3 }
      ],
      source: 'freelyfitcoaching.com/transformations'
    },
    mama: {
      id: 'mama', name: 'Ashley', coach: 'Ave', title: 'From "You can\'t have kids" to muscle mommy',
      meta: 'postpartum mom, 25 lbs down',
      quote: 'Before I joined FreelyFit, my hormones were all messed up and so was my fertility.', quoteNote: 'in her words',
      imgs: ['client-mama-01', 'client-mama-02'],
      stops: [
        { when: 'before', text: '"my hormones were all messed up and so was my fertility."', kind: 'life', img: 0 },
        { when: 'with FreelyFit', text: '"Freely Fit is what helped my body get to where I am today."', kind: 'mind', img: 1 },
        { when: 'Riley', text: '"...the business she built helped bless me with Riley. And that\'s pretty dang special."', kind: 'life', img: 1 },
        { when: 'now', text: 'a postpartum mom who has lost 25 lbs since.', kind: 'scale', img: 1 }
      ],
      source: 'freelyfitcoaching.com/transformations'
    },
    madi: {
      id: 'madi', name: 'Madi', coach: '', title: 'Food fear to food freedom',
      meta: '"a hard and long road", 20 lbs gained',
      imgs: ['client-madi-01', 'client-madi-02'],
      stops: [
        { when: 'when she came in', text: 'she was afraid of food and afraid of getting bigger, and her social life had been traded for physical results.', kind: 'mind', img: 0 },
        { when: 'the approach', text: 'we put the "less is more" approach to the test with her.', kind: 'training' },
        { when: 'the food', text: 'she\'s eating 700+ more calories a day and has gained 20 lbs.', kind: 'food', img: 1 },
        { when: 'now', text: 'she goes out to eat with friends, tries a new food every week and eats meals she doesn\'t track at all.', kind: 'life', img: 1 }
      ],
      source: 'freelyfitcoaching.com/transformations'
    },
    jasmine: {
      id: 'jasmine', name: 'Jasmine', coach: '', title: 'Balancing work, a masters program & motherhood while dropping over 20lbs',
      meta: 'mom, full time job, master\'s degree, a year',
      imgs: ['client-jasmine-01', 'client-jasmine-02'],
      stops: [
        { when: 'when she came in', text: 'she\'s a mom working full time while getting her master\'s, and she was frustrated that nothing was moving.', kind: 'life', img: 0 },
        { when: 'the food', text: 'we brought her intake up almost 400 calories a day.', kind: 'food' },
        { when: 'the phase', text: 'then she went through a fat loss phase with routines that still leave time for her family and school.', kind: 'training' },
        { when: 'a year later', text: 'she\'s down 20+ lbs, with inches off her waist, arms and legs.', kind: 'scale', img: 1 }
      ],
      source: 'freelyfitcoaching.com/transformations'
    }
  };

  /* Caption wall: verbatim excerpts. Emoji other than the brand's were removed; punctuation lightly edited. */
  var CAPTIONS = [
    { t: 'I cut a single slice. I ate it slowly. I enjoyed every bite. Every action that followed was normal.', by: '@averyweiler', d: 'Oct 2026', u: 'https://www.instagram.com/averyweiler/reel/De3dz3NRrDK/' },
    { t: 'Come for the training/ nutrition but stay because we will ultimately end up navigating new jobs, weddings, pregnancies, postpartum, cross country moves, burnout and approximately 400 life crises together lol.', by: '@freelyfitcoaching', d: 'Oct 2026', u: 'https://www.instagram.com/freelyfitcoaching/p/De9xSPiGtnU/' },
    { t: 'coaches aren\'t perfect & if you saw our meal logs I think you\'d breathe a sigh of relief <3', by: 'Coach Kae', d: 'Jun 2026', u: 'https://www.instagram.com/freelyfitcoaching/reel/DZYhZzJgpI-/' },
    { t: 'The bravest thing I ever did was stop trying to figure it all out alone.', by: 'Coach Alecia', d: 'Jun 2025', u: 'https://www.instagram.com/alecia.lifts/p/DKxg_FqzfnS/' },
    { t: 'So you had a bad week. does that mean the progress is gone? You\'re back to where you started? You have to start over?', by: 'Coach Ciera', d: 'Jul 2026', u: 'https://www.instagram.com/ciera.lord/reel/DbWhMmKpXBr/' },
    { t: 'Sometimes I say yes to exactly what I want. Most of the time I make a version at home, or enhance the version I really want by adding a protein or veg to it.', by: '@averyweiler', d: 'Nov 2026', u: 'https://www.instagram.com/averyweiler/p/DfbWzkLFsJA/' },
    { t: 'just because it may be slow, doesn\'t mean it isn\'t happening. so take the pictures, collect the data & keep showing up my girl.', by: 'Coach Kae', d: 'Apr 2026', u: 'https://www.instagram.com/kaelaromano/p/DXpslT1jxDU/' },
    { t: 'Your progress is actually built during the messy weeks', by: 'Coach Alecia', d: 'Jun 2026', u: 'https://www.instagram.com/alecia.lifts/reel/DZqSrdLhQRr/' },
    { t: 'My gal has been working with me for the last 4 years, and I\'ve loved every season of it.', by: 'Coach Ang', d: 'Oct 2026', u: 'https://www.instagram.com/freelyfitcoaching/p/DezeED8mkzV/' },
    { t: 'What if I told you trying on dresses becomes fun. Going out dressed up doesn\'t lead to a spiral.', by: '@averyweiler', d: 'Jul 2026', u: 'https://www.instagram.com/averyweiler/reel/Daozsory10g/' },
    { t: 'The girl who goes on vacation without spiraling. The girl who knows one meal doesn\'t erase weeks of consistency.', by: 'for Coach Alecia\'s client', d: 'Aug 2026', u: 'https://www.instagram.com/freelyfitcoaching/p/DctktpGj50V/' },
    { t: '& honestly time passes whether you use it or not. Might as well use it to become the most confident version of yourself', by: 'Coach Ciera', d: 'Aug 2026', u: 'https://www.instagram.com/ciera.lord/reel/DcencDuRphO/' },
    { t: 'The woman who for the first time in 10 years took time completely off of the gym (and work) and didn\'t spiral.', by: '@averyweiler', d: 'Aug 2026', u: 'https://www.instagram.com/averyweiler/reel/DcB5WbSxbV7/' },
    { t: 'It\'s the women who learned how to navigate a hard week instead of starting over on Monday.', by: '@freelyfitcoaching', d: 'Jun 2026', u: 'https://www.instagram.com/freelyfitcoaching/p/Dads2ChlDu7/' },
    { t: 'if you\'re wanting to come back home to yourself too, you know where to find us', by: 'Coach Kae', d: 'Jun 2026', u: 'https://www.instagram.com/kaelaromano/p/DZDv9H6D7Vj/' },
    { t: 'you are always in the process of becoming.', by: '@freelyfitcoaching', d: 'Sep 2026', u: 'https://www.instagram.com/freelyfitcoaching/reel/DcwwN4oAYZZ/' },
    { t: 'The first step to achieving any goal is believing you can. The second step is having a good strategy', by: 'Coach Ciera', d: 'Jun 2026', u: 'https://www.instagram.com/ciera.lord/reel/DZGXQxJJse-/' },
    { t: 'I\'m throwing absolutely NO shade if I see some Reese\'s in there or dessert before dinner. in fact, we want to see that.', by: 'Coach Kae', d: 'Jun 2026', u: 'https://www.instagram.com/freelyfitcoaching/reel/DZYhZzJgpI-/' },
    { t: 'Health is supposed to fit into every season of life.', by: 'for Avery\'s client Lauren', d: 'Aug 2026', u: 'https://www.instagram.com/freelyfitcoaching/p/DdZWS_iG1Z7/' },
    { t: 'The point of coaching IS to learn to do it on your own, And Jennie girl know that you have a whole community cheering you on', by: 'for Coach Ciera\'s client', d: 'Oct 2026', u: 'https://www.instagram.com/freelyfitcoaching/p/DfFfrg7AfD_/' }
  ];

  /* =====================================================================
     TRACKING
     ===================================================================== */
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function loadTracking() {
    if (GA4_ID) {
      var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID; document.head.appendChild(s);
      window.dataLayer = window.dataLayer || []; window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date()); window.gtag('config', GA4_ID);
    }
    if (CLARITY_ID) {
      (function (c, l, a, r, i, t, y) { c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); }; t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i; y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y); })(window, document, 'clarity', 'script', CLARITY_ID);
    }
    /* Meta pixel 368636512260025 is set once at Kaboodle funnel or site level. Do not add it here. */
  }
  function track(name, params) {
    params = params || {};
    try { if (window.gtag) window.gtag('event', name, params); } catch (e) {}
    try { if (window.clarity) { window.clarity('event', name); Object.keys(params).forEach(function (k) { window.clarity('set', k, String(params[k])); }); } } catch (e) {}
  }
  var started = {};
  function startOnce(piece) { if (!started[piece]) { started[piece] = true; track('piece_start', { piece: piece }); } }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function imgSrc(base) { var root = document.documentElement.getAttribute('data-ff-assets') || 'img'; return root + '/' + base; }

  /* =====================================================================
     WING SYSTEM
     ===================================================================== */
  function openWings() {
    var root = document.documentElement;
    var fly = $('.ff-fly--hero');
    var go = function () {
      root.classList.remove('ff-preload');
      if (!fly) return;
      setTimeout(function () { fly.classList.add('is-idle'); track('wings_open'); }, reduce ? 0 : 1650);
    };
    if (reduce) { go(); return; }
    requestAnimationFrame(function () { requestAnimationFrame(go); });
  }

  function observeEmergence(selector) {
    var els = $$(selector);
    if (!('IntersectionObserver' in window) || reduce) { els.forEach(function (e) { e.classList.add('is-in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target, row = el.parentElement ? $$(selector, el.parentElement) : [el];
        var delay = Math.max(0, row.indexOf(el)) * 90;
        setTimeout(function () { el.classList.add('is-in'); }, Math.min(delay, 450));
        io.unobserve(el);
      });
    }, { threshold: 0.35 });
    els.forEach(function (e) { io.observe(e); });
  }

  function flutter(hero) {
    if (!hero || reduce || !window.matchMedia('(pointer: fine)').matches) return;
    var fly = $('.ff-fly--hero', hero); if (!fly) return;
    var layer = document.createElement('div'); layer.className = 'ff-flutter'; layer.setAttribute('aria-hidden', 'true'); hero.appendChild(layer);
    var parts = [], N = 12, target = null, last = 0, running = false, visible = true;
    function home() { var h = hero.getBoundingClientRect(), f = fly.getBoundingClientRect(); return { x: f.left - h.left + f.width / 2, y: f.top - h.top + f.height / 2 }; }
    for (var i = 0; i < N; i++) {
      var el = document.createElement('i'); layer.appendChild(el);
      var p = home(); parts.push({ el: el, x: p.x, y: p.y, lag: 0.03 + i * 0.012, ox: (Math.random() - .5) * 60, oy: (Math.random() - .5) * 50, r: Math.random() * 360 });
    }
    hero.addEventListener('pointermove', function (e) {
      var h = hero.getBoundingClientRect(); target = { x: e.clientX - h.left, y: e.clientY - h.top }; last = performance.now();
      if (!running) { running = true; requestAnimationFrame(tick); }
    });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(hero);
    function tick(now) {
      var idle = now - last, fade = idle > 2000;
      parts.forEach(function (p, k) {
        var tx = target.x + p.ox, ty = target.y + p.oy;
        p.x += (tx - p.x) * p.lag; p.y += (ty - p.y) * p.lag; p.r += 1.5 + k * .2;
        p.el.style.transform = 'translate(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px) rotate(' + p.r.toFixed(0) + 'deg) scaleX(' + Math.cos(p.r / 9).toFixed(2) + ')';
        p.el.style.opacity = fade ? 0 : .5;
      });
      if (visible && idle < 4000) requestAnimationFrame(tick); else running = false;
    }
  }

  /* pause looping animations while they're off screen, so scrolling stays smooth */
  function pauseOffscreen(sel) {
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) { e.target.classList.toggle('is-off', !e.isIntersecting); });
    }, { rootMargin: '100px 0px' });
    $$(sel).forEach(function (el) { io.observe(el); });
  }

  /* one thin line flows down the left margin and draws itself as you scroll, with a small dot at its tip,
     echoing the wing curve. Desktop only, one style write per scroll frame. */
  function initFlow() {
    if (reduce || !window.matchMedia('(min-width: 1000px)').matches || !document.createElementNS) return;
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'ff-flow'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    var ghost = document.createElementNS(NS, 'path'); ghost.setAttribute('class', 'ff-flow__ghost');
    var line = document.createElementNS(NS, 'path'); line.setAttribute('class', 'ff-flow__line');
    var tip = document.createElementNS(NS, 'circle'); tip.setAttribute('class', 'ff-flow__tip'); tip.setAttribute('r', '4');
    svg.appendChild(ghost); svg.appendChild(line); svg.appendChild(tip); document.body.appendChild(svg);
    var len = 0, H = 0, ticking = false, top0 = 0;
    function build() {
      var vw = document.documentElement.clientWidth, wrap = $('main .ff-wrap');
      var g = wrap ? (vw - wrap.getBoundingClientRect().width) / 2 : 0;
      if (g < 70) { svg.style.display = 'none'; return; }
      svg.style.display = '';
      var main = $('main'), hero = $('.ff-hero, .ff-phero');
      top0 = hero ? hero.getBoundingClientRect().bottom + window.scrollY - 40 : 400;
      svg.setAttribute('height', '0'); H = document.documentElement.scrollHeight;
      var w = g, x1 = w * .3, x2 = w * .7, step = 560, y = top0, d = 'M' + (w * .5).toFixed(1) + ' ' + y, side = 0;
      while (y < H - 200) {
        var ny = Math.min(y + step, H - 200), nx = side ? x1 : x2;
        d += ' C' + (side ? x2 : x1).toFixed(1) + ' ' + (y + step * .45).toFixed(0) + ' ' + nx.toFixed(1) + ' ' + (ny - step * .45).toFixed(0) + ' ' + nx.toFixed(1) + ' ' + ny.toFixed(0);
        y = ny; side = 1 - side;
      }
      svg.setAttribute('width', w.toFixed(0)); svg.setAttribute('height', H); svg.setAttribute('viewBox', '0 0 ' + w.toFixed(0) + ' ' + H);
      ghost.setAttribute('d', d); line.setAttribute('d', d);
      len = line.getTotalLength(); line.style.strokeDasharray = len + ' ' + len;
      draw();
    }
    function draw() {
      ticking = false; if (!len) return;
      var y = window.scrollY + window.innerHeight * .55;
      var p = Math.max(0, Math.min(1, (y - top0) / Math.max(1, H - 200 - top0)));
      line.style.strokeDashoffset = (len * (1 - p)).toFixed(1);
      var pt = line.getPointAtLength(len * p); tip.setAttribute('cx', pt.x.toFixed(1)); tip.setAttribute('cy', pt.y.toFixed(1));
      tip.style.opacity = p > 0 && p < 1 ? 1 : 0;
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(draw); } }, { passive: true });
    var t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(build, 150); });
    window.addEventListener('load', build);
    if ('ResizeObserver' in window) { var last = 0; new ResizeObserver(function () { var h = document.documentElement.scrollHeight; if (Math.abs(h - last) > 40) { last = h; clearTimeout(t); t = setTimeout(build, 150); } }).observe(document.body); }
    build();
  }

  /* =====================================================================
     PIECES
     ===================================================================== */
  function initNav() {
    var nav = $('.ff-nav'), btn = $('.ff-menu-btn'), sheet = $('.ff-sheet');
    if (btn && sheet) btn.addEventListener('click', function () {
      var open = sheet.classList.toggle('is-open'); btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    var onScroll = function () { if (nav) nav.classList.toggle('is-scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    initBar();
  }

  /* The phone Apply bar shows only once the hero has scrolled away and no other Apply button is on screen. */
  function initBar() {
    var bar = $('.ff-bar'); if (!bar || !('IntersectionObserver' in window)) return;
    var link = $('a', bar), hero = $('[data-hero-apply]') || $('.ff-hero') || $('.ff-phero') || $('main section');
    if (!hero) return;
    var others = $$('[data-apply]').filter(function (a) { return !bar.contains(a) && !a.closest('.ff-nav') && !a.closest('.ff-sheet'); });
    var heroGone = false, visible = new Set();
    function update() {
      var on = heroGone && visible.size === 0;
      bar.classList.toggle('is-on', on);
      bar.setAttribute('aria-hidden', on ? 'false' : 'true');
      if (link) link.tabIndex = on ? 0 : -1;
    }
    new IntersectionObserver(function (en) {
      var e = en[0]; heroGone = !e.isIntersecting && e.boundingClientRect.top < 0; update();
    }, { threshold: 0 }).observe(hero);
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) { if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target); }); update();
    }, { threshold: 0 });
    others.forEach(function (a) { if (a !== hero) io.observe(a); });
  }

  function initTracking() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a,button'); if (!a) return;
      if (a.hasAttribute('data-apply')) track('apply_click', { location: a.getAttribute('data-loc') || 'page' });
      if (a.hasAttribute('data-resource')) track('resource_click', { resource: a.getAttribute('data-resource') });
    });
    var fired = false;
    window.addEventListener('scroll', function () {
      if (fired) return;
      var h = document.documentElement; if ((window.scrollY + window.innerHeight) / h.scrollHeight >= .75) { fired = true; track('scroll_75', { page: location.pathname }); }
    }, { passive: true });
    if (document.body.hasAttribute('data-page-apply') || $('[data-page="apply"]')) track('apply_view', { tried: parseHash(location.hash).tried || '' });
    if ($('[data-page="applied"]')) track('apply_complete');
  }

  function initTried() {
    var box = $('[data-tried]'); if (!box) return;
    var chips = $$('.ff-chip', box), otherWrap = $('.ff-other', box), otherInput = $('.ff-other input', box);
    var lead = $('.ff-result__lead', box), rest = $('.ff-result__rest', box), out = $('.ff-result', box), go = $('.ff-result .ff-btn', box);
    var lastState = '';
    function selected() { return chips.filter(function (c) { return c.getAttribute('aria-pressed') === 'true'; }).map(function (c) { return c.getAttribute('data-v'); }); }
    function render() {
      var sel = selected(), r = triedItAll(sel, sel.indexOf('other') !== -1 && otherInput ? otherInput.value : '');
      var swap = function () { lead.textContent = r.lead; rest.textContent = r.rest; out.classList.remove('is-out'); };
      if (reduce) swap(); else { out.classList.add('is-out'); setTimeout(swap, 180); }
      var href = (go.getAttribute('data-base') || go.getAttribute('href')).split('#')[0];
      go.setAttribute('href', r.count ? href + '#tried=' + encodeURIComponent(sel.filter(function (s) { return s !== 'other'; }).join(',')) : href);
      go.hidden = r.count === 0;
      if (r.state !== lastState && r.count) track('piece_result', { piece: 'tried', outcome: countBucket(r.count) });
      lastState = r.state;
    }
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        startOnce('tried');
        var on = c.getAttribute('aria-pressed') !== 'true'; c.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (c.getAttribute('data-v') === 'other' && otherWrap) { otherWrap.classList.toggle('is-on', on); if (on && otherInput) otherInput.focus(); }
        render();
      });
    });
    if (otherInput) otherInput.addEventListener('input', render);
    go.setAttribute('data-base', go.getAttribute('href'));
    go.hidden = true;
  }

  function buildStory(root, story, startAt) {
    var photo = $('.ff-story__photo', root), range = $('.ff-range', root), stopsEl = $('.ff-track__stops', root);
    var whenEl = $('.ff-stopcard__when', root), textEl = $('.ff-stopcard__text', root), kindEl = $('.ff-stopcard__kind', root);
    var card = $('.ff-stopcard', root), sourceEl = $('.ff-story__source', root);
    $('.ff-story__name', root).textContent = story.name;
    $('.ff-story__title', root).textContent = story.title;
    $('.ff-story__meta', root).textContent = (story.coach ? 'coached by ' + story.coach + ', ' : '') + story.meta;
    var q = $('.ff-story__quote', root);
    if (q) { if (story.quote) { q.hidden = false; q.textContent = '"' + story.quote + '"' + (story.quoteNote ? ' (' + story.quoteNote + ')' : ''); } else q.hidden = true; }
    if (sourceEl) sourceEl.innerHTML = 'as posted on <a href="https://' + story.source + '">' + story.source + '</a>. photos shared by FreelyFit.';
    photo.querySelectorAll('img').forEach(function (i) { i.remove(); });
    story.imgs.forEach(function (base, k) {
      var im = document.createElement('img'); im.src = imgSrc(base + '.webp'); im.alt = story.name + ', progress photos as posted by FreelyFit (' + (k + 1) + ' of ' + story.imgs.length + ')';
      im.width = 900; im.height = 900; im.loading = 'lazy'; im.decoding = 'async'; if (k) im.className = 'is-hidden';
      photo.insertBefore(im, photo.querySelector('figcaption'));
    });
    stopsEl.innerHTML = '';
    var n = story.stops.length;
    story.stops.forEach(function (s, k) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'ff-track__stop'; b.setAttribute('data-kind', s.kind);
      b.style.left = (n === 1 ? 50 : (k / (n - 1)) * 100) + '%'; b.setAttribute('aria-label', 'Go to: ' + s.when);
      var lab = document.createElement('span'); lab.className = 'ff-track__lab'; lab.textContent = s.when; lab.setAttribute('aria-hidden', 'true'); b.appendChild(lab);
      b.addEventListener('click', function () { range.value = k; draw(k, true); range.focus(); });
      stopsEl.appendChild(b);
    });
    range.min = 0; range.max = n - 1; range.step = 1;
    var labels = $('.ff-track__labels', root);
    if (labels) labels.innerHTML = '<span>' + story.stops[0].when + '</span><span>' + story.stops[n - 1].when + '</span>';
    var reachedEnd = false;
    nudge(root, range);
    function draw(i, user) {
      var v = timelineView(story, i);
      range.value = v.index; range.style.setProperty('--fill', v.fill + '%');
      range.setAttribute('aria-valuetext', v.stop.when + ': ' + v.stop.text);
      $$('.ff-track__stop', stopsEl).forEach(function (b, k) { b.classList.toggle('is-lit', v.lit[k]); b.classList.toggle('is-now', k === v.index); });
      var imgs = $$('img', photo); imgs.forEach(function (im, k) { im.classList.toggle('is-hidden', k !== v.img); });
      var set = function () { whenEl.textContent = v.stop.when; textEl.textContent = v.stop.text; kindEl.textContent = v.stop.kind === 'scale' ? 'the scale, as posted' : ''; card.classList.remove('is-out'); };
      if (user && !reduce) { card.classList.add('is-out'); setTimeout(set, 180); } else set();
      if (user) {
        startOnce('timeline');
        if (history.replaceState && root.hasAttribute('data-hash')) history.replaceState(null, '', '#' + v.hash);
        if (v.index >= Math.min(n - 1, 2)) track('story_open', { story: story.id });
        if (v.last && !reachedEnd) { reachedEnd = true; track('piece_result', { piece: 'timeline', outcome: story.id }); }
      }
    }
    range.oninput = function () { draw(range.value, true); };
    draw(startAt || 0, false);
  }

  function initStories() {
    $$('[data-story]').forEach(function (root) {
      var h = parseHash(location.hash), id = root.getAttribute('data-story');
      if (root.hasAttribute('data-hash') && h.story && STORIES[h.story]) id = h.story;
      var picks = $$('[data-pick]', root.parentElement || root);
      var at = root.hasAttribute('data-hash') && h.story === id ? Number(h.at) || 0 : 0;
      buildStory(root, STORIES[id], at);
      picks.forEach(function (p) {
        p.setAttribute('aria-pressed', p.getAttribute('data-pick') === id ? 'true' : 'false');
        p.addEventListener('click', function () {
          picks.forEach(function (o) { o.setAttribute('aria-pressed', 'false'); }); p.setAttribute('aria-pressed', 'true');
          buildStory(root, STORIES[p.getAttribute('data-pick')], 0);
          if (history.replaceState && root.hasAttribute('data-hash')) history.replaceState(null, '', '#story=' + p.getAttribute('data-pick') + '&at=0');
        });
      });
    });
  }

  function initWall() {
    var wall = $('[data-wall]'); if (!wall) return;
    var ncols = window.matchMedia('(min-width: 900px)').matches ? 3 : window.matchMedia('(min-width: 600px)').matches ? 2 : 1;
    var resume;
    wall.addEventListener('touchstart', function () { wall.classList.add('is-paused'); clearTimeout(resume); }, { passive: true });
    wall.addEventListener('touchend', function () { clearTimeout(resume); resume = setTimeout(function () { wall.classList.remove('is-paused'); }, 4000); }, { passive: true });
    var cols = splitColumns(CAPTIONS, ncols), durs = [36, 48, 42];
    var dlg = $('.ff-dialog--cap'), dText = dlg && $('p', dlg), dBy = dlg && $('.ff-dialog__by', dlg), dLink = dlg && $('a', dlg);
    wall.innerHTML = '';
    cols.forEach(function (items, c) {
      var col = document.createElement('div'); col.className = 'ff-wall__col'; col.style.setProperty('--dur', durs[c] + 's');
      [false, true].forEach(function (copy) {
        var grp = document.createElement('div'); grp.style.display = 'contents';
        if (copy) grp.setAttribute('aria-hidden', 'true');
        items.forEach(function (it) {
          var b = document.createElement('button'); b.type = 'button'; b.className = 'ff-cap'; if (copy) b.tabIndex = -1;
          var short = it.t.length > 150 ? it.t.slice(0, 147).replace(/\s\S*$/, '') + '...' : it.t;
          b.innerHTML = ''; b.appendChild(document.createTextNode(short));
          var sm = document.createElement('small'); sm.textContent = it.by + ', ' + it.d; b.appendChild(sm);
          b.addEventListener('click', function () {
            startOnce('wall');
            if (!dlg || !dlg.showModal) { window.open(it.u, '_blank', 'noopener'); return; }
            dText.textContent = it.t; dBy.textContent = it.by + ', ' + it.d; dLink.href = it.u; dlg.showModal();
            track('piece_result', { piece: 'wall', outcome: it.by });
          });
          grp.appendChild(b);
        });
        col.appendChild(grp);
      });
      wall.appendChild(col);
    });
    if (dlg) {
      $('.ff-dialog__close', dlg).addEventListener('click', function () { dlg.close(); });
      dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    }
  }

  function initDeck() {
    $$('.ff-card').forEach(function (card) {
      var front = $('.ff-card__front', card), back = $('.ff-card__back', card);
      var openBtn = $('.ff-card__flip', front), backBtn = $('.ff-card__flip--back', back);
      if (!openBtn || !backBtn) return;
      function set(on) {
        card.classList.toggle('is-flipped', on);
        openBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
        front.setAttribute('aria-hidden', on ? 'true' : 'false'); back.setAttribute('aria-hidden', on ? 'false' : 'true');
        if (on) { front.setAttribute('inert', ''); back.removeAttribute('inert'); back.scrollTop = 0; setTimeout(function () { backBtn.focus({ preventScroll: true }); back.scrollTop = 0; }, 60); }
        else { back.setAttribute('inert', ''); front.removeAttribute('inert'); setTimeout(function () { openBtn.focus({ preventScroll: true }); }, 60); }
      }
      openBtn.addEventListener('click', function () { startOnce('deck'); set(true); track('piece_result', { piece: 'deck', outcome: card.getAttribute('data-coach') }); });
      backBtn.addEventListener('click', function () { set(false); });
      card.addEventListener('keydown', function (e) { if (e.key === 'Escape' && card.classList.contains('is-flipped')) set(false); });
    });
    // phones: the deck is a swipe carousel with dots
    var deck = $('.ff-deck'); if (!deck) return;
    var cards = $$('.ff-card', deck), dots = document.createElement('div');
    dots.className = 'ff-deckdots'; dots.setAttribute('role', 'group'); dots.setAttribute('aria-label', 'Choose a coach');
    cards.forEach(function (c, i) {
      var d = document.createElement('button'); d.type = 'button'; d.className = 'ff-deckdot';
      d.setAttribute('aria-label', 'Show ' + ($('.ff-card__name', c) || {}).textContent);
      d.addEventListener('click', function () { deck.scrollTo({ left: c.offsetLeft - (deck.clientWidth - c.clientWidth) / 2, behavior: reduce ? 'auto' : 'smooth' }); });
      dots.appendChild(d);
    });
    deck.parentNode.insertBefore(dots, deck.nextSibling);
    var all = $$('.ff-deckdot', dots);
    function mark() {
      var mid = deck.scrollLeft + deck.clientWidth / 2, best = 0, bd = 1e9;
      cards.forEach(function (c, i) { var d = Math.abs(c.offsetLeft + c.clientWidth / 2 - mid); if (d < bd) { bd = d; best = i; } });
      all.forEach(function (d, i) { d.setAttribute('aria-current', i === best ? 'true' : 'false'); });
    }
    deck.addEventListener('scroll', function () { window.requestAnimationFrame(mark); }, { passive: true }); mark();
  }

  /* Stories: "show six more" on phones, and tap-to-enlarge DMs */
  function initMore() {
    var box = $('[data-receipts]'), btn = $('[data-more-btn]');
    if (box && btn) btn.addEventListener('click', function () {
      box.classList.add('is-open'); btn.hidden = true; btn.setAttribute('aria-expanded', 'true');
      var first = $('[data-first-more]', box); if (first) first.focus();
    });
    var dlg = $('.ff-dialog--img'); if (!dlg || !dlg.showModal) return;
    var im = $('img', dlg), cap = $('.ff-dialog__cap', dlg);
    $$('[data-enlarge]').forEach(function (b) {
      b.addEventListener('click', function () {
        var src = $('img', b); im.src = src.currentSrc || src.src; im.alt = src.alt;
        var fc = b.parentNode.querySelector('figcaption'); cap.textContent = fc ? fc.textContent : '';
        dlg.showModal();
      });
    });
    $('.ff-dialog__close', dlg).addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  }

  function initVideos() {
    $$('[data-video]').forEach(function (fig) {
      var btn = $('.ff-play', fig); if (!btn) return;
      btn.addEventListener('click', function () {
        var v = document.createElement('video'); v.src = fig.getAttribute('data-video'); v.controls = true; v.playsInline = true; v.autoplay = true;
        v.setAttribute('aria-label', 'Video testimonial from ' + fig.getAttribute('data-name'));
        var frame = $('.ff-video__frame', fig); frame.innerHTML = ''; frame.appendChild(v);
        var p = v.play(); if (p && p.catch) p.catch(function () {});
        track('video_play', { name: fig.getAttribute('data-name') });
      });
    });
  }

  function initFaq() {
    $$('.ff-faq details').forEach(function (d) {
      var s = $('summary', d), body = $('.ff-faq__body', d);
      if (!s || !body || reduce) return;
      s.addEventListener('click', function (e) {
        e.preventDefault();
        if (d.open) {
          body.style.height = body.scrollHeight + 'px'; requestAnimationFrame(function () { body.style.height = '0px'; body.style.opacity = '0'; });
          setTimeout(function () { d.open = false; body.style.height = ''; body.style.opacity = ''; }, 200);
        } else {
          d.open = true; var h = body.scrollHeight; body.style.height = '0px'; body.style.opacity = '0';
          requestAnimationFrame(function () { body.style.height = h + 'px'; body.style.opacity = '1'; });
          setTimeout(function () { body.style.height = ''; }, 220);
        }
      });
    });
  }

  function initApplyFrame() {
    var f = $('[data-form-frame]'); if (!f) return;
    var src = f.getAttribute('data-src'), qs = location.search ? location.search.slice(1) : '';
    var box = f.parentNode, load = box && box.querySelector('.ff-formbox__loading');
    if (load) f.addEventListener('load', function () { load.hidden = true; });
    f.src = src + (qs ? (src.indexOf('?') === -1 ? '?' : '&') + qs : '');
  }

  /* one gentle hint that the handle moves, the first time a timeline comes into view */
  var nudged = false;
  function nudge(root, range) {
    if (reduce || nudged || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (en) {
      if (!en[0].isIntersecting || nudged) return;
      nudged = true; io.disconnect();
      if (Number(range.value) !== 0) return;
      range.classList.add('is-nudge'); setTimeout(function () { range.classList.remove('is-nudge'); }, 950);
    }, { threshold: 0.6 });
    io.observe(root);
  }

  /* every new page opens at the top; back and forward still return to where you were */
  function startAtTop() {
    try {
      var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      if (nav && nav.type === 'back_forward') return;
    } catch (e) {}
    var id = location.hash.slice(1);
    if (id && document.getElementById(id)) return;
    function top() {
      var h = document.documentElement, was = h.style.scrollBehavior;
      h.style.scrollBehavior = 'auto'; window.scrollTo(0, 0); h.style.scrollBehavior = was;
    }
    top(); requestAnimationFrame(top); window.addEventListener('load', top, { once: true });
  }

  function init() {
    document.documentElement.classList.add('ff-js');
    startAtTop();
    loadTracking();
    openWings();
    initNav();
    initTracking();
    observeEmergence('.ff-emerge');
    flutter($('.ff-hero'));
    initTried();
    initStories();
    initWall();
    initDeck();
    initMore();
    initVideos();
    initFaq();
    initApplyFrame();
    pauseOffscreen('.ff-fly, [data-wall]');
    initFlow();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
