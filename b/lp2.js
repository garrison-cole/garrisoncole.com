/* garrisoncole.com landing pages, Nov 27 2026 rebuild.
   Page text lives in the HTML. This file only does what has to move:
   the search line, the calendar, tracking, the text links and one interactive piece per page.
   Add ?test to any page to run the checks. */
"use strict";

/* ---------- Settings. IDs and labels carried over from lp.js (v12) unchanged. ---------- */
const LP = {
  FORMSPREE_ID: "mrppnbab",
  GA4_ID: "",
  GOOGLE_ADS_ID: "AW-18498275090",
  GOOGLE_ADS_LEAD_LABEL: "wUHYCJO2rLUdEJKO1fRE",  // a booked call counts as one lead
  GOOGLE_ADS_TEXT_LABEL: "nAH1CJWX2LsdEJKO1fRE",  // "Text tap (website)", a secondary action
  CLARITY_ID: "zbt543g7fb",
  BOOKING_URL: "https://cal.com/garrison-cole/call",
  CAL_LINK: "garrison-cole/call",
  CAL_LINK_COACH: "",
  BOOKING_URL_COACH: "",
  PHONE: "+17606444559",
  PHONE_SHOWN: "760-644-4559"
};

/* Preview pages live under /next/. They never send a conversion to Google Ads, so testing them cannot count as a lead. */
const PREVIEW = /^\/next\//.test(location.pathname);
const DOC = document.documentElement;
const PAGE = DOC.dataset.page || "";
const HOME = DOC.dataset.town || "Roseville";
const PAGE_TOPIC = DOC.dataset.topic || "";
const LP_TAG = (PREVIEW ? "preview-" : "") + (DOC.dataset.lp || PAGE);

/* ---------- Pure functions ---------- */
function cleanName(s, max = 40) {
  return String(s == null ? "" : s).replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}
