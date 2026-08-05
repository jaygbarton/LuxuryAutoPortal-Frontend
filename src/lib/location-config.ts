export type PublicLocationId = "hub" | "slc" | "wilmington";

export type PublicLocation = {
  id: PublicLocationId;
  name: string;
  shortName: string;
  cityState: string;
  path: string;
  fleetPath: string;
  fleetSlugs: string[];
  turoFleetUrl: string;
  availablePages: {
    detailShop: boolean;
    deals: boolean;
    jobs: boolean;
    suggestedCars: boolean;
  };
};

export const PUBLIC_LOCATIONS: Record<Exclude<PublicLocationId, "hub">, PublicLocation> = {
  slc: {
    id: "slc",
    name: "Salt Lake City",
    shortName: "SLC",
    cityState: "Salt Lake City, UT",
    path: "/salt-lake-city",
    fleetPath: "/salt-lake-city/fleet",
    fleetSlugs: ["salt-lake-city-ut"],
    turoFleetUrl: "https://turo.com/us/en/drivers/4325673/vehicles",
    availablePages: {
      detailShop: true,
      deals: true,
      jobs: true,
      suggestedCars: true,
    },
  },
  wilmington: {
    id: "wilmington",
    name: "Wilmington",
    shortName: "Wilmington",
    cityState: "Wilmington, NC",
    path: "/wilmington-nc",
    fleetPath: "/wilmington-nc/fleet",
    fleetSlugs: ["leland-nc", "wilmington-nc"],
    turoFleetUrl: "https://turo.com/us/en/drivers/4325673/vehicles",
    availablePages: {
      detailShop: false,
      deals: false,
      jobs: false,
      suggestedCars: false,
    },
  },
};

export function getPublicLocationFromPath(pathname: string): PublicLocation | null {
  if (pathname.startsWith(PUBLIC_LOCATIONS.wilmington.path)) return PUBLIC_LOCATIONS.wilmington;
  if (pathname.startsWith(PUBLIC_LOCATIONS.slc.path)) return PUBLIC_LOCATIONS.slc;
  return null;
}

export function withLocationPath(href: string, location: PublicLocation | null): string {
  if (!location || href.startsWith("http") || href.startsWith("#")) return href;
  if (href === "/") return location.path;
  if (href.startsWith(location.path)) return href;
  return `${location.path}${href}`;
}

export function fleetCarBelongsToLocation(turoLink: string | null | undefined, location: PublicLocation | null): boolean {
  if (!location) return true;
  const link = (turoLink ?? "").toLowerCase();
  return location.fleetSlugs.some((slug) => link.includes(`/united-states/${slug}/`));
}
