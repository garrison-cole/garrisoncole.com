"""Builds the Nov 27 2026 landing page rebuild as plain HTML.

Every word is written into the HTML, so Google's ad checker and a no-script fetch see the whole page.
b/lp2.js only handles the search line, the calendar, tracking and the one interactive piece on each page.

    python3 _tools/build_next.py            # writes the preview pages into next/
    python3 _tools/build_next.py --live     # writes the same pages for the root (for "make it live")

The copy comes from the four page build docs (Nov 27 2026). Reviews come from b/reviews.json,
which holds them word for word from the Thumbtack profile.
Folders starting with "_" are not published by GitHub Pages.
"""
import html, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIVE = "--live" in sys.argv
OUT = ROOT if LIVE else os.path.join(ROOT, "next")
P = "/" if LIVE else "/next/"          # where the other new pages live
V = "20261127g"                        # cache tag for b/site.css and b/lp2.js

# ---------- SETTINGS (from the master build doc) ----------
LOGO_HEADER = "/b/logo-gc.png"   # Garrison's horizontal logo, background cut out. Blank: the text wordmark
LARAYE_ATTRIBUTION = "wedding florist, Auburn. She’s also family."
GROWTH_CLAIM = "I’ve grown online businesses from $5,000 a month to more than $300,000 a month."
GROWTH_TIMEFRAME = ""   # blank: no time frame shown
THUMBTACK = "https://www.thumbtack.com/ca/roseville/web-design/garrison-cole-websites-for-local-businesses/service/595967527377379336"

R = {r["name"]: r for r in json.load(open(os.path.join(ROOT, "b", "reviews.json")))["reviews"]}
AVERY, LARAYE = R["Avery A."], R["LaRaye E."]
e = html.escape

def paras(text):
    return "".join("<p>" + e(p) + "</p>" for p in text.split("\n\n"))

def first_para(text):
    return text.split("\n\n")[0]

def rev_card(r, who, full=True, extra=""):
    body = r["text"] if full else first_para(r["text"])
    return ('<blockquote class="rev">' + paras(body) +
            '<footer><b>' + e(r["name"]) + '</b>, ' + e(who) + ' Review on Thumbtack.' + extra + '</footer></blockquote>')

# ---------- Shared parts ----------
def head(title, desc, canon, page, lp, town="", topic=""):
    attrs = ' data-page="%s" data-lp="%s"' % (page, lp)
    if town: attrs += ' data-town="%s"' % town
    if topic: attrs += ' data-topic="%s"' % e(topic)
    url = "https://garrisoncole.com/" + canon
    return f'''<!doctype html>
<html lang="en"{attrs}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<meta name="robots" content="noindex, nofollow">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website">
<meta property="og:url" content="{url}">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta name="theme-color" content="#FFFFFF">
<link rel="icon" href="/b/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="/b/favicon-64.png" sizes="64x64" type="image/png">
<link rel="apple-touch-icon" href="/b/apple-touch.png">
<link rel="preload" href="/b/fonts/archivo-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preconnect" href="https://app.cal.com">
<link rel="stylesheet" href="/b/site.css?v={V}">
<script src="/b/lp2.js?v={V}" defer></script>
</head>
<body>
<a class="vh skip" href="#start">Skip to the page</a>
'''

def logo():
    if LOGO_HEADER:
        return f'<img src="{LOGO_HEADER}" alt="Garrison Cole" width="566" height="96">'
    return 'GARRISON&nbsp;<span>COLE</span>'

def header(nav=False, home_href=None):
    mark = f'<a class="mark" href="{home_href}">{logo()}</a>' if home_href else f'<span class="mark">{logo()}</span>'
    navs = (f'<nav class="hdr-nav" aria-label="Pages"><a href="{P}websites">Websites</a><a href="{P}growth">Ads</a><a href="{P}business-coach">Coaching</a></nav>' if nav else "")
    return f'''<header class="hdr"><div class="wrap">{mark}<div class="hdr-r">{navs}<a class="hdr-text" data-sms href="sms:+17606444559">Text me</a><a class="btn btn-sm" href="#book">Book a call</a></div></div></header>
<main id="start">
'''