const titleCase = (s) => s.replace(/(^|[ \-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
const money = (n) => "$" + Math.round(n).toLocaleString("en-US");

/* What a Text button types for them, so Garrison can tell which page a text came from. */
const SMS_ASK = {
  websites: "I'd like to talk about a website for my business.",
  growth: "I'd like the complimentary audit.",
  coach: "I'd like to talk about business coaching.",
  other: "I was on your site and have a question."
};
function smsHref(co, page) {
  const what = SMS_ASK[page] || SMS_ASK.other;
  const body = "Hi Garrison, " + (co ? "this is " + co + ". " : "") + what;
  return "sms:" + LP.PHONE + "?&body=" + encodeURIComponent(body);
}

/* What they searched decides the small line over the headline. */
const PLACES = ["el dorado hills", "granite bay", "sacramento", "roseville", "rocklin", "folsom", "lincoln", "auburn"];
function kwPlace(kw) {
  const k = String(kw == null ? "" : kw).toLowerCase();
  const hit = PLACES.find((p) => k.includes(p));
  return hit ? titleCase(hit) : "";
}
const kwMeta = (kw) => /facebook|instagram|meta ads/.test(String(kw == null ? "" : kw).toLowerCase());
/** Words like "agency", "company" and "near me" never print. */
function kwTopic(kw, web, home = "Roseville", def = "") {
  const k = String(kw == null ? "" : kw).toLowerCase(), place = kwPlace(k), inPlace = place ? " in " + place : "";
  if (!k && def) return def;
  const at = inPlace || " in " + home;
  if (web) {
    if (k.includes("contractor")) return "Contractor website design";
    if (k.includes("small business")) return "Small business website design" + inPlace;
    if (k.includes("web design") && !k.includes("website")) return "Web design" + at;
    return "Website design" + at;
  }
  if (/google ads|adwords|ppc/.test(k)) return k.includes("contractor") ? "Google Ads for contractors" : "Google Ads management" + inPlace;
  if (kwMeta(k)) return k.includes("contractor") ? "Facebook ads for contractors" : "Facebook and Instagram ads" + inPlace;
  if (k.includes("landscap")) return "Landscaping marketing";
  if (k.includes("tree")) return "Tree service marketing";
  if (k.includes("home service")) return "Home service marketing";
  if (k.includes("small business")) return "Small business marketing" + inPlace;
  if (k.includes("digital marketing")) return "Digital marketing" + at;
  if (k.includes("lead")) return "More leads for your business";
  if (place) return "Marketing for " + place + " businesses";
  if (/near me|near you|local/.test(k)) return "Marketing for " + home + " businesses";
  if (!k) return "Google Ads management in " + home;
  return "Marketing for contractors";
}
const COACH_TOWNS = ["sacramento", "roseville", "rocklin", "folsom"];
function coachTopic(kw, home = "Roseville") {
  const k = String(kw == null ? "" : kw).toLowerCase();
  const hit = COACH_TOWNS.find((p) => k.includes(p));
  return (k.includes("consultant") ? "Business consultant in " : "Business coach in ") + (hit ? titleCase(hit) : home);
}
const isContractor = (kw) => /contractor/.test(String(kw == null ? "" : kw).toLowerCase());

/* ---------- Growth: who's on it ---------- */
/** taps: up to five of "me" | "paid" | "nobody". Returns the answer line, or "" before three taps. */
function boardRead(taps) {
  const t = taps.filter(Boolean);
  if (t.length < 3) return "";
  const c = (v) => t.filter((x) => x === v).length;
  const nobody = c("nobody"), me = c("me"), paid = c("paid");
  if (nobody >= 1) return nobody + " of 5 have nobody on them. Customers go missing right there.";
  if (me >= 3) return "You’re on " + me + " of 5 yourself. That’s a second job on top of the one you already have.";
  if (paid === 5) return "You’ve got people on all five. Then the call is about whether they’re talking to each other.";
  return "You’re paying for " + paid + " of 5. On the call I’ll check that each one is earning it.";
}
const BOARD_KEYS = ["found", "page", "phone", "quote", "tracking"];
const BOARD_WORD = { me: "me", paid: "paid", nobody: "nobody" };
const boardLine = (taps) => "On it: " + BOARD_KEYS.map((k, i) => k + " " + (BOARD_WORD[taps[i]] || "not tapped")).join(", ");

/* ---------- Coach: run your month past me ----------
   Garrison's rules of thumb, carried over from lp.js (v12) unchanged. Change a number here and the read follows.
   answerMin: under this share getting a price, the phone is the problem.
   yesLow: under this share saying yes, the sale is the problem. yesHigh: at or over this, the price is too low.
   startAt: fewer than this reaching out means the business is still starting. */
const READ = { answerMin: 0.6, yesLow: 0.3, yesHigh: 0.7, startAt: 5, answerWinBack: 0.5, saleLift: 0.2, priceRaise: 0.1 };
const READ_NAME = { sale: "The sale", phone: "A price for everyone", price: "Your price", more: "More people reaching out", start: "Still starting" };
/** Every problem that applies is sized in dollars, and the biggest one leads. Same math as lp.js (v12). */
function monthRead(reach, priced, yes, job, contractor = false) {
  reach = Math.max(0, Math.round(Number(reach) || 0));
  priced = Math.min(Math.max(0, Math.round(Number(priced) || 0)), reach);
  yes = Math.min(Math.max(0, Math.round(Number(yes) || 0)), priced);
  job = Math.max(0, Number(job) || 0);
  const price = contractor ? "bid" : "price", noun = contractor ? "jobs" : "customers";
  if (reach < READ.startAt) {
    return { key: "start", lostA: 0, lostB: 0, val: 0,
      text: "Still looking for your first " + noun + "? I’m the wrong fit for now. Text me and I’ll point you somewhere useful." };
  }
  const pr = priced / reach, yr = priced ? yes / priced : 0, lostA = reach - priced, lostB = priced - yes;
  const issues = [];
  if (pr < READ.answerMin) issues.push({ key: "phone", n: lostA * READ.answerWinBack * yr });
  if (priced > 0 && yr < READ.yesLow) issues.push({ key: "sale", n: priced * READ.saleLift });
  if (priced >= 5 && yr >= READ.yesHigh) issues.push({ key: "price", n: 0, val: yes * job * READ.priceRaise });
  issues.forEach((i) => { if (i.val == null) i.val = i.n * job; });
  issues.sort((x, y) => y.val - x.val);
  const top = issues[0] || { key: "more", n: 10 * pr * yr };
  if (top.val == null) top.val = top.n * job;
  let text;
  if (top.key === "phone") text = lostA + " people never got a " + price + ". I’d start there, before a dollar goes to ads. A text back inside a minute keeps a lot of them from calling the next name on the list.";
  else if (top.key === "sale") text = lostB + " people heard your " + price + " and walked. I’d start with the sale. More ads would send more people to lose.";
  else if (top.key === "price") text = "That sounds great. It usually means you’re too cheap. I’d raise the price 10% before spending on marketing.";
  else text = "Nothing here is broken. This is when ads earn their keep. Google first, then Facebook.";
  return { key: top.key, lostA, lostB, val: Math.round(top.val / 100) * 100, text };
}
const cashLine = (rd) => (rd.key !== "start" && rd.val >= 100 ? "That’s about " + money(rd.val) + " a month you aren’t collecting yet." : "");

function selfTest() {
  const t = [
    ["cleanName strips tags", cleanName("  <b>Acme</b>   Fence ") === "bAcme/b Fence"],
    ["money", money(120000) === "$120,000"],
    ["smsHref encodes", smsHref("A&B Fence", "websites").includes("A%26B%20Fence")],
    ["smsHref says the page", decodeURIComponent(smsHref("", "growth")).includes("complimentary audit") && decodeURIComponent(smsHref("", "coach")).includes("business coaching") && decodeURIComponent(smsHref("", "home")).includes("a question")],
    ["kwPlace", kwPlace("website design el dorado hills") === "El Dorado Hills" && kwPlace("web designer near me") === ""],
    ["kwTopic web", kwTopic("website design sacramento", true) === "Website design in Sacramento" && kwTopic("", true) === "Website design in Roseville" && kwTopic("contractor website design", true) === "Contractor website design"],
    ["kwTopic web design", kwTopic("web design sacramento", true) === "Web design in Sacramento" && kwTopic("web designer near me", true) === "Web design in Roseville"],
    ["kwTopic web default Sacramento", kwTopic("", true, "Sacramento") === "Website design in Sacramento"],
    ["kwTopic growth", kwTopic("google ads management roseville", false) === "Google Ads management in Roseville" && kwTopic("facebook ads management", false) === "Facebook and Instagram ads" && kwTopic("marketing for contractors", false) === "Marketing for contractors"],
    ["kwTopic growth Sacramento page", kwTopic("", false, "Sacramento", "Digital marketing in Sacramento") === "Digital marketing in Sacramento" && kwTopic("digital marketing agency near me", false, "Sacramento") === "Digital marketing in Sacramento"],
    ["kwTopic never prints agency, company or near me", ["digital marketing agency sacramento", "marketing agency near me", "marketing companies sacramento", "web design company sacramento", "website design near me", "web designer near me", "marketing company roseville"].every((x) => !/agenc|compan|near me/i.test(kwTopic(x, false, "Sacramento") + kwTopic(x, true, "Sacramento")))],
    ["kwTopic never says coaching", !/coach/i.test(kwTopic("business coach roseville", false))],
    ["coachTopic", coachTopic("business coach sacramento") === "Business coach in Sacramento" && coachTopic("business consultant folsom") === "Business consultant in Folsom" && coachTopic("") === "Business coach in Roseville"],
    ["isContractor", isContractor("business coach for contractors") && !isContractor("business coach roseville")],
    ["board waits for three taps", boardRead(["nobody", "me"]) === ""],
    ["board 2 nobody + 1 me", boardRead(["nobody", "nobody", "me"]).startsWith("2 of 5")],
    ["board five me", boardRead(["me", "me", "me", "me", "me"]).includes("second job")],
    ["board all paid", boardRead(["paid", "paid", "paid", "paid", "paid"]).includes("all five")],
    ["board some paid", boardRead(["paid", "paid", "me", "paid"]).includes("paying for 3 of 5")],
    ["board line", boardLine(["nobody", "paid", "me", "nobody", "nobody"]) === "On it: found nobody, page paid, phone me, quote nobody, tracking nobody"],
    ["month default is the sale, 16 walked", monthRead(40, 22, 6, 3000).key === "sale" && monthRead(40, 22, 6, 3000).text.startsWith("16 people")],
    ["month phone, 28 never got one", monthRead(40, 12, 6, 3000).key === "phone" && monthRead(40, 12, 6, 3000).text.startsWith("28 people never got a price")],
    ["month too cheap", monthRead(20, 16, 13, 3000).key === "price"],
    ["month nothing broken", monthRead(20, 14, 6, 3000).key === "more"],
    ["month still starting", monthRead(3, 2, 1, 3000).key === "start" && cashLine(monthRead(3, 2, 1, 3000)) === ""],
    ["month clamps", monthRead(10, 50, 99, 1000).lostA === 0 && monthRead(10, 50, 99, 1000).lostB === 0],
    ["month says bid for contractors", monthRead(40, 12, 6, 3000, true).text.includes("never got a bid")],
    ["month money has commas", cashLine(monthRead(40, 22, 6, 3000)) === "That’s about $13,200 a month you aren’t collecting yet."],
    ["no em dashes in reads", ![monthRead(40, 22, 6, 3000), monthRead(40, 12, 6, 3000), monthRead(20, 16, 13, 3000), monthRead(20, 14, 6, 3000), monthRead(3, 2, 1, 3000)].some((r) => /—/.test(r.text))]
  ];
  console.table(t.map(([name, pass]) => ({ name, pass })));
  return t.every((r) => r[1]);
}

/* ---------- Plumbing ---------- */
const store = {
  get(k) { try { return JSON.parse(sessionStorage.getItem(k) || "null"); } catch (e) { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
};
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.prototype.slice.call(el.querySelectorAll(s));
/* Events carry the page and small flags. Never a name or a number. */
function track(name, params) {
  try {
    if (typeof window.gtag === "function") window.gtag("event", name, Object.assign({ lp: PAGE }, params || {}));
    if (typeof window.clarity === "function") window.clarity("event", name);
  } catch (e) { /* tracking never breaks the page */ }
}
function sendConversion(label, what) {
  if (!LP.GOOGLE_ADS_ID || !label) return;
  if (PREVIEW) { console.info("[preview] " + what + " conversion not sent: " + LP.GOOGLE_ADS_ID + "/" + label); window.__gcConv = (window.__gcConv || []).concat([what]); return; }
  if (typeof window.gtag === "function") window.gtag("event", "conversion", { send_to: LP.GOOGLE_ADS_ID + "/" + label });
}
let textCounted = false;
function textConversion() { if (textCounted) return; textCounted = true; sendConversion(LP.GOOGLE_ADS_TEXT_LABEL, "text"); }
const leadConversion = () => sendConversion(LP.GOOGLE_ADS_LEAD_LABEL, "lead");

function initTracking() {
  const ids = PREVIEW ? [] : [LP.GA4_ID, LP.GOOGLE_ADS_ID].filter(Boolean);
  if (ids.length) {
    const s = document.createElement("script");
    s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + ids[0];
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    ids.forEach((id) => window.gtag("config", id));
  }
  if (LP.CLARITY_ID) {
    (function (c, l, a, r, i, t, y) { c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); }; t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i; y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y); })(window, document, "clarity", "script", LP.CLARITY_ID);
    const utm = store.get("gc-utm") || {};
    window.clarity("set", "lp", LP_TAG || "other");
    if (utm.utm_term) window.clarity("set", "search_term", String(utm.utm_term).slice(0, 80));
    if (utm.utm_source) window.clarity("set", "source", String(utm.utm_source).slice(0, 40));
  }
}
/* Click IDs and campaign tags ride along with the lead. Same storage key as before. */
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

/* What the visitor told the page, sent along with a booked call. */
let said = "";

/* ---------- The calendar. Loads on the visitor's first move, or once the page is idle. ---------- */
function startCalendar() {
  const box = $("#cal-inline"); if (!box) return;
  let started = false;
  const evs = ["scroll", "touchstart", "pointerdown", "pointermove", "keydown"];
  const go = () => {
    if (started) return; started = true;
    evs.forEach((e) => window.removeEventListener(e, go, { passive: true }));
    loadCal();
  };
  evs.forEach((e) => window.addEventListener(e, go, { passive: true, once: true }));
  const idle = () => { if (window.requestIdleCallback) window.requestIdleCallback(go, { timeout: 2000 }); else setTimeout(go, 1200); };
  if (document.readyState === "complete") idle(); else window.addEventListener("load", idle, { once: true });
  if (location.hash === "#book") go();
}
function calDown() { const b = $(".cal-box"); if (b) b.classList.add("cal-down"); }
function loadCal() {
  const calLink = (PAGE === "coach" && LP.CAL_LINK_COACH) || LP.CAL_LINK;
  if (!calLink) return calDown();
  const ns = "call";
  try {
    (function (C, A, L) { let p = function (a, ar) { a.q.push(ar); }; let d = C.document; C.Cal = C.Cal || function () { let cal = C.Cal; let ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; let sc = d.createElement("script"); sc.src = A; sc.onerror = function () { C.dispatchEvent(new Event("gc-cal-down")); }; d.head.appendChild(sc); cal.loaded = true; } if (ar[0] === L) { const api = function () { p(api, arguments); }; const namespace = ar[1]; api.q = api.q || []; if (typeof namespace === "string") { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ["initNamespace", namespace]); } else p(cal, ar); return; } p(cal, ar); }; })(window, "https://app.cal.com/embed/embed.js", "init");
    window.addEventListener("gc-cal-down", calDown);
    const Cal = window.Cal;
    Cal("init", ns, { origin: "https://cal.com" });
    Cal.ns[ns]("inline", { elementOrSelector: "#cal-inline", config: { layout: "month_view", theme: "light" }, calLink });
    Cal.ns[ns]("ui", { theme: "light", hideEventTypeDetails: true, layout: "month_view", cssVarsPerTheme: { light: { "cal-brand": "#111315" } } });
    const booked = (e) => onBooked((e && e.detail && e.detail.data) || {});
    ["bookingSuccessfulV2", "bookingSuccessful"].forEach((action) => Cal.ns[ns]("on", { action, callback: booked }));
    Cal.ns[ns]("on", { action: "linkFailed", callback: calDown });
    Cal.ns[ns]("on", { action: "linkReady", callback: () => track("cal_ready") });
  } catch (x) { calDown(); }
}
/* A booked call counts as one lead, and Garrison gets what the visitor told the page alongside Cal.com's own email. */
function onBooked(data) {
  const bk = data.booking || {}, when = data.startTime || bk.startTime || "";
  const key = String(data.uid || bk.uid || when || "booked");
  const seen = store.get("gc-booked") || [];
  if (seen.indexOf(key) > -1) return;
  store.set("gc-booked", seen.concat([key]));
  track("booking_made");
  leadConversion();
  const whenShown = when ? new Date(when).toLocaleString("en-US", { timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " Pacific" : "";
  postLead(Object.assign({
    _subject: "Call booked (from the " + LP_TAG + " page)",
    booked_for: whenShown, wants: "Booked a call on the page", said, page: LP_TAG
  }, store.get("gc-utm") || {})).catch(() => {});
}

/* ---------- Websites and home: open a site I built ---------- */
function initViewer() {
  const dlg = $("#viewer"); if (!dlg) return;
  const frame = $("#viewer-frame"), side = $("#viewer-side"), title = $("#viewer-title");
  const open = (btn) => {
    const key = btn.dataset.site, src = btn.dataset.src, tpl = document.getElementById("rev-" + key);
    title.textContent = btn.dataset.label || "A site I built";
    frame.title = btn.dataset.label || "A site I built";
    side.innerHTML = "";
    if (tpl) side.appendChild(tpl.content.cloneNode(true));
    frame.src = src;
    if (typeof dlg.showModal === "function") dlg.showModal(); else window.open(src, "_blank");
    track("work_open", { site: key });
  };
  $$("[data-site]").forEach((b) => b.addEventListener("click", () => open(b)));
  /* One listener on the dialog, so the Book button that arrives with each review closes it too. */
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg || (e.target.closest && e.target.closest("[data-close]"))) dlg.close();
  });
  dlg.addEventListener("close", () => { frame.src = "about:blank"; });
}

