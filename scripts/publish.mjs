#!/usr/bin/env node
// Hextra Toolbox Talks – publish pipeline.
// validate -> copy into talks/ -> rebuild talks/index.json -> bump SW cache version -> build dist/ -> deploy
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, cpSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { validateTalk } from './validate.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TALKS = join(ROOT, 'talks');
const DIST = join(ROOT, 'dist');
const SHIP = ['index.html', 'manifest.webmanifest', 'sw.js', 'version.json', 'robots.txt', '.nojekyll', 'css', 'js', 'icons', 'talks'];

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--target'].includes(argv[i - 1])));

if (flag('--help') || flag('-h')) {
  console.log(`Usage:
  scripts/publish.sh <talk.json>            validate, add to talks/, bump SW cache, build dist/, deploy
  scripts/publish.sh <talk.json> --replace  overwrite an existing talk with the same id
  scripts/publish.sh --redeploy             rebuild + bump cache + deploy without adding a talk
  scripts/publish.sh --check                validate every talk and the index, change nothing
Options:
  --no-deploy        stop after building dist/
  --target <t>       auto | github | git | netlify | cloudflare | none   (default: $DEPLOY_TARGET or auto)
Config: deploy.env (sourced by publish.sh) – GH_REPO, DEPLOY_TARGET, DEPLOY_GIT_REMOTE, DEPLOY_BRANCH, NETLIFY_SITE_ID, CF_PAGES_PROJECT, SITE_URL`);
  process.exit(0);
}

const log = (...a) => console.log('•', ...a);
const die = (msg, code = 1) => { console.error(`✗ ${msg}`); process.exit(code); };
const run = (cmd, args, o = {}) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', ...o }).trim();
const ok = (cmd, args, o = {}) => spawnSync(cmd, args, { stdio: 'ignore', ...o }).status === 0;
const has = (cmd) => ok('sh', ['-c', `command -v ${cmd}`]);
const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));
const writeJSON = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + '\n');

function listTalkFiles() {
  return readdirSync(TALKS).filter((f) => f.endsWith('.json') && f !== 'index.json');
}

function rebuildIndex() {
  const entries = [];
  const errors = [];
  for (const f of listTalkFiles()) {
    let t;
    try { t = readJSON(join(TALKS, f)); } catch (e) { errors.push(`${f}: invalid JSON (${e.message})`); continue; }
    const errs = validateTalk(t);
    if (errs.length) errors.push(`${f}: ${errs.join('; ')}`);
    if (t.id && `${t.id}.json` !== f) errors.push(`${f}: file name must be <id>.json (id is ${t.id})`);
    entries.push({ id: t.id, title: t.title, date: t.date, week_label: t.week_label, file: f });
  }
  if (errors.length) die(`talk validation failed:\n  - ${errors.join('\n  - ')}`);
  const ids = new Set();
  for (const e of entries) { if (ids.has(e.id)) die(`duplicate talk id ${e.id}`); ids.add(e.id); }
  entries.sort((a, b) => (b.date.localeCompare(a.date)) || b.id.localeCompare(a.id));
  return { schema_version: 1, generated_at: new Date().toISOString(), latest: entries[0]?.id ?? null, count: entries.length, talks: entries };
}

function bumpCacheVersion() {
  const swPath = join(ROOT, 'sw.js');
  const sw = readFileSync(swPath, 'utf8');
  const re = /const CACHE_VERSION = 'hextra-toolbox-v(\d+)';/;
  const m = sw.match(re);
  if (!m) die('could not find CACHE_VERSION in sw.js');
  const next = Number(m[1]) + 1;
  writeFileSync(swPath, sw.replace(re, `const CACHE_VERSION = 'hextra-toolbox-v${next}';`));
  return `hextra-toolbox-v${next}`;
}

function build() {
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST);
  for (const item of SHIP) {
    const src = join(ROOT, item);
    if (!existsSync(src)) die(`missing ${item}`);
    cpSync(src, join(DIST, item), { recursive: true });
  }
}

// ---------- deploy targets ----------
function ghAuthed() { return has('gh') && ok('gh', ['auth', 'status']); }
function netlifyAuthed() { return has('netlify') && ok('netlify', ['status']); }
function wranglerAuthed() { return has('wrangler') && ok('wrangler', ['whoami']); }

