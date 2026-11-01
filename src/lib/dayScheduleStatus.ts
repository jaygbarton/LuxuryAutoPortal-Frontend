/** Simplified task state for the schedule; source workflow/history stays intact. */
export function scheduleTaskStatus(event: { status: string | null; completed_day?: string | null }): 'new' | 'completed' {
  return event.completed_day || ['completed', 'delivered', 'no_issues'].includes(String(event.status ?? '').trim().toLowerCase()) ? 'completed' : 'new';
}