def book(h, body, kicker=""):
    k = f'<span class="tag">{e(kicker)}</span>' if kicker else ""
    return f'''<section class="sec" id="book" aria-labelledby="book-h"><div class="wrap book-grid">
<div>{k}<h2 id="book-h">{e(h)}</h2><p class="sub">{body}</p><p class="bring">If someone else helps you decide, bring them.</p></div>
<div class="cal-box"><div id="cal-inline"></div><div class="cal-fallback"><p class="sub">The calendar didn’t load.</p><a class="btn" href="https://cal.com/garrison-cole/call">Pick a time on Cal.com</a></div></div>
</div></section>
'''

def who(text):
    return f'''<section class="sec" aria-labelledby="who-h"><div class="wrap who">
<img src="/garrison.webp" alt="Garrison Cole" width="140" height="140" loading="lazy" decoding="async">
<div><h2 id="who-h" class="vh">Who you get</h2><p><b>You get me.</b>{e(text)}</p></div>
</div></section>
'''

def qa(rows, sec_class="sec sec-s"):
    items = "".join(f"<div><dt>{e(q)}</dt><dd>{e(a)}</dd></div>" for q, a in rows)
    return f'''<section class="{sec_class}" aria-labelledby="qa-h"><div class="wrap">
<h2 id="qa-h">What owners ask me first.</h2><dl class="qa">{items}</dl>
</div></section>
'''

def quick(rows, h="Quick answers."):
    items = "".join(f"<details><summary>{e(q)}</summary><p>{e(a)}</p></details>" for q, a in rows)
    return f'''<section class="sec quick" aria-labelledby="quick-h"><div class="wrap"><h2 id="quick-h">{e(h)}</h2>{items}</div></section>
'''

def close(line, button, sub="You deal with me, start to finish."):
    s = f"<p>{e(sub)}</p>" if sub else ""
    return f'''<section class="close" aria-label="Book a call"><div class="wrap"><div class="close-l"><img class="close-mark" src="/b/mark-gc.png" alt="" width="379" height="200" loading="lazy" decoding="async"><div><h2>{e(line)}</h2>{s}</div></div><a class="btn" href="#book">{e(button)}</a></div></section>
</main>
'''

def footer(area, links):
    ls = "".join(f'<a href="{h}">{e(t)}</a>' for t, h in links)
    return f'''<footer class="foot"><div class="wrap">
<p>{e(area)}</p>
<nav aria-label="Footer"><span style="display:inline-flex;align-items:center;min-height:44px">Garrison Cole · Roseville, CA</span><a data-sms href="sms:+17606444559">Text 760-644-4559</a><a href="mailto:garrison@garrisoncole.com">garrison@garrisoncole.com</a>{ls}<a href="/privacy.html">Privacy</a></nav>
</div></footer>
<div class="stick"><a class="btn btn-line" data-sms href="sms:+17606444559" aria-label="Text Garrison at 760-644-4559">Text</a><a class="btn" href="#book">Book a free call</a></div>
<noscript><p style="padding:24px">Garrison Cole, Roseville, CA. Text <a href="sms:+17606444559">760-644-4559</a> or <a href="https://cal.com/garrison-cole/call">pick a time for a free call</a>.</p></noscript>
'''

def viewer():
    return '''<dialog class="viewer" id="viewer" aria-labelledby="viewer-title"><div class="viewer-in">
<div class="viewer-top"><b id="viewer-title">A site I built</b><button class="btn btn-sm" type="button" data-close>Close</button></div>
<div class="viewer-body"><div class="phone"><iframe id="viewer-frame" title="A site I built" loading="lazy" src="about:blank"></iframe></div><div class="viewer-side" id="viewer-side"></div></div>
</div></dialog>
'''

def rev_templates(book_label):
    btn = f'<a class="btn" href="#book" data-close>{e(book_label)}</a>'
    return (f'<template id="rev-florist">{rev_card(LARAYE, LARAYE_ATTRIBUTION)}{btn}</template>'
            f'<template id="rev-coaching">{rev_card(AVERY, "coaching company owner.")}{btn}</template>\n')

