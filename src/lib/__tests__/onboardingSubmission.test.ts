import { test } from 'vitest';
import assert from 'node:assert/strict';
import { onboardingDate, onboardingSubmissionError } from '../onboardingSubmission';

test('application date stays ISO when mobile locale formatting returns slash dates', () => {
  const date = new Date(2026, 10, 6, 13, 48);
  date.toLocaleDateString = () => '11/6/2026';
  assert.equal(onboardingDate(date), '2026-11-06');
});

test('application date uses the local calendar day around UTC midnight', () => {
  assert.equal(onboardingDate(new Date(2026, 0, 1, 0, 5)), '2026-01-01');
  assert.equal(onboardingDate(new Date(2026, 11, 31, 23, 55)), '2026-12-31');
});

test('submission error shows the server recovery message ahead of its generic label', () => {
  assert.equal(onboardingSubmissionError({
    error: 'Failed to create onboarding submission',
    message: 'Your application could not be submitted. Your saved draft is still available; please retry.',
  }), 'Your application could not be submitted. Your saved draft is still available; please retry.');
  assert.equal(onboardingSubmissionError({ error: 'Please sign in again.' }), 'Please sign in again.');
  assert.match(onboardingSubmissionError({}), /saved draft/);
});
