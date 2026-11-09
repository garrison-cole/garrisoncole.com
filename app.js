/* garrisoncole.com v3 script
   Everything Garrison edits to go live is in CONFIG. Leave an ID empty and that piece stays off. */

const CONFIG = {
  FORMSPREE_ID: "mrppnbab", // the part after formspree.io/f/ , for example "xyzabcd"
  GA4_ID: "",              // "G-XXXXXXXXXX"
  CLARITY_ID: "",          // the Clarity project ID
  META_PIXEL_ID: "",       // optional, numbers only
  BOOKING_URL: "",         // Google Calendar appointment page or Calendly link. Empty hides every booking link.
  SAMPLE_VIDEO_URL: "",    // a Loom or YouTube embed URL. Empty hides "Watch a real one".
  TWO_MINUTES_MS: 120000,  // the nav ring and the two-minute card. 0 turns both off.
  TAB_TITLE_AWAY: true,    // "(1) Missed call from your next customer" when the tab is left for 8 seconds
  PHONE: "+17606444559",
  SITE: "https://garrisoncole.com",
  THRESHOLDS: { closeRate: 20, cpbjShareOfValue: 15, revPerCrewWeek: 8000 },
  LIFT: { none: 10, one: 6, sequence: 2 }
};

/* =====================================================================
   Pure functions. No DOM in here. Add ?test to any URL to run them.
   ===================================================================== */

const WEEKS_PER_MONTH = 4.33;

function num(v) {
  if (v === null || v === undefined) return NaN;
  const s = String(v).replace(/[$,\s%]/g, "");
  if (s === "") return NaN;
  return Number(s);
}

