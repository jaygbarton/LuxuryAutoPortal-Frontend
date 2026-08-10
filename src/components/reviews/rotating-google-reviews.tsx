import { useEffect, useState } from "react";
import { Star } from "lucide-react";

const recentGoogleReviews = [
  {
    name: "Sinthia Kabir",
    date: "15/08/2025",
    quote:
      "I had a great experience with their service. They have clear instructions. I had no issues finding the car. They dropped the car within very short notice which was really helpful. The car was clean and smelled great. I will definitely book with them again.",
  },
  {
    name: "Melissa Rose Stoltzfus",
    date: "08/08/2025",
    quote: "Great experience, will use them again when in the area.",
  },
  {
    name: "Faatupuinati Muliumu",
    date: "22/08/2025",
    quote:
      "First class service, highly recommended. The service was impeccable. I had a last minute trip to Salt Lake City for a family event and Jay and his team went above and beyond.",
  },
  {
    name: "Tony LoPresto",
    date: "15/08/2025",
    quote: "We had a great experience renting in Salt Lake City. It could not have been an easier experience. 5 stars.",
  },
];

type RotatingGoogleReviewsProps = {
  className?: string;
  surface?: "dark" | "light";
};

export function RotatingGoogleReviews({ className = "", surface = "dark" }: RotatingGoogleReviewsProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeReview = recentGoogleReviews[activeIndex];
  const isDark = surface === "dark";
  const quoteSize =
    activeReview.quote.length > 190
      ? "text-sm leading-6 sm:text-base sm:leading-7"
      : activeReview.quote.length > 110
        ? "text-base leading-7 sm:text-lg sm:leading-8"
        : "text-lg leading-8 sm:text-xl sm:leading-9";

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % recentGoogleReviews.length);
    }, 5200);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className={`overflow-hidden ${isDark ? "bg-[#050505] text-white" : "bg-background text-foreground"} ${className}`}>
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[3px]" style={{ color: "#E8B830" }}>
              Recent Google Reviews
            </p>
            <h2 className="font-serif text-3xl font-bold sm:text-4xl">What guests say after the trip</h2>
          </div>
          <div className="flex gap-2">
            {recentGoogleReviews.map((item, index) => (
              <button
                key={item.name}
                aria-label={`Show Google review from ${item.name}`}
                onClick={() => setActiveIndex(index)}
                className="h-2.5 w-8 rounded-full transition-all"
                style={{
                  background: index === activeIndex ? "#D4A017" : isDark ? "rgba(255,255,255,0.24)" : "rgba(28,28,28,0.18)",
                }}
              />
            ))}
          </div>
        </div>

        <article
          className="rounded-[6px] border p-6 shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl transition-all duration-500 sm:p-8 lg:p-10"
          style={{
            borderColor: isDark ? "rgba(255,255,255,0.28)" : "rgba(212,160,23,0.28)",
            background: isDark
              ? "linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.05))"
              : "linear-gradient(135deg, rgba(255,255,255,0.82), rgba(255,255,255,0.58))",
          }}
        >
          <div className="mb-5 flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, starIndex) => (
              <Star key={starIndex} className="h-5 w-5 fill-[#D4A017] text-[#D4A017]" />
            ))}
          </div>
          <p className={`max-w-5xl ${quoteSize} ${isDark ? "text-white/88" : "text-foreground/82"}`}>
            "{activeReview.quote}"
          </p>
          <div className={`mt-5 flex flex-wrap items-center gap-3 text-sm ${isDark ? "text-white/62" : "text-muted-foreground"}`}>
            <span className={isDark ? "font-bold text-white" : "font-bold text-foreground"}>{activeReview.name}</span>
            <span className="h-1 w-1 rounded-full bg-[#D4A017]" />
            <span>{activeReview.date}</span>
            <span className="h-1 w-1 rounded-full bg-[#D4A017]" />
            <span>Google review</span>
          </div>
        </article>
      </div>
    </section>
  );
}
