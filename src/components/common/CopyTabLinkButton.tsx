import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

/**
 * Copies a shareable link to the currently open tab.
 *
 * Why this exists: tabs on Forms / Car Block Off each have their own URL
 * (?section= / ?tab=), but a client viewing a tab had no way to get that URL
 * out of the address bar and into an email — the ask was for a visible control
 * that hands them the link for exactly the tab they're looking at.
 *
 * `search` is the query string for the tab (e.g. "?tab=car-on"); the origin and
 * pathname come from the current location so the link works on any environment.
 */
export default function CopyTabLinkButton({
  search,
  label,
  className,
}: {
  search: string;
  /** Tab name, used in the confirmation toast so it's clear WHICH link was copied. */
  label: string;
  className?: string;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const url = `${window.location.origin}${window.location.pathname}${search}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      // Revert the checkmark so the button doesn't read as permanently "done".
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link copied", description: `Opens "${label}" directly.` });
    } catch {
      // clipboard.writeText needs a secure context and permission; show the URL
      // so it can still be copied by hand rather than failing silently.
      toast({ title: `Copy this link to "${label}"`, description: url });
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className={className}
      title={`Copy a link that opens "${label}"`}
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 mr-1.5 text-green-600" />
      ) : (
        <Link2 className="w-3.5 h-3.5 mr-1.5" />
      )}
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}
