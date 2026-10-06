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

if (problems.length) {
  console.error(`${problems.length} route/audit gap(s):`);
  for (const problem of problems) {
    console.error('  ' + problem);
  }
  process.exit(1);
}
console.log(`Route check passed: ${routes.length} routed screen(s), all exercised by ${audited.size} `
  + `audited URL(s), and every audited URL is a screen.`);
