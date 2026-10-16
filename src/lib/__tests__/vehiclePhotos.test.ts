import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/queryClient", () => ({
  buildApiUrl: (path: string) => path,
  getProxiedImageUrl: (url: string) => url.startsWith("https://storage.googleapis.com/")
    ? `/api/gcs-image-proxy?url=${encodeURIComponent(url)}` : url,
}));
import { vehiclePhotoSources } from "../vehiclePhotos";

describe("saved vehicle photos", () => {
  it("reads the JSON photo list and uses the existing storage and Drive proxies in saved order", () => {
    const url = "https://storage.googleapis.com/fleet/first.jpg";
    expect(vehiclePhotoSources(JSON.stringify([{ url }, { id: "legacy Drive id" }, { path: "/car-photos/last.jpg" }]), 800)).toEqual([
      `/api/gcs-image-proxy?url=${encodeURIComponent(url)}&size=800`,
      "/api/employees/drive-file?fileId=legacy%20Drive%20id", "/car-photos/last.jpg",
    ]);
  });
  it.each(["/car-photos/car.jpg", JSON.stringify("/car-photos/car.jpg"), JSON.stringify({ path: "/car-photos/car.jpg" }), JSON.stringify(["/car-photos/car.jpg"])])("supports old plain and JSON photo formats: %s", raw => {
    expect(vehiclePhotoSources(raw)).toEqual(["/car-photos/car.jpg"]);
  });
  it("skips empty entries and duplicate URLs without inventing a photo", () => {
    expect(vehiclePhotoSources(JSON.stringify([null, {}, "", { url: " ", path: "/car.jpg" }, "/car.jpg"]))).toEqual(["/car.jpg"]);
    for (const raw of [null, "", "[]", "null", "[broken", "{broken"]) expect(vehiclePhotoSources(raw)).toEqual([]);
  });
});