/** Four Numbers Scoreboard. Returns null until the inputs make a complete, valid result. */
function fourNumbers(input, t = CONFIG.THRESHOLDS) {
  const spend = num(input.spend), leads = num(input.leads), jobs = num(input.jobs), value = num(input.value);
  const crews = num(input.crews === undefined ? 1 : input.crews);
  if ([spend, leads, jobs, value, crews].some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (leads <= 0 || crews < 1 || jobs > leads) return null;
  const cpl = spend / leads;
  const closeRate = (jobs / leads) * 100;
  const cpbj = jobs > 0 ? spend / jobs : null;
  const revPerCrewWeek = (jobs * value) / crews / WEEKS_PER_MONTH;
  let verdict;
  if (closeRate < t.closeRate) verdict = "sales";
  else if (cpbj !== null && cpbj > value * (t.cpbjShareOfValue / 100)) verdict = "channel";
  else if (revPerCrewWeek < t.revPerCrewWeek) verdict = "fuel";
  else verdict = "good";
  return { cpl, closeRate, cpbj, revPerCrewWeek, verdict };
}
/* fourNumbers tests
   A) 3000 / 40 / 12 / 4500 / 2 crews: cpl 75, close 30%, cpbj 250, rev/crew/wk 54000 / 2 / 4.33 = 6235.57, verdict "fuel"
   B) 2000 / 50 / 6 / 3000 / 1 crew: close 12%, verdict "sales"
   C) leads 0 returns null */

/** Quote Leak Calculator. f is "none", "one" or "sequence". */
function quoteLeak(input, lifts = CONFIG.LIFT) {
  const q = num(input.q), v = num(input.v);
  const c = num(input.c === undefined ? 30 : input.c);
  const f = input.f || "none";
  if (!Number.isFinite(q) || !Number.isFinite(v) || q <= 0 || v <= 0) return null;
  if (!Number.isFinite(c) || c < 0 || c > 100) return null;
  const lift = Math.min(lifts[f] ?? lifts.none, 100 - c);
  const current = q * v * (c / 100);
  const monthly = q * v * (lift / 100);
  return { current, lift, monthly, yearly: monthly * 12 };
}
/* quoteLeak tests
   A) 20 quotes, 4500, 30%, none: current 27,000, monthly 9,000, yearly 108,000
   B) q 0 returns null */

const LAYERS = ["offer", "channel", "sales", "cash"];

const FINDER_QUESTIONS = [
  { q: "How do you price most jobs?", a: [
    ["Hourly or by the day", { offer: 3 }], ["A flat price from a quote", {}], ["Whatever beats the other bids", { offer: 3 }]] },
  { q: "When a customer gets three bids, how often do you win at your price?", a: [
    ["Rarely", { offer: 2 }], ["About half the time", { offer: 1 }], ["Usually", {}]] },
  { q: "Where did your last ten jobs come from?", a: [
    ["Referrals and repeat customers", { channel: 2 }], ["Angi, HomeAdvisor, Thumbtack or similar", { channel: 3 }],
    ["Google or my website", {}], ["Social media", { channel: 1 }], ["A mix", { channel: 1 }]] },
  { q: "What does your calendar look like in January compared to May?", a: [
    ["Dead in January, slammed in May", { channel: 2, cash: 2 }], ["Slower but steady", { cash: 1 }], ["About the same", {}]] },
  { q: "Who answers the phone at 4pm on a Tuesday?", a: [
    ["Me, from the job", { sales: 3 }], ["Voicemail", { sales: 3 }], ["Someone in the office", {}], ["An answering service", { sales: 1 }]] },
  { q: "After a quote goes out, what happens?", a: [
    ["We wait", { sales: 3 }], ["I follow up when I remember", { sales: 2 }], ["One call or text", { sales: 1 }], ["A set follow-up sequence", {}]] },
  { q: "Who closes the sale?", a: [
    ["Only me", { sales: 2 }], ["Me and one other person", { sales: 1 }], ["A salesperson or estimator", {}]] },
  { q: "Do you know what last month's jobs cost you after labor, materials and fuel?", a: [
    ["No idea", { cash: 3 }], ["Roughly", { cash: 1 }], ["Yes, job by job", {}]] }
];

/** Ties go to the lower layer: Offer, then Channel, then Sales, then Cash. All zero is "none". */
function finderScore(answers, questions = FINDER_QUESTIONS) {
  const scores = { offer: 0, channel: 0, sales: 0, cash: 0 };
  answers.forEach((ai, qi) => {
    const opt = questions[qi] && questions[qi].a[ai];
    if (opt) for (const [k, v] of Object.entries(opt[1])) scores[k] += v;
  });
  let layer = "none", best = 0;
  for (const k of LAYERS) if (scores[k] > best) { best = scores[k]; layer = k; }
  return { scores, layer };
}
/* finderScore test: [1,2,2,2,0,0,0,2] scores sales 8, everything else 0, so "sales" */

/** Most-tapped layer wins. Ties go to the lower layer. */
function painLayer(layers) {
  const counts = { offer: 0, channel: 0, sales: 0, cash: 0 };
  layers.forEach((l) => { if (l in counts) counts[l] += 1; });
  let best = null, n = 0;
  for (const k of LAYERS) if (counts[k] > n) { n = counts[k]; best = k; }
  return best;
}

/** Company and town names. Tags and links come out, then anything that isn't a letter, number, space, & ' - or period. Max 40. */
function cleanName(s) {
  return String(s == null ? "" : s)
    .replace(/[‘’]/g, "'")
    .replace(/<[^>]*>?/g, " ")
    .replace(/(?:https?:\/\/|www\.)\S*/gi, " ")
    .replace(/[^\p{L}\p{N} &'.\-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40)
    .trim();
}
/* cleanName tests
   "<b>Aguilar</b> Fence https://x.co/a" -> "Aguilar Fence"
   "Smith & Sons' Co.-West" stays as is
   60 letters -> 40 */

const TRADES = {
  fence:     { chip: "Fencing",                lead: "fence repair",           search: "fence contractor",      booked: "fence estimate" },
  concrete:  { chip: "Concrete and pavers",    lead: "paver patio",            search: "concrete contractor",   booked: "patio estimate" },
  tree:      { chip: "Tree service",           lead: "tree removal",           search: "tree service",          booked: "tree removal bid" },
  landscape: { chip: "Landscape and turf",     lead: "backyard turf",          search: "landscaper",            booked: "landscape estimate" },
  epoxy:     { chip: "Epoxy floors",           lead: "garage floor epoxy",     search: "epoxy garage floor",    booked: "garage floor quote" },
  glass:     { chip: "Windows and glass",      lead: "window replacement",     search: "window company",        booked: "window estimate" },
  pool:      { chip: "Pools",                  lead: "pool resurfacing",       search: "pool contractor",       booked: "pool bid" },
  paint:     { chip: "Painting",               lead: "exterior repaint",       search: "house painter",         booked: "paint estimate" },
  garage:    { chip: "Garage doors",           lead: "garage door repair",     search: "garage door repair",    booked: "repair visit" },
  haul:      { chip: "Demolition and hauling", lead: "junk haul-off",          search: "demolition contractor", booked: "haul-off quote" },
  coach:     { chip: "Coaching and consulting", lead: "discovery call request", search: "executive coach",      booked: "discovery call" }
};
const DEFAULT_TRADE = { key: "", chip: "Something else", lead: "paver patio", search: "fence repair", booked: "paver patio estimate" };
const DEFAULT_TOWN = "Roseville";

/* The sample listing borrows the visitor's trade and town. The company stays made up. */
const SAMPLE_BIZ = { fence: "Example Fence Co.", concrete: "Example Concrete Co.", tree: "Example Tree Care", landscape: "Example Landscape Co.",
  epoxy: "Example Floor Coatings", glass: "Example Window Co.", pool: "Example Pool Co.", paint: "Example Painting Co.",
  garage: "Example Garage Door Co.", haul: "Example Hauling Co.", coach: "Example Coaching Co." };

/** What the sample search box shows. Defaults to the fence company in Rocklin. */
function samplePhrase(tradeKey, town) {
  const t = cleanName(town) || "Rocklin";
  return (TRADES[tradeKey] ? TRADES[tradeKey].search : "fence contractor") + " " + t.toLowerCase();
}
/* samplePhrase tests: ("tree", "Granite Bay") -> "tree service granite bay"; ("", "") -> "fence contractor rocklin" */

function tradeFor(key) {
  return Object.prototype.hasOwnProperty.call(TRADES, key) ? Object.assign({ key }, TRADES[key]) : DEFAULT_TRADE;
}
/* tradeFor tests: tradeFor("fence").search is "fence contractor"; tradeFor("roofing") is the default */

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const titleCase = (s) => s.replace(/(^|[ \-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());

/** The hero phone's two scripts for a trade and a town. */
function phoneScript(trade = DEFAULT_TRADE, town = DEFAULT_TOWN) {
  const t = titleCase(cleanName(town) || DEFAULT_TOWN);
  const coach = trade.key === "coach";
  return {
    today: { focus: "On a job site", notes: [
      { app: "Phone", icon: "call", tone: "alert", title: "Missed call", body: "(916) 555-0142, " + t },
      { app: "Messages", icon: "msg", title: "(916) 555-0188", body: coach ? "Hi, are you taking new clients? Hoping to start this month." : "Hi, do you do " + trade.lead + "? Looking for a quote this week." },
      { app: "Leads", icon: "pin", title: coach ? "Inquiry, sent to 3 coaches" : "New lead, shared with 3 pros", body: cap(trade.lead) + ", " + t + ". First to respond wins." },
      { app: "Phone", icon: "vm", tone: "alert", title: "Voicemail, 0:42", body: "“Calling back about the quote, give me a…”" },
      { app: "Reminders", icon: "bell", title: "Follow up on last week's quote", body: "Sent 9 days ago. No reply." },
      { app: "Messages", icon: "msg", tone: "alert", title: "(916) 555-0188", body: "Never mind, we went with someone else." }
    ] },
    engine: { focus: "Running without you", notes: [
      { app: "Auto-reply", icon: "bolt", title: "Texted back in 41 seconds", body: "(916) 555-0142 has your " + (coach ? "booking" : "estimate") + " link." },
      { app: "Calendar", icon: "cal", tone: "win", title: "Booked: Thursday, 8:00 AM", body: cap(trade.booked) + ", " + t },
      { app: "Google Ads", icon: "search", title: "New call from “" + trade.search + " " + t.toLowerCase() + "”", body: "Answered by the office. 2 min 14 sec." },
      { app: "Follow-up", icon: "bolt", title: "Step 3 of 4 sent", body: "Last week's " + (coach ? "proposal" : "quote") },
      { app: coach ? "Proposals" : "Quotes", icon: "check", tone: "win", title: coach ? "Proposal accepted" : "Quote accepted", body: "Deposit paid." },
      { app: "Scoreboard", icon: "chart", tone: "win", title: "This week so far", body: "31% close rate. $155 per booked job." }
    ] }
  };
}
/* phoneScript test: phoneScript(tradeFor("fence"), "rocklin").engine.notes[1].body is "Fence estimate, Rocklin" */

/* Roseville time. Every visitor gets the Roseville clock, so the sun matches the nav. */
const TZ = "America/Los_Angeles";
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const fmtParts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", weekday: "short", month: "numeric", hour: "numeric", minute: "numeric" });

/** A Date, or an already-made {month, day, mins}. month 0-11, day 0 = Sunday, mins since midnight. */
function partsOf(d) {
  if (d && typeof d.mins === "number") return d;
  const p = {};
  fmtParts.formatToParts(d).forEach((x) => (p[x.type] = x.value));
  return { month: Number(p.month) - 1, day: WD.indexOf(p.weekday), mins: (Number(p.hour) % 24) * 60 + Number(p.minute) };
}
const at = (month, h, m, day = 1) => ({ month, day, mins: h * 60 + m });

/* Sunrise and sunset by month, minutes after midnight, Roseville clock time. */
const SUN = [[440, 1025], [415, 1060], [435, 1150], [390, 1180], [355, 1208], [342, 1230],
  [355, 1227], [380, 1198], [407, 1152], [435, 1107], [405, 1015], [435, 1005]];

/** Where the hero sun sits. x and y are percentages of the hero box. */
function skyFor(d) {
  const p = partsOf(d);
  const [rise, set] = SUN[p.month];
  const t = p.mins;
  const r = (n) => Math.round(n * 10) / 10;
  const k = (a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
  if (t >= rise - 45 && t < rise + 60) {
    return { phase: "dawn", x: 82, y: r(104 - 18 * k(rise - 45, rise + 60)), size: 1100, glow: "rgba(255,196,92,.55)" };
  }
  if (t >= rise + 60 && t < set - 90) {
    const q = k(rise + 60, set - 90);
    return { phase: "day", x: r(82 - 60 * q), y: r(78 - 64 * Math.sin(Math.PI * q)), size: 1200, glow: "rgba(255,226,160,.42)" };
  }
  if (t >= set - 90 && t < set) {
    return { phase: "golden", x: 22, y: r(84 + 16 * k(set - 90, set)), size: 1300, glow: "rgba(255,170,70,.58)" };
  }
  if (t >= set && t < set + 45) return { phase: "dusk", x: 18, y: 114, size: 1100, glow: "rgba(255,160,90,.40)" };
  return { phase: "night", x: 88, y: 84, size: 400, glow: "rgba(255,190,100,.55)" };
}
/* skyFor tests (Nov rise 6:45, set 16:55)
   Nov 9 06:30 dawn. Nov 9 12:25 day, y about 16, close to the top of the arc. Nov 9 16:10 golden.
   Nov 9 17:20 dusk. Nov 9 22:00 night. Jun 21 20:00 golden (Jun set 20:30). */

const GREET = {
  early: "Early start. You're up before the crew.",
  morning: "Morning. I'll keep this quick, you've got jobs running.",
  lunch: "Lunch on the tailgate? Two minutes is all this takes.",
  four: "It's about 4pm. Who's answering your phone right now?",
  after: "After hours. This is usually when owners finally get to the business side.",
  late: "Late one. Leave your company name and get some sleep. I'll take it from here.",
  saturday: "Saturday. Of course you're working.",
  sunday: "Sunday. I'm probably at the ballfield. Text me anyway."
};

function greetSlot(p) {
  const t = p.mins;
  if (t >= 1260 || t < 300) return "late";
  if (p.day === 6) return "saturday";
  if (p.day === 0) return "sunday";
  if (t < 480) return "early";
  if (t < 720) return "morning";
  if (t < 930) return "lunch";
  if (t < 1050) return "four";
  return "after";
}

/** The line above the H1. With a company name it goes in front and the first word drops to lowercase. */
function greetingFor(d, company) {
  const slot = greetSlot(partsOf(d));
  let line = GREET[slot];
  const name = cleanName(company);
  if (!name) return { slot, name: "", line, text: line };
  if (!/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|I\b|I')/.test(line)) line = line.charAt(0).toLowerCase() + line.slice(1);
  return { slot, name, line, text: name + ", " + line };
}
/* greetingFor tests: one per row, plus
   Mon 16:00 + "Aguilar Fence" -> "Aguilar Fence, it's about 4pm. Who's answering your phone right now?"
   Sat 10:00 + "Aguilar Fence" -> "Aguilar Fence, Saturday. Of course you're working." */

function runSelfTests() {
  const near = (a, b) => Math.abs(a - b) < 0.01;
  const out = [];
  const a = fourNumbers({ spend: 3000, leads: 40, jobs: 12, value: 4500, crews: 2 });
  out.push(["four A cpl", near(a.cpl, 75)], ["four A close", near(a.closeRate, 30)], ["four A cpbj", near(a.cpbj, 250)],
    ["four A rev", near(a.revPerCrewWeek, 6235.57)], ["four A verdict", a.verdict === "fuel"]);
  const b = fourNumbers({ spend: 2000, leads: 50, jobs: 6, value: 3000, crews: 1 });
  out.push(["four B close", near(b.closeRate, 12)], ["four B verdict", b.verdict === "sales"]);
  out.push(["four C empty", fourNumbers({ spend: 1000, leads: 0, jobs: 0, value: 1000, crews: 1 }) === null]);
  const l = quoteLeak({ q: 20, v: 4500, c: 30, f: "none" });
  out.push(["leak current", near(l.current, 27000)], ["leak monthly", near(l.monthly, 9000)], ["leak yearly", near(l.yearly, 108000)]);
  out.push(["leak empty", quoteLeak({ q: 0, v: 4500 }) === null]);
  out.push(["finder sales", finderScore([1, 2, 2, 2, 0, 0, 0, 2]).layer === "sales"]);
  out.push(["finder none", finderScore([1, 2, 2, 2, 2, 3, 2, 2]).layer === "none"]);
  out.push(["finder tie to offer", finderScore([0, 2, 1, 2, 2, 3, 2, 2]).layer === "offer"]);
  out.push(["pains channel", painLayer(["channel", "channel", "sales"]) === "channel"]);
  out.push(["pains tie to offer", painLayer(["offer", "cash"]) === "offer"]);
  out.push(["pains none", painLayer([]) === null]);
  out.push(["sky dawn", skyFor(at(10, 6, 30)).phase === "dawn"]);
  const noon = skyFor(at(10, 12, 25));
  out.push(["sky day near top", noon.phase === "day" && noon.y < 20]);
  out.push(["sky golden", skyFor(at(10, 16, 10)).phase === "golden"]);
  out.push(["sky dusk", skyFor(at(10, 17, 20)).phase === "dusk"]);
  out.push(["sky night", skyFor(at(10, 22, 0)).phase === "night"]);
  out.push(["sky June golden", skyFor(at(5, 20, 0)).phase === "golden"]);
  [["early", 6, 0, 1], ["morning", 9, 0, 1], ["lunch", 12, 30, 1], ["four", 16, 0, 5], ["after", 18, 0, 1],
    ["late", 23, 0, 6], ["saturday", 10, 0, 6], ["sunday", 10, 0, 0]].forEach(([slot, h, m, day]) => {
    out.push(["greet " + slot, greetingFor(at(10, h, m, day)).slot === slot]);
  });
  out.push(["greet company", greetingFor(at(10, 16, 0), "Aguilar Fence").text === "Aguilar Fence, it's about 4pm. Who's answering your phone right now?"]);
  out.push(["greet company day name", greetingFor(at(10, 10, 0, 6), "Aguilar Fence").text === "Aguilar Fence, Saturday. Of course you're working."]);
  out.push(["clean tags and links", cleanName("<b>Aguilar</b> Fence https://x.co/a") === "Aguilar Fence"]);
  out.push(["clean keeps marks", cleanName("Smith & Sons' Co.-West") === "Smith & Sons' Co.-West"]);
  out.push(["clean max 40", cleanName("a".repeat(60)).length === 40]);
  out.push(["trade fence", tradeFor("fence").search === "fence contractor"]);
  out.push(["trade unknown", tradeFor("roofing") === DEFAULT_TRADE]);
  out.push(["sample phrase", samplePhrase("tree", "Granite Bay") === "tree service granite bay" && samplePhrase("", "") === "fence contractor rocklin"]);
  out.push(["phone script", phoneScript(tradeFor("fence"), "rocklin").engine.notes[1].body === "Fence estimate, Rocklin"]);
  return out;
}

/* =====================================================================
   Formatting, tracking, small helpers
   ===================================================================== */

const fmtMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmtInt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const fmtPct = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const money = (n) => fmtMoney.format(Math.round(n));
const pct = (n) => fmtPct.format(n) + "%";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const PAGE = document.body.dataset.page || "";
const hasIO = "IntersectionObserver" in window;

function loadScript(src) {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

function initTracking() {
  if (CONFIG.GA4_ID) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", CONFIG.GA4_ID);
    loadScript("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(CONFIG.GA4_ID));
  }
  if (CONFIG.CLARITY_ID) {
    window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
    loadScript("https://www.clarity.ms/tag/" + encodeURIComponent(CONFIG.CLARITY_ID));
  }
  if (CONFIG.META_PIXEL_ID) {
    const f = window;
    if (!f.fbq) {
      const n = (f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); });
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
      loadScript("https://connect.facebook.net/en_US/fbevents.js");
    }
    f.fbq("init", CONFIG.META_PIXEL_ID);
    f.fbq("track", "PageView");
  }
}

/** Events carry the trade and true/false flags. The company name never goes to analytics. */
function track(name, params = {}) {
  try {
    if (window.gtag) window.gtag("event", name, params);
    if (window.clarity) window.clarity("event", name);
    if (window.fbq) window.fbq("trackCustom", name, params);
  } catch (e) { /* tracking never breaks the page */ }
  if (window.__gcDebug) console.log("[track]", name, params);
  (window.__gcEvents = window.__gcEvents || []).push([name, params]);
}

function initLinkTracking() {
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a) return;
    const href = a.getAttribute("href");
    const loc = (a.closest("[data-loc]") && a.closest("[data-loc]").dataset.loc) || "body";
    if (href.startsWith("tel:")) track("phone_tap", { location: loc });
    else if (href.startsWith("sms:")) track("text_tap", Object.assign({ location: loc }, a.dataset.tool ? { tool: a.dataset.tool } : {}));
    else if (href.startsWith("mailto:")) track("email_tap", { location: loc });
    else if (a.hasAttribute("data-booking")) track("booking_click", { location: loc });
  });
}

function store(kind, key, value) {
  try {
    const s = kind === "local" ? window.localStorage : window.sessionStorage;
    if (value === undefined) return s.getItem(key);
    if (value === null) s.removeItem(key); else s.setItem(key, value);
  } catch (e) { return null; }
  return null;
}

const smsHref = (body) => "sms:" + CONFIG.PHONE + (body ? "?&body=" + encodeURIComponent(body) : "");
const formHref = () => ($("#contact") ? "#contact" : "index.html#contact");

function tweenTo(el, to, format, ms = 150) {
  const from = Number(el.dataset.v || 0);
  el.dataset.v = String(to);
  el.classList.remove("empty");
  if (reduceMotion || ms === 0 || !Number.isFinite(from)) { el.textContent = format(to); return; }
  const start = performance.now();
  cancelAnimationFrame(el._raf);
  const step = (now) => {
    const p = Math.min(1, (now - start) / ms);
    el.textContent = format(from + (to - from) * (1 - Math.pow(1 - p, 3)));
    if (p < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
}

function setEmpty(el, text) {
  cancelAnimationFrame(el._raf);
  el.dataset.v = "0";
  el.textContent = text;
  el.classList.add("empty");
}

/** One quiet live region per tool, so screen readers hear the settled result once. */
function announce(root, text) {
  let live = root.querySelector("[data-live]");
  if (!live) {
    live = document.createElement("p");
    live.className = "visually-hidden";
    live.setAttribute("aria-live", "polite");
    live.setAttribute("data-live", "");
    root.appendChild(live);
  }
  clearTimeout(live._t);
  live._t = setTimeout(() => { live.textContent = text || ""; }, 700);
}

function resultReporter(tool) {
  let timer = null, last = "";
  return (outcome) => {
    clearTimeout(timer);
    if (!outcome) return;
    timer = setTimeout(() => {
      if (outcome === last) return;
      last = outcome;
      track("tool_result", { tool, outcome });
    }, 1200);
  };
}

function startReporter(root, tool) {
  let started = false;
  root.addEventListener("input", () => {
    if (started) return;
    started = true;
    track("tool_start", { tool });
  });
}

function hashState(id) {
  const h = decodeURIComponent(location.hash.slice(1));
  if (!h.startsWith(id + "?")) return null;
  return Object.fromEntries(new URLSearchParams(h.slice(id.length + 1)));
}

function writeHash(id, params) {
  try { history.replaceState(null, "", location.pathname + location.search + "#" + id + "?" + new URLSearchParams(params)); } catch (e) { /* sandbox */ }
}

const shareUrl = (id, params) => CONFIG.SITE + "/tools.html#" + id + "?" + new URLSearchParams(params).toString();

/* =====================================================================
   Move 1: your name on the door
   ===================================================================== */

const ME = { co: "", trade: "", town: "" };
let SCRIPT = phoneScript();
const phoneHooks = [];

function loadMe() {
  try { Object.assign(ME, JSON.parse(store("session", "gc-me") || "{}") || {}); } catch (e) { /* ignore */ }
  ME.co = cleanName(ME.co);
  ME.town = cleanName(ME.town);
  if (!TRADES[ME.trade]) ME.trade = "";
  const q = new URLSearchParams(location.search);
  if (PAGE !== "link" && (q.has("co") || q.has("trade") || q.has("town"))) {
    if (q.has("co")) ME.co = cleanName(q.get("co"));
    if (q.has("trade")) ME.trade = TRADES[q.get("trade")] ? q.get("trade") : "";
    if (q.has("town")) ME.town = cleanName(q.get("town"));
    saveMe();
    track("personalized_view", { source: "link", trade: ME.trade || "none" });
  }
}

function saveMe() {
  store("session", "gc-me", JSON.stringify({ co: ME.co, trade: ME.trade, town: ME.town }));
}

const DEFAULT_TITLE = document.title;

function applyMe() {
  const co = ME.co;
  if (PAGE === "home") document.title = co ? co + ", this page is yours" : DEFAULT_TITLE;
  SCRIPT = phoneScript(tradeFor(ME.trade), ME.town ? titleCase(ME.town) : DEFAULT_TOWN);
  phoneHooks.forEach((fn) => fn());
  renderGreeting();
  $$('a[href^="sms:"]:not([data-tool])').forEach((a) => {
    a.href = smsHref(co ? "This is ___ from " + co + ". " : "");
  });
  if (co) $$("form[data-lead-form]").forEach((f) => { if (!f.elements.company.value) f.elements.company.value = co; });
  const sf = $("form[data-search-check]");
  if (sf) {
    if (ME.trade && !sf.elements.trade.value) sf.elements.trade.value = TRADES[ME.trade].search;
    if (ME.town && !sf.elements.city.value) sf.elements.city.value = titleCase(ME.town);
  }
  $$("[data-scout-phrase]").forEach((n) => (n.textContent = samplePhrase(ME.trade, ME.town)));
  $$("[data-scout-biz]").forEach((n) => (n.textContent = SAMPLE_BIZ[ME.trade] || "Example Fence Co."));
  $$("[data-scout-cat]").forEach((n) => (n.textContent = ME.trade ? cap(TRADES[ME.trade].search) : "Fence contractor"));
  $$("[data-scout-town]").forEach((n) => (n.textContent = ME.town ? titleCase(ME.town) : "Rocklin"));
  const th = $("[data-thanks-title]");
  if (th) th.textContent = co ? "Got it, " + co + "." : "Got it.";
}

function initClaim() {
  const root = $("[data-claim]");
  if (!root) return;
  const form = $("[data-claim-form]", root);
  const chips = $("[data-claim-chips]", root);
  const owned = $("[data-claim-owned]", root);
  const msg = $(".claim-msg", root);
  const input = form.elements.co;
  const show = (which) => {
    form.hidden = which !== "form";
    chips.hidden = which !== "chips";
    owned.hidden = which !== "owned";
    if (which === "owned") $("[data-owned-name]", owned).textContent = ME.co;
  };
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const co = cleanName(input.value);
    if (!co) { msg.textContent = "Type your company name first."; input.focus(); return; }
    msg.textContent = "";
    ME.co = co;
    saveMe();
    applyMe();
    drawName();
    show("chips");
    const first = $("button", chips);
    if (first) first.focus({ preventScroll: true });
  });
  chips.addEventListener("click", (e) => {
    const b = e.target.closest("[data-trade]");
    if (!b) return;
    ME.trade = TRADES[b.dataset.trade] ? b.dataset.trade : "";
    saveMe();
    applyMe();
    track("trade_pick", { trade: ME.trade || "other" });
    track("personalized_view", { source: "field", trade: ME.trade || "none" });
    show("owned");
    $("[data-claim-change]", owned).focus({ preventScroll: true });
  });
  $("[data-claim-change]", owned).addEventListener("click", () => {
    input.value = ME.co;
    show("form");
    input.focus();
    input.select();
  });
  show(ME.co ? "owned" : "form");
}

/* =====================================================================
   Move 4: the sun and the greeting
   ===================================================================== */

/** ?time=16:10 previews the sun and greeting at that Roseville time today. */
function nowParts() {
  const p = partsOf(new Date());
  const m = /^(\d{1,2}):(\d{2})$/.exec(new URLSearchParams(location.search).get("time") || "");
  if (m) p.mins = Math.min(1439, Number(m[1]) * 60 + Number(m[2]));
  return p;
}

let greetShown = false;

function renderGreeting() {
  const el = $("[data-greeting]");
  if (!el) return;
  const g = greetingFor(nowParts(), ME.co);
  if (g.name) {
    const name = document.createElement("span");
    name.className = "co mk-hl";
    name.textContent = g.name;
    el.replaceChildren(name, document.createTextNode(", " + g.line));
    if (el.dataset.drawn) name.classList.add("drawn");
  } else {
    el.textContent = g.line;
  }
  if (!greetShown) { greetShown = true; track("greeting_shown", { slot: g.slot }); }
}

function drawName() {
  const el = $("[data-greeting]");
  const name = el && $(".co", el);
  if (!name) return;
  el.dataset.drawn = "1";
  if (reduceMotion) { name.classList.add("drawn"); return; }
  setTimeout(() => name.classList.add("drawn"), 120);
}

function initSky() {
  const hero = $("[data-hero]");
  const set = () => {
    const s = skyFor(nowParts());
    document.documentElement.dataset.phase = s.phase;
    if (!hero) return;
    hero.style.setProperty("--sky-x", s.x + "%");
    hero.style.setProperty("--sky-y", s.y + "%");
    hero.style.setProperty("--sky-size", s.size + "px");
    hero.style.setProperty("--sky-glow", s.glow);
  };
  set();
  setInterval(() => { set(); renderGreeting(); }, 300000);
}

/* =====================================================================
   Nav, sticky bar, booking, the Roseville clock
   ===================================================================== */

function initNav() {
  const nav = $(".nav");
  if (nav) {
    const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }
  const btn = $(".menu-btn"), sheet = $("#sheet");
  if (btn && sheet) {
    const close = () => { sheet.hidden = true; btn.setAttribute("aria-expanded", "false"); };
    btn.addEventListener("click", () => {
      if (btn.getAttribute("aria-expanded") === "true") { close(); return; }
      sheet.hidden = false;
      btn.setAttribute("aria-expanded", "true");
    });
    sheet.addEventListener("click", (e) => { if (e.target.closest("a")) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !sheet.hidden) { close(); btn.focus(); } });
  }
  const sticky = $(".sticky"), hero = $("[data-hero]");
  if (sticky && hero && hasIO) {
    new IntersectionObserver(([entry]) => {
      const past = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      sticky.classList.toggle("on", past);
      sticky.setAttribute("aria-hidden", String(!past));
      $$("a, button", sticky).forEach((el) => (el.tabIndex = past ? 0 : -1));
    }).observe(hero);
  }
}

function initBooking() {
  $$("[data-booking]").forEach((el) => {
    if (!CONFIG.BOOKING_URL) { el.hidden = true; return; }
    el.href = CONFIG.BOOKING_URL;
    el.hidden = false;
    el.target = "_blank";
    el.rel = "noopener";
  });
}

const fmtClock = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const fmtLockDate = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric" });

function initClock() {
  const clocks = $$("[data-clock]"), lockTime = $("[data-lock-time]"), lockDate = $("[data-lock-date]");
  if (!clocks.length && !lockTime) return;
  const tick = () => {
    const now = new Date();
    const t = fmtClock.format(now);
    clocks.forEach((el) => (el.textContent = "Roseville, " + t));
    if (lockTime) lockTime.textContent = t.replace(/\s?[AP]M$/, "");
    if (lockDate) lockDate.textContent = fmtLockDate.format(now);
  };
  tick();
  setTimeout(() => { tick(); setInterval(tick, 60000); }, (60 - new Date().getSeconds()) * 1000 + 50);
}

/* =====================================================================
   Home: count-up, phone, pains, timeline, stack, headline, manifesto
   ===================================================================== */

function initCountUp() {
  const board = $("[data-countup]");
  if (!board) return;
  const cells = $$("[data-count]", board);
  const show = (el, n) => { el.textContent = (el.dataset.prefix || "") + fmtInt.format(Math.round(n)) + (el.dataset.suffix || ""); };
  const run = () => {
    track("scoreboard_view");
    if (reduceMotion) { cells.forEach((el) => show(el, Number(el.dataset.count))); return; }
    cells.forEach((el, i) => {
      const to = Number(el.dataset.count);
      const t0 = performance.now() + i * 120;
      const tick = (now) => {
        const p = Math.max(0, Math.min(1, (now - t0) / 1200));
        show(el, to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  };
  if (!hasIO) { run(); return; }
  cells.forEach((el) => show(el, 0));
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { io.disconnect(); run(); }
  }, { threshold: 0.5 });
  io.observe(board);
}

const ICONS = {
  call: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  msg: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z"/>',
  pin: '<path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',
  vm: '<circle cx="7" cy="12" r="3.5"/><circle cx="17" cy="12" r="3.5"/><path d="M7 15.5h10"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  bolt: '<path d="M13 3 5 14h6l-1 7 8-11h-6z"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
  check: '<path d="m5 12 4.5 4.5L19 7"/>',
  chart: '<path d="M5 19V11M12 19V5M19 19v-6"/>'
};

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

/** Built with textContent, so a company or town name can never become markup. */
function noteEl(n) {
  const box = el("div", "note");
  if (n.tone) box.dataset.tone = n.tone;
  const icon = el("span", "note-icon");
  icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICONS[n.icon] + "</svg>";
  const body = el("span");
  const top = el("span", "note-top");
  top.append(el("span", "", n.app), el("span", "note-when", "now"));
  body.append(top, el("b", "", n.title), el("span", "note-body", n.body));
  box.append(icon, body);
  return box;
}

function initPhone() {
  const stage = $("[data-phone]");
  if (!stage) return;
  const list = $("[data-notes]", stage), focus = $("[data-focus]", stage);
  const buttons = $$("[data-mode-btn]", stage);
  const MAX = 4;
  let mode = "today", i = 0, timer = null, auto = true, visible = false;

  const stamp = () => {
    $$(".note:not(.leaving)", list).forEach((n, idx) => {
      const w = $(".note-when", n);
      if (w) w.textContent = idx === 0 ? "now" : idx * 3 + "m ago";
    });
  };
  const push = (n, instant) => {
    const node = noteEl(n);
    if (instant) node.style.animation = "none";
    list.prepend(node);
    $$(".note:not(.leaving)", list).slice(MAX).forEach((old) => {
      if (instant || reduceMotion) { old.remove(); return; }
      old.classList.add("leaving");
      old.addEventListener("animationend", () => old.remove(), { once: true });
    });
    stamp();
  };
  const setMode = (m, clear) => {
    mode = m; i = 0;
    stage.dataset.mode = m;
    focus.textContent = SCRIPT[m].focus;
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeBtn === m)));
    if (clear) list.replaceChildren();
  };
  const fillStatic = () => { list.replaceChildren(); SCRIPT[mode].notes.slice(-MAX).forEach((n) => push(n, true)); };
  const step = () => {
    clearTimeout(timer);
    if (!visible) return;
    const script = SCRIPT[mode].notes;
    if (i < script.length) {
      push(script[i]);
      i += 1;
      timer = setTimeout(step, i === script.length ? 2600 : 2100);
    } else if (auto) {
      setMode(mode === "today" ? "engine" : "today", true);
      timer = setTimeout(step, 450);
    } else {
      timer = setTimeout(() => { i = 0; list.replaceChildren(); step(); }, 4000);
    }
  };
  buttons.forEach((b) => b.addEventListener("click", () => {
    auto = false;
    clearTimeout(timer);
    setMode(b.dataset.modeBtn, true);
    track("phone_mode", { mode: b.dataset.modeBtn });
    if (reduceMotion) { fillStatic(); return; }
    step();
  }));
  // When the visitor personalizes, the phone starts over with their trade and town.
  phoneHooks.push(() => {
    if (reduceMotion) { fillStatic(); return; }
    clearTimeout(timer);
    setMode(mode, true);
    push(SCRIPT[mode].notes[0], true);
    i = 1;
    if (visible) timer = setTimeout(step, 900);
  });
  if (reduceMotion) { fillStatic(); return; }
  push(SCRIPT.today.notes[0], true);
  i = 1;
  const go = () => { clearTimeout(timer); timer = setTimeout(step, 900); };
  if (!hasIO) { visible = true; go(); return; }
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting && !document.hidden;
    if (visible) go(); else clearTimeout(timer);
  }, { threshold: 0.25 }).observe(stage);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { visible = false; clearTimeout(timer); }
    else if (stage.getBoundingClientRect().top < innerHeight) { visible = true; go(); }
  });
}