function gitDeploy(remote, branch, gitExtra = []) {
  const work = join(ROOT, '.deploy', 'worktree');
  rmSync(work, { recursive: true, force: true });
  mkdirSync(dirname(work), { recursive: true });
  const g = (args, o = {}) => run('git', [...gitExtra, ...args], o);
  let exists = false;
  try { exists = g(['ls-remote', '--heads', remote, branch]).length > 0; } catch (e) { die(`cannot reach deploy remote ${remote}: ${e.stderr || e.message}`); }
  if (exists) g(['clone', '--quiet', '--depth', '1', '--branch', branch, remote, work]);
  else { mkdirSync(work); g(['init', '--quiet', '-b', branch], { cwd: work }); g(['remote', 'add', 'origin', remote], { cwd: work }); }
  for (const f of readdirSync(work)) if (f !== '.git') rmSync(join(work, f), { recursive: true, force: true });
  cpSync(DIST, work, { recursive: true });
  g(['add', '-A'], { cwd: work });
  const dirty = g(['status', '--porcelain'], { cwd: work });
  if (!dirty) { log('deploy branch already up to date'); return false; }
  const msg = `Publish ${new Date().toISOString()}`;
  g(['-c', 'user.name=Hextra Toolbox Publisher', '-c', 'user.email=publisher@hextra-toolbox.invalid', 'commit', '--quiet', '-m', msg], { cwd: work });
  g(['push', '--quiet', 'origin', `HEAD:${branch}`], { cwd: work });
  log(`pushed to ${remote} (${branch})`);
  return true;
}

async function waitForLive(url, cacheVersion, seconds = 240) {
  if (!url) return;
  const target = url.replace(/\/?$/, '/') + 'version.json';
  log(`verifying live site ${target} …`);
  const until = Date.now() + seconds * 1000;
  while (Date.now() < until) {
    try {
      const r = await fetch(`${target}?t=${Date.now()}`, { cache: 'no-store' });
      if (r.ok) { const v = await r.json(); if (v.cache_version === cacheVersion) { log(`live ✓ ${url} is serving ${cacheVersion}`); return true; } }
    } catch {}
    await new Promise((r) => setTimeout(r, 10000));
  }
  console.warn(`! live site not yet showing ${cacheVersion} after ${seconds}s (GitHub Pages can take a few minutes). Check ${url}`);
  return false;
}

async function deployGithub(cacheVersion) {
  if (!ghAuthed()) die('GitHub CLI is not logged in. Run:  gh auth login  (then re-run: scripts/publish.sh --redeploy)', 3);
  const login = run('gh', ['api', 'user', '--jq', '.login']);
  const repo = process.env.GH_REPO || `${login}/hextra-toolbox`;
  const branch = process.env.DEPLOY_BRANCH || 'gh-pages';
  if (!ok('gh', ['repo', 'view', repo])) {
    const vis = process.env.GH_VISIBILITY || 'public';
    log(`creating GitHub repo ${repo} (${vis}) – note: GitHub Pages on a free plan needs a PUBLIC repo`);
    run('gh', ['repo', 'create', repo, `--${vis}`, '--description', 'Hextra weekly toolbox talks (PWA, static site)']);
  }
  gitDeploy(`https://github.com/${repo}.git`, branch, ['-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential']);
  if (!ok('gh', ['api', `repos/${repo}/pages`])) {
    log('enabling GitHub Pages');
    run('gh', ['api', '-X', 'POST', `repos/${repo}/pages`, '-f', `source[branch]=${branch}`, '-f', 'source[path]=/']);
  }
  let url = process.env.SITE_URL;
  try { url = url || run('gh', ['api', `repos/${repo}/pages`, '--jq', '.html_url']); } catch {}
  await waitForLive(url, cacheVersion);
  return url;
}

