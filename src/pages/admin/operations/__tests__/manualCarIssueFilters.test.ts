import { describe, expect, it } from "vitest";
import { operationVehicleMatches, type OperationsVehicle } from "@/lib/operationsFleet";
import { operationLocationMatches } from "../OperationLocationFilter";

// Shapes of the production rows Cathy saw on the Dashboard but not on
// Operations → Car Issues: manual issues with no trip, VIN only in car_name.
const fleet: OperationsVehicle[] = [
  { carId: 1158, carName: "2026 Land Rover Defender", plateNumber: "TEMP", vinNumber: "SALEJ7EX4T2614195", carStatus: "available" },
  { carId: 868, carName: "2022 Chevrolet Tahoe", plateNumber: "6U8ZL", vinNumber: "1GNSCMKDXNR153468", carStatus: "available" },
];
const landRover = { id: 17861, source: "manual", car_name: "Land Rover Defender - TEMP - SALEJ7EX4T2614195", plate: null };
const tahoe = { id: 17869, source: "manual", car_name: "Chevrolet Tahoe - 6U8ZL - 1GNSCMKDXNR153468", plate: "6U8ZL" };

describe("manual Car Issues on the Operations tabs", () => {
  it("are matched to an active vehicle once the server resolves car_id", () => {
    // Before: a TEMP plate and a VIN buried in car_name matched no vehicle.
    expect(operationVehicleMatches(landRover, fleet, "active")).toBe(false);
    expect(operationVehicleMatches({ ...landRover, car_id: 1158 }, fleet, "active")).toBe(true);
    expect(operationVehicleMatches({ ...tahoe, car_id: 868 }, fleet, "active")).toBe(true);
  });

  it("are placed in a location by the car's home location when there is no trip", () => {
    // Before: only car_name/plate were checked, which never say "SLC".
    expect(operationLocationMatches("slc", [tahoe.car_name, tahoe.plate])).toBe(false);
    expect(operationLocationMatches("slc", [tahoe.car_name, tahoe.plate, "slc"])).toBe(true);
    expect(operationLocationMatches("wilmington", [tahoe.car_name, tahoe.plate, "slc"])).toBe(false);
  });
});