const PAIN_READ = {
  offer: { text: "Sounds like the offer. When price is the fight, it starts with how the job is priced.", href: "philosophy.html#offer" },
  channel: { text: "Sounds like the channel. The work is good enough. The right people aren't finding you on the day they're ready to hire.", href: "philosophy.html#channel" },
  sales: { text: "Sounds like the sales system. The leads are there. They're going cold between the first call and the signed quote.", href: "philosophy.html#sales" },
  cash: { text: "Sounds like cash. Busy and still tight usually means nobody knows what a job really costs.", href: "philosophy.html#cash" }
};

function initPains() {
  const root = $("[data-pains]");
  if (!root) return;
  const buttons = $$(".pain", root), read = $(".pain-read", root);
  const count = $("[data-pain-n]", root), verdict = $("[data-pain-verdict]", root), link = $("[data-pain-link]", root);
  const update = () => {
    const on = buttons.filter((b) => b.getAttribute("aria-pressed") === "true");
    count.textContent = String(on.length);
    read.hidden = !on.length;
    if (!on.length) return;
    if (on.length === buttons.length) {
      verdict.textContent = "All seven. Text me your company name and I'll start on your video today.";
      link.href = smsHref(ME.co ? "This is ___ from " + ME.co + ". " : "");
      link.textContent = "Text me";
    } else {
      const layer = painLayer(on.map((b) => b.dataset.layer));
      verdict.textContent = PAIN_READ[layer].text;
      link.href = PAIN_READ[layer].href;
      link.textContent = "What that looks like";
    }
  };
  buttons.forEach((b) => b.addEventListener("click", () => {
    const on = b.getAttribute("aria-pressed") !== "true";
    b.setAttribute("aria-pressed", String(on));
    update();
    if (on) track("pain_tap", { layer: b.dataset.layer });
  }));
  update();
}

