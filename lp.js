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
    /* A box marked data-keep belongs to an outside widget (the calendar). Leave it and its children as they are. */
    if (a.nodeType === 1 && a.hasAttribute('data-keep')) return;
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

/* ---------- garrisoncole.com ad landing pages (v12). Settings first. ---------- */
const LP = {
  FORMSPREE_ID: "mrppnbab",
  GA4_ID: "",                 // "G-XXXXXXXXXX"
  GOOGLE_ADS_ID: "AW-18498275090",          // "AW-XXXXXXXXXX"
  GOOGLE_ADS_LEAD_LABEL: "wUHYCJO2rLUdEJKO1fRE",  // label of the lead conversion. A sent form and a booked call both count as one lead.
  GOOGLE_ADS_CALL_LABEL: "",  // optional: label of "Calls from website"
  CLARITY_ID: "",
  BOOKING_URL: "https://cal.com/garrison-cole/call",  // Cal.com booking page, used by the fallback link and the sent page.
  CAL_LINK: "garrison-cole/call",  // the same event, for the calendar that sits on the page. Empty leaves only the link.
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
const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
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
/* ---------- What they searched decides the words they read ---------- */
const PLACES = ["el dorado hills", "granite bay", "sacramento", "roseville", "rocklin", "folsom", "lincoln", "auburn"];
/** The town named in a search phrase, or "" when there is none. */
function kwPlace(kw) {
  const k = String(kw == null ? "" : kw).toLowerCase();
  const hit = PLACES.find((p) => k.includes(p));
  return hit ? titleCase(hit) : "";
}
/** True when the search was about Facebook, Instagram or Meta ads. */
const kwMeta = (kw) => /facebook|instagram|meta ads/.test(String(kw == null ? "" : kw).toLowerCase());
/** The service they searched for, in their words. Sits inside the h1, above the headline.
    With no search term it is the page's own search target. */
function kwTopic(kw, web) {
  const k = String(kw == null ? "" : kw).toLowerCase(), place = kwPlace(k), inPlace = place ? " in " + place : "";
  if (web) {
    if (k.includes("contractor")) return "Contractor website design";
    if (k.includes("small business")) return "Small business website design" + inPlace;
    return "Website design" + (inPlace || " in Roseville");
  }
  if (/google ads|adwords|ppc/.test(k)) return k.includes("contractor") ? "Google Ads for contractors" : "Google Ads management" + inPlace;
  if (kwMeta(k)) return k.includes("contractor") ? "Facebook ads for contractors" : "Facebook and Instagram ads" + inPlace;
  if (k.includes("landscap")) return "Landscaping marketing";
  if (k.includes("tree")) return "Tree service marketing";
  if (k.includes("home service")) return "Home service marketing";
  if (k.includes("small business")) return "Small business marketing" + inPlace;
  if (k.includes("lead")) return "More leads for your business";
  if (place) return "Marketing for " + place + " businesses";
  if (!k) return "Google Ads management in Roseville";
  return "Marketing for contractors";
}
/* What owners say. The ones they tap ride along with the lead as "said". */
const PAINS = {
  websites: ["Customers look me up, then call the next guy.", "My site looks like 2015.", "I paid a web designer and got a template.", "I don’t have a website yet."],
  growth: ["The phone rings while I’m on a job.", "I pay Angi for leads three other guys get.", "Quotes go out and I never hear back.", "Slammed in spring, dead in winter.", "My last marketing company sent impression reports.", "They’re getting three bids and I flinch on price."]
};
const JOB_STOPS = [150, 250, 400, 600, 800, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6500, 8000, 10000, 12500, 15000, 20000, 30000, 50000];
/** Same math as the Quote Leak Calculator on the home page: follow-up closes about one more quote in ten. */
const quoteLeak = (quotes, job) => quotes * job * 0.10;
function selfTest() {
  const t = [
    ["cleanName strips tags", cleanName("  <b>Acme</b>   Fence ") === "bAcme/b Fence"],
    ["cleanName caps length", cleanName("x".repeat(90)).length === 40],
    ["cleanPhone drops 1", cleanPhone("+1 (916) 555-0142") === "9165550142"],
    ["phoneOk good", phoneOk("916-555-0142") === true],
    ["phoneOk short", phoneOk("916-555") === false],
    ["phoneOk bad area code", phoneOk("116-555-0142") === false],
    ["formatPhone", formatPhone("9165550142") === "(916) 555-0142"],
    ["money", money(120000) === "$120,000"],
    ["dueDay Monday", dueDay(1) === "Wednesday"],
    ["dueDay Thursday", dueDay(4) === "Monday"],
    ["nextDay Friday", nextDay(5) === "Monday"],
    ["smsHref encodes", smsHref("A&B Fence", "websites").includes("A%26B%20Fence")],
    ["kwPlace finds the town", kwPlace("website design el dorado hills") === "El Dorado Hills"],
    ["kwPlace none", kwPlace("web designer near me") === ""],
    ["kwTopic web with town", kwTopic("website design sacramento", true) === "Website design in Sacramento"],
    ["kwTopic web contractor", kwTopic("contractor website design", true) === "Contractor website design"],
    ["kwTopic web default", kwTopic("", true) === "Website design in Roseville"],
    ["kwTopic growth ads", kwTopic("google ads for contractors", false) === "Google Ads for contractors"],
    ["kwTopic growth ads with town", kwTopic("google ads management roseville", false) === "Google Ads management in Roseville"],
    ["kwTopic growth meta", kwTopic("facebook ads management", false) === "Facebook and Instagram ads"],
    ["kwTopic growth meta contractor", kwTopic("facebook ads for contractors", false) === "Facebook ads for contractors"],
    ["kwTopic growth agency", kwTopic("marketing agency sacramento", false) === "Marketing for Sacramento businesses"],
    ["kwTopic growth contractor", kwTopic("contractor marketing", false) === "Marketing for contractors"],
    ["kwTopic growth no search", kwTopic("", false) === "Google Ads management in Roseville"],
    ["kwTopic never says coaching", !/coach/i.test(kwTopic("business coach roseville", false))],
    ["kwMeta", kwMeta("Instagram ads management") === true && kwMeta("google ads") === false],
    ["quoteLeak", quoteLeak(20, 5000) === 10000],
    ["six growth pains, four website pains", PAINS.growth.length === 6 && PAINS.websites.length === 4]
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
/* Events carry the page and true/false flags. Never the company name or the number. */
function track(name, params) {
  if (typeof window.gtag === "function") window.gtag("event", name, Object.assign({ lp: PAGE }, params || {}));
}
function leadConversion() {
  if (LP.GOOGLE_ADS_ID && LP.GOOGLE_ADS_LEAD_LABEL && typeof window.gtag === "function") {
    window.gtag("event", "conversion", { send_to: LP.GOOGLE_ADS_ID + "/" + LP.GOOGLE_ADS_LEAD_LABEL });
  }
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
const postLead = (body) => fetch("https://formspree.io/f/" + LP.FORMSPREE_ID, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(body) });

/* ---------- The landing page ---------- */
class Component extends DCLogic {
  constructor(props) {
    super(props);
    const q = new URLSearchParams(location.search);
    const saved = store.get("gc-lp5") || {};
    const term = cleanName((store.get("gc-utm") || {}).utm_term, 60);
    this.town = titleCase(cleanName(q.get("town"), 28)) || kwPlace(term) || "Roseville";
    this.state = {
      company: cleanName(q.get("co")) || saved.company || "",
      phone: "", step: 1, err: "", sending: false, sendFail: false, trap: "",
      engine: false, picks: [], q: 12, jobIdx: 8, ranCalc: false, calDown: false
    };
  }
  keep() { store.set("gc-lp5", { company: this.state.company }); }
  /* What they told the page, for the lead email. */
  context() {
    const s = this.state, list = PAINS[PAGE] || [];
    const out = { said: s.picks.slice().sort().map((i) => list[i]).filter(Boolean).join(" | "), page: PAGE };
    if (PAGE === "growth" && s.ranCalc) { out.quotes_a_month = s.q; out.average_job = money(JOB_STOPS[s.jobIdx] || 0); }
    return Object.assign(out, store.get("gc-utm") || {});
  }
  componentDidMount() { this.loadCal(); }
  /* The live calendar. It draws itself into #cal-inline, which the renderer leaves alone (data-keep). */
  loadCal() {
    if (!LP.CAL_LINK || !document.getElementById("cal-inline")) return;
    const ns = "call";
    try {
      (function (C, A, L) { let p = function (a, ar) { a.q.push(ar); }; let d = C.document; C.Cal = C.Cal || function () { let cal = C.Cal; let ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; let sc = d.createElement("script"); sc.src = A; sc.onerror = function () { C.dispatchEvent(new Event("gc-cal-down")); }; d.head.appendChild(sc); cal.loaded = true; } if (ar[0] === L) { const api = function () { p(api, arguments); }; const namespace = ar[1]; api.q = api.q || []; if (typeof namespace === "string") { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ["initNamespace", namespace]); } else p(cal, ar); return; } p(cal, ar); }; })(window, "https://app.cal.com/embed/embed.js", "init");
      window.addEventListener("gc-cal-down", () => this.setState({ calDown: true }));
      const Cal = window.Cal;
      Cal("init", ns, { origin: "https://cal.com" });
      Cal.ns[ns]("inline", { elementOrSelector: "#cal-inline", config: { layout: "month_view", theme: "light" }, calLink: LP.CAL_LINK });
      Cal.ns[ns]("ui", { theme: "light", hideEventTypeDetails: true, layout: "month_view", cssVarsPerTheme: { light: { "cal-brand": "#2348E0" } } });
      const booked = (e) => this.onBooked((e && e.detail && e.detail.data) || {});
      ["bookingSuccessfulV2", "bookingSuccessful"].forEach((action) => Cal.ns[ns]("on", { action, callback: booked }));
      Cal.ns[ns]("on", { action: "linkFailed", callback: () => this.setState({ calDown: true }) });
      Cal.ns[ns]("on", { action: "linkReady", callback: () => track("cal_ready") });
    } catch (x) { this.setState({ calDown: true }); }
  }
  /* A booked call counts as a lead once, and Garrison gets what they tapped alongside Cal.com's own booking email. */
  onBooked(data) {
    /* Cal.com sends the booking twice: an older message that wraps it in "booking", and the current one. Same id on both. */
    const bk = data.booking || {}, when = data.startTime || bk.startTime || "";
    const key = String(data.uid || bk.uid || when || "booked");
    const whenShown = when ? new Date(when).toLocaleString("en-US", { timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " Pacific" : "";
    const seen = store.get("gc-booked") || [];
    if (seen.indexOf(key) > -1) return;
    store.set("gc-booked", seen.concat([key]));
    track("booking_made");
    leadConversion();
    const co = cleanName(this.state.company);
    postLead(Object.assign({
      _subject: "Call booked" + (co ? ": " + co : "") + " (from the " + PAGE + " page)",
      company: co, booked_for: whenShown, wants: "Booked a call on the page"
    }, this.context())).catch(() => {});
  }
  async send(e) {
    e.preventDefault();
    const s = this.state;
    if (s.sending) return;
    const d = cleanPhone(s.phone);
    if (!phoneOk(d)) return this.setState({ err: "That number looks short. I need all ten digits to text you.", sendFail: false });
    if (s.trap) return;
    this.setState({ err: "", sendFail: false, sending: true });
    const co = cleanName(s.company), web = PAGE === "websites";
    const body = Object.assign({
      _subject: (web ? "Website draft request: " : "Video request: ") + co,
      company: co, phone: formatPhone(d),
      wants: web ? "Build-first website draft" : "Free two-minute video"
    }, this.context());
    try {
      const r = await postLead(body);
      if (!r.ok) throw new Error("bad status");
      store.set("gc-lp-sent", { co, last4: d.slice(6), page: PAGE, trade: "", fresh: true });
      location.href = "sent.html";
    } catch (x) {
      this.setState({ sending: false, sendFail: true });
      track("lp_send_error");
    }
  }
  renderVals() {
    const st = this.state, web = PAGE === "websites", town = this.town;
    const kw = cleanName((store.get("gc-utm") || {}).utm_term, 60).toLowerCase();
    const co = cleanName(st.company);
    const job = JOB_STOPS[st.jobIdx] || 2500, leak = quoteLeak(st.q, job);
    const num = (key) => (e) => { this.setState({ [key]: Number(e.target.value) || 0, ranCalc: true }); };
    const painList = PAINS[PAGE] || [], n = st.picks.length;
    const toggle = (i) => {
      const cur = this.state.picks, at = cur.indexOf(i);
      this.setState({ picks: at === -1 ? cur.concat([i]) : cur.filter((x) => x !== i) });
      track("pain_pick", { n: i + 1, on: at === -1 });
    };
    const noun = web ? "first draft" : "video";
    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })).getDay();
    const next = (e) => {
      e.preventDefault();
      if (cleanName(this.state.company).length < 2) return;
      this.setState({ step: 2 }, () => { const el = document.getElementById("ph1"); if (el) el.focus(); }); this.keep();
      track("lp_step1");
    };
    const rows = (list) => list.map((r, i) => ({ n: i + 1, t: r[0], b: r[1] }));
    const show = (engine) => () => { this.setState({ engine }); track("before_after", { to: engine ? "after" : "before" }); };
    return {
      web, grow: !web, town,
      otherHref: web ? "growth" : "websites",
      otherFoot: web ? "Google and Meta ads" : "Website design",
      topic: kwTopic(kw, web),
      h1a: web ? "A website that brings you " : "More jobs ", h1b: web ? "customers." : (kwMeta(kw) ? "from Facebook." : "from Google."),
      lede: web
        ? "I’m a Roseville local. I build yours first, and you pay only if you want it live."
        : "I’m a Roseville local. I run your ads and build the page behind them. I know sales too, so I’ll show you where jobs slip away after the lead comes in.",
      altBtn: web ? "Build mine first" : "Get a free video",

      today: !st.engine, engine: st.engine,
      mockId: st.engine ? "mock-b" : "mock-a",
      clock: st.engine ? "4:21" : "5:02",
      coName: co || "Your Company",
      tabA: web ? "Your site today" : "Your phone today",
      tabB: web ? "The one I build" : "With the engine",
      showToday: show(false), showEngine: show(true),
      mockCaption: web
        ? (st.engine ? "Built first. You pay only if you want it live." : "What a customer sees when they look you up.")
        : (st.engine ? "You never left the job. The work got booked anyway." : "You were on a job the whole time."),

      bookH: web ? "Pick a time. I’ll build yours before you pay." : "Pick a time. I’ll look at your business before we talk.",
      bookSub: web ? "Free, 30 minutes. One flat price, and you hear it before I build." : "Free, 30 minutes. You’ll leave knowing what I’d fix first, what it costs and whether I’m the right fit.",
      hasCal: !!LP.CAL_LINK && !st.calDown, noCal: !LP.CAL_LINK || st.calDown,
      bookingUrl: LP.BOOKING_URL || "#", bookClick: () => track("booking_click", { from: "page" }),
      altH: web ? "Rather see it first?" : "Not ready to talk?",
      altSub: web ? "Send your company name. I’ll build a first draft and text you the link." : "Send your company name. I’ll text you a free two-minute video of the first thing I’d fix.",
      cta: web ? "Build mine" : "Text me the video",
      company: st.company, phone: st.phone, trap: st.trap,
      err: !!st.err, errMsg: st.err, sendFail: st.sendFail, smsHref: smsHref(co, PAGE),
      sendLabel: st.sending ? "Sending" : "Text it to me",
      step1: st.step === 1, step2: st.step === 2, done: st.step === 3,
      askPhone: "Where do I text your " + noun + "?",
      doneLine: "Your " + noun + " lands " + (web ? nextDay(today) : dueDay(today)) + " from " + LP.PHONE_SHOWN + ".",
      setCompany: (e) => { this.setState({ company: e.target.value.slice(0, 60) }); },
      setPhone: (e) => { const d = cleanPhone(e.target.value); this.setState({ phone: d.length === 10 ? formatPhone(d) : e.target.value.slice(0, 20), err: "" }); },
      setTrap: (e) => this.setState({ trap: e.target.value }),
      nextHero: next, sendHero: (e) => this.send(e),

      doH: web ? "What you get." : "I own everything that gets you the call.",
      doSub: web ? "Everything a local customer needs to pick you and reach you." : "Ads are where most owners start with me. Whatever the ads need behind them, I build that too.",
      doRows: rows(web
        ? [["Built first.", "You see it on your phone before you pay."],
           ["Built to get the call.", "Your best work and reviews up top, one button to reach you."],
           ["Written by someone who sells.", "I take sales calls every week, so the page answers what a customer asks before they call."],
           ["Kept running.", "I host it and keep it current for a flat monthly."]]
        : [["The ads.", "Google Search, Meta and ChatGPT, run by me. You pay the ad spend directly and see every dollar."],
           ["The page.", "A landing page or a full website, built by me, so the click has somewhere good to land."],
           ["The diagnosis.", "I take sales calls every week, so I can show you where a lead dies between the first ring and the signed quote."],
           ["The sale, when you want it.", "Follow-up that runs without you and quotes that close. I’ll get on the calls with you."]]),
      optH: "Two ways to work with me.",
      opts: web
        ? [{ t: "Built and live.", b: "One flat price. I build it, you approve it, and it goes live in about 10 days." },
           { t: "Built and looked after.", b: "The same build, plus hosting and changes for a flat monthly. Text me an update and it gets done." }]
        : [{ t: "Just the ads.", b: "Your phone gets answered and your quotes already close. I run the ads and the page behind them, and you get more of the right calls." },
           { t: "The whole engine.", b: "Ads, the page, follow-up and the sale. I stay on it with you until the calls turn into booked jobs." }],
      optNote: "Not sure which one you need? I’ll tell you on the call.",

      painH: web ? "Sound like your site?" : "Sound like your week?",
      pains: painList.map((q, i) => { const on = st.picks.indexOf(i) > -1; return { q, on, off: !on, pick: () => toggle(i) }; }),
      hasPicks: n > 0,
      painCount: n + " of " + painList.length,
      painNote: n === 1 ? "Bring it to the call. I’ll start there." : "Bring them to the call. I’ll start with the one costing you most.",

      q: st.q, setQ: num("q"),
      jobShown: money(job), jobIdx: st.jobIdx, jobMax: JOB_STOPS.length - 1, setJob: num("jobIdx"),
      leakShown: money(leak),
      leakSub: "If following up closes one more quote in ten. " + money(leak * 12) + " a year.",

      areaLine: web
        ? "Website design for owner-run businesses in Roseville, Rocklin, Granite Bay, Lincoln, Auburn, Folsom, El Dorado Hills and the rest of the Sacramento area. Glad to meet in person."
        : "Google Ads, Meta ads and landing pages for owner-run service businesses in Roseville, Rocklin, Granite Bay, Lincoln, Auburn, Folsom and El Dorado Hills. Glad to meet in person. Outside the area, we meet on Zoom.",
      faq: web
        ? [{ q: "What does it cost?", a: "One flat price, and you hear it before I build." }, { q: "Do you host it?", a: "Yes, if you want. A flat monthly covers hosting and changes." }, { q: "I already have a site.", a: "Compare them side by side. Nothing changes until you say go." }, { q: "Do you only do website design in Roseville?", a: "Roseville, Rocklin, Folsom, El Dorado Hills and the rest of the Sacramento area." }, { q: "How long does a website take?", a: "About 10 days from your go to live." }, { q: "Do you build websites for contractors?", a: "Yes. Contractors, landscapers, cleaners, photographers and other owner-run local businesses." }, { q: "Will my website show up on Google?", a: "It’s built so Google can read it, with your services and your towns on the page. Ranking takes time, and I’ll tell you what to expect on the call." }, { q: "Can you bring in more customers once it’s live?", a: "Yes, when you’re ready. I also run Google and Meta ads for local businesses." }]
        : [{ q: "What does it cost?", a: "Depends what’s broken. You get the number on the call, before you spend anything." }, { q: "Burned by a marketer before?", a: "You pay the ad spend directly and see every dollar." }, { q: "What if ads aren’t the problem?", a: "I’ll tell you what is." }, { q: "I only need someone to run my ads.", a: "That works. If your follow-up and quotes are already solid, I run the ads and the page and leave the rest alone." }, { q: "Do you do Google Ads management?", a: "Yes. Google, Meta and ChatGPT ads for local service businesses, with the page and follow-up behind them." }, { q: "Do you run Facebook and Instagram ads?", a: "Yes. Meta ads work well for before and after work, and I build the page they land on." }, { q: "Do you only work with contractors in Roseville?", a: "Mostly owner-run service businesses in Placer County, Folsom and El Dorado Hills. I work with owners anywhere when it’s a fit." }, { q: "Are you a marketing agency?", a: "You get me. One Roseville local who runs it and sits down with you to go through the numbers." }]
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
    track("generate_lead", { lp: s.page });
    leadConversion();
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
