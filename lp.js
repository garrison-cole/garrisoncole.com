/* dc-lite: renders the prototype's page templates in a normal browser.
   Each page ships its template in <template id="dc-tpl"> and its original
   Component class; this file supplies DCLogic, holes, sc-for, sc-if,
   events, and an in-place DOM update so inputs and animations survive. */
(function () {
  'use strict';
  var inst = null, tpl = null, root = null, queued = false;

  function DCLogic(props) { this.props = props || {}; this.state = {}; }
  DCLogic.prototype.setState = function (p, cb) {
    var next = typeof p === 'function' ? p(this.state, this.props) : p;
    this.state = Object.assign({}, this.state, next);
    schedule();
    if (cb) Promise.resolve().then(cb);
  };
  DCLogic.prototype.forceUpdate = function () { schedule(); };
  window.DCLogic = DCLogic;

  function schedule() {
    if (queued) return;
    queued = true;
    Promise.resolve().then(function () { queued = false; render(); });
  }

  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  var WHOLE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;

  function lookup(path, scopes) {
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    var q = path.match(/^(['"])(.*)\1$/);
    if (q) return q[2];
    var parts = path.split('.');
    var head = parts[0], cur;
    for (var i = 0; i < scopes.length; i++) {
      var s = scopes[i];
      if (s != null && head in Object(s)) { cur = s[head]; break; }
    }
    for (var k = 1; k < parts.length; k++) {
      if (cur == null) return undefined;
      cur = cur[parts[k]];
    }
    return cur;
  }

  function interp(str, scopes) {
    return str.replace(HOLE, function (_, p) {
      var v = lookup(p, scopes);
      return v == null || v === false ? '' : String(v);
    });
  }

  function eventName(attr, el) {
    var n = attr.slice(2);
    if (n === 'change') {
      var t = (el.getAttribute('type') || '').toLowerCase();
      if ((el.localName === 'input' && t !== 'checkbox' && t !== 'radio') || el.localName === 'textarea') return 'input';
    }
    if (n === 'doubleclick') return 'dblclick';
    return n;
  }

  function bind(el, type) {
    el.__dcb = el.__dcb || {};
    if (el.__dcb[type]) return;
    el.__dcb[type] = true;
    el.addEventListener(type, function (e) {
      var f = el.__dc && el.__dc[type];
      if (typeof f === 'function') f(e);
    });
  }

  function build(nodes, scopes, parent) {
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.nodeType === 3) { parent.appendChild(document.createTextNode(interp(n.nodeValue, scopes))); continue; }
      if (n.nodeType !== 1) continue;
      var tag = n.localName;
      if (tag === 'sc-for') {
        var list = lookup((n.getAttribute('list') || '').replace(WHOLE, '$1'), scopes) || [];
        var as = n.getAttribute('as') || 'item';
        for (var j = 0; j < list.length; j++) {
          var sc = {}; sc[as] = list[j]; sc.$index = j;
          build(n.childNodes, [sc].concat(scopes), parent);
        }
        continue;
      }
      if (tag === 'sc-if') {
        if (lookup((n.getAttribute('value') || '').replace(WHOLE, '$1'), scopes)) build(n.childNodes, scopes, parent);
        continue;
      }
      var el = n.namespaceURI && n.namespaceURI !== 'http://www.w3.org/1999/xhtml'
        ? document.createElementNS(n.namespaceURI, n.localName)
        : document.createElement(tag);
      for (var a = 0; a < n.attributes.length; a++) {
        var at = n.attributes[a], name = at.name, val = at.value, m = val.match(WHOLE);
        if (/^on[a-z]+$/.test(name)) {
          if (m) {
            el.__dc = el.__dc || {};
            var type = eventName(name, n);
            el.__dc[type] = lookup(m[1], scopes);
            bind(el, type);
          }
          continue;
        }
        if (m) {
          var v = lookup(m[1], scopes);
          if (/^(aria|data)-/.test(name)) { if (v != null) el.setAttribute(name, String(v)); continue; }
          if (v === false || v == null) continue;
          el.setAttribute(name, v === true ? '' : String(v));
        } else {
          el.setAttribute(name, val.indexOf('{{') >= 0 ? interp(val, scopes) : val);
        }
      }
      if (tag === 'input' && el.hasAttribute('value')) el.value = el.getAttribute('value');
      build(tag === 'template' ? n.content.childNodes : n.childNodes, scopes, el);
      parent.appendChild(el);
    }
  }

  function sameKind(a, b) {
    if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) return false;
    if (a.nodeType !== 1) return true;
    if (a.namespaceURI !== b.namespaceURI) return false;
    return a.getAttribute('aria-label') === b.getAttribute('aria-label') && a.id === b.id;
  }

  function morph(a, b) {
    if (!sameKind(a, b)) { a.parentNode.replaceChild(b, a); return; }
    if (a.nodeType === 3) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
    var i, at;
    for (i = a.attributes.length - 1; i >= 0; i--) { at = a.attributes[i]; if (!b.hasAttribute(at.name)) a.removeAttribute(at.name); }
    for (i = 0; i < b.attributes.length; i++) { at = b.attributes[i]; if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value); }
    if (a.localName === 'input' && b.hasAttribute('value') && a.value !== b.getAttribute('value')) a.value = b.getAttribute('value');
    a.__dc = b.__dc;
    if (a.__dc) for (var t in a.__dc) bind(a, t);
    morphChildren(a, b);
  }

  function morphChildren(oldP, newP) {
    var o = Array.prototype.slice.call(oldP.childNodes), n = Array.prototype.slice.call(newP.childNodes);
    for (var i = 0; i < n.length; i++) {
      if (i < o.length) morph(o[i], n[i]); else oldP.appendChild(n[i]);
    }
    for (var j = n.length; j < o.length; j++) oldP.removeChild(o[j]);
  }

  function render() {
    var vals;
    try { vals = inst.renderVals(); } catch (e) { console.error(e); return; }
    var frag = document.createElement('div');
    build(tpl.content.childNodes, [vals], frag);
    morphChildren(root, frag);
  }

  window.DCLite = {
    mount: function (Comp, props) {
      tpl = document.getElementById('dc-tpl');
      root = document.getElementById('dc-root');
      inst = new Comp(props || {});
      render();
      if (typeof inst.componentDidMount === 'function') inst.componentDidMount();
    }
  };
})();

