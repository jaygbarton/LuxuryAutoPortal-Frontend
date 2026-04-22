import { cn } from "@/lib/utils";

/** Props for the SectionHeader component */
interface SectionHeaderProps {
  /** Section title displayed in bold uppercase */
  title: string;
  /** Optional subtitle displayed below the title */
  subtitle?: string;
  /** Variant: "bar" renders a black bar with white text (default); "plain" renders plain bold black text */
  variant?: "bar" | "plain";
  /** Additional CSS classes */
  className?: string;
}

export function SectionHeader({ title, subtitle, variant = "plain", className }: SectionHeaderProps) {
  if (variant === "bar") {
    return (
      <div className={cn("bg-black px-4 py-3", className)}>
        <h2 className="text-lg font-bold uppercase tracking-wide text-white">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-sm text-[#d3bc8d]">{subtitle}</p>
        )}
        <div className="mt-2 h-[2px] w-full bg-[#d3bc8d]" />
      </div>
    );
  }

  return (
    <div className={cn("mb-4", className)}>
      <h2 className="text-xl font-bold uppercase tracking-wide text-black">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-1 text-sm text-gray-600">{subtitle}</p>
      )}
    </div>
  );
}