function onceInView(target, fn, opts) {
  if (reduceMotion || !hasIO) { fn(); return; }
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { io.disconnect(); fn(); }
  }, opts || { threshold: 0.45 });
  io.observe(target);
}

function initTimeline() {
  const tl = $("[data-timeline]");
  if (!tl) return;
  onceInView(tl, () => {
    tl.style.setProperty("--fill", "1");
    $$("li", tl).forEach((li, i) => setTimeout(() => li.classList.add("lit"), reduceMotion ? 0 : 150 + i * 420));
  });
}

function initBuild() {
  $$("[data-build]").forEach((l) => onceInView(l, () => l.classList.add("built"), { threshold: 0.3 }));
}

/** Splits an element's words for animation. Screen readers get one visually hidden copy of the text. Marked spans survive. */
function splitWords(node, cls, inner) {
  const full = node.textContent.replace(/[ \t\n]+/g, " ").trim();
  let i = 0;
  const word = (w) => {
    const s = el("span", cls);
    if (inner) { const t = el("span", "", w); t.style.setProperty("--i", i); s.appendChild(t); } else s.textContent = w;
    i += 1;
    return s;
  };
  const build = (from, into) => {
    Array.from(from.childNodes).forEach((ch) => {
      if (ch.nodeType === 3) {
        ch.textContent.split(/([ \t\n]+)/).forEach((p) => {
          if (!p) return;
          into.appendChild(/^[ \t\n]+$/.test(p) ? document.createTextNode(" ") : word(p));
        });
      } else if (ch.nodeType === 1) {
        const clone = ch.cloneNode(false);
        into.appendChild(clone);
        build(ch, clone);
      }
    });
  };
  const shown = el("span");
  shown.setAttribute("aria-hidden", "true");
  build(node, shown);
  node.replaceChildren(el("span", "visually-hidden", full), shown);
  return $$("." + cls, shown);
}

