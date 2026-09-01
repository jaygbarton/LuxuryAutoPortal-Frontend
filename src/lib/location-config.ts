export type PublicLocationId = "hub" | "slc" | "wilmington" | "myrtle" | "charleston";

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
    chauffeur: boolean;
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
      chauffeur: true,
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
      chauffeur: false,
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
    cityState: "Myrtle Beach, SC",
    path: "/myrtle-beach-sc",
    fleetPath: "/myrtle-beach-sc/fleet",
    fleetSlugs: ["myrtle-beach-sc"],
    locationTag: "myrtle",
    turoFleetUrl: "https://turo.com/us/en/drivers/4325673/vehicles",
    comingSoon: true,
    availablePages: {
      chauffeur: false,
      detailShop: false,
      deals: false,
      jobs: false,
      suggestedCars: false,
    },
  },
  charleston: {
    id: "charleston",
    name: "Charleston",
    shortName: "Charleston",
    cityState: "Charleston, SC",
    path: "/charleston-sc",
    fleetPath: "/charleston-sc/fleet",
    fleetSlugs: ["charleston-sc"],
    locationTag: "charleston",
    turoFleetUrl: "https://turo.com/us/en/drivers/4325673/vehicles",
    comingSoon: true,
    availablePages: {
      chauffeur: false,
      detailShop: false,
      deals: false,
      jobs: false,
      suggestedCars: false,
    },
  },
};

const SELECTED_PUBLIC_LOCATION_KEY = "gla:selected-public-location";

export function getPublicLocationFromPath(pathname: string): PublicLocation | null {
  if (pathname.startsWith(PUBLIC_LOCATIONS.charleston.path)) return PUBLIC_LOCATIONS.charleston;
  if (pathname.startsWith(PUBLIC_LOCATIONS.myrtle.path)) return PUBLIC_LOCATIONS.myrtle;
  if (pathname.startsWith(PUBLIC_LOCATIONS.wilmington.path)) return PUBLIC_LOCATIONS.wilmington;
  if (pathname.startsWith(PUBLIC_LOCATIONS.slc.path)) return PUBLIC_LOCATIONS.slc;
  return null;
}

export function getSavedPublicLocation(): PublicLocation | null {
  if (typeof window === "undefined") return null;
  const id = window.localStorage.getItem(SELECTED_PUBLIC_LOCATION_KEY) as Exclude<PublicLocationId, "hub"> | null;
  return id && id in PUBLIC_LOCATIONS ? PUBLIC_LOCATIONS[id] : null;
}

export function rememberPublicLocationFromPath(pathname: string): void {
  if (typeof window === "undefined") return;
  const location = getPublicLocationFromPath(pathname);
  if (location) window.localStorage.setItem(SELECTED_PUBLIC_LOCATION_KEY, location.id);
}

export function getPreferredPublicLocation(pathname: string): PublicLocation | null {
  if (pathname === "/choose-location") return null;
  return getPublicLocationFromPath(pathname) ?? getSavedPublicLocation() ?? PUBLIC_LOCATIONS.slc;
}

export function withLocationPath(href: string, location: PublicLocation | null): string {
  if (!location || href.startsWith("http") || href.startsWith("#")) return href;
  if (href === "/") return location.path;
  if (href.startsWith(location.path)) return href;
  return `${location.path}${href}`;
}

export function withPreferredLocationPath(href: string, pathname: string): string {
  return withLocationPath(href, getPreferredPublicLocation(pathname));
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
