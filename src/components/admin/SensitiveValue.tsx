import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

/**
 * Displays a masked SSN / EIN / bank number with an optional click-to-reveal.
 *
 * The masked text comes from the server — the API never sends the full value in
 * list or detail responses. Clicking "reveal" makes a separate, audit-logged
 * request that only super-admins are authorised to make, so a non-super-admin
 * simply never receives the number (rather than it being hidden with CSS).
 *
 * The revealed value is held in local state only and cleared on hide; it is
 * never written back into form state or cached by react-query.
 */
export function SensitiveValue({
  masked,
  entityType,
  field,
  entityId,
  canReveal,
  className,
}: {
  /** Server-provided masked string, e.g. "•••6789". */
  masked: string | null | undefined;
  /** Matches the backend REVEAL_SOURCES key, e.g. "employee" + "ssn_ein". */
  entityType: string;
  field: string;
  entityId: number | string | null | undefined;
  /** Whether to render the reveal control at all (super-admin only). */
  canReveal: boolean;
  className?: string;
}) {
  const { toast } = useToast();
  const [full, setFull] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const display = full ?? (masked || "Unspecified");
  const hasValue = Boolean(masked);

  const reveal = async () => {
    if (entityId === null || entityId === undefined) return;
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl("/api/sensitive/reveal"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, field, entityId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        // 403 here means the account isn't a super-admin — say so plainly
        // rather than showing a generic failure.
        throw new Error(
          res.status === 403
            ? "Only super-admins can view the full number."
            : json.error || json.message || "Failed to reveal value",
        );
      }
      if (!json.value) {
        toast({ title: "No value on record", description: "This field is empty." });
        return;
      }
      setFull(String(json.value));
    } catch (e: any) {
      toast({
        title: "Cannot reveal",
        description: e?.message || "Failed to reveal value",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      <span className="font-mono">{display}</span>
      {canReveal && hasValue && (
        <button
          type="button"
          onClick={() => (full ? setFull(null) : reveal())}
          disabled={loading}
          title={full ? "Hide full number" : "View full number (logged)"}
          aria-label={full ? "Hide full number" : "View full number"}
          className="text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : full ? (
            <EyeOff className="w-3.5 h-3.5" />
          ) : (
            <Eye className="w-3.5 h-3.5" />
          )}
        </button>
      )}
    </span>
  );
}