function initReveal() {
  const h = $("[data-reveal]");
  if (!h) return;
  if (!reduceMotion) splitWords(h, "hw", true);
  h.classList.add("split");
}

function initManifesto() {
  const p = $("[data-words]");
  if (!p || reduceMotion) return;
  const words = splitWords(p, "w", false);
  let ticking = false;
  const paint = () => {
    ticking = false;
    const r = p.getBoundingClientRect(), vh = window.innerHeight;
    const start = vh * 0.85, end = vh * 0.55;
    const progress = Math.max(0, Math.min(1, (start - r.top) / (r.height + (start - end))));
    const n = Math.round(progress * words.length);
    words.forEach((w, i) => w.classList.toggle("on", i < n));
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(paint); } };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  paint();
}

/* =====================================================================
   Move 3: the marker
   ===================================================================== */

/* A hand-drawn loop in a 100 by 42 box. The ends overlap and miss, the way a pen does. */
const CIRCLE_PATH = "M10 24 C7 11 34 4 58 5 C82 6 97 13 95 24 C93 35 71 39 48 38 C25 37 4 31 7 19 C9 11 22 6 33 5";

function circleSvg() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("class", "mk-svg");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("pathLength", "1");
  svg.appendChild(path);
  return svg;
}

/** Redraws the loop at the box's real pixel size so the pen line stays 2.5 px on any shape. */
function fitCircle(svg) {
  const r = svg.getBoundingClientRect();
  const w = Math.max(24, r.width), h = Math.max(14, r.height);
  svg.setAttribute("viewBox", "0 0 " + w.toFixed(1) + " " + h.toFixed(1));
  svg.firstChild.setAttribute("d", CIRCLE_PATH.replace(/(-?[\d.]+) (-?[\d.]+)/g, (m, x, y) => (x * w / 100).toFixed(1) + " " + (y * h / 42).toFixed(1)));
}

function initMarker() {
  const marks = $$("[data-mark]");
  marks.forEach((m) => {
    const kind = m.dataset.mark;
    if (kind === "hl") m.classList.add("mk-hl");
    else if (kind === "ul") m.classList.add("mk-ul");
    else if (kind === "circle") { m.classList.add("mk-circle"); m.appendChild(circleSvg()); }
  });
  const all = marks.concat($$(".pen-note"));
  const draw = (n) => {
    const svg = n.matches(".mk-circle") && $(".mk-svg", n);
    if (svg) fitCircle(svg);
    requestAnimationFrame(() => n.classList.add("drawn"));
  };
  all.forEach((n) => {
    if (reduceMotion || !hasIO) { draw(n); return; }
    const delay = n.dataset.markDelay;
    if (delay) { setTimeout(() => draw(n), Number(delay)); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); draw(n); }
    }, { rootMargin: "0px 0px -40% 0px" });
    io.observe(n);
  });
}

/* =====================================================================
   Move 2: scout a sample business
   ===================================================================== */

function initScout() {
  const root = $("[data-scout]");
  if (!root) return;
  const targets = $$(".sf-target", root);
  const spots = $$(".spot", root);
  const empty = $(".scout-notes .empty", root);
  const card = $(".verdict-card", root);
  const playBtn = $("[data-scout-play]", root), skipBtn = $("[data-scout-skip]", root);
  let playing = false, timer = null, done = false, via = "taps";

  targets.forEach((t) => t.appendChild(circleSvg()));

  const finish = () => {
    if (done) return;
    done = true;
    stop();
    card.classList.remove("waiting");
    card.removeAttribute("aria-hidden");
    if (!reduceMotion) card.classList.add("shown");
    $$("a, button", card).forEach((n) => n.removeAttribute("tabindex"));
    playBtn.hidden = true;
    skipBtn.hidden = true;
    track("scout_complete", { via });
  };
  const open = (n, quiet) => {
    const spot = spots[n - 1];
    if (!spot || spot.getAttribute("aria-expanded") === "true") return false;
    spot.setAttribute("aria-expanded", "true");
    const t = spot.closest(".sf-target");
    t.classList.add("open");
    fitCircle($(".mk-svg", t));
    requestAnimationFrame(() => t.classList.add("drawn"));
    const line = document.getElementById(spot.getAttribute("aria-controls"));
    if (line) line.hidden = false;
    if (empty) empty.hidden = true;
    if (!quiet) track("scout_open", { spot: n });
    if (spots.every((s) => s.getAttribute("aria-expanded") === "true")) setTimeout(finish, quiet ? 0 : 500);
    return true;
  };
  const stop = () => {
    playing = false;
    clearTimeout(timer);
    playBtn.textContent = "Play it for me";
    playBtn.setAttribute("aria-pressed", "false");
  };
  const next = () => {
    if (!playing) return;
    const n = spots.findIndex((s) => s.getAttribute("aria-expanded") !== "true") + 1;
    if (!n) { stop(); return; }
    open(n);
    timer = setTimeout(next, reduceMotion ? 2500 : 4000);
  };
  spots.forEach((s, i) => s.addEventListener("click", () => { if (playing) stop(); via = "taps"; open(i + 1); }));
  playBtn.addEventListener("click", () => {
    if (playing) { stop(); return; }
    playing = true;
    via = "play";
    playBtn.textContent = "Pause";
    playBtn.setAttribute("aria-pressed", "true");
    track("scout_play");
    next();
  });
  skipBtn.addEventListener("click", () => {
    via = "skip";
    spots.forEach((s, i) => open(i + 1, true));
    finish();
    $("h3", card).focus({ preventScroll: true });
    card.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
  });

  const vlink = $("[data-sample-video]", root), slot = $(".video-slot", root);
  if (vlink && slot && CONFIG.SAMPLE_VIDEO_URL) {
    vlink.hidden = false;
    vlink.addEventListener("click", () => {
      const f = document.createElement("iframe");
      f.src = CONFIG.SAMPLE_VIDEO_URL;
      f.title = "A real scouting video, two minutes";
      f.allow = "autoplay; fullscreen; picture-in-picture";
      f.allowFullscreen = true;
      slot.replaceChildren(f);
      slot.hidden = false;
      vlink.hidden = true;
      track("sample_play");
    });
  }
}

/* =====================================================================
   Handoff: text it, carry it into the form, or save the scorecard
   ===================================================================== */

