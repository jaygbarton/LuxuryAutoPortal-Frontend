import { MailWarning } from "lucide-react";

/** Sender of the agreement and account emails (backend FROM_EMAIL default). */
export const GLA_EMAIL_SENDER = "golden@goldenluxuryauto.com";

/**
 * Shown wherever an applicant is told to check their email. Agreement emails
 * are sometimes filtered as spam, and an unsigned agreement blocks approval,
 * so this is deliberately prominent rather than fine print.
 */
export function SpamFolderNotice({ className = "" }: { className?: string }) {
  return (
    <div
      role="note"
      className={`flex gap-3 rounded-lg border border-amber-500/60 bg-amber-500/10 p-3 text-left text-sm text-foreground ${className}`}
    >
      <MailWarning aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <p>
        <strong>Don’t see our email? Check your spam or junk folder.</strong> Our emails are sometimes marked as spam.
        Look for a message from <strong>{GLA_EMAIL_SENDER}</strong>, then mark it as “Not spam” so our next emails
        reach your inbox.
      </p>
    </div>
  );
}
