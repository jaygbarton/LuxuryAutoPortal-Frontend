/** Date inputs and the API need calendar digits, not a browser locale's display format. */
export function onboardingDate(date = new Date()): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function onboardingSubmissionError(error: { message?: string; error?: string }): string {
  return error.message || error.error || 'Submission failed. Your saved draft is still available; please retry.';
}