function wireHandoff(root, tool, getSummary) {
  const box = $(".handoff", root);
  if (!box) return;
  const sms = $("[data-handoff='sms']", box), toForm = $("[data-handoff='form']", box);
  const refresh = () => {
    const s = getSummary();
    box.setAttribute("aria-disabled", String(!s));
    if (sms) { sms.href = s ? smsHref((ME.co ? "This is ___ from " + ME.co + ". " : "") + s) : "#"; sms.dataset.tool = tool; }
  };
  root.addEventListener("tool:update", refresh);
  refresh();
  if (toForm) toForm.addEventListener("click", () => { const s = getSummary(); if (s) attachToForm(s); });
}

function attachToForm(summary) {
  const form = $("form[data-lead-form]");
  if (!form) return;
  form.elements.tool_result.value = summary;
  const note = $(".attached", form);
  if (note) {
    $(".attached-text", note).textContent = summary.length > 160 ? summary.slice(0, 157) + "..." : summary;
    note.hidden = false;
  }
  form.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  const first = form.querySelector("input:not([type=hidden]):not(.hp input)");
  setTimeout(() => first && first.focus({ preventScroll: true }), reduceMotion ? 0 : 450);
}

/* =====================================================================
   Move 6: a scorecard to keep
   ===================================================================== */

const fmtCardDate = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "long", day: "numeric", year: "numeric" });

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(" ");
  let line = "";
  words.forEach((w) => {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, y); line = w; y += lh; } else line = test;
  });
  if (line) ctx.fillText(line, x, y);
  return y + lh;
}

function setFont(ctx, weight, size, stretch) {
  ctx.font = weight + " " + size + 'px "Instrument Sans", "Helvetica Neue", Arial, sans-serif';
  try { ctx.fontStretch = stretch || "normal"; } catch (e) { /* older browsers */ }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** kind "four" gets {tiles:[[label,value]x4], verdict}. kind "finder" gets {layer, diagnosis, move}. */
function drawScorecard(kind, data) {
  const W = 1080, H = 1350, P = 88;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#F4F5F6"); bg.addColorStop(0.55, "#FAF4EA"); bg.addColorStop(1, "#FFF4E0");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const sun = ctx.createRadialGradient(930, 120, 0, 930, 120, 560);
  sun.addColorStop(0, "rgba(255,196,92,.55)"); sun.addColorStop(0.45, "rgba(255,196,92,.16)"); sun.addColorStop(1, "rgba(255,196,92,0)");
  ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(226,196,142,.35)";
  ctx.beginPath(); ctx.moveTo(0, 1180);
  ctx.bezierCurveTo(200, 1120, 360, 1160, 540, 1130); ctx.bezierCurveTo(720, 1100, 880, 1150, 1080, 1120);
  ctx.lineTo(1080, H); ctx.lineTo(0, H); ctx.fill();
  ctx.fillStyle = "#FFF4E0";
  ctx.beginPath(); ctx.moveTo(0, 1225);
  ctx.bezierCurveTo(240, 1190, 420, 1230, 620, 1205); ctx.bezierCurveTo(820, 1180, 960, 1215, 1080, 1200);
  ctx.lineTo(1080, H); ctx.lineTo(0, H); ctx.fill();

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#17191E";
  setFont(ctx, 600, 64, "condensed");
  ctx.fillText(ME.co || "My business", P, P + 56);
  ctx.fillStyle = "#5E636D";
  setFont(ctx, 500, 32);
  ctx.fillText("Last month", P, P + 112);
  ctx.textAlign = "right";
  ctx.fillText(fmtCardDate.format(new Date()), W - P, P + 112);
  ctx.textAlign = "left";

  let y = P + 180;
  if (kind === "four") {
    const gw = (W - P * 2 - 28) / 2, gh = 310;
    data.tiles.forEach(([label, value], i) => {
      const x = P + (i % 2) * (gw + 28), ty = y + Math.floor(i / 2) * (gh + 28);
      ctx.fillStyle = "#FFFFFF"; roundRect(ctx, x, ty, gw, gh, 22); ctx.fill();
      ctx.strokeStyle = "#E4E1DA"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "#5E636D"; setFont(ctx, 500, 30); ctx.fillText(label, x + 32, ty + 60);
      ctx.fillStyle = "#17191E"; setFont(ctx, 700, 124, "condensed"); ctx.fillText(value, x + 32, ty + 214);
      ctx.fillStyle = "#F2B33D"; roundRect(ctx, x + 32, ty + 254, 96, 8, 4); ctx.fill();
    });
    y += gh * 2 + 28 + 90;
    ctx.fillStyle = "#17191E"; setFont(ctx, 600, 40, "semi-condensed");
    wrapText(ctx, data.verdict, P, y, W - P * 2, 54);
  } else {
    ctx.fillStyle = "#5E636D"; setFont(ctx, 500, 34); ctx.fillText("My bottleneck", P, y + 30);
    ctx.fillStyle = "#17191E"; setFont(ctx, 700, data.layer.length > 8 ? 150 : 190, "condensed");
    ctx.fillText(data.layer, P - 6, y + 210);
    ctx.fillStyle = "#F2B33D"; roundRect(ctx, P, y + 250, 140, 10, 5); ctx.fill();
    ctx.fillStyle = "#17191E"; setFont(ctx, 500, 38);
    y = wrapText(ctx, data.diagnosis, P, y + 340, W - P * 2, 54) + 30;
    setFont(ctx, 700, 36); ctx.fillText("First move:", P, y);
    setFont(ctx, 500, 36);
    wrapText(ctx, data.move, P, y + 52, W - P * 2, 52);
  }
  ctx.fillStyle = "#17191E"; setFont(ctx, 600, 30);
  ctx.fillText("Run yours at garrisoncole.com/tools", P, H - 64);
  ctx.textAlign = "right"; ctx.fillStyle = "#5E636D"; setFont(ctx, 500, 30);
  ctx.fillText("Garrison Cole, Roseville", W - P, H - 64);
  ctx.textAlign = "left";
  return c;
}

function saveScorecard(tool, kind, getData) {
  const data = getData();
  if (!data) return;
  const ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(() => {
    const canvas = drawScorecard(kind, data);
    window.__gcCard = canvas;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "scorecard.png", { type: "image/png" });
      if (navigator.canShare && navigator.share) {
        try {
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: "My scorecard" });
            track("card_save", { tool, method: "share" });
            return;
          }
        } catch (e) { if (e && e.name === "AbortError") return; }
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "scorecard.png";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      track("card_save", { tool, method: "download" });
    }, "image/png");
  });
}

/* =====================================================================
   Tool 1: Four Numbers Scoreboard
   ===================================================================== */

const VERDICTS = {
  sales: "You're getting leads. The handoff from lead to booked job is where the money leaks, so this is a sales-system problem before it's an ads problem.",
  channel: "You close well. You're paying too much to get each job in the door, which makes this a channel problem.",
  fuel: "The engine works. It needs more fuel, or a second crew, and a plan for the slow months.",
  good: "These are good numbers. The question now is whether they hold in January."
};

function initFourNumbers() {
  const root = $("#scoreboard[data-tool]");
  if (!root) return;
  const form = $("form", root);
  const out = { cpl: $("[data-out='cpl']", root), close: $("[data-out='close']", root), cpbj: $("[data-out='cpbj']", root), rev: $("[data-out='rev']", root) };
  const verdict = $(".verdict", root);
  const report = resultReporter("four_numbers");
  startReporter(root, "four_numbers");
  let summary = "", last = null;
  const read = () => ({ spend: form.elements.spend.value, leads: form.elements.leads.value, jobs: form.elements.jobs.value, value: form.elements.value.value, crews: form.elements.crews.value });
  const render = () => {
    const input = read();
    const r = fourNumbers(input);
    last = r;
    if (!r) {
      Object.values(out).forEach((n) => setEmpty(n, "?"));
      verdict.textContent = num(input.jobs) > num(input.leads) ? "Booked jobs can't be more than leads. Check those two numbers." : "Put in a number and I'll do the math.";
      verdict.classList.add("empty");
      summary = "";
      report(null);
    } else {
      tweenTo(out.cpl, r.cpl, money);
      tweenTo(out.close, r.closeRate, pct);
      if (r.cpbj === null) setEmpty(out.cpbj, "n/a"); else tweenTo(out.cpbj, r.cpbj, money);
      tweenTo(out.rev, r.revPerCrewWeek, money);
      verdict.textContent = VERDICTS[r.verdict];
      verdict.classList.remove("empty");
      const p = { spend: num(input.spend), leads: num(input.leads), jobs: num(input.jobs), value: num(input.value), crews: num(input.crews) };
      writeHash("scoreboard", p);
      summary = "Four Numbers: " + money(p.spend) + " spend, " + p.leads + " leads, " + p.jobs + " jobs, " + money(p.value) + " avg, " +
        p.crews + " crew" + (p.crews === 1 ? "" : "s") + ". CPL " + money(r.cpl) + ", close " + pct(r.closeRate) + ", per job " +
        (r.cpbj === null ? "n/a" : money(r.cpbj)) + ", per crew/wk " + money(r.revPerCrewWeek) + ".";
      const withUrl = summary + " " + shareUrl("scoreboard", p);
      if (withUrl.length <= 300) summary = withUrl;
      report(r.verdict);
    }
    announce(root, r ? "Cost per lead " + money(r.cpl) + ". Close rate " + pct(r.closeRate) + ". Cost per booked job " +
      (r.cpbj === null ? "not available" : money(r.cpbj)) + ". Revenue per crew per week " + money(r.revPerCrewWeek) + ". " + VERDICTS[r.verdict] : "");
    root.dispatchEvent(new Event("tool:update"));
  };
  const state = hashState("scoreboard");
  if (state) ["spend", "leads", "jobs", "value", "crews"].forEach((k) => { if (state[k] !== undefined) form.elements[k].value = state[k]; });
  form.addEventListener("input", render);
  form.addEventListener("submit", (e) => e.preventDefault());
  render();
  wireHandoff(root, "four_numbers", () => summary);
  const card = $("[data-card]", root);
  if (card) card.addEventListener("click", () => saveScorecard("four_numbers", "four", () => last && {
    tiles: [["Cost per lead", money(last.cpl)], ["Close rate", pct(last.closeRate)],
      ["Cost per booked job", last.cpbj === null ? "n/a" : money(last.cpbj)], ["Revenue per crew per week", money(last.revPerCrewWeek)]],
    verdict: VERDICTS[last.verdict]
  }));
  if (state) setTimeout(() => root.scrollIntoView(), 0);
}