def climb():
    tf = (" " + GROWTH_TIMEFRAME) if GROWTH_TIMEFRAME else ""
    claim = GROWTH_CLAIM[:-1] + tf + "." if tf else GROWTH_CLAIM
    return f'''<div class="climb" role="img" aria-label="From $5,000 a month to more than $300,000 a month">
<div class="col" aria-hidden="true"><span class="bar lo"></span><span class="lab"><b>$5K</b>a month</span></div>
<span class="to" aria-hidden="true">&rarr;</span>
<div class="col" aria-hidden="true"><span class="bar hi"></span><span class="lab"><b class="g">$300K+</b>a month</span></div></div>
<p>{e(claim)}</p>'''

def end():
    return "</body>\n</html>\n"

def write(name, text):
    path = os.path.join(OUT, name + ".html")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "w").write(text)
    print("wrote", os.path.relpath(path, ROOT))

# ---------- 1. Websites ----------
WEB_QA = [
    ("What does it cost?", "One flat price. You hear it on the call, before I start. If you want hosting and updates handled after launch, that’s a flat monthly."),
    ("How much of my time does it take?", "One 30-minute call, then a few texts while I build. I write the words."),
    ("Who do I call when something needs changing?", "Me. Same number, same person."),
]
def websites(sac=False):
    town = "Sacramento" if sac else "Roseville"
    first = "I’m Garrison. I’m local, just up 80 in Roseville." if sac else "I’m Garrison, a Roseville local."
    cal_body = "Free, 30 minutes, on Zoom or in person. I look at your current site and your Google listing before the call. Most sites are live about 10 days after you say go." + (" Glad to meet in person in Sacramento." if sac else "")
    rows = WEB_QA + ([("Do you work with Sacramento businesses?", "Yes. I’m just up 80 in Roseville, and I’m glad to meet in person.")] if sac else [])
    area = ("Web design for owner-run businesses in Sacramento, Elk Grove, Rancho Cordova, Folsom, Roseville, Rocklin and the towns around them." if sac
            else "Website design for owner-run businesses in Roseville, Rocklin, Granite Bay, Lincoln, Auburn, Folsom, El Dorado Hills and the rest of the Sacramento area. Glad to meet in person.")
    pull = first_para(LARAYE["text"]).split("! ")[0] + "!"
    title = f"Website Design in {town}, CA | Garrison Cole"
    desc = ("Website design for owner-run businesses in Sacramento, Folsom and Placer County. I build your site first. You pay only if you want it live." if sac
            else "Website design for owner-run businesses in Roseville, Rocklin, Folsom and the Sacramento area. I build your site first. You pay only if you want it live.")
    h = head(title, desc, "websites-sacramento" if sac else "websites", "websites", "websites-sacramento" if sac else "websites", "Sacramento" if sac else "")
    h += header()
    h += f'''<section class="hero"><div class="wrap">
<div>
<h1><span class="eyebrow" data-topic>Website design in {town}</span>See your new website before you pay for it.</h1>
<p class="pain">Customers look you up, then call the next guy?</p>
<p class="lede">{e(first)} I design your site and write every word on it. You click through the real thing on your phone before you decide. If you pass, you owe nothing.</p>
<div class="hero-acts"><a class="btn" href="#book">Book a call. I build yours first.</a></div>
<figure class="pull"><q>{e(pull)}</q><small>{e(LARAYE["name"])}, {e(LARAYE_ATTRIBUTION)} Review on Thumbtack.</small></figure>
</div>
<div><img src="/florist-phone-680.webp" srcset="/florist-phone-340.webp 340w, /florist-phone-680.webp 680w" sizes="(min-width: 900px) 340px, 70vw" width="340" height="680" alt="A wedding florist’s website I built, on a phone" fetchpriority="high" style="margin:0 auto;max-width:340px;width:70%"></div>
</div></section>
'''
    h += book("Pick a time. I start on your site after we talk.", e(cal_body))
    h += f'''<section class="sec sec-s" aria-labelledby="sites-h"><div class="wrap">
<h2 id="sites-h">Open a site I built.</h2>
<p class="sub">Website design for contractors, trades and other owner-run local businesses. Every site is built to get you the call or the quote request, even while you’re on a job.</p>
<div class="sites">
<article class="site"><img class="shot" src="/work-florist-800.webp" srcset="/work-florist-800.webp 800w, /work-florist-1600.webp 1600w" sizes="(min-width: 760px) 540px, 92vw" width="800" height="500" alt="The wedding florist site" loading="lazy" decoding="async"><div class="body"><h3>Wedding florist, Auburn.</h3><button class="btn btn-ink btn-sm" type="button" data-site="florist" data-src="/preview/the-blonde-bouquet/" data-label="Wedding florist, Auburn">Open the site</button></div></article>
<article class="site"><img class="shot" src="/work-coaching-800.webp" srcset="/work-coaching-800.webp 800w, /work-coaching-1600.webp 1600w" sizes="(min-width: 760px) 540px, 92vw" width="800" height="500" alt="The coaching company site" loading="lazy" decoding="async"><div class="body"><h3>Coaching company.</h3><button class="btn btn-ink btn-sm" type="button" data-site="coaching" data-src="/preview/freelyfit/" data-label="Coaching company">Open the site</button></div></article>
</div>
<div class="risk"><div><span>Until you’ve seen yours</span><b class="g">$0</b></div><div><span>When you say go</span><b>You pay, and it goes live.</b></div></div>
<p style="margin:22px 0 0"><a class="btn" href="#book">Book a call. I build yours first.</a></p>
</div></section>
'''
    h += who(" I’ve spent eight years in sales and marketing, so your site gets built by someone who knows what a customer asks before they call. " + GROWTH_CLAIM + " I live in Roseville with my wife and our son, and you deal with me, start to finish.")
    h += qa(rows)
    town_q = ([("Do you do web design in Sacramento?", "Yes. Web design and website design for owner-run businesses in Sacramento, Elk Grove, Rancho Cordova and Folsom. I’m glad to meet in person in Sacramento."),
               ("Are you a web design company in Sacramento?", "You get me. One local web designer, just up 80 from Sacramento, who builds your site and answers when you text."),
               ("Is a Sacramento website designer going to hand me a template?", "No. Every site is designed from scratch around your work and the way your customers pick who to call.")] if sac else
              [("Where do you do web design?", "I’m a web designer in Roseville. I do web design and website design for businesses in Rocklin, Folsom, El Dorado Hills, Elk Grove, Lincoln, Auburn and Sacramento."),
               ("I searched for a web designer near me. Are you local?", "Yes. I live in Roseville and I’m glad to meet in person.")])
    h += quick(town_q + [
        ("Do you build websites for contractors?", "Yes. I do contractor website design for trades like concrete, fencing, tree service, landscaping and painting. I build for florists, home organizers and coaches too."),
        ("Do you do a website redesign if I already have a site?", "Yes. Most of my work is a website redesign. You compare the two side by side, and nothing changes until you say go."),
        ("How long does website design take?", "About 10 days from your go to live."),
        ("Will my website show up on Google?", "It’s built so Google can read it, with your services and your towns on the page. Ranking takes time, and I’ll tell you what to expect on the call."),
    ], "Website design questions.")
    h += close("Your site, built first.", "Book a call. I build yours first.")
    h += footer(area, [("Google and Meta ads", P + ("growth-sacramento" if sac else "growth"))])
    h += viewer() + rev_templates("Book a call. I build yours first.") + end()
    write("websites-sacramento" if sac else "websites", h)

