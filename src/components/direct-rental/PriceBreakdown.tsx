import { money, type Quote } from "@/lib/directRental";

/** Every line of a trip's price, the trip total, the deposit and what is due at booking. */
export function PriceBreakdown({ quote, paidCents }: { quote: Quote; paidCents?: number }) {
  return (
    <dl className="space-y-2 text-sm" data-price-breakdown>
      {quote.lines.map(line => (
        <div key={line.code} className="flex items-baseline justify-between gap-4">
          <dt className="text-[#4A4438]">{line.label}{line.detail && <span className="ml-1.5 text-xs text-[#8A8275]">{line.detail}</span>}</dt>
          <dd className={`tabular-nums ${line.amountCents < 0 ? "text-[#2F6B3A]" : ""}`}>{line.amountCents < 0 ? `−${money(-line.amountCents)}` : money(line.amountCents)}</dd>
        </div>
      ))}
      <div className="flex items-baseline justify-between gap-4 border-t border-[#E8E1D5] pt-3 text-base font-semibold"><dt>Trip total</dt><dd className="tabular-nums">{money(quote.tripTotalCents)}</dd></div>
      <div className="flex items-baseline justify-between gap-4"><dt className="text-[#4A4438]">Security deposit <span className="text-xs text-[#8A8275]">returned 10 to 21 days after return</span></dt><dd className="tabular-nums">{money(quote.depositCents)}</dd></div>
      <div className="flex items-baseline justify-between gap-4 rounded-lg bg-[#F7F2E6] px-3 py-2.5 font-semibold">
        <dt>{paidCents ? "Paid" : "Due at booking"}</dt><dd className="tabular-nums">{money(paidCents || quote.dueNowCents)}</dd>
      </div>
    </dl>
  );
}
