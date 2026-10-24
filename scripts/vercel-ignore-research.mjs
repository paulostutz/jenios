#!/usr/bin/env node
import { readFileSync } from 'node:fs';

// Vercel convention: exit 0 skips the build; exit 1 continues it.
// This runs before dependency installation and must not require packages,
// credentials, network access, or changes to project-wide settings.
const researchPrefixes = [
  'fix/jenios-robot-',
  'research/jenios-robot-',
  'backup/jenios-robot-',
];

try {
  const ref = process.env.VERCEL_GIT_COMMIT_REF;
  if (typeof ref !== 'string' || ref.length === 0 || /\s/.test(ref)) {
    console.log('Build skipped: no unambiguous Git branch was provided.');
    process.exit(0);
  }

  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const rules = config.git?.deploymentEnabled;
  if (rules === false) {
    console.log('Build skipped by the repository Git deployment policy.');
    process.exit(0);
  }
  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) {
    throw new Error('Git deployment policy is unavailable');
  }

  const isResearch = researchPrefixes.some((prefix) => ref.startsWith(prefix));
  const isExplicitlyDisabled = Object.hasOwn(rules, ref) && rules[ref] === false;
  if (isResearch || isExplicitlyDisabled) {
    console.log('Build skipped: isolated research or certified backup branch.');
    process.exit(0);
  }

  console.log('Branch is outside the research exclusion; normal build policy continues.');
  process.exit(1);
} catch {
  // An unreadable policy must never accidentally publish a research build.
  console.log('Build skipped: repository deployment policy could not be verified.');
  process.exit(0);
}
