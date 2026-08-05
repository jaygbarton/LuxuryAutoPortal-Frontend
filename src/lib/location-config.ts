export type PublicLocationId = "hub" | "slc" | "wilmington" | "myrtle";

export type PublicLocation = {
  id: PublicLocationId;
  name: string;
  shortName: string;
  cityState: string;
  path: string;
  fleetPath: string;
  fleetSlugs: string[];
  locationTag: string;
  turoFleetUrl: string;
  comingSoon?: boolean;
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
    locationTag: "slc",
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
    locationTag: "wilmington",
    turoFleetUrl: "https://turo.com/us/en/drivers/4325673/vehicles",
    availablePages: {
      detailShop: false,
      deals: false,
      jobs: false,
      suggestedCars: false,
    },
  },
  myrtle: {
    id: "myrtle",
    name: "Myrtle Beach",
    shortName: "Myrtle Beach",
    cityState: "Myrtle Beach, NC",
    path: "/myrtle-beach-nc",
    fleetPath: "/myrtle-beach-nc/fleet",
    fleetSlugs: ["myrtle-beach-nc", "myrtle-beach-sc"],
    locationTag: "myrtle",
    turoFleetUrl: "https://turo.com/us/en/drivers/4325673/vehicles",
    comingSoon: true,
    availablePages: {
      detailShop: false,
      deals: false,
      jobs: false,
      suggestedCars: false,
    },
  },
};

export function getPublicLocationFromPath(pathname: string): PublicLocation | null {
  if (pathname.startsWith(PUBLIC_LOCATIONS.myrtle.path)) return PUBLIC_LOCATIONS.myrtle;
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

export function fleetCarBelongsToLocation(
  turoLink: string | null | undefined,
  location: PublicLocation | null,
  locationTag?: string | null,
): boolean {
  if (!location) return true;
  if (locationTag && locationTag.toLowerCase() === location.locationTag) return true;
  const link = (turoLink ?? "").toLowerCase();
  return location.fleetSlugs.some((slug) => link.includes(`/united-states/${slug}/`));
}
