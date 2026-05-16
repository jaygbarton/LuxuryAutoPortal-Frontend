import { cn } from "@/lib/utils";

/** Props for the SummaryCard component */
interface SummaryCardProps {
  /** Small uppercase label at the top of the card */
  label: string;
  /** Large bold value displayed in the center */
  value: string;
  /** Optional small text below the value */
  subtitle?: string;
  /** Card color variant: gold bg with black text, dark bg with white/gold text, or white bg with black text */
  variant?: "gold" | "dark" | "white";
  /** Additional CSS classes */
  className?: string;
}

export function SummaryCard({
  label,
  value,
  subtitle,
  variant = "dark",
  className,
}: SummaryCardProps) {
  return (
    <div
      className={cn(
        "rounded-md px-3 py-3 flex flex-col items-center justify-center text-center transition-shadow",
        variant === "gold"
          ? "bg-[#FFCC00]"
          : variant === "white"
            ? "bg-[#e5e5e5]"
            : "bg-[#111111]",
        className,
      )}
    >
      <p
        className={cn(
          "text-xl font-bold leading-tight",
          variant === "dark" ? "text-[#FFCC00]" : "text-black",
        )}
      >
        {value}
      </p>
      <p
        className={cn(
          "mt-1 text-[10px] font-semibold uppercase tracking-wide leading-tight",
          variant === "dark" ? "text-white" : "text-black/70",
        )}
      >
        {label}
      </p>
      {subtitle && (
        <p
          className={cn(
            "mt-1 line-clamp-2 text-xs",
            variant === "dark" ? "text-white/50" : "text-black/50",
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