# ---------- 2. Ads + growth ----------
GROW_QA = [
    ("I’ve paid for marketing before and got nothing.", "I hear that most weeks. On the call I’ll look at what you tried and tell you what I think went wrong. After that, we go over your numbers together every month."),
    ("What does it cost?", "One flat monthly price for my work. You pay Google or Facebook directly for the ads, so you see every dollar. On the call we work out how many new jobs it takes to pay for it. If the math doesn’t work, I’ll say so."),
    ("How fast does it start?", "The ads and the page go live in about two weeks."),
]
STEPS = ["Getting found on Google", "The page they land on", "Answering the call or text fast", "Following up on the quote", "Knowing which dollar brought which job"]
def growth(sac=False):
    first = "I’m Garrison. I’m local, just up 80 in Roseville." if sac else "I’m Garrison, a Roseville local."
    topic = "Digital marketing in Sacramento" if sac else "Google Ads management in Roseville"
    cal_body = "Free, 30 minutes, on Zoom or in person. You leave knowing the first thing I’d fix and what it should bring in." + (" Glad to meet in person in Sacramento." if sac else "")
    area = ("Google Ads, Meta ads and landing pages for owner-run service businesses in Sacramento, Roseville, Rocklin, Granite Bay, Lincoln, Auburn, Folsom and El Dorado Hills. Glad to meet in person. Outside the area, we meet on Zoom." if sac
            else "Google Ads, Meta ads and landing pages for owner-run service businesses in Roseville, Rocklin, Granite Bay, Lincoln, Auburn, Folsom and El Dorado Hills. Glad to meet in person. Outside the area, we meet on Zoom.")
    title = "Digital Marketing in Sacramento, CA | Garrison Cole" if sac else "Google Ads Management in Roseville, CA | Garrison Cole"
    desc = ("Google Ads and Meta ads for owner-run service businesses in Sacramento and Placer County, run by a local who builds the page behind them and knows sales. Book a free call." if sac
            else "Google Ads and Meta ads for owner-run service businesses in Roseville and Placer County, run by a local who builds the page behind them and knows sales. Book a free call.")
    h = head(title, desc, "growth-sacramento" if sac else "growth", "growth", "growth-sacramento" if sac else "growth",
             "Sacramento" if sac else "", "Digital marketing in Sacramento" if sac else "")
    h += header()
    h += f'''<section class="hero"><div class="wrap">
<div>
<h1><span class="eyebrow" data-topic>{topic}</span>More booked jobs. One person who answers for all of it.</h1>
<p class="pain">Paying for leads three other guys get? Quotes going out and nothing coming back?</p>
<p class="lede">{e(first)} I run your ads and build the page behind them. I track every call and help you close the ones that come in. You see every dollar, and you deal with me.</p>
<div class="hero-acts"><a class="btn" href="#book">Book a free call. I look you up first.</a></div>
</div>
<div class="card-d"><span class="big">$4.08</span><p>came back for every $1 one client spent on ads. In one spring, $12,149 went in and $49,616 came out.</p><div class="rule"></div><p style="color:#fff;font-weight:600;margin:0">{e(GROWTH_CLAIM)}</p></div>
</div></section>
'''
    h += book("Pick a time. I’ll look at your Google listing and website first.", e(cal_body), kicker="Your complimentary audit")
    rows = ""
    for i, s in enumerate(STEPS, 1):
        label = f'<span data-row4>{e(s)}</span>' if i == 4 else e(s)
        opts = "".join(f'<label class="opt"><input type="radio" name="r{i}" value="{v}"><span>{t}</span></label>' for v, t in (("me", "Me"), ("paid", "Someone I pay"), ("nobody", "Nobody")))
        rows += f'<fieldset class="row"><legend><span class="n">0{i}</span>{label}</legend><div class="opts">{opts}</div></fieldset>'
    mine = "".join(f'<li>{e(s)}<span class="pill">Garrison</span></li>' for s in STEPS)
    h += f'''<section class="sec sec-s" aria-labelledby="board-h"><div class="wrap">
<h2 id="board-h">Who’s on it at your company?</h2>
<p class="sub">Five steps between a stranger and a paid job. Tap who handles each one today.</p>
<form class="board" id="board" onsubmit="return false">{rows}</form>
<div class="answer" id="board-answer" aria-live="polite"><h3 id="board-line"></h3><p>With me: <b style="color:#fff">Garrison, on all five.</b></p><ul class="mine">{mine}</ul><a class="btn" href="#book">Book a free call. I take all five.</a></div>
</div></section>
'''
    h += f'''<section class="sec" aria-labelledby="proof-h"><div class="wrap"><h2 id="proof-h" class="vh">What an owner says</h2>{rev_card(AVERY, "coaching company owner.")}</div></section>
'''
    h += who(" I started out selling face to face on a gym floor. Later I built a sales team from zero at a startup and ran sales for founder-led companies. Eight years in, I still take sales calls every week, so I know what a customer says right before they walk. I live in Roseville with my wife and our son.")
    h += qa(GROW_QA)
    h += quick([
        ("Do you do Google Ads management?", ("Yes. Google Ads management for service businesses in Sacramento and Roseville, sometimes called PPC. You pay Google directly." if sac else "Yes. Google Ads management for local service businesses in Roseville and the Sacramento area, sometimes called PPC. You pay Google directly.")),
        ("Do you run Facebook and Instagram ads?", "Yes. Facebook ads and Instagram ads (Meta ads) work well for before and after work. I handle the Facebook ads management and build the landing page they go to."),
        ("Do you do marketing for contractors?", "Yes. I do contractor marketing for local trades: landscaping marketing, tree service marketing, concrete, fencing and other home service marketing."),
        ("Is this a marketing company or one person?", "You get me. One Roseville local who works as your marketing and Google Ads consultant, and sits down with you to go through the numbers."),
        ("Can you help in the slow winter months?", "Yes. We book winter work in the fall, while you’re still busy, and stop paying for shared leads."),
    ], "Google Ads and marketing questions.")
    h += close("One person. Every step.", "Book a free call. I look you up first.")
    h += footer(area, [("Website design", P + ("websites-sacramento" if sac else "websites"))])
    h += end()
    write("growth-sacramento" if sac else "growth", h)

