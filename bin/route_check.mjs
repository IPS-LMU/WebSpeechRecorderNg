#!/usr/bin/env node
/**
 * Every screen the editor routes must be exercised by the audits, and every audited URL must be a
 * screen the editor routes.
 *
 * Both directions have failed here. The bank + draw-rule route renders with no interaction yet was
 * on a11y.md's manual list only, so no audit covered it — and its dark scheme was broken in seven
 * places nobody could have seen (plan §11.45). The other direction is quieter: a renamed route
 * leaves an audit line pointing at a URL that renders the shell and nothing else, and the audit
 * passes because there is no screen left to find faults in.
 *
 * The router is the ground truth for what exists; the audit lists are hand-written. This compares
 * the two, statically, without a browser.
 *
 * Usage: node bin/route_check.mjs
 */
import {readFileSync} from 'node:fs';

const ROUTES = 'projects/spr-script-editor/src/app/app.routes.ts';
const WORKFLOW = '.github/workflows/tests.yml';
const EDITOR_ORIGIN = 'http://127.0.0.1:4300';

// --- what the router exposes ---------------------------------------------------------------
const source = readFileSync(ROUTES, 'utf8');
const routes = [];
// Entries are objects that may span lines; a redirect has no screen to audit.
const entries = source.split(/\{\s*path:/).slice(1).map((chunk) => chunk.split('}')[0]);
for (const entry of entries) {
  const path = /^\s*'([^']*)'/.exec(entry)?.[1];
  if (path === undefined || /redirectTo/.test(entry)) {
    continue;
  }
  if (path === '**') {
    continue;
  }
  routes.push('/' + path);
}

// --- what the audits visit -----------------------------------------------------------------
// Line continuations in the workflow join first, so a wrapped command is still one line.
const workflow = readFileSync(WORKFLOW, 'utf8').replace(/\\\s*\n\s*/g, ' ');
const audited = new Set();
for (const match of workflow.matchAll(new RegExp(`--url ['"]?${EDITOR_ORIGIN}(/[^\\s'"]*)`, 'g'))) {
  // A query string selects a node, not a route: the route is what has to be audited.
  const url = match[1].replace(/\/$/, '').split('?')[0];
  if (url.startsWith('/project/')) {
    audited.add(url);
  }
}

/** A route pattern matches a URL when the fixed segments agree and the parameters take anything. */
const matches = (pattern, url) => {
  const patternParts = pattern.split('/');
  const urlParts = url.split('/');
  if (patternParts.length !== urlParts.length) {
    return false;
  }
  return patternParts.every((part, i) => part.startsWith(':') ? urlParts[i].length > 0 : part === urlParts[i]);
};

const problems = [];
for (const route of routes) {
  if (![...audited].some((url) => matches(route, url))) {
    problems.push(`the router exposes ${route} and no audit visits it`);
  }
}
for (const url of [...audited].sort()) {
  if (!routes.some((route) => matches(route, url))) {
    problems.push(`an audit visits ${url} and no route renders it`);
  }
}

// --- the dark pass must mirror the light one ------------------------------------------------
// The dark block's comment says "the same routes again with the opt-in dark scheme switched on", and a
// URL alone is not enough to check that: `bank-draw/edit` is audited in both passes, but the light one
// opens the draw-rule inspector with `open-draw-rule.js` and the dark one did not, so that state was
// never measured in dark — the failure mode §11.45 records. Compare URL *and* fixture, with the scheme
// fixture itself of course ignored.
//
// Three things this comparison must not do, each of which it did first: count the mobile-only pass (the
// dark pass is deliberately one desktop viewport), count the `plant-*` sensitivity lines (they prove the
// audit *fails* on a planted fault and have no dark twin), or count URLs that are not editor screens
// (`/favicon.ico`).
const SCHEME_FIXTURE = 'bin/audit/use-dark-scheme.js';
const DESKTOP = '1366x768';
const auditCalls = [];
for (const line of workflow.split('\n')) {
  // Match the *command*, not any line that mentions it: a comment or a wrapped continuation can carry the
  // tool's name, and a theme line classified as a11y made the cross-tool comparison below a no-op.
  const command = line.match(/node bin\/(theme|a11y)_audit\.mjs/);
  if (command === null) {
    continue;
  }
  const tool = command[1] === 'theme' ? 'theme' : 'a11y';
  const url = (line.match(new RegExp(`--url '?${EDITOR_ORIGIN}([^\\s'"]*)`)) ?? [])[1] ?? '';
  const prepare = ((line.match(/--prepare ([^\s]+)/) ?? [])[1] ?? '').split(',')
    .map((name) => name.trim()).filter((name) => name !== '');
  const viewports = (line.match(/--viewports ([^\s]+)/) ?? [])[1] ?? '';
  auditCalls.push({tool, url, prepare, viewports});
}
const stateOf = ({url, prepare}) => `${url}|${prepare.filter((name) => name !== SCHEME_FIXTURE).join(',')}`;
const darkStates = new Set(auditCalls.filter((call) => call.prepare.includes(SCHEME_FIXTURE)).map(stateOf));
for (const call of auditCalls) {
  if (call.prepare.includes(SCHEME_FIXTURE) || !call.url.startsWith('/project/')) {
    continue;
  }
  if (!call.viewports.split(',').includes(DESKTOP)) {
    continue;
  }
  if (call.prepare.some((name) => name.includes('plant-'))) {
    continue;
  }
  if (!darkStates.has(stateOf(call))) {
    problems.push(`the light pass audits ${call.url}${call.prepare.length ? ' with ' + call.prepare.join(',') : ''} and no dark pass measures that state`);
  }
}

// The a11y block says "on the same routes" as the theme block, so the same (URL, fixture) comparison runs
// the other way: a screen only the a11y audit visits has had no token or contrast measurement at all, which
// is how `…/script/1245/source` sat unchecked (§11.112).
const themeStates = new Set(auditCalls
  .filter((call) => call.tool === 'theme' && call.viewports.split(',').includes(DESKTOP))
  .map(stateOf));
for (const call of auditCalls) {
  if (call.tool !== 'a11y' || !call.url.startsWith('/project/')) {
    continue;
  }
  if (!themeStates.has(stateOf(call))) {
    problems.push(`the a11y pass audits ${call.url}${call.prepare.length ? ' with ' + call.prepare.join(',') : ''} and no theme pass measures that state`);
  }
}

if (problems.length) {
  console.error(`${problems.length} route/audit gap(s):`);
  for (const problem of problems) {
    console.error('  ' + problem);
  }
  process.exit(1);
}
console.log(`Route check passed: ${routes.length} routed screen(s), all exercised by ${audited.size} `
  + `audited URL(s), and every audited URL is a screen.`);
