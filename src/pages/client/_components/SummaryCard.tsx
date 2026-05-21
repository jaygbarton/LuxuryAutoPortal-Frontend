import React from "react";
import { CARD_BG_BLACK, CARD_BG_GOLD, CARD_BG_LIGHT, CARD_TEXT_DARK, CARD_TEXT_LIGHT } from "./constants";

interface SummaryCardProps {
  label: string;
  value: string;
  variant?: "black" | "light" | "gold";
  valueColor?: string;
  className?: string;
}

export function SummaryCard({ label, value, variant = "gold", valueColor, className = "" }: SummaryCardProps) {
  const bg       = variant === "black" ? CARD_BG_BLACK : variant === "gold" ? CARD_BG_GOLD : CARD_BG_LIGHT;
  const valueClr = valueColor ?? (variant === "black" ? CARD_TEXT_LIGHT : CARD_TEXT_DARK);
  const labelClr = variant === "black" ? CARD_TEXT_LIGHT : CARD_TEXT_DARK;
  return (
    <div
      style={{ backgroundColor: bg, minHeight: "72px" }}
      className={`flex flex-col items-center justify-center px-3 py-2 border border-[#d8d0b8] rounded-lg ${className}`}
    >
      <p className="text-lg font-extrabold leading-tight text-center" style={{ color: valueClr }}>{value}</p>
      {label && <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-center leading-tight" style={{ color: labelClr, opacity: 0.85 }}>{label}</p>}
    </div>
  );
}
