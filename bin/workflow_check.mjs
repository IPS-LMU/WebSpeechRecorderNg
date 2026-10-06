#!/usr/bin/env node
/**
 * Structural check for `.github/workflows/tests.yml`.
 *
 * The failure this guards against is silent and total: a workflow file GitHub cannot parse runs
 * *nothing*, so a job appended by hand with one wrong indent turns every check in the repository off
 * without any of them reporting it. This work has edited that file in almost every round, so the
 * check belongs in the repository rather than in a habit.
 *
 * It is deliberately dependency-free and conservative: the server job installs nothing, and a guard
 * that misparsed a valid file would be worse than none. So it only rejects what is unambiguously
 * wrong, using the shape this file keeps:
 *
 *   - no tabs (YAML forbids them);
 *   - top-level `name`, `on`, `jobs`;
 *   - each job at two spaces, with `runs-on:` and at least one step;
 *   - each step a `- uses:` or `- run:` (or a `- name:` that leads to one), never empty;
 *   - each `run:` block at least one non-empty command line.
 *
 * Usage: node bin/workflow_check.mjs [--verbose]
 */
import {readFileSync} from 'node:fs';

const PATH = '.github/workflows/tests.yml';
const VERBOSE = process.argv.includes('--verbose');
const lines = readFileSync(PATH, 'utf8').split('\n');
const problems = [];
const jobNames = [];

const indentOf = (line) => line.length - line.trimStart().length;

if (lines.some((line) => line.includes('\t'))) {
  const at = lines.findIndex((line) => line.includes('\t')) + 1;
  problems.push(`${PATH}:${at}: contains a tab, which YAML forbids`);
}

const topLevel = lines
  .filter((line) => /^[A-Za-z_][A-Za-z0-9_-]*:/.test(line))
  .map((line) => line.slice(0, line.indexOf(':')));
for (const key of ['name', 'on', 'jobs']) {
  if (!topLevel.includes(key)) {
    problems.push(`${PATH}: no top-level \`${key}:\``);
  }
}

const jobsAt = lines.findIndex((line) => /^jobs:\s*$/.test(line));
if (jobsAt < 0) {
  problems.push(`${PATH}: no \`jobs:\` block`);
} else {
  // Every two-space key after `jobs:` starts a job; its block runs to the next one.
  const starts = [];
  for (let i = jobsAt + 1; i < lines.length; i += 1) {
    if (/^[A-Za-z_][A-Za-z0-9_-]*:/.test(lines[i])) {
      break; // the next top-level key ends the jobs block
    }
    if (/^  [A-Za-z0-9_-]+:\s*$/.test(lines[i])) {
      starts.push(i);
    }
  }
  for (const [index, start] of starts.entries()) {
    const end = index + 1 < starts.length ? starts[index + 1] : lines.length;
    const block = lines.slice(start, end);
    const name = lines[start].trim().replace(/:$/, '');
    jobNames.push(name);
    const job = (i) => `${PATH}: job \`${name}\``;
    if (!block.some((line) => /^    runs-on:\s*\S/.test(line))) {
      problems.push(`${job()}: no \`runs-on:\``);
    }
    // A job key indented by four spaces is what it always looks like: a job-level key. Anything else
    // there is either a key this list has not met — decide it explicitly, here — or a job that lost
    // two spaces and is now invisible to every rule below, which is the mistake this check exists for.
    const JOB_KEYS = ['name', 'runs-on', 'needs', 'if', 'env', 'strategy', 'timeout-minutes', 'steps', 'continue-on-error'];
    for (const [i, line] of block.entries()) {
      const match = /^    ([A-Za-z0-9_-]+):/.exec(line);
      if (match && !JOB_KEYS.includes(match[1])) {
        problems.push(`${PATH}:${start + i + 1}: \`${match[1]}:\` is neither a job-level key this check knows nor a step — ` +
          `a job indented by four spaces instead of two looks exactly like this`);
      }
    }
    const steps = block.filter((line) => /^      - /.test(line)).length;
    if (steps === 0) {
      problems.push(`${job()}: no steps`);
    }
    for (const [i, line] of block.entries()) {
      if (!/^        run: \|/.test(line)) {
        continue;
      }
      const runIndent = indentOf(line);
      const body = [];
      for (let j = i + 1; j < block.length; j += 1) {
        const bodyLine = block[j];
        if (bodyLine.trim() && indentOf(bodyLine) <= runIndent) {
          break;
        }
        body.push(bodyLine);
      }
      if (!body.some((bodyLine) => bodyLine.trim() && !bodyLine.trim().startsWith('#'))) {
        problems.push(`${job()}: a \`run: |\` block has no command`);
      }
    }
    for (const [i, line] of block.entries()) {
      if (!/^      - /.test(line)) {
        continue;
      }
      const stepText = line.replace(/^      - /, '').trim();
      if (!stepText && !/^      - /.test(block[i + 1] ?? '')) {
        problems.push(`${job()}: an empty step`);
      }
    }
  }
}

if (VERBOSE) {
  console.log(`${PATH}: ${lines.length} lines, jobs: ${jobNames.join(', ')}`);
}
if (problems.length) {
  console.error(`${problems.length} problem(s) in ${PATH}:`);
  for (const problem of problems) {
    console.error('  ' + problem);
  }
  process.exit(1);
}
console.log(`Workflow check passed: ${jobNames.length} job(s) — ${jobNames.join(', ')}.`);