/* ---------- garrisoncole.com ad landing pages (v5). Settings first. ---------- */
const LP = {
  FORMSPREE_ID: "mrppnbab",
  GA4_ID: "",                 // "G-XXXXXXXXXX"
  GOOGLE_ADS_ID: "AW-18498275090",          // "AW-XXXXXXXXXX"
  GOOGLE_ADS_LEAD_LABEL: "wUHYCJO2rLUdEJKO1fRE",  // label of the lead conversion
  GOOGLE_ADS_CALL_LABEL: "",  // optional: label of "Calls from website"
  CLARITY_ID: "",
  BOOKING_URL: "",            // Google Calendar booking page or Calendly link. Empty hides every booking link.
  PHONE: "+17606444559",
  PHONE_SHOWN: "760-644-4559"
};

/* ---------- Pure functions. Add ?test to the URL to run the checks. ---------- */
function cleanName(s, max = 40) {
  return String(s == null ? "" : s).replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}
const titleCase = (s) => s.replace(/(^|[ \-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
function cleanPhone(s) {
  let d = String(s == null ? "" : s).replace(/\D/g, "");
  if (d.length === 11 && d[0] === "1") d = d.slice(1);
  return d.slice(0, 10);
}
const phoneOk = (s) => { const d = cleanPhone(s); return d.length === 10 && d[0] > "1" && d[3] > "1"; };
const formatPhone = (d) => (d.length === 10 ? "(" + d.slice(0, 3) + ") " + d.slice(3, 6) + "-" + d.slice(6) : d);
const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function dueDay(dayIndex) {
  let k = dayIndex, n = 0;
  while (n < 2) { k = (k + 1) % 7; if (k !== 0 && k !== 6) n += 1; }
  return WD[k];
}
function nextDay(dayIndex) {
  let k = (dayIndex + 1) % 7;
  while (k === 0 || k === 6) k = (k + 1) % 7;
  return WD[k];
}
function smsHref(co, page) {
  const what = page === "websites" ? "I'd like to see a first draft of a site" : "I'd like the free two-minute video";
  const body = "Hi Garrison, " + (co ? "this is " + co + ". " : "") + what + ".";
  return "sms:" + LP.PHONE + "?&body=" + encodeURIComponent(body);
}
const est = (job) => ({ booked: job + " estimate, Thursday 8am", feed: job + " we just finished in {town}", offer: "Free Estimates", btn: "Book an estimate" });
const TRADES = [
  Object.assign({ label: "Fencing", kw: "fence contractor" }, est("Fence")),
  { label: "Photography", kw: "wedding photographer", booked: "Engagement shoot, Saturday 10am", feed: "A {town} wedding we just shot", offer: "Check Your Date", btn: "Check my date" },
  Object.assign({ label: "Landscaping", kw: "landscaper" }, est("Backyard")),
  { label: "Bridal", kw: "bridal shop", booked: "Bridal appointment, Saturday 11am", feed: "New gowns just arrived in {town}", offer: "Book Your Appointment", btn: "Book an appointment" },
  Object.assign({ label: "Cleaning", kw: "house cleaning" }, est("Deep clean")),
  { label: "Florist", kw: "wedding florist", booked: "Wedding flowers consult, Thursday 2pm", feed: "Wedding flowers we just delivered in {town}", offer: "Request a Quote", btn: "Request a quote" },
  Object.assign({ label: "Painting", kw: "house painter" }, est("Exterior paint")),
  { label: "Med spa", kw: "med spa", booked: "Consultation, Friday 1pm", feed: "Before and after from a {town} client", offer: "Book a Consult", btn: "Book a consult" },
  Object.assign({ label: "Concrete", kw: "concrete contractor" }, est("Driveway")),
  { label: "Event planning", kw: "wedding planner", booked: "Planning consult, Thursday 2pm", feed: "A {town} wedding we just planned", offer: "Check Your Date", btn: "Check my date" },
  Object.assign({ label: "Pools", kw: "pool builder" }, est("Pool")),
  { label: "Hair and makeup", kw: "bridal hair and makeup", booked: "Bridal trial, Friday 1pm", feed: "Bridal party we just finished in {town}", offer: "Check Your Date", btn: "Check my date" },
  Object.assign({ label: "Tree service", kw: "tree service" }, est("Tree removal")),
  { label: "Interior design", kw: "interior designer", booked: "Design consult, Tuesday 10am", feed: "A {town} kitchen we just finished", offer: "Book a Consult", btn: "Book a consult" },
  Object.assign({ label: "Garage doors", kw: "garage door repair" }, est("Garage door")),
  Object.assign({ label: "Epoxy", kw: "epoxy garage floor" }, est("Garage floor"))
];
function tradeFor(key, typed) {
  const t = cleanName(typed, 30);
  if (key === "__custom" && t) {
    return { label: titleCase(t), kw: t.toLowerCase(), booked: "New " + t.toLowerCase() + " client, Thursday 8am", feed: "Our latest work in {town}", offer: "Get a Quote", btn: "Get a quote", custom: true };
  }
  return TRADES.find((x) => x.label === key) || TRADES[0];
}
/** Finds a listed trade by its name or search phrase, any case. Returns "" when nothing fits. */
function matchTrade(s) {
  const q = cleanName(s, 30).toLowerCase();
  const hit = TRADES.find((x) => x.label.toLowerCase() === q || x.kw === q);
  return hit ? hit.label : "";
}
function selfTest() {
  const t = [
    ["cleanName strips tags", cleanName("  <b>Acme</b>   Fence ") === "bAcme/b Fence"],
    ["cleanName caps length", cleanName("x".repeat(90)).length === 40],
    ["cleanPhone drops 1", cleanPhone("+1 (916) 555-0142") === "9165550142"],
    ["phoneOk good", phoneOk("916-555-0142") === true],
    ["phoneOk short", phoneOk("916-555") === false],
    ["phoneOk bad area code", phoneOk("116-555-0142") === false],
    ["formatPhone", formatPhone("9165550142") === "(916) 555-0142"],
    ["dueDay Monday", dueDay(1) === "Wednesday"],
    ["dueDay Thursday", dueDay(4) === "Monday"],
    ["nextDay Friday", nextDay(5) === "Monday"],
    ["smsHref encodes", smsHref("A&B Fence", "websites").includes("A%26B%20Fence")],
    ["tradeFor default", tradeFor("nope", "").label === "Fencing"],
    ["tradeFor custom", tradeFor("__custom", "dog groomer").label === "Dog Groomer"],
    ["tradeFor custom empty falls back", tradeFor("__custom", "  ").label === "Fencing"],
    ["matchTrade by name", matchTrade("bridal") === "Bridal"],
    ["matchTrade by search", matchTrade("Wedding Florist") === "Florist"],
    ["matchTrade miss", matchTrade("roofing") === ""]
  ];
  console.table(t.map(([name, pass]) => ({ name, pass })));
  return t.every((r) => r[1]);
}

/* ---------- Page plumbing ---------- */
const PAGE = document.documentElement.dataset.page || "";
const store = {
  get(k) { try { return JSON.parse(sessionStorage.getItem(k) || "null"); } catch (e) { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
};
/* Events carry the page, the field and true/false flags. Never the company name or the number. */
function track(name, params) {
  if (typeof window.gtag === "function") window.gtag("event", name, Object.assign({ lp: PAGE }, params || {}));
}
function initTracking() {
  const ids = [LP.GA4_ID, LP.GOOGLE_ADS_ID].filter(Boolean);
  if (ids.length) {
    const s = document.createElement("script");
    s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + ids[0];
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    ids.forEach((id) => window.gtag("config", id));
    if (LP.GOOGLE_ADS_ID && LP.GOOGLE_ADS_CALL_LABEL) {
      window.gtag("config", LP.GOOGLE_ADS_ID + "/" + LP.GOOGLE_ADS_CALL_LABEL, { phone_conversion_number: LP.PHONE_SHOWN });
    }
  }
  if (LP.CLARITY_ID) {
    (function (c, l, a, r, i, t, y) { c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); }; t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i; y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y); })(window, document, "clarity", "script", LP.CLARITY_ID);
  }
}
/* Click IDs and campaign tags ride along with the lead. Same storage key as the main site. */
function captureAd() {
  const q = new URLSearchParams(location.search), keep = store.get("gc-utm") || {};
  ["gclid", "gbraid", "wbraid", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach((k) => {
    const v = q.get(k); if (v) keep[k] = v.slice(0, 120);
  });
  if (!keep.landing) keep.landing = location.pathname;
  store.set("gc-utm", keep);
  return keep;
}

/* ---------- The landing page ---------- */
class Component extends DCLogic {
  constructor(props) {
    super(props);
    const q = new URLSearchParams(location.search);
    const saved = store.get("gc-lp5") || {};
    const asked = cleanName(q.get("trade"), 30);
    const listed = matchTrade(asked);
    this.town = titleCase(cleanName(q.get("town"), 28)) || "Roseville";
    this.state = {
      company: cleanName(q.get("co")) || saved.company || "",
      phone: "", step: 1, err: "", sending: false, sendFail: false, trap: "",
      trade: listed || (asked ? "__custom" : saved.trade || "Fencing"),
      custom: listed ? "" : asked || saved.custom || "",
      channel: "search"
    };
  }
  keep() { const s = this.state; store.set("gc-lp5", { company: s.company, trade: s.trade, custom: s.custom }); }
  async send(e, where) {
    e.preventDefault();
    const s = this.state;
    if (s.sending) return;
    const d = cleanPhone(s.phone);
    if (!phoneOk(d)) return this.setState({ err: "That number looks short. I need all ten digits to text you.", sendFail: false });
    if (s.trap) return;
    this.setState({ err: "", sendFail: false, sending: true });
    const co = cleanName(s.company), tr = tradeFor(s.trade, s.custom), web = PAGE === "websites";
    const body = Object.assign({
      _subject: (web ? "Website draft request: " : "Video request: ") + co,
      company: co, phone: formatPhone(d), field: tr.label,
      wants: web ? "Build-first website draft" : "Free two-minute video",
      looked_at: s.channel, page: PAGE, form: where
    }, store.get("gc-utm") || {});
    try {
      const r = await fetch("https://formspree.io/f/" + LP.FORMSPREE_ID, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error("bad status");
      store.set("gc-lp-sent", { co, last4: d.slice(6), page: PAGE, trade: tr.custom ? "custom" : tr.label, fresh: true });
      location.href = "sent.html";
    } catch (x) {
      this.setState({ sending: false, sendFail: true });
      track("lp_send_error", { where });
    }
  }
  renderVals() {
    const st = this.state, web = PAGE === "websites", town = this.town;
    const co = cleanName(st.company), coName = co || "Your Company";
    const tr = tradeFor(st.trade, st.custom);
    const kw = cleanName((store.get("gc-utm") || {}).utm_term, 60).toLowerCase();
    const noun = web ? "first draft" : "video";
    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })).getDay();
    const inTown = (s) => s.replace("{town}", town);
    const next = (where) => (e) => {
      e.preventDefault();
      if (cleanName(this.state.company).length < 2) return;
      this.setState({ step: 2 }, () => { const el = document.getElementById(where === "hero" ? "ph1" : "ph2"); if (el) el.focus(); }); this.keep();
      track("lp_step1", { where, trade: tr.custom ? "custom" : tr.label });
    };
    return {
      keyword: kw, hasKw: !!kw,
      web, grow: !web,
      accent: "#A35F00", accentSoft: "#FBF3E6", accentInk: "#7A4600",
      h1: web ? "A website that brings you customers." : "More jobs from Google.",
      lede: web ? "I build it first. You pay only if you want it live." : "From a Roseville local who’ll sit down with you and show you the numbers.",
      cta: web ? "Build mine" : "Get my free video",
      ticks: (web ? ["Built before you pay", "Live in 10 days"] : ["Free 2-minute video of what I’d fix first", "Ready in 2 days"]).map((label) => ({ label })),
      company: st.company, phone: st.phone,
      err: !!st.err, errMsg: st.err, sendFail: st.sendFail, smsHref: smsHref(co, PAGE),
      sendLabel: st.sending ? "Sending" : "Text it to me",
      trap: st.trap, setTrap: (e) => this.setState({ trap: e.target.value }),
      step1: st.step === 1, step2: st.step === 2, done: st.step === 3,
      askPhone: "Where do I text your " + noun + "?",
      doneLine: "Your " + noun + " lands " + (web ? nextDay(today) : dueDay(today)) + " from " + LP.PHONE_SHOWN + ".",
      setCompany: (e) => { this.setState({ company: e.target.value.slice(0, 60) }); },
      setPhone: (e) => { const d = cleanPhone(e.target.value); this.setState({ phone: d.length === 10 ? formatPhone(d) : e.target.value.slice(0, 20), err: "" }); },
      nextHero: next("hero"), nextClose: next("close"),
      sendHero: (e) => this.send(e, "hero"), sendClose: (e) => this.send(e, "close"),
      hasBooking: !!LP.BOOKING_URL, bookingUrl: LP.BOOKING_URL || "#", bookClick: () => track("booking_click", { from: "page" }),

      town, siteHead: "Good work, done right in " + town + ".",
      bookedLine: tr.booked, pageBtn: tr.btn,
      custom: st.custom,
      setCustom: (e) => { const v = e.target.value.slice(0, 30); this.setState({ custom: v, trade: v.trim() ? "__custom" : "Fencing" }, () => this.keep()); },
      trades: TRADES.map((t) => ({ label: t.label, on: t.label === tr.label && !tr.custom, off: t.label !== tr.label || !!tr.custom, pick: () => { this.setState({ trade: t.label, custom: "" }, () => this.keep()); track("trade_pick", { trade: t.label }); } })),
      channels: [{ id: "search", label: "Google" }, { id: "feed", label: "Facebook" }, { id: "chat", label: "ChatGPT" }]
        .map((c) => ({ label: c.label, on: c.id === st.channel, off: c.id !== st.channel, pick: () => { this.setState({ channel: c.id }); track("channel_pick", { to: c.id }); } })),
      isFeed: st.channel === "feed", isChat: st.channel === "chat", notChat: st.channel !== "chat",
      p1Title: st.channel === "chat" ? "She asks" : st.channel === "feed" ? "She scrolls" : "She searches",
      query: st.channel === "feed" ? "Scrolling after dinner" : tr.kw + " " + town.toLowerCase(),
      chatQ: "Good " + tr.kw + " near " + town + "?",
      coName,
      adLine: st.channel === "feed" ? inTown(tr.feed) : titleCase(tr.kw) + " in " + town + " | " + tr.offer,
      pageHead: tr.label + " in " + town + ".",

      stepsH: web ? "You see it before you pay." : "I look before I ask.",
      steps: (web
        ? [["Send your name.", "I look at what you have."], ["Text me photos.", "Six to ten of your best."], ["See it on your phone.", "Two rounds of changes."], ["Say go.", "Live same day. Pass and owe nothing."]]
        : [["Get the video.", "Yours to keep."], ["Short call.", "We find what’s broken."], ["I build and run it.", "You pay Google directly."], ["We check the numbers.", "Day 30 and day 90."]]
      ).map((s, i) => ({ n: i + 1, title: s[0], body: s[1] })),
      faq: web
        ? [{ q: "What does it cost?", a: "One flat price, texted to you before I build." }, { q: "I already have a site.", a: "Compare them side by side. Nothing changes until you say go." }, { q: "Can you bring customers to it?", a: "Yes. Google ads and follow-up are most of my work." }, { q: "I run the office, not the company. Can I reach out?", a: "Yes. I’ll send it to you, and you bring the owner in whenever you like." }]
        : [{ q: "What does it cost?", a: "Depends what’s broken. You get the number on the call." }, { q: "Burned by a marketer before?", a: "You pay Google directly and see every dollar." }, { q: "What if ads aren’t the problem?", a: "I’ll tell you what is." }, { q: "I run the office, not the company. Can I reach out?", a: "Yes. I’ll send it to you, and you bring the owner in whenever you like." }],
      closeH: web ? "See yours before you spend a dollar." : "Find out where your customers are going."
    };
  }
}

/* ---------- The page a sent form lands on ---------- */
function initSent() {
  const box = document.querySelector("[data-sent]"); if (!box) return;
  const $ = (s) => document.querySelector(s);
  const s = store.get("gc-lp-sent");
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })).getDay();
  const web = s && s.page === "websites";
  if (s && s.co) $("[data-sent-title]").textContent = "Got it, " + s.co + ".";
  $("[data-sent-line]").textContent = (web
    ? "I'll text you by " + nextDay(today) + " to grab a few photos, and I start on your first draft from there."
    : "Your two-minute video is due " + dueDay(today) + ". I'll text it to you.")
    + (s && s.last4 ? " It's coming to the number ending in " + s.last4 + ", from " + LP.PHONE_SHOWN + "." : "");
  document.querySelectorAll("[data-sent-for]").forEach((n) => { n.hidden = n.dataset.sentFor !== (web ? "websites" : "growth"); });
  const book = $("[data-book]");
  if (book && LP.BOOKING_URL) {
    book.hidden = false;
    const a = book.querySelector("a"); a.href = LP.BOOKING_URL;
    a.addEventListener("click", () => track("booking_click", { from: "sent" }));
  }
  if (s && s.fresh) {
    s.fresh = false; store.set("gc-lp-sent", s);
    track("generate_lead", { trade: s.trade, lp: s.page });
    if (LP.GOOGLE_ADS_ID && LP.GOOGLE_ADS_LEAD_LABEL && typeof window.gtag === "function") {
      window.gtag("event", "conversion", { send_to: LP.GOOGLE_ADS_ID + "/" + LP.GOOGLE_ADS_LEAD_LABEL });
    }
  }
}

(function start() {
  initTracking(); captureAd();
  if (document.getElementById("dc-tpl")) DCLite.mount(Component, {});
  initSent();
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[href^='tel:'], a[href^='sms:']");
    if (a) track(a.href.indexOf("tel:") === 0 ? "phone_tap" : "text_tap");
  });
  if (new URLSearchParams(location.search).has("test")) console.log("lp self-test " + (selfTest() ? "passed" : "FAILED"));
})();