/* ---------- Growth: who's on it ---------- */
function initBoard() {
  const board = $("#board"); if (!board) return;
  const ans = $("#board-answer"), line = $("#board-line");
  let tracked = false;
  const taps = () => [1, 2, 3, 4, 5].map((i) => { const c = $("input[name=r" + i + "]:checked", board); return c ? c.value : ""; });
  board.addEventListener("change", () => {
    const t = taps(), read = boardRead(t);
    said = boardLine(t);
    if (!read) return;
    line.textContent = read;
    ans.classList.add("on");
    if (!tracked && t.filter(Boolean).length === 5) { tracked = true; track("who_on_it", { nobody: t.filter((x) => x === "nobody").length }); }
  });
}

/* ---------- Coach: run your month past me ---------- */
function initMonth() {
  const box = $("#month"); if (!box) return;
  const kw = cleanName((store.get("gc-utm") || {}).utm_term, 60);
  const contractor = isContractor(kw);
  if (contractor) {
    $$("[data-c-label]").forEach((el) => { el.textContent = el.dataset.cLabel; });
  }
  const f = { reach: $("#m-reach"), priced: $("#m-priced"), yes: $("#m-yes"), worth: $("#m-worth") };
  const reply = $("#reply"), bubble = $("#bubble"), cash = $("#cash"), bookBtn = $("#reply-book"), textBtn = $("#reply-text");
  const still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let timer = null, tracked = false, touched = false;
  const num = (el, max) => Math.min(Math.max(0, Math.round(Number(String(el.value).replace(/[^\d]/g, "")) || 0)), max);
  const clamp = () => {
    const reach = num(f.reach, 999), priced = num(f.priced, reach), yes = num(f.yes, priced);
    f.reach.value = reach; f.priced.value = priced; f.yes.value = yes;
    const worth = num(f.worth, 999999); f.worth.value = worth ? worth.toLocaleString("en-US") : "";
    return { reach, priced, yes, worth };
  };
  const show = () => {
    const v = clamp(), rd = monthRead(v.reach, v.priced, v.yes, v.worth, contractor);
    bubble.textContent = rd.text;
    cash.textContent = v.worth ? cashLine(rd) : "";
    const start = rd.key === "start";
    bookBtn.hidden = start; textBtn.hidden = !start;
    bubble.classList.remove("in"); void bubble.offsetWidth; bubble.classList.add("in");
    if (touched) said = "Month: " + v.reach + " reach out, " + v.priced + " get a " + (contractor ? "bid" : "price") + ", " + v.yes + " say yes" + (v.worth ? ", about " + money(v.worth) + " each" : "") + ". The page led with: " + READ_NAME[rd.key] + ".";
    return rd;
  };
  const changed = () => {
    touched = true;
    clearTimeout(timer);
    if (!still) reply.classList.add("is-typing");
    timer = setTimeout(() => {
      reply.classList.remove("is-typing");
      const rd = show();
      if (!tracked) { tracked = true; track("coach_read", { call: rd.key }); }
    }, still ? 0 : 550);
  };
  $$("[data-step]", box).forEach((b) => b.addEventListener("click", () => {
    const el = document.getElementById(b.dataset.for), d = Number(b.dataset.step);
    el.value = Math.max(0, (Number(String(el.value).replace(/[^\d]/g, "")) || 0) + d);
    changed();
  }));
  Object.values(f).forEach((el) => el.addEventListener("change", changed));
  f.worth.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(changed, 700); });
  show();
}