async function deploy(target, cacheVersion) {
  if (target === 'auto') {
    target = ghAuthed() ? 'github' : netlifyAuthed() ? 'netlify' : wranglerAuthed() ? 'cloudflare'
      : process.env.DEPLOY_GIT_REMOTE ? 'git' : null;
    if (!target) die(`no authenticated host found. dist/ is built and the talk is published locally.
  To deploy to GitHub Pages:  gh auth login   then   scripts/publish.sh --redeploy
  (or: netlify login / wrangler login, then re-run)`, 3);
    log(`deploy target: ${target}`);
  }
  switch (target) {
    case 'none': log('deploy skipped (--target none)'); return null;
    case 'github': return deployGithub(cacheVersion);
    case 'git': {
      const remote = process.env.DEPLOY_GIT_REMOTE;
      if (!remote) die('DEPLOY_GIT_REMOTE not set');
      gitDeploy(remote, process.env.DEPLOY_BRANCH || 'gh-pages');
      await waitForLive(process.env.SITE_URL, cacheVersion, 30);
      return process.env.SITE_URL || remote;
    }
    case 'netlify': {
      if (!netlifyAuthed()) die('Netlify CLI not logged in: run  netlify login', 3);
      const args = ['deploy', '--prod', '--dir', DIST];
      if (process.env.NETLIFY_SITE_ID) args.push('--site', process.env.NETLIFY_SITE_ID);
      console.log(run('netlify', args));
      await waitForLive(process.env.SITE_URL, cacheVersion, 60);
      return process.env.SITE_URL;
    }
    case 'cloudflare': {
      if (!wranglerAuthed()) die('Wrangler not logged in: run  wrangler login', 3);
      console.log(run('wrangler', ['pages', 'deploy', DIST, '--project-name', process.env.CF_PAGES_PROJECT || 'hextra-toolbox', '--branch', 'main']));
      await waitForLive(process.env.SITE_URL, cacheVersion, 60);
      return process.env.SITE_URL;
    }
    default: die(`unknown target ${target}`);
  }
}

function commitSource(message) {
  if (!existsSync(join(ROOT, '.git'))) return;
  try {
    run('git', ['add', '-A'], { cwd: ROOT });
    if (run('git', ['status', '--porcelain'], { cwd: ROOT })) {
      run('git', ['-c', 'user.name=Hextra Toolbox Publisher', '-c', 'user.email=publisher@hextra-toolbox.invalid', 'commit', '--quiet', '-m', message], { cwd: ROOT });
      log(`source committed: ${message}`);
    }
  } catch (e) { console.warn('! source commit skipped:', e.stderr || e.message); }
}

// ---------- main ----------
(async () => {
  if (flag('--check')) {
    const idx = rebuildIndex();
    const cur = readJSON(join(TALKS, 'index.json'));
    const same = JSON.stringify(cur.talks) === JSON.stringify(idx.talks);
    log(`${idx.count} talk(s) valid; index.json ${same ? 'is in sync' : 'is OUT OF SYNC (run publish --redeploy)'}`);
    process.exit(same ? 0 : 1);
  }

  let label = 'redeploy';
  if (!flag('--redeploy')) {
    const src = positional[0];
    if (!src) die('give a talk JSON file (or --redeploy). See --help', 2);
    let talk;
    try { talk = readJSON(resolve(src)); } catch (e) { die(`cannot read ${src}: ${e.message}`, 2); }
    const errs = validateTalk(talk);
    if (errs.length) die(`${basename(src)} failed schema validation:\n  - ${errs.join('\n  - ')}`);
    log(`validated ${talk.id} – ${talk.title}`);
    const dest = join(TALKS, `${talk.id}.json`);
    if (existsSync(dest) && resolve(src) !== dest) {
      const same = JSON.stringify(readJSON(dest)) === JSON.stringify(talk);
      if (!same && !flag('--replace')) die(`talks/${talk.id}.json already exists with different content. Use --replace to overwrite.`);
    }
    writeJSON(dest, talk);
    label = `talk ${talk.id}`;
  }

  const index = rebuildIndex();
  writeJSON(join(TALKS, 'index.json'), index);
  log(`index.json: ${index.count} talk(s), latest ${index.latest}`);

  const cacheVersion = bumpCacheVersion();
  writeJSON(join(ROOT, 'version.json'), { cache_version: cacheVersion, published_at: new Date().toISOString(), latest: index.latest });
  log(`service worker cache bumped to ${cacheVersion}`);

  build();
  log(`built ${DIST}`);
  commitSource(`Publish ${label} (${cacheVersion})`);

  if (flag('--no-deploy')) { log('--no-deploy: stopping before deploy'); return; }
  const url = await deploy(opt('--target', process.env.DEPLOY_TARGET || 'auto'), cacheVersion);
  if (url) console.log(`\n✓ Published ${label} → ${url}`);
})().catch((e) => die(e.stderr || e.stack || String(e)));
