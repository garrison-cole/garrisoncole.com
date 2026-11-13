# garrisoncole.com v3, "The site that looks first"

Static site. No build step. Push these files to the root of the GitHub Pages repo and it's live. Keep the existing `CNAME` file in the repo.

## What each file is

| File | What it does |
|---|---|
| `index.html` | Home. Hero with the real-time sun, the greeting and "Make it mine," why small businesses matter, the pains, the sample scouting report, the timeline, the four numbers and tools, grows in order, about, the form |
| `tools.html` | Four Numbers Scoreboard, Quote Leak Calculator, Bottleneck Finder (the first and third save a scorecard image), the search check, the form |
| `philosophy.html` | The four layers with the "bottom up" bracket, the four numbers explained, rules, what I won't do |
| `link.html` | Your private link builder. Not linked anywhere, not indexed |
| `thanks.html` | Where the form lands. Greets the company by name. Fires `lead_form` |
| `404.html` | GitHub Pages serves this for any bad link |
| `styles.css` | All styling. Colors, type and motion are tokens at the top |
| `app.js` | Everything that moves. `CONFIG` at the very top, then the pure functions with their tests |
| `link.js` | Only for `link.html`. Builds the link and draws the QR code |
| images, `favicon.svg`, `og.jpg`, `og.svg`, `sitemap.xml`, `robots.txt` | Same as v2 |

## Go-live settings

Everything is in the `CONFIG` block at the top of `app.js`. Anything left empty stays off and the site still runs clean.

1. `FORMSPREE_ID`: the part after `formspree.io/f/`. Until it's filled, the form tells visitors to text you.
2. `GA4_ID`, `CLARITY_ID`, `META_PIXEL_ID` (optional).
3. `BOOKING_URL` (optional). Every "Book a 15-minute call" stays hidden until it's filled.
4. `SAMPLE_VIDEO_URL`: a Loom or YouTube **embed** URL for one real scouting video. When it's filled, "Watch a real one, two minutes" shows under the sample listing.
5. `TWO_MINUTES_MS`: 120000 by default. Set it to 0 to turn the nav ring and the two-minute card off.
6. `TAB_TITLE_AWAY`: true by default. Set false to stop the "(1) Missed call from your next customer" tab title.
7. `THRESHOLDS` and `LIFT`: same placeholders as v2. Swap in your own numbers whenever you have them.

## Personalized links

Open `garrisoncole.com/link.html`, type the company, pick the trade, type the town, press **Copy link**. The QR code under it is the same link, ready for a leave-behind. The link looks like:

`https://garrisoncole.com/?co=Aguilar+Fence&trade=fence&town=Rocklin`

Use them in texts, replies and follow-ups. Cold emails stay link-free.

Their name lives only in their own browser tab (`sessionStorage`). It reaches you only if they send the form. Analytics get the trade and true/false flags, never the name. The canonical tag always points at the clean URL, so personalized links never get indexed.

Trade keys: `fence`, `concrete`, `tree`, `landscape`, `epoxy`, `glass`, `pool`, `paint`, `garage`, `haul`, `coach`.

## GA4 after the ID is in

Mark `lead_form`, `phone_tap`, `text_tap` and `scout_complete` as key events. New in v3: `personalized_view`, `trade_pick`, `greeting_shown`, `scout_open`, `scout_play`, `scout_complete`, `sample_play`, `card_save`, `two_minute_shown`, `two_minute_click`, `two_minute_dismiss`, `tab_return`. The v2 events are all still there.

## Still marked for you

Search the HTML for `[Garrison` to find them.

- **Proof section on home.** Live with three anonymized results from one client. When an owner gives you a quote, add it where the QUOTE comment sits.
- **About photos.** Hidden. Drop three images in, swap each `slot-box` for an `<img>`, delete `hidden` on the `strip` line. Keep your son's face out.
- **"Good for a two-crew trade" ranges** on the philosophy page. Hidden until filled.
- **Your own handwriting (optional).** The marker notes use the Nanum Pen Script font. If you want your real hand: write the six notes on paper ("this is what you get," "start here," "bottom up," and the five sample-listing notes), photograph them, trace to SVG, and swap them in where the `pen-note` and `hand` spans are.

## Review checklist

1. Add `?test` to any URL and open the console. 40 checks print as a table, all true.
2. Add `?time=06:30`, `?time=12:25`, `?time=16:10`, `?time=17:20` or `?time=22:00` to the home page to see the sun and the greeting at each part of the day.
3. Open `index.html?co=Aguilar+Fence&trade=fence&town=Rocklin`. Greeting, tab title, phone, form and text links all carry the name. The thanks page says "Got it, Aguilar Fence."
4. Type a company into the hero field, press **Make it mine**, pick a trade.
5. Tap the five numbers on the sample listing, or press **Play it for me**, or **Skip to the end**.
6. Tools: 3000 / 40 / 12 / 4500 / 2 crews gives $75, 30%, $250, $6,236. Press **Save my scorecard**.
7. Stay on the home page two minutes. The ring by the clock fills and the card shows once.
8. Run Lighthouse on the three main pages.

## Ad landing pages (growth, websites and their Sacramento versions)

`growth.html`, `websites.html`, `growth-sacramento.html` and `websites-sacramento.html` draw themselves from `<template id="dc-tpl">` with `lp.js`. The default view is also pre-built into `<div id="dc-root">`, so the page text is in the HTML for crawlers and Google's ad checks. `lp.js` updates that HTML in place.

**After any change to a landing page template or to `lp.js`, run `python3 _tools/prerender.py`** (needs Playwright and Chrome), then bump the `lp.js?v=` tag. The template is shared, so edit it in all four files.

A town version of a page sets `data-town`, `data-lp` and, when needed, `data-topic` on `<html>`.