/* ---------- Home: what do you need? ---------- */
function initDoors() {
  const doors = $$(".door"); if (!doors.length) return;
  const ans = $("#door-ans"), line = $("#door-line"), link = $("#door-link");
  doors.forEach((d, i) => d.addEventListener("click", () => {
    doors.forEach((x) => x.setAttribute("aria-expanded", String(x === d)));
    line.textContent = d.dataset.line;
    link.textContent = d.dataset.label;
    link.href = d.dataset.href;
    ans.classList.add("on");
    track("home_pick", { n: i + 1 });
  }));
}

/* ---------- Start ---------- */
(function start() {
  const utm = captureAd();
  initTracking();
  const kw = cleanName(utm.utm_term, 60);
  /* The small line over the headline follows the search. With no search term the HTML already says the right thing. */
  const topic = $("span[data-topic]"); /* never <html>, which also carries data-topic on town pages */
  if (topic && new URLSearchParams(location.search).get("utm_term")) {
    topic.textContent = PAGE === "coach" ? coachTopic(kw, HOME) : kwTopic(kw, PAGE === "websites", HOME, PAGE_TOPIC);
  }
  if (isContractor(kw)) { const r4 = $("[data-row4]"); if (r4) r4.textContent = "Following up on the bid"; }
  const page = PAGE === "home" ? "other" : PAGE;
  $$("a[data-sms]").forEach((a) => { a.href = smsHref("", page); });
  startCalendar();
  initViewer(); initBoard(); initMonth(); initDoors();
  /* Phone bottom bar steps aside while the calendar is on screen. */
  let queued = false;
  const check = () => {
    queued = false;
    const b = $("#book"); if (!b) return;
    const r = b.getBoundingClientRect(), h = window.innerHeight || 0;
    DOC.classList.toggle("at-book", r.top < h * 0.6 && r.bottom > h * 0.4);
  };
  const ask = () => { if (!queued) { queued = true; requestAnimationFrame(check); } };
  window.addEventListener("scroll", ask, { passive: true });
  window.addEventListener("resize", ask);
  ask();
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[href^='sms:'], a[href^='#book'], a[href$='#book']");
    if (!a) return;
    if (a.href.indexOf("sms:") === 0) { track("text_tap"); textConversion(); return; }
    track("book_click");
  });
  if (new URLSearchParams(location.search).has("test")) console.log("lp2 self-test " + (selfTest() ? "passed" : "FAILED"));
})();