# ---------- 3. Business coach ----------
COACH_QA = [
    ("I’ve paid for help before and it didn’t work.", "I hear that most weeks. On the free call I’ll look at what you tried and tell you what I think went wrong. After that, we look at your numbers together every month."),
    ("What does it cost?", "One flat monthly price, and I never take a cut of your sales. On the call we work out how many new customers it takes to pay for it. If the math doesn’t work, I’ll say so."),
    ("How much of my time?", "We talk once a week for 30 minutes. In between, I do the building."),
]
def stepper(fid, label, value, c_label="", sub=""):
    lab = f'<span data-c-label="{e(c_label)}">{e(label)}</span>' if c_label else e(label)
    s = f"<small>{e(sub)}</small>" if sub else ""
    return (f'<div class="step"><label for="{fid}">{lab}{s}</label><div class="stepper">'
            f'<button type="button" data-step="-1" data-for="{fid}" aria-label="One less">&minus;</button>'
            f'<input id="{fid}" inputmode="numeric" value="{value}" autocomplete="off">'
            f'<button type="button" data-step="1" data-for="{fid}" aria-label="One more">+</button></div></div>')
def coach():
    h = head("Business Coach in Roseville and Sacramento | Garrison Cole",
             "Business coach for owner-run companies in Roseville and Sacramento. More customers every month, and I do the hard parts with you. Book a free call.",
             "business-coach", "coach", "coach", "Roseville")
    h += header()
    h += f'''<section class="hero"><div class="wrap">
<div>
<h1><span class="eyebrow" data-topic>Business coach in Roseville</span>More customers every month. No more guessing.</h1>
<p class="pain">Referrals slowing down? Good at the work, but customers come and go?</p>
<p class="lede">I’m Garrison, a Roseville local. I help with getting customers and getting them to say yes. I tell you what I’d change, then I do the hard parts with you.</p>
<div class="hero-acts"><a class="btn" href="#book">Book a free call. We find your next 10.</a><a class="quiet" href="#month">Run your month past me first</a></div>
</div>
<div class="card-d"><div class="who-mini"><img src="/garrison.webp" alt="" width="64" height="64"><span><b>Garrison Cole</b>Roseville, CA</span></div>{climb()}</div>
</div></section>
'''
    h += book("Pick a time. We’ll find your next 10 customers.", "Free, 30 minutes, on Zoom or in person. I look you up first. Then we work out where your next 10 customers can come from. You keep that either way.")
    h += f'''<section class="sec sec-s" id="month" aria-labelledby="month-h"><div class="wrap">
<h2 id="month-h">Run your month past me.</h2>
<p class="sub">Three numbers. I’ll tell you where I’d start.</p>
<div class="month">
<div class="steps">
{stepper("m-reach", "People who reach out in a month", 40)}
{stepper("m-priced", "How many get a price", 22, c_label="How many get a bid")}
{stepper("m-yes", "How many say yes", 6)}
<div class="step worth"><label for="m-worth">A customer is worth about<small>Optional</small></label><div class="stepper"><span style="font-weight:800;font-size:20px">$</span><input id="m-worth" inputmode="numeric" value="3,000" autocomplete="off"></div></div>
</div>
<div class="reply" id="reply" aria-live="polite">
<div class="reply-hd"><img src="/garrison-112.webp" alt="" width="44" height="44"><div><b>Garrison</b><span>What I’d text you</span></div></div>
<div class="typing" aria-hidden="true"><i></i><i></i><i></i></div>
<div class="bubble" id="bubble">16 people heard your price and walked. I’d start with the sale. More ads would send more people to lose.</div>
<p class="cash" id="cash">That’s about $13,200 a month you aren’t collecting yet.</p>
<a class="btn" id="reply-book" href="#book">Do this on my real numbers. Book a free call.</a>
<a class="btn" id="reply-text" data-sms href="sms:+17606444559" hidden>Text me</a>
</div>
</div>
</div></section>
'''
    h += f'''<section class="sec" aria-labelledby="proof-h"><div class="wrap"><h2 id="proof-h" class="vh">What an owner says</h2>{rev_card(AVERY, "coaching company owner.")}</div></section>
'''
    h += who(" I started out selling face to face on a gym floor. Later I built a sales team from zero at a startup and ran sales for founder-led companies. Eight years in, I still take sales calls every week. I live in Roseville with my wife and our son, and you deal with me, start to finish.")
    h += qa(COACH_QA)
    h += quick([
        ("Are you a small business coach?", "Yes. I’m a small business coach for owner-run companies that already have customers and want more of them."),
        ("Do you work as a business coach for contractors?", "Yes. I work as a contractor business coach for trades and home service companies. Med spas, dental offices and consultants are a fit too."),
        ("Is this business coaching or a business consultant?", "Call it either one. I tell you what I’d change the way a business consultant would, then I build it with you."),
        ("Where do you offer business coaching?", "I’m a business coach in Roseville and Sacramento, and I meet in person in Rocklin and Folsom too. Anywhere else, we meet on Zoom."),
    ], "Business coaching questions.")
    h += close("Let’s find your next 10.", "Book a free call. We find your next 10.")
    h += footer("Business coaching for owner-run companies in Roseville, Rocklin, Granite Bay, Lincoln, Auburn, Folsom, El Dorado Hills and Sacramento. Glad to meet in person. Outside the area, we meet on Zoom.", [])
    h += end()
    write("business-coach", h)

