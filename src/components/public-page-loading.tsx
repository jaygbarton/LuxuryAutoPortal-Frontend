import { Loader2 } from "lucide-react";

const HOME_PATHS = ["/", "/choose-location", "/salt-lake-city", "/wilmington-nc"];

export function PublicPageLoading({ path }: { path: string }) {
  const isHome = HOME_PATHS.includes(path.replace(/\/+$/, "") || "/");
  return (
    <div data-public-loading className={`flex min-h-[100svh] items-center justify-center ${isHome ? "gla-home-loading text-[#D3BC8D]" : "bg-background text-primary"}`}>
      <Loader2 className="h-8 w-8 animate-spin" aria-label="Loading page" />
    </div>
  );
}
