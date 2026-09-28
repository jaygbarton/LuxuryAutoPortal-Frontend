import { useEffect, useState } from "react";
import { buildApiUrl } from "@/lib/queryClient";
import { Image } from "lucide-react";

interface EmployeeDocumentImageProps {
  /** Google Drive file ID or value from employee_photo / employee_driver_license_photo / employee_car_insurance */
  value: string | null | undefined;
  alt: string;
  className?: string;
  /** Size of the placeholder icon shown when there is no image (default h-12 w-12). */
  iconClassName?: string;
}

function extractFileIdOrUrl(value: string | null | undefined): string | null {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();
  if (trimmed.startsWith("http")) return trimmed;
  try {
    const parsed = JSON.parse(trimmed);
    const arr = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
    const first = arr[0];
    if (first?.url) return first.url;
    if (typeof first?.id === "string") return first.id;
  } catch {
    // Not JSON
  }
  if (trimmed.length > 10 && !trimmed.includes("/")) return trimmed;
  return null;
}

/**
 * Renders an image from employee document (Drive file ID or URL).
 * For Drive file IDs, fetches via backend proxy with credentials.
 */
export function EmployeeDocumentImage({ value, alt, className, iconClassName }: EmployeeDocumentImageProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const fileIdOrUrl = extractFileIdOrUrl(value);

  useEffect(() => {
    if (!fileIdOrUrl) {
      setSrc(null);
      setError(false);
      return;
    }
    if (fileIdOrUrl.startsWith("http")) {
      setSrc(fileIdOrUrl);
      setError(false);
      return;
    }
    const url = buildApiUrl(`/api/employees/drive-file?fileId=${encodeURIComponent(fileIdOrUrl)}`);
    let cancelled = false;
    fetch(url, { credentials: "include" })
      .then((res) => {
        if (cancelled) return null;
        if (!res.ok) throw new Error("Failed to load");
        return res.blob();
      })
      .then((blob) => {
        if (cancelled || !blob) return;
        setSrc(URL.createObjectURL(blob));
        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
      setSrc((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [fileIdOrUrl]);

  if (error || !src) {
    return (
      <div
        className={`flex items-center justify-center bg-background border border-border rounded-md ${className || ""}`}
      >
        <Image className={`${iconClassName || "h-12 w-12"} text-muted-foreground`} />
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} />;
}