# ---------- 4. Home ----------
HOME_QA = [
    ("I’ve paid for marketing before and got nothing.", "I hear that most weeks. On the free call I’ll look at what you tried and tell you what I think went wrong."),
    ("What does it cost?", "It depends on what you need, and you hear the number on the call before anything starts. If the math doesn’t work for your business, I’ll say so."),
    ("Can we meet in person?", "Yes, anywhere from Sacramento to Auburn. Zoom works too."),
]
DOORS = [
    ("My website looks old, or I don’t have one.", "I build it first. You see it before you pay.", P + "websites", "See websites"),
    ("I need my phone to ring more.", "I run your ads and build the page behind them. You see every dollar.", P + "growth", "See ads"),
    ("I’ve paid for marketing and got nothing.", "I hear that most weeks. On a free call I’ll look at what you tried and tell you what I think went wrong.", "#book", "Book a free call"),
    ("I want help with the whole business.", "That’s coaching. We talk every week and I do the hard parts with you.", P + "business-coach", "See coaching"),
]
def home():
    h = head("Garrison Cole | More Customers for Owner-Run Businesses in Roseville, CA",
             "Websites, ads and coaching for owner-run businesses in Roseville and Sacramento. One person owns it, start to finish. Book a free call.",
             "", "home", "home")
    if LIVE:  # personalized ?co= links from link.html keep opening the old home
        h = h.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<script>if(/[?&](co|trade)=/.test(location.search))location.replace("/home-v3"+location.search+location.hash)</script>', 1)
    h += header(nav=True)
    h += f'''<section class="hero"><div class="wrap">
<div>
<h1><span class="eyebrow">Roseville, CA. Websites, ads and coaching for owner-run businesses.</span>More customers for the business you built.</h1>
<p class="pain">Good at the work, but customers come and go?</p>
<p class="lede">I’m Garrison, a Roseville local. I help you get more customers, and I own it from the first search to the paid job.</p>
<div class="hero-acts"><a class="btn" href="#book">Book a free call. I look you up first.</a></div>
</div>
<div class="card-d"><div class="who-mini"><img src="/garrison.webp" alt="" width="64" height="64"><span><b>Garrison Cole</b>Roseville, CA</span></div>{climb()}</div>
</div></section>
'''
    h += book("Pick a time. I’ll look at your business first.", "Free, 30 minutes, on Zoom or in person. I look up your website and your Google listing before we talk. You’ll leave knowing what I’d do first and what it would cost.")
    doors = "".join(f'<button class="door" type="button" aria-expanded="false" aria-controls="door-ans" data-line="{e(l)}" data-href="{e(hf)}" data-label="{e(lb)}">{e(t)}</button>' for t, l, hf, lb in DOORS)
    h += f'''<section class="sec sec-s" aria-labelledby="doors-h"><div class="wrap">
<h2 id="doors-h">What do you need?</h2>
<div class="doors">{doors}</div>
<div class="door-ans" id="door-ans" aria-live="polite"><p id="door-line"></p><a class="btn" id="door-link" href="#book">Book a free call</a></div>
</div></section>
'''
    strip = "".join(f'<li>{e(s)}<span class="pill">Garrison</span></li>' for s in STEPS)
    h += f'''<section class="sec" aria-labelledby="strip-h"><div class="wrap">
<h2 id="strip-h">One person. Every step.</h2>
<ol class="strip">{strip}</ol>
<p class="strip-note">You deal with me, start to finish.</p>
</div></section>
'''
    h += f'''<section class="sec sec-s" aria-labelledby="owners-h"><div class="wrap">
<h2 id="owners-h">Two owners, in their own words.</h2>
<div class="owners">
<article class="owner"><button type="button" data-site="florist" data-src="/preview/the-blonde-bouquet/" data-label="Wedding florist, Auburn" aria-label="Open the wedding florist site"><img src="/work-florist-800.webp" width="800" height="450" alt="" loading="lazy" decoding="async"></button>{rev_card(LARAYE, LARAYE_ATTRIBUTION, full=False)}</article>
<article class="owner"><button type="button" data-site="coaching" data-src="/preview/freelyfit/" data-label="Coaching company" aria-label="Open the coaching company site"><img src="/work-coaching-800.webp" width="800" height="450" alt="" loading="lazy" decoding="async"></button>{rev_card(AVERY, "coaching company owner.")}</article>
</div>
<a class="tt" href="{THUMBTACK}" target="_blank" rel="noopener">Reviews on Thumbtack</a>
<p class="result-line">$4.08 came back for every $1 one client spent on ads. In one spring, $12,149 went in and $49,616 came out.</p>
</div></section>
'''
    h += who(" I started out selling face to face on a gym floor. Later I built a sales team from zero at a startup and ran sales for founder-led companies. Eight years in, I still take sales calls every week, so I know what a customer says right before they walk. I live in Roseville with my wife and our son.")
    h += qa(HOME_QA)
    h += close("Let’s get you more customers.", "Book a free call. I look you up first.")
    h += footer("Websites, ads and business coaching for owner-run businesses in Roseville, Rocklin, Granite Bay, Lincoln, Auburn, Folsom and El Dorado Hills. Glad to meet in person. Outside the area, we meet on Zoom.",
                [("Websites", P + "websites"), ("Ads", P + "growth"), ("Coaching", P + "business-coach")])
    h += viewer() + rev_templates("Book a free call. I look you up first.") + end()
    write("index" if LIVE else "home", h)

if __name__ == "__main__":
    websites(); websites(sac=True); growth(); growth(sac=True); coach(); home()
