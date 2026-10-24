export type EmployeePasswordEmailResult = {
  status: 'accepted' | 'failed';
  message: string;
  recipient?: string;
  messageId?: string;
};

/** Saving/approving an employee and sending their invitation are separate outcomes. */
export function employeePasswordEmailFeedback(action: string, result?: EmployeePasswordEmailResult) {
  return {
    title: result?.status === 'failed' ? `${action}; password email needs attention` : action,
    description: result?.message || `Employee ${action.toLowerCase()} successfully.`,
    variant: result?.status === 'failed' ? 'destructive' as const : 'default' as const,
  };
}