/* =====================================================================
   Tool 2: Quote Leak Calculator (full, and the mini on home)
   ===================================================================== */

const FOLLOW_LABEL = { none: "no follow-up", one: "one call or text", sequence: "a sequence" };

function leakBucket(m) {
  if (m < 2000) return "under_2k";
  if (m < 5000) return "2k_5k";
  if (m < 10000) return "5k_10k";
  return "10k_plus";
}

function initQuoteLeak() {
  const root = $("#leak[data-tool]");
  if (!root) return;
  const form = $("form", root);
  const rangeOut = $("output[for='leak-c']", root);
  const outM = $("[data-out='monthly']", root), outY = $("[data-out='yearly']", root);
  const verdict = $(".verdict", root), assume = $(".assume", root);
  const report = resultReporter("quote_leak");
  startReporter(root, "quote_leak");
  let summary = "";
  const read = () => ({ q: form.elements.q.value, v: form.elements.v.value, c: form.elements.c.value, f: form.elements.f.value || "none" });
  const render = () => {
    const input = read();
    rangeOut.textContent = input.c + "%";
    const r = quoteLeak(input);
    if (!r) {
      setEmpty(outM, "?"); setEmpty(outY, "?");
      verdict.textContent = "Put in your quotes and your average job and I'll do the math.";
      verdict.classList.add("empty");
      assume.hidden = true;
      summary = ""; report(null);
    } else {
      tweenTo(outM, r.monthly, money);
      tweenTo(outY, r.yearly, money);
      verdict.textContent = "Same leads, same prices. The only change is somebody calling back.";
      verdict.classList.remove("empty");
      assume.hidden = false;
      assume.textContent = "Assumes " + r.lift + " more out of every 100 quotes close with consistent follow-up. Your real number comes from your own quote log.";
      const p = { q: num(input.q), v: num(input.v), c: num(input.c), f: input.f };
      writeHash("leak", p);
      summary = "Quote Leak: " + p.q + " quotes/mo, " + money(p.v) + " avg, " + p.c + "% close, " + FOLLOW_LABEL[input.f] +
        ". About " + money(r.monthly) + "/mo left on the table, " + money(r.yearly) + "/yr.";
      const withUrl = summary + " " + shareUrl("leak", p);
      if (withUrl.length <= 300) summary = withUrl;
      report(leakBucket(r.monthly));
    }
    announce(root, r ? "About " + money(r.monthly) + " a month left on the table, " + money(r.yearly) + " a year." : "");
    root.dispatchEvent(new Event("tool:update"));
  };
  const state = hashState("leak");
  if (state) {
    ["q", "v", "c"].forEach((k) => { if (state[k] !== undefined) form.elements[k].value = state[k]; });
    if (state.f && FOLLOW_LABEL[state.f]) $$("input[name=f]", form).forEach((r) => (r.checked = r.value === state.f));
  }
  form.addEventListener("input", render);
  form.addEventListener("change", render);
  form.addEventListener("submit", (e) => e.preventDefault());
  render();
  wireHandoff(root, "quote_leak", () => summary);
  if (state) setTimeout(() => root.scrollIntoView(), 0);
}

function initMiniLeak() {
  const root = $("[data-mini-leak]");
  if (!root) return;
  const q = $("[name=q]", root), v = $("[name=v]", root);
  const out = $("[data-out='monthly']", root), link = $("[data-mini-link]", root);
  const report = resultReporter("quote_leak_mini");
  startReporter(root, "quote_leak_mini");
  const render = () => {
    const r = quoteLeak({ q: q.value, v: v.value, c: 30, f: "none" });
    if (!r) { setEmpty(out, "Two numbers and you'll see it."); link.href = "tools.html#leak"; report(null); return; }
    tweenTo(out, r.monthly, money);
    announce(root, "About " + money(r.monthly) + " a month left on the table.");
    link.href = "tools.html#leak?" + new URLSearchParams({ q: num(q.value), v: num(v.value), c: 30, f: "none" });
    report(leakBucket(r.monthly));
  };
  root.addEventListener("input", render);
  root.addEventListener("submit", (e) => e.preventDefault());
  render();
}

/* =====================================================================
   Tool 3: Bottleneck Finder
   ===================================================================== */

const LAYER_RESULT = {
  offer: { name: "Offer", number: "Close rate at full price",
    diagnosis: "You're competing on price, and that's an offer problem. When the price is built on the result the customer is buying, the three-bid conversation gets a lot shorter.",
    moves: ["Put the real cost of your last five jobs on paper, after labor, materials and fuel.", "Price the next quote on the result the customer gets, then hold it."] },
  channel: { name: "Channel", number: "Cost per lead",
    diagnosis: "Your work is good enough to sell. The right people just aren't finding you on the day they're ready to hire someone.",
    moves: ["Stop renting shared leads and move that money to Google Search for the jobs you actually want.", "Get tracking on every call and form before you spend another dollar.", "Plan the January push in October, while there's still time to run it."] },
  sales: { name: "Sales system", number: "Close rate and cost per booked job",
    diagnosis: "The leads are there. Too many go cold between the first call and the signed quote, mostly because everything runs through you.",
    moves: ["Answer every new lead fast, even if it's a text saying when you'll call.", "Follow up every quote on a set schedule that runs without you.", "Record a few sales calls and listen for where the price talk goes sideways.", "Get a second person who can close."] },
  cash: { name: "Cash", number: "Revenue per crew per week",
    diagnosis: "You stay busy and still feel tight. That usually means nobody knows what each job really costs or which months need a cushion.",
    moves: ["Put revenue per crew per week on one page and look at it every Monday.", "Build the slow-season plan before spring ends."] },
  none: { name: "No clear crack", number: "All four",
    diagnosis: "Nothing jumped out from your answers, which is a good sign. The next question is whether your numbers hold in January.",
    moves: ["Run the Four Numbers Scoreboard with last month's real figures and see where the weakest one is."] }
};

function initFinder() {
  const root = $("#finder[data-tool]");
  if (!root) return;
  const stage = $(".finder-in", root), out = $(".panel-out", root);
  const resultName = $("[data-out='layer']", root), resultBody = $(".result-body", root);
  const answers = new Array(FINDER_QUESTIONS.length).fill(null);
  let index = 0, pointerPick = false, summary = "", started = false, lastLayer = null;

  const progress = () => '<div class="progress" aria-hidden="true">' +
    FINDER_QUESTIONS.map((_, i) => '<span class="' + (i < index || (answers[i] !== null && i <= index) ? "done" : "") + '"></span>').join("") + "</div>";

  const renderQuestion = (focus) => {
    const item = FINDER_QUESTIONS[index];
    stage.innerHTML = progress() +
      '<p class="finder-count">Question ' + (index + 1) + " of " + FINDER_QUESTIONS.length + "</p>" +
      '<fieldset class="q"><legend>' + item.q + "</legend>" +
      item.a.map((opt, i) => '<label class="choice"><input type="radio" name="fq' + index + '" value="' + i + '"' + (answers[index] === i ? " checked" : "") + "> " + opt[0] + "</label>").join("") +
      "</fieldset>" +
      '<div class="finder-nav"><button type="button" class="btn line sm" data-back' + (index === 0 ? " disabled" : "") + ">Back</button>" +
      '<button type="button" class="btn sm" data-next' + (answers[index] === null ? " disabled" : "") + ">" +
      (index === FINDER_QUESTIONS.length - 1 ? "See my bottleneck" : "Next") + "</button></div>";
    if (focus) {
      const target = stage.querySelector("input:checked") || stage.querySelector("input");
      if (target) target.focus({ preventScroll: true });
    }
  };

  const showResult = () => {
    const { layer } = finderScore(answers);
    lastLayer = layer;
    const r = LAYER_RESULT[layer];
    stage.innerHTML = progress() + '<p class="finder-count">Your answers</p><ol class="answers">' +
      FINDER_QUESTIONS.map((q, i) => "<li>" + q.a[answers[i]][0] + "</li>").join("") + "</ol>" +
      '<div class="finder-nav"><button type="button" class="btn line sm" data-restart>Start over</button></div>';
    resultName.textContent = r.name;
    resultName.classList.remove("empty");
    resultBody.innerHTML = "<p>" + r.diagnosis + "</p><div><h3>What I'd do first</h3><ul>" + r.moves.map((m) => "<li>" + m + "</li>").join("") +
      "</ul></div><div><h3>The number to start tracking</h3><p>" + r.number + "</p></div>";
    const picks = [4, 5, 6].map((i) => FINDER_QUESTIONS[i].a[answers[i]][0].toLowerCase());
    summary = "Bottleneck Finder: " + r.name + ". Phone: " + picks[0] + ". Quotes: " + picks[1] + ". Closer: " + picks[2] + ".";
    const withUrl = summary + " " + shareUrl("finder", { a: answers.join("") });
    if (withUrl.length <= 300) summary = withUrl;
    writeHash("finder", { a: answers.join("") });
    track("tool_result", { tool: "bottleneck_finder", outcome: layer });
    root.dispatchEvent(new Event("tool:update"));
    if (window.matchMedia("(max-width: 899px)").matches) out.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    resultName.focus({ preventScroll: true });
  };

  const go = (dir) => {
    if (dir > 0 && index === FINDER_QUESTIONS.length - 1) { showResult(); return; }
    index = Math.max(0, Math.min(FINDER_QUESTIONS.length - 1, index + dir));
    renderQuestion(true);
  };

  stage.addEventListener("pointerdown", (e) => { if (e.target.closest(".choice")) pointerPick = true; });
  stage.addEventListener("change", (e) => {
    if (!e.target.matches("input[type=radio]")) return;
    if (!started) { started = true; track("tool_start", { tool: "bottleneck_finder" }); }
    answers[index] = Number(e.target.value);
    const nextBtn = $("[data-next]", stage);
    if (nextBtn) nextBtn.disabled = false;
    $$(".progress span", stage).forEach((s, i) => s.classList.toggle("done", (i <= index && answers[i] !== null) || i < index));
    if (pointerPick) { pointerPick = false; setTimeout(() => go(1), reduceMotion ? 0 : 180); }
  });
  stage.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches("input[type=radio]") && answers[index] !== null) { e.preventDefault(); go(1); }
  });
  stage.addEventListener("click", (e) => {
    if (e.target.closest("[data-next]")) go(1);
    else if (e.target.closest("[data-back]")) go(-1);
    else if (e.target.closest("[data-restart]")) {
      answers.fill(null); index = 0; summary = ""; lastLayer = null;
      resultName.textContent = "?"; resultName.classList.add("empty");
      resultBody.innerHTML = '<p class="muted">Answer the eight questions and your bottleneck shows up here.</p>';
      root.dispatchEvent(new Event("tool:update"));
      renderQuestion(true);
    }
  });
  wireHandoff(root, "bottleneck_finder", () => summary);
  const card = $("[data-card]", root);
  if (card) card.addEventListener("click", () => saveScorecard("bottleneck_finder", "finder", () => lastLayer && {
    layer: LAYER_RESULT[lastLayer].name, diagnosis: LAYER_RESULT[lastLayer].diagnosis, move: LAYER_RESULT[lastLayer].moves[0]
  }));
  const state = hashState("finder");
  if (state && /^[0-9]{8}$/.test(state.a || "") && state.a.split("").every((d, i) => FINDER_QUESTIONS[i].a[Number(d)])) {
    state.a.split("").forEach((d, i) => (answers[i] = Number(d)));
    index = FINDER_QUESTIONS.length - 1;
    showResult();
    setTimeout(() => root.scrollIntoView(), 0);
  } else {
    renderQuestion(false);
  }
}

