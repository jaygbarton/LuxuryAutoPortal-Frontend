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
        "rounded-md px-3 py-2 transition-shadow",
        variant === "gold"
          ? "bg-[#FFD700] text-black"
          : variant === "white"
            ? "bg-white text-black border border-gray-200"
            : "bg-[#111111] text-white",
        className,
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80 leading-tight">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-lg font-bold leading-tight",
          variant === "dark" ? "text-[#FFD700]" : "text-black",
        )}
      >
        {value}
      </p>
      {subtitle && (
        <p className="mt-1 line-clamp-2 text-xs opacity-70">{subtitle}</p>
      )}
    </div>
  );
}
