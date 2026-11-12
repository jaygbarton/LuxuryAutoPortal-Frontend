import { Redirect, useLocation } from "wouter";
import { getPublicLocationFromPath, PUBLIC_LOCATIONS } from "@/lib/location-config";

// Compatibility only: one owner page remains at the original funnel URL.
export default function ListYourCarRedirect() {
  const [path] = useLocation();
  const location = getPublicLocationFromPath(path) ?? PUBLIC_LOCATIONS.slc;
  return <Redirect to={`${location.path}/onboarding${window.location.search}${window.location.hash}`} />;
}