function initSearchCheck() {
  const form = $("form[data-search-check]");
  if (!form) return;
  const note = $(".search-note", form.parentElement);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const trade = form.elements.trade.value.trim(), city = form.elements.city.value.trim();
    if (!trade || !city) { note.textContent = "Add your trade and your town, like fence contractor and Rocklin."; return; }
    window.open("https://www.google.com/search?q=" + encodeURIComponent(trade + " " + city), "_blank", "noopener");
    note.textContent = "If you're not on that first screen, that's the first thing I'd look at in your video.";
    track("search_check", { trade: ME.trade || "typed" });
  });
}

/* =====================================================================
   Philosophy accordion
   ===================================================================== */

function initLayers() {
  $$(".layer-btn").forEach((btn) => {
    const panel = document.getElementById(btn.getAttribute("aria-controls"));
    if (!panel) return;
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!open));
      if (!open) {
        panel.hidden = false;
        if (reduceMotion) { panel.style.height = "auto"; } else {
          const h = panel.scrollHeight;
          panel.style.height = "0px";
          requestAnimationFrame(() => { panel.style.height = h + "px"; });
          panel.addEventListener("transitionend", () => { panel.style.height = "auto"; }, { once: true });
        }
        track("philosophy_expand", { layer: btn.dataset.layer });
      } else if (reduceMotion) {
        panel.style.height = "0px"; panel.hidden = true;
      } else {
        panel.style.height = panel.scrollHeight + "px";
        requestAnimationFrame(() => { panel.style.height = "0px"; });
        panel.addEventListener("transitionend", () => { panel.hidden = true; }, { once: true });
      }
    });
  });
  const target = location.hash.slice(1);
  const btn = target && document.querySelector('.layer-btn[data-layer="' + target + '"]');
  if (btn) btn.click();
}

/* =====================================================================
   Lead form and thanks
   ===================================================================== */

function initForms() {
  const params = new URLSearchParams(location.search);
  $$("form[data-lead-form]").forEach((form) => {
    form.elements.page.value = location.pathname;
    form.elements.utm_source.value = params.get("utm_source") || "";
    form.elements.utm_campaign.value = params.get("utm_campaign") || "";
    let started = false;
    form.addEventListener("focusin", () => {
      if (started) return;
      started = true;
      track("form_start", { page: location.pathname });
    });
    const clear = $(".attached button", form);
    if (clear) clear.addEventListener("click", () => { form.elements.tool_result.value = ""; $(".attached", form).hidden = true; });
    const status = $(".form-status", form);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      status.classList.remove("error");
      if (!form.checkValidity()) { form.reportValidity(); return; }
      if (form.elements._gotcha && form.elements._gotcha.value) return;
      if (!CONFIG.FORMSPREE_ID) {
        status.classList.add("error");
        status.textContent = "This form isn't connected yet. Text me at 760-644-4559 and I'll take it from there.";
        return;
      }
      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true;
      status.textContent = "Sending...";
      try {
        const res = await fetch("https://formspree.io/f/" + CONFIG.FORMSPREE_ID, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error("bad status");
        store("session", "gc-lead", JSON.stringify({ page: location.pathname, tool: !!form.elements.tool_result.value }));
        if (!ME.co) { ME.co = cleanName(form.elements.company.value); saveMe(); }
        window.location.href = "thanks.html";
      } catch (err) {
        status.classList.add("error");
        status.textContent = "That didn't go through. Text me at 760-644-4559 and I'll take it from there.";
        btn.disabled = false;
      }
    });
  });
}

function initThanks() {
  if (PAGE !== "thanks") return;
  let info = {};
  try { info = JSON.parse(store("session", "gc-lead") || "{}") || {}; } catch (e) { info = {}; }
  track("lead_form", { page: info.page || "unknown", tool_result: !!info.tool, personalized: !!ME.co });
  store("session", "gc-lead", null);
}

/* =====================================================================
   Move 5: two minutes, and the tab title
   ===================================================================== */

function initTwoMinutes() {
  const ring = $(".ring .fill");
  const MS = CONFIG.TWO_MINUTES_MS;
  const skip = PAGE === "thanks" || PAGE === "link";
  if (!MS || skip) { if (ring) ring.closest(".ring").hidden = !MS; return; }
  let t = Number(store("session", "gc-2m") || 0) || 0;
  let shown = store("session", "gc-2m-shown") === "1";
  const paint = () => { if (ring) ring.closest(".ring").style.setProperty("--p", String(Math.min(1, t / MS))); };
  paint();
  const fieldFocused = () => { const a = document.activeElement; return a && a.matches && a.matches("input, textarea, select"); };
  const show = () => {
    shown = true;
    store("session", "gc-2m-shown", "1");
    const card = el("div", "nudge");
    card.setAttribute("role", "region");
    card.setAttribute("aria-label", "Two minutes");
    card.appendChild(el("p", "", "You've been here two minutes. That's the length of your video."));
    const row = el("div", "btn-row");
    const go = el("a", "btn sm", "Get my free video");
    go.href = formHref();
    const no = el("button", "btn line sm", "Not now");
    no.type = "button";
    row.append(go, no);
    card.appendChild(row);
    const close = () => { card.remove(); document.removeEventListener("keydown", esc); };
    const esc = (e) => { if (e.key === "Escape") { close(); track("two_minute_dismiss"); } };
    go.addEventListener("click", () => { track("two_minute_click"); close(); });
    no.addEventListener("click", () => { track("two_minute_dismiss"); close(); });
    document.addEventListener("keydown", esc);
    document.body.appendChild(card);
    track("two_minute_shown");
  };
  const tick = setInterval(() => {
    if (document.hidden) return;
    if (t < MS) { t = Math.min(MS, t + 1000); store("session", "gc-2m", String(t)); paint(); }
    if (t >= MS) {
      if (shown) { clearInterval(tick); return; }
      if (!fieldFocused()) { show(); clearInterval(tick); }
    }
  }, 1000);
}

function initTabTitle() {
  if (!CONFIG.TAB_TITLE_AWAY || PAGE === "thanks" || PAGE === "link") return;
  let timer = null, changed = false, saved = "";
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      timer = setTimeout(() => { saved = document.title; document.title = "(1) Missed call from your next customer"; changed = true; }, 8000);
    } else {
      clearTimeout(timer);
      if (changed) { document.title = saved; changed = false; track("tab_return"); }
    }
  });
}

/* =====================================================================
   Boot
   ===================================================================== */

(function boot() {
  document.documentElement.classList.add("js");
  loadMe();
  renderGreeting();
  initSky();
  initReveal();
  initTracking();
  initLinkTracking();
  initNav();
  initBooking();
  initClock();
  initPhone();
  applyMe();
  if (ME.co) drawName();
  initClaim();
  initMarker();
  initCountUp();
  initPains();
  initScout();
  initTimeline();
  initBuild();
  initManifesto();
  initFourNumbers();
  initQuoteLeak();
  initMiniLeak();
  initFinder();
  initSearchCheck();
  initLayers();
  initForms();
  initThanks();
  initTwoMinutes();
  initTabTitle();
  const y = $("[data-year]");
  if (y) y.textContent = String(new Date().getFullYear());
  if (new URLSearchParams(location.search).has("test")) {
    window.__gcDebug = true;
    const results = runSelfTests();
    console.table(results.map(([name, pass]) => ({ name, pass })));
    window.__gcTests = results;
  }
})();
