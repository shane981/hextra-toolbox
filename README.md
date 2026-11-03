# Hextra Toolbox Talks (PWA)

Installable, offline-capable web app for the weekly toolbox talk: read the talk, sign on (name, role,
site/job, "attended and understood" tick, finger signature, timestamp), export the sign-on register as
CSV, and tick off supervisor follow-up actions. Plain HTML/CSS/vanilla JS – no build step.

## Layout

```
index.html               app shell (hash routes: #/  #/archive  #/talk/<id>  #/supervisor)
manifest.webmanifest     name "Hextra Toolbox Talks", short_name "Hextra TB Talk", standalone
sw.js                    service worker (CACHE_VERSION bumped by publish)
css/app.css              screen + print (A4) styles
js/app.js  js/db.js  js/signature.js
icons/                   192/512 "any" + maskable, apple-touch-icon 180, favicon, logo
talks/index.json         generated list, newest first
talks/<id>.json          one file per talk
version.json             generated: cache version + publish time
schema/talk.schema.json  JSON Schema;  SCHEMA.md – human-readable schema
drafts/                  put new talk JSON here before publishing (not deployed)
scripts/publish.sh       validate → add → index → bump SW cache → build dist/ → deploy → verify live
scripts/validate.mjs     zero-dependency validator
scripts/verify-pwa.mjs   headless Chrome check (installability, SW, offline, sign-on, CSV)
scripts/make-icons.py    regenerate icons from the Hextra logo (/workspace/hextra-brand/logo.png)
deploy.env               deploy settings (GitHub repo, target, site URL)
```

## Publish a new week

```bash
cd /workspace/hextra-toolbox
node scripts/validate.mjs drafts/2026-11-16.json      # optional – publish validates anyway
scripts/publish.sh drafts/2026-11-16.json             # add + deploy
scripts/publish.sh drafts/2026-11-16.json --replace   # fix a talk already published
scripts/publish.sh --redeploy                         # redeploy without a new talk (e.g. after a CSS change)
scripts/publish.sh --check                            # validate everything, change nothing
```

Exit codes: 0 ok · 1 validation/other error · 2 usage · 3 no authenticated host (the talk is still added
locally and `dist/` built – log in and run `scripts/publish.sh --redeploy`).

## Hosting

Default target is **GitHub Pages** via the `gh` CLI (`deploy.env`: `GH_REPO=shane981/hextra-toolbox`).
First deploy creates the repo (public – required for Pages on a free plan), pushes `dist/` to the
`gh-pages` branch, enables Pages and waits until `version.json` on the live site shows the new cache
version. One-off login: `gh auth login` (GitHub.com → HTTPS → browser/device code).
Alternatives: `netlify login` or `wrangler login`, then `scripts/publish.sh --redeploy --target netlify|cloudflare`.

**Exposure:** the site and talk content are public to anyone with the URL (`robots.txt` + `noindex`
discourage search engines). Sign-on data never leaves the device except via the supervisor's CSV export.
For a private site, use Cloudflare Pages + Cloudflare Access (free for small teams) or Netlify password
protection (paid).

## Local test

```bash
python3 -m http.server 8080            # then open http://localhost:8080/
npm i && node scripts/verify-pwa.mjs http://localhost:8080/
```
