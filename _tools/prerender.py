"""Pre-builds the default view of each ad landing page into its HTML.

Why: the pages draw themselves from <template id="dc-tpl"> with lp.js. Without this,
a crawler that does not run scripts (and Google's ad quality check, at first look)
sees an empty page. This renders each page in Chrome with no search term, copies
what lp.js drew into <div id="dc-root">, and writes it back into the file.
lp.js then updates that HTML in place, so visitors see no change.

Run after any change to a landing page template or to lp.js:
    python3 _tools/prerender.py
Needs: pip install playwright, and Google Chrome (or `playwright install chromium`).
Folders starting with "_" are not published by GitHub Pages.
"""
import http.server, os, re, socketserver, sys, threading
from functools import partial
from playwright.sync_api import sync_playwright

PAGES = ["websites.html", "growth.html", "websites-sacramento.html", "growth-sacramento.html"]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOX = re.compile(r'(<div id="dc-root">)(.*?)(</div>\n<noscript>)', re.S)
# The calendar must not draw (or fail) during the build, so stub it out.
CAL_STUB = "window.Cal = function () {}; window.Cal.ns = { call: function () {} };"

def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    handler = partial(Quiet, directory=ROOT)
    srv = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

def main():
    srv = serve(); base = "http://127.0.0.1:%d/" % srv.server_address[1]
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(channel="chrome")
        except Exception:
            browser = p.chromium.launch()
        for page_file in PAGES:
            ctx = browser.new_context(viewport={"width": 1280, "height": 900})
            ctx.add_init_script(CAL_STUB)
            ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
            pg = ctx.new_page()
            pg.goto(base + page_file)
            pg.wait_for_selector("#dc-root h1")
            pg.wait_for_timeout(300)
            inner = pg.evaluate("document.getElementById('dc-root').innerHTML")
            ctx.close()
            path = os.path.join(ROOT, page_file)
            src = open(path, encoding="utf-8").read()
            assert len(BOX.findall(src)) == 1, page_file + ": #dc-root box not found once"
            assert "</div>\n<noscript>" not in inner
            out = BOX.sub(lambda m: m.group(1) + inner + m.group(3), src)
            open(path, "w", encoding="utf-8").write(out)
            print("%-26s %6d characters of page text built in" % (page_file, len(inner)))
        browser.close()
    srv.shutdown()

if __name__ == "__main__":
    main()
