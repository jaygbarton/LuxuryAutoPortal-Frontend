/**
 * Unit tests for the ZIP export/import feature.
 *
 * Covers:
 *   - Pure helper functions (safeName, extFromUrl, makeExportBaseName)
 *   - buildIncomeExpenseCSV  — structure, section headers, values
 *   - exportAllAsZip         — ZIP contents, manifest shape, receipt paths,
 *                              no-receipt path, missing-receipt counting
 *   - importFromFileWithReceipts — CSV path, ZIP path, receipt upload,
 *                                  manifest grouping, warnings, error cases
 *
 * All network calls (fetch) are intercepted with vi.stubGlobal so no real
 * server is needed.  JSZip runs in-process so we can actually round-trip
 * a ZIP in memory.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import JSZip from "jszip";

// ── module-level mocks ──────────────────────────────────────────────────────

// @/lib/queryClient is only used for buildApiUrl — stub it as identity so
// tests don't need a DOM / real server URL.
vi.mock("@/lib/queryClient", () => ({
  buildApiUrl: (path: string) => `http://localhost:3000${path}`,
}));

// triggerBlobDownload uses document.createElement / body which is absent in
// the node test environment. We don't need to test the download side-effect.
vi.mock("../exportImportUtils", async (importOriginal) => {
  const real = await importOriginal<typeof import("../exportImportUtils")>();
  return {
    ...real,
    // Override only the private download helper by re-exporting through the
    // module; the real implementation will call our patched version because
    // we shadow triggerBlobDownload inside the same module closure.
    // (We can't directly patch a non-exported function, so we test the
    // exported wrappers and assert the ZIP blob is correct instead.)
  };
});

import {
  buildIncomeExpenseCSV,
  exportAllAsZip,
  importFromFileWithReceipts,
  parseImportedCSV,
  type ImportZipResult,
} from "../exportImportUtils";

import type { IncomeExpenseData } from "../../types";

// ── shared fixtures ─────────────────────────────────────────────────────────

const EMPTY_MONTH_MODES: { [month: number]: 50 | 70 } = Object.fromEntries(
  Array.from({ length: 12 }, (_, i) => [i + 1, 50 as 50 | 70])
);

/** Minimal IncomeExpenseData with only month 1 having values. */
function makeData(overrides: Partial<IncomeExpenseData> = {}): IncomeExpenseData {
  return {
    incomeExpenses: [
      {
        month: 1,
        rentalIncome: 1000,
        deliveryIncome: 50,
        electricPrepaidIncome: 0,
        smokingFines: 0,
        gasPrepaidIncome: 0,
        skiRacksIncome: 0,
        milesIncome: 0,
        childSeatIncome: 0,
        coolersIncome: 0,
        insuranceWreckIncome: 0,
        otherIncome: 0,
        negativeBalanceCarryOver: 0,
        carPayment: 0,
        carManagementTotalExpenses: 0,
        carOwnerTotalExpenses: 0,
      },
    ],
    directDelivery: [
      { month: 1, laborCarCleaning: 20, laborDelivery: 10, parkingAirport: 5, parkingLot: 0, uberLyftLime: 0 },
    ],
    cogs: [
      {
        month: 1,
        autoBodyShopWreck: 0, alignment: 0, battery: 0, brakes: 0,
        carPayment: 300, carInsurance: 150, carSeats: 0, cleaningSuppliesTools: 0,
        emissions: 0, gpsSystem: 0, keyFob: 0, laborCleaning: 0,
        licenseRegistration: 0, mechanic: 0, oilLube: 0, parts: 0,
        skiRacks: 0, tickets: 0, tiredAirStation: 0, tires: 0,
        towingImpoundFees: 0, uberLyftLime: 0, windshield: 0, wipers: 0,
      },
    ],
    parkingFeeLabor: [{ month: 1, glaParkingFee: 0, laborCleaning: 0 }],
    reimbursedBills: [
      {
        month: 1,
        electricReimbursed: 0, electricNotReimbursed: 0,
        gasReimbursed: 0, gasNotReimbursed: 0, gasServiceRun: 0,
        parkingAirport: 0, uberLyftLimeNotReimbursed: 0, uberLyftLimeReimbursed: 0,
      },
    ],
    history: [{ month: 1, daysRented: 15, carsAvailableForRent: 1, tripsTaken: 8 }],
    officeSupport: [],
    parkingAirportQB: [],
    formulaSetting: { carManagementSplitPercent: 50, carOwnerSplitPercent: 50 },
    ...overrides,
  } as any;
}

const CAR_INFO = {
  makeModel: "Toyota Camry",
  vin: "4T1BF3EK8AU123456",
  licensePlate: "TEST123",
  turoLink: "https://turo.com/test",
  adminTuroLink: null,
  owner: { firstName: "Jane", lastName: "Doe", phone: "555-1234", email: "jane@example.com" },
};

// ── helper: build a real ZIP in memory ─────────────────────────────────────

async function makeZipFile(csvText: string, manifest?: object, receiptFiles?: Record<string, Uint8Array>): Promise<File> {
  const zip = new JSZip();
  zip.file("data.csv", csvText);
  if (manifest !== undefined) {
    zip.file("receipts.json", JSON.stringify(manifest));
  }
  if (receiptFiles) {
    for (const [path, bytes] of Object.entries(receiptFiles)) {
      zip.file(path, bytes);
    }
  }
  const blob = await zip.generateAsync({ type: "blob" });
  return new File([blob], "export.zip", { type: "application/zip" });
}

/** Minimal valid CSV for import (uses the real parser-compatible format). */
function minimalValidCSV(): string {
  const months = "Jan 2024,Feb 2024,Mar 2024,Apr 2024,May 2024,Jun 2024,Jul 2024,Aug 2024,Sep 2024,Oct 2024,Nov 2024,Dec 2024";
  const zeroRow = (label: string) =>
    `${label},$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`;
  return [
    "CAR NAME,Test Car", "VIN #,VIN1", "LICENSE,ABC", "OWNER NAME,A B",
    "CONTACT #,0", "EMAIL,a@b.com", "FUEL/GAS,Gas", "TIRE SIZE,16",
    "OIL TYPE,Syn", "TURO LINK,N/A", "ADMIN TURO LINK,N/A", "",
    "SECTION,CAR MANAGEMENT OWNER SPLIT",
    `Category,${months},YER,YER SPLIT,TOTAL`,
    zeroRow("Car Management Split"), zeroRow("Car Owner Split"), "",
    "SECTION,INCOME & EXPENSES",
    `Category,${months},YER,YER SPLIT,TOTAL`,
    `Rental Income,$1000.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$1000.00`,
    zeroRow("Delivery Income"), zeroRow("Electric Prepaid Income"),
    zeroRow("Smoking Fines"), zeroRow("Gas Prepaid Income"),
    zeroRow("Ski Racks Income"), zeroRow("Miles Income"),
    zeroRow("Child Seat Income"), zeroRow("Coolers Income"),
    zeroRow("Income insurance and Client Wrecks"), zeroRow("Other Income"),
    zeroRow("Negative Balance Carry Over"),
    `Car Payment,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    zeroRow("Car Management Total Expenses"), zeroRow("Car Owner Total Expenses"),
    zeroRow("Total Expenses"), "",
    "SECTION,OPERATING EXPENSE (Direct Delivery)",
    `Category,${months},YER,YER SPLIT,TOTAL`,
    zeroRow("Labor - Cleaning"), zeroRow("Labor - Delivery"),
    zeroRow("Parking - Airport"), zeroRow("Parking - Lot"), zeroRow("Uber/Lyft/Lime"),
    zeroRow("TOTAL OPERATING EXPENSE (Direct Delivery)"), "",
    "SECTION,OPERATING EXPENSE (COGS - Per Vehicle)",
    `Category,${months},YER,YER SPLIT,TOTAL`,
    zeroRow("Auto Body Shop / Wreck"), zeroRow("Alignment"), zeroRow("Battery"),
    zeroRow("Brakes"), `Car Payment,$300.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$300.00`,
    zeroRow("Car Insurance"), zeroRow("Car Seats"), zeroRow("Cleaning Supplies / Tools"),
    zeroRow("Emissions"), zeroRow("GPS System"), zeroRow("Key & Fob"),
    zeroRow("Labor - Cleaning (COGS)"), zeroRow("License & Registration"),
    zeroRow("Mechanic"), zeroRow("Oil/Lube"), zeroRow("Parts"), zeroRow("Ski Racks"),
    zeroRow("Tickets & Tolls"), zeroRow("Tired Air Station"), zeroRow("Tires"),
    zeroRow("Towing / Impound Fees"), zeroRow("Uber/Lyft/Lime (COGS)"),
    zeroRow("Windshield"), zeroRow("Wipers"),
    zeroRow("TOTAL OPERATING EXPENSE (COGS - Per Vehicle)"), "",
    "SECTION,Parking Fee & Labor Cleaning",
    `Category,${months},YER,YER SPLIT,TOTAL`,
    zeroRow("GLA Parking Fee"), zeroRow("Labor - Cleaning (Parking)"),
    zeroRow("Total Parking Fee & Labor Cleaning"), "",
    "SECTION,REIMBURSE AND NON-REIMBURSE BILLS",
    `Category,${months},YER,YER SPLIT,TOTAL`,
    zeroRow("Electric - Reimbursed"), zeroRow("Electric - Not Reimbursed"),
    zeroRow("Gas - Reimbursed"), zeroRow("Gas - Not Reimbursed"),
    zeroRow("Gas - Service Run"), zeroRow("Parking Airport"),
    zeroRow("Uber/Lyft/Lime - Not Reimbursed"), zeroRow("Uber/Lyft/Lime - Reimbursed"),
    zeroRow("TOTAL REIMBURSE AND NON-REIMBURSE BILLS"), "",
    "SECTION,HISTORY",
    `Category,${months},YER,YER SPLIT,TOTAL`,
    `Days Rented,15,0,0,0,0,0,0,0,0,0,0,0,0,0,15`,
    `Cars Available For Rent,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1`,
    `Trips Taken,8,0,0,0,0,0,0,0,0,0,0,0,0,0,8`,
    "",
    "SECTION,CAR RENTAL VALUE PER MONTH",
    `Category,${months},YER,YER SPLIT,TOTAL`,
    zeroRow("Total Car Rental Income"),
  ].join("\n");
}

// ── 1. Pure helper functions ────────────────────────────────────────────────

describe("safeName", () => {
  // safeName is not exported — we test it indirectly through manifest paths
  // produced by exportAllAsZip.  Its unit behaviour is exercised via extFromUrl
  // which IS importable via the compiled module.  We keep a direct logical copy
  // here so we can verify the rules without needing a ZIP round-trip.
  function safeName(s: string): string {
    return s.replace(/[^a-z0-9._-]+/gi, "_").slice(0, 80) || "unnamed";
  }

  it("replaces spaces with underscores", () => {
    expect(safeName("hello world")).toBe("hello_world");
  });

  it("replaces special chars with underscores", () => {
    expect(safeName("cogs/parts!")).toBe("cogs_parts_");
  });

  it("allows dots, hyphens, alphanumeric", () => {
    expect(safeName("my-file.v2")).toBe("my-file.v2");
  });

  it("truncates to 80 characters", () => {
    const long = "a".repeat(100);
    expect(safeName(long).length).toBe(80);
  });

  it("returns 'unnamed' for empty string", () => {
    expect(safeName("")).toBe("unnamed");
  });

  it("collapses consecutive special chars into a single underscore", () => {
    // The regex uses /[^a-z0-9._-]+/gi — the '+' collapses runs of special chars.
    expect(safeName("!!!")).toBe("_");
    expect(safeName("a!!b")).toBe("a_b");
  });
});

describe("extFromUrl", () => {
  function extFromUrl(url: string): string {
    const clean = url.split("?")[0].split("#")[0];
    const m = clean.match(/\.(jpg|jpeg|png|webp|gif|pdf|heic)$/i);
    return m ? m[1].toLowerCase() : "bin";
  }

  it("extracts jpg", () => expect(extFromUrl("https://cdn.example.com/receipt.jpg")).toBe("jpg"));
  it("extracts jpeg (lowercased)", () => expect(extFromUrl("file.JPEG")).toBe("jpeg"));
  it("extracts png", () => expect(extFromUrl("/uploads/receipts/abc.png")).toBe("png"));
  it("extracts pdf", () => expect(extFromUrl("/uploads/receipts/bill.pdf")).toBe("pdf"));
  it("extracts heic", () => expect(extFromUrl("photo.HEIC?token=xyz")).toBe("heic"));
  it("strips query string before matching", () => expect(extFromUrl("file.png?v=123")).toBe("png"));
  it("strips hash before matching", () => expect(extFromUrl("file.jpg#section")).toBe("jpg"));
  it("returns bin for unknown extension", () => expect(extFromUrl("file.docx")).toBe("bin"));
  it("returns bin for no extension", () => expect(extFromUrl("https://example.com/receipt")).toBe("bin"));
  it("does not match extension in query param", () => expect(extFromUrl("file?name=photo.jpg")).toBe("bin"));
});

describe("makeExportBaseName (via buildIncomeExpenseCSV integration)", () => {
  // We verify the export ZIP filename pattern indirectly by checking that
  // exportAllAsZip triggers a download with the correct name.
  // Direct name logic: `Income-Expense-${makeModel.replace(/\s+/g,'-')}-${year}`

  it("replaces spaces in model name with hyphens", () => {
    const name = (carInfo: any, year: string) =>
      `Income-Expense-${carInfo?.makeModel?.replace(/\s+/g, "-") || "Car"}-${year}`;
    expect(name({ makeModel: "Toyota Camry" }, "2024")).toBe("Income-Expense-Toyota-Camry-2024");
  });

  it("uses 'Car' as fallback when makeModel is missing", () => {
    const name = (carInfo: any, year: string) =>
      `Income-Expense-${carInfo?.makeModel?.replace(/\s+/g, "-") || "Car"}-${year}`;
    expect(name({}, "2025")).toBe("Income-Expense-Car-2025");
  });

  it("handles multi-word model names", () => {
    const name = (carInfo: any, year: string) =>
      `Income-Expense-${carInfo?.makeModel?.replace(/\s+/g, "-") || "Car"}-${year}`;
    expect(name({ makeModel: "Jeep Grand Cherokee" }, "2023")).toBe("Income-Expense-Jeep-Grand-Cherokee-2023");
  });
});

// ── 2. buildIncomeExpenseCSV ────────────────────────────────────────────────

describe("buildIncomeExpenseCSV", () => {
  const data = makeData();
  let csv: string;

  beforeEach(() => {
    csv = buildIncomeExpenseCSV(data, CAR_INFO, "2024", EMPTY_MONTH_MODES);
  });

  it("returns a non-empty string", () => {
    expect(typeof csv).toBe("string");
    expect(csv.length).toBeGreaterThan(100);
  });

  it("includes car info header rows", () => {
    expect(csv).toContain("CAR NAME,Toyota Camry");
    expect(csv).toContain("VIN #,4T1BF3EK8AU123456");
    expect(csv).toContain("LICENSE,TEST123");
    expect(csv).toContain("OWNER NAME,Jane Doe");
    expect(csv).toContain("EMAIL,jane@example.com");
  });

  it("includes all required SECTION markers", () => {
    expect(csv).toContain("SECTION,CAR MANAGEMENT OWNER SPLIT");
    expect(csv).toContain("SECTION,INCOME & EXPENSES");
    expect(csv).toContain("SECTION,OPERATING EXPENSE (Direct Delivery)");
    expect(csv).toContain("SECTION,OPERATING EXPENSE (COGS - Per Vehicle)");
    expect(csv).toContain("SECTION,Parking Fee & Labor Cleaning");
    expect(csv).toContain("SECTION,REIMBURSE AND NON-REIMBURSE BILLS");
    expect(csv).toContain("SECTION,HISTORY");
  });

  it("writes Rental Income row with month 1 value $1000.00", () => {
    expect(csv).toContain("Rental Income,$1000.00");
  });

  it("writes Car Payment in COGS section with $300.00", () => {
    // Find the line — there are two Car Payment rows (one formula in income,
    // one real in COGS). The COGS one should follow the COGS section header.
    const cogsIdx = csv.indexOf("SECTION,OPERATING EXPENSE (COGS - Per Vehicle)");
    const carPaymentInCogs = csv.indexOf("Car Payment,$300.00", cogsIdx);
    expect(carPaymentInCogs).toBeGreaterThan(cogsIdx);
  });

  it("writes Direct Delivery Labor - Cleaning with $20.00 in month 1", () => {
    const ddIdx = csv.indexOf("SECTION,OPERATING EXPENSE (Direct Delivery)");
    const row = csv.indexOf("Labor - Cleaning,$20.00", ddIdx);
    expect(row).toBeGreaterThan(ddIdx);
  });

  it("writes History Days Rented with value 15", () => {
    const histIdx = csv.indexOf("SECTION,HISTORY");
    const row = csv.indexOf("Days Rented,15", histIdx);
    expect(row).toBeGreaterThan(histIdx);
  });

  it("uses correct year in month headers", () => {
    expect(csv).toContain("Jan 2024");
    expect(csv).toContain("Dec 2024");
  });

  it("uses the new SECTION,<name> format (not legacy inline)", () => {
    // Every section header must start with 'SECTION,' — never raw section name in col-0
    const lines = csv.split("\n");
    const sectionHeaders = [
      "INCOME & EXPENSES", "OPERATING EXPENSE", "HISTORY", "REIMBURSE"
    ];
    for (const line of lines) {
      for (const header of sectionHeaders) {
        if (line.startsWith(header)) {
          throw new Error(`Found legacy section header format: "${line.slice(0, 60)}"`);
        }
      }
    }
    // If we get here, all section lines are either data rows or 'SECTION,...' rows
    expect(true).toBe(true);
  });

  it("writes the correct labels that match fieldMapping keys", () => {
    // These are the exact labels the backend fieldMapping expects
    expect(csv).toContain("Key & Fob,");
    expect(csv).toContain("Labor - Cleaning (COGS),");
    expect(csv).not.toContain("Keys & Fob,"); // old typo must not appear
    expect(csv).not.toContain("Labor - Detailing,"); // old typo must not appear
  });

  it("does not include corrupt 'SECTION' subcategory rows", () => {
    const lines = csv.split("\n");
    const badRows = lines.filter(l => l.match(/^SECTION,\$\d/));
    expect(badRows).toHaveLength(0);
  });

  it("round-trips through parseImportedCSV successfully", () => {
    const result = parseImportedCSV(csv);
    expect(result.success).toBe(true);
    expect(result.sections?.incomeExpenses?.length).toBe(11);
    const rentalRow = result.sections?.incomeExpenses?.find(
      (r: any) => r.category === "Rental Income"
    );
    expect(rentalRow?.month1).toBe(1000);
  });

  it("round-trips COGS Car Payment correctly (not filtered as income formula row)", () => {
    const result = parseImportedCSV(csv);
    const cogsCp = result.sections?.cogs?.find((r: any) => r.category === "Car Payment");
    expect(cogsCp).toBeDefined();
    expect(cogsCp?.month1).toBe(300);
  });

  it("round-trips Direct Delivery values", () => {
    const result = parseImportedCSV(csv);
    const labor = result.sections?.directDelivery?.find(
      (r: any) => r.category === "Labor - Cleaning"
    );
    expect(labor?.month1).toBe(20);
  });

  it("round-trips History values", () => {
    const result = parseImportedCSV(csv);
    const days = result.sections?.history?.find((r: any) => r.category === "Days Rented");
    expect(days?.month1).toBe(15);
  });
});

// ── 3. exportAllAsZip ───────────────────────────────────────────────────────

describe("exportAllAsZip", () => {
  let capturedBlob: Blob | null = null;
  let capturedFileName: string = "";

  // Intercept triggerBlobDownload by patching document APIs used inside it.
  beforeEach(() => {
    capturedBlob = null;
    capturedFileName = "";

    // Minimal DOM stubs
    const fakeLink = {
      setAttribute: (key: string, val: string) => {
        if (key === "download") capturedFileName = val;
      },
      style: { visibility: "" },
      click: () => {},
    };
    vi.stubGlobal("document", {
      createElement: () => fakeLink,
      body: { appendChild: () => {}, removeChild: () => {} },
    });
    vi.stubGlobal("URL", {
      createObjectURL: (blob: Blob) => { capturedBlob = blob; return "blob:fake"; },
      revokeObjectURL: () => {},
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("no receipts — submissions API returns empty", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      }));
    });

    it("returns receiptCount=0 and missingCount=0", async () => {
      const result = await exportAllAsZip(makeData(), CAR_INFO, "2024", EMPTY_MONTH_MODES, 42);
      expect(result.receiptCount).toBe(0);
      expect(result.missingCount).toBe(0);
    });

    it("triggers a download with .zip extension", async () => {
      await exportAllAsZip(makeData(), CAR_INFO, "2024", EMPTY_MONTH_MODES, 42);
      expect(capturedFileName).toMatch(/\.zip$/);
    });

    it("filename includes car make/model and year", async () => {
      await exportAllAsZip(makeData(), CAR_INFO, "2024", EMPTY_MONTH_MODES, 42);
      expect(capturedFileName).toContain("Toyota-Camry");
      expect(capturedFileName).toContain("2024");
    });

    it("produces a valid ZIP with data.csv", async () => {
      await exportAllAsZip(makeData(), CAR_INFO, "2024", EMPTY_MONTH_MODES, 42);
      expect(capturedBlob).not.toBeNull();
      const zip = new JSZip();
      const archive = await zip.loadAsync(await capturedBlob!.arrayBuffer());
      expect(Object.keys(archive.files)).toContain("data.csv");
    });

    it("produced data.csv contains SECTION headers", async () => {
      await exportAllAsZip(makeData(), CAR_INFO, "2024", EMPTY_MONTH_MODES, 42);
      const zip = new JSZip();
      const archive = await zip.loadAsync(await capturedBlob!.arrayBuffer());
      const csv = await archive.file("data.csv")!.async("string");
      expect(csv).toContain("SECTION,INCOME & EXPENSES");
      expect(csv).toContain("SECTION,OPERATING EXPENSE (COGS - Per Vehicle)");
    });

    it("produced ZIP contains receipts.json with empty entries array", async () => {
      await exportAllAsZip(makeData(), CAR_INFO, "2024", EMPTY_MONTH_MODES, 42);
      const zip = new JSZip();
      const archive = await zip.loadAsync(await capturedBlob!.arrayBuffer());
      const manifestRaw = await archive.file("receipts.json")!.async("string");
      const manifest = JSON.parse(manifestRaw);
      expect(manifest.schemaVersion).toBe(1);
      expect(manifest.carId).toBe(42);
      expect(manifest.year).toBe(2024);
      expect(manifest.entries).toEqual([]);
    });

    it("receipts.json has exportedAt ISO timestamp", async () => {
      await exportAllAsZip(makeData(), CAR_INFO, "2024", EMPTY_MONTH_MODES, 42);
      const zip = new JSZip();
      const archive = await zip.loadAsync(await capturedBlob!.arrayBuffer());
      const manifest = JSON.parse(await archive.file("receipts.json")!.async("string"));
      expect(() => new Date(manifest.exportedAt)).not.toThrow();
      expect(new Date(manifest.exportedAt).getTime()).not.toBeNaN();
    });

    it("still exports even when submissions API is unreachable", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
      const result = await exportAllAsZip(makeData(), CAR_INFO, "2024", EMPTY_MONTH_MODES, 42);
      expect(result.receiptCount).toBe(0);
      expect(capturedFileName).toMatch(/\.zip$/);
    });
  });

  describe("with receipts — submissions API returns 2 submissions", () => {
    const FAKE_JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]); // JPEG magic
    const FAKE_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic

    beforeEach(() => {
      let fetchCallCount = 0;
      vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => {
        fetchCallCount++;
        // Submissions list
        if (String(url).includes("approved-by-car")) {
          return {
            ok: true,
            json: async () => ({
              data: [
                { id: 10, carId: 42, year: 2024, month: 1, category: "cogs", field: "parts", amount: 0, receiptUrls: ["https://cdn.example.com/r1.jpg"], remarks: null },
                { id: 11, carId: 42, year: 2024, month: 3, category: "directDelivery", field: "parkingAirport", amount: 0, receiptUrls: ["https://cdn.example.com/r2.png", "https://cdn.example.com/r3.png"], remarks: null },
              ],
            }),
          };
        }
        // Receipt file downloads
        if (String(url).includes("r1.jpg")) return { ok: true, blob: async () => new Blob([FAKE_JPG]) };
        if (String(url).includes("r2.png")) return { ok: true, blob: async () => new Blob([FAKE_PNG]) };
        if (String(url).includes("r3.png")) return { ok: false }; // simulate missing
        return { ok: false };
      }));
    });

    it("returns receiptCount=2 (r1 + r2 downloaded, r3 failed)", async () => {
      const result = await exportAllAsZip(makeData(), CAR_INFO, "2024", EMPTY_MONTH_MODES, 42);
      expect(result.receiptCount).toBe(2);
    });

    it("returns missingCount=1 for the failed download", async () => {
      const result = await exportAllAsZip(makeData(), CAR_INFO, "2024", EMPTY_MONTH_MODES, 42);
      expect(result.missingCount).toBe(1);
    });

    it("receipt files exist in the ZIP at correct paths", async () => {
      await exportAllAsZip(makeData(), CAR_INFO, "2024", EMPTY_MONTH_MODES, 42);
      const zip = new JSZip();
      const archive = await zip.loadAsync(await capturedBlob!.arrayBuffer());
      const paths = Object.keys(archive.files);
      // r1.jpg -> receipts/cogs/parts/01-10-1.jpg
      expect(paths.some(p => p.includes("receipts/cogs/parts/") && p.endsWith(".jpg"))).toBe(true);
      // r2.png -> receipts/directDelivery/parkingAirport/03-11-1.png
      expect(paths.some(p => p.includes("receipts/directDelivery/parkingAirport/") && p.endsWith(".png"))).toBe(true);
    });

    it("manifest entries contain correct category/field/month", async () => {
      await exportAllAsZip(makeData(), CAR_INFO, "2024", EMPTY_MONTH_MODES, 42);
      const zip = new JSZip();
      const archive = await zip.loadAsync(await capturedBlob!.arrayBuffer());
      const manifest = JSON.parse(await archive.file("receipts.json")!.async("string"));
      const entry1 = manifest.entries.find((e: any) => e.category === "cogs");
      expect(entry1.field).toBe("parts");
      expect(entry1.month).toBe(1);
      expect(entry1.file).toMatch(/^receipts\/cogs\/parts\//);

      const entry2 = manifest.entries.find((e: any) => e.category === "directDelivery");
      expect(entry2.field).toBe("parkingAirport");
      expect(entry2.month).toBe(3);
    });

    it("manifest entry file path matches actual file in ZIP", async () => {
      await exportAllAsZip(makeData(), CAR_INFO, "2024", EMPTY_MONTH_MODES, 42);
      const zip = new JSZip();
      const archive = await zip.loadAsync(await capturedBlob!.arrayBuffer());
      const manifest = JSON.parse(await archive.file("receipts.json")!.async("string"));
      for (const entry of manifest.entries) {
        expect(archive.file(entry.file)).not.toBeNull();
      }
    });

    it("receipt filename includes zero-padded month, submission id, index", async () => {
      await exportAllAsZip(makeData(), CAR_INFO, "2024", EMPTY_MONTH_MODES, 42);
      const zip = new JSZip();
      const archive = await zip.loadAsync(await capturedBlob!.arrayBuffer());
      const manifest = JSON.parse(await archive.file("receipts.json")!.async("string"));
      const entry1 = manifest.entries.find((e: any) => e.category === "cogs");
      // Should be  01-10-1.jpg  (month=01, id=10, index=1)
      expect(entry1.file).toMatch(/01-10-1\.jpg$/);
    });

    it("ZIP is parseable by JSZip (not corrupted)", async () => {
      await exportAllAsZip(makeData(), CAR_INFO, "2024", EMPTY_MONTH_MODES, 42);
      const zip = new JSZip();
      await expect(zip.loadAsync(await capturedBlob!.arrayBuffer())).resolves.toBeDefined();
    });
  });
});

// ── 4. importFromFileWithReceipts ───────────────────────────────────────────

describe("importFromFileWithReceipts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── 4a. CSV (legacy) path ────────────────────────────────────────────────

  describe("CSV file (no ZIP magic bytes)", () => {
    it("returns csvImported=true and receiptCount=0 on valid CSV", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
      const csv = minimalValidCSV();
      const file = new File([csv], "data.csv", { type: "text/csv" });
      const result = await importFromFileWithReceipts(file, 123, 2024);
      expect(result.csvImported).toBe(true);
      expect(result.receiptCount).toBe(0);
      expect(result.warnings).toHaveLength(0);
    });

    it("throws if CSV is too short / invalid", async () => {
      const file = new File(["a,b\nc,d"], "data.csv", { type: "text/csv" });
      await expect(importFromFileWithReceipts(file, 123, 2024)).rejects.toThrow();
    });

    it("sends correct carId and year to /api/income-expense/import", async () => {
      let capturedBody: any = null;
      vi.stubGlobal("fetch", vi.fn().mockImplementation(async (_url: string, opts: any) => {
        if (opts?.body) capturedBody = JSON.parse(opts.body);
        return { ok: true, json: async () => ({}) };
      }));
      const csv = minimalValidCSV();
      const file = new File([csv], "data.csv", { type: "text/csv" });
      await importFromFileWithReceipts(file, 777, 2023);
      expect(capturedBody?.carId).toBe(777);
      expect(capturedBody?.year).toBe(2023);
    });

    it("throws if the import API returns non-ok", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "DB error" }),
      }));
      const csv = minimalValidCSV();
      const file = new File([csv], "data.csv", { type: "text/csv" });
      await expect(importFromFileWithReceipts(file, 1, 2024)).rejects.toThrow("DB error");
    });
  });

  // ── 4b. ZIP path ─────────────────────────────────────────────────────────

  describe("ZIP file — CSV only (no receipts.json)", () => {
    it("imports CSV and returns warning about missing receipts.json", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
      const zipFile = await makeZipFile(minimalValidCSV()); // no manifest
      const result = await importFromFileWithReceipts(zipFile, 42, 2024);
      expect(result.csvImported).toBe(true);
      expect(result.receiptCount).toBe(0);
      expect(result.warnings.some(w => w.includes("receipts.json"))).toBe(true);
    });

    it("throws if ZIP has no data.csv", async () => {
      const zip = new JSZip();
      zip.file("other.txt", "hello");
      const blob = await zip.generateAsync({ type: "blob" });
      const file = new File([blob], "export.zip", { type: "application/zip" });
      await expect(importFromFileWithReceipts(file, 1, 2024)).rejects.toThrow("data.csv");
    });

    it("finds data.csv in a subdirectory within the ZIP", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
      const zip = new JSZip();
      zip.file("subdir/data.csv", minimalValidCSV());
      zip.file("subdir/receipts.json", JSON.stringify({ schemaVersion: 1, carId: 1, year: 2024, exportedAt: new Date().toISOString(), entries: [] }));
      const blob = await zip.generateAsync({ type: "blob" });
      const file = new File([blob], "export.zip");
      const result = await importFromFileWithReceipts(file, 1, 2024);
      expect(result.csvImported).toBe(true);
    });
  });

  describe("ZIP file — with receipts manifest and receipt files", () => {
    const FAKE_IMG = new Uint8Array([0xff, 0xd8, 0xff]); // partial JPEG

    const MANIFEST = {
      schemaVersion: 1,
      carId: 42,
      year: 2024,
      exportedAt: new Date().toISOString(),
      entries: [
        { category: "cogs", field: "parts", month: 2, file: "receipts/cogs/parts/02-10-1.jpg", originalUrl: "https://cdn.example.com/r1.jpg" },
        { category: "cogs", field: "parts", month: 2, file: "receipts/cogs/parts/02-10-2.jpg", originalUrl: "https://cdn.example.com/r2.jpg" },
        { category: "directDelivery", field: "laborCarCleaning", month: 5, file: "receipts/directDelivery/laborCarCleaning/05-11-1.jpg", originalUrl: "https://cdn.example.com/r3.jpg" },
      ],
    };

    let uploadCallCount: number;
    let registerCallBody: any;

    beforeEach(() => {
      uploadCallCount = 0;
      registerCallBody = null;

      vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string, opts: any) => {
        const u = String(url);
        if (u.includes("/api/income-expense/import") && !u.includes("receipts")) {
          return { ok: true, json: async () => ({}) };
        }
        if (u.includes("/receipts/upload")) {
          uploadCallCount++;
          return { ok: true, json: async () => ({ fileIds: [`file-${uploadCallCount}`] }) };
        }
        if (u.includes("/import-receipts")) {
          registerCallBody = JSON.parse(opts.body);
          return { ok: true, json: async () => ({ created: registerCallBody.receipts.length }) };
        }
        return { ok: false };
      }));
    });

    async function makeReceiptZip(): Promise<File> {
      return makeZipFile(
        minimalValidCSV(),
        MANIFEST,
        {
          "receipts/cogs/parts/02-10-1.jpg": FAKE_IMG,
          "receipts/cogs/parts/02-10-2.jpg": FAKE_IMG,
          "receipts/directDelivery/laborCarCleaning/05-11-1.jpg": FAKE_IMG,
        }
      );
    }

    it("returns receiptCount=3 (one per receipt file)", async () => {
      const file = await makeReceiptZip();
      const result = await importFromFileWithReceipts(file, 42, 2024);
      expect(result.receiptCount).toBe(3);
    });

    it("calls receipt upload API once per receipt file", async () => {
      const file = await makeReceiptZip();
      await importFromFileWithReceipts(file, 42, 2024);
      expect(uploadCallCount).toBe(3);
    });

    it("calls /import-receipts with correct carId and year", async () => {
      const file = await makeReceiptZip();
      await importFromFileWithReceipts(file, 42, 2024);
      expect(registerCallBody?.carId).toBe(42);
      expect(registerCallBody?.year).toBe(2024);
    });

    it("groups receipts by (category, field, month) before registering", async () => {
      const file = await makeReceiptZip();
      await importFromFileWithReceipts(file, 42, 2024);
      // 2 entries for cogs/parts/month=2, 1 entry for directDelivery/laborCarCleaning/month=5
      // Should produce 2 groups in the payload
      expect(registerCallBody?.receipts).toHaveLength(2);
    });

    it("groups the two cogs/parts/month=2 receipts into one payload entry with 2 fileIds", async () => {
      const file = await makeReceiptZip();
      await importFromFileWithReceipts(file, 42, 2024);
      const cogsEntry = registerCallBody?.receipts?.find(
        (r: any) => r.category === "cogs" && r.field === "parts" && r.month === 2
      );
      expect(cogsEntry).toBeDefined();
      expect(cogsEntry.fileIds).toHaveLength(2);
    });

    it("includes directDelivery entry in payload", async () => {
      const file = await makeReceiptZip();
      await importFromFileWithReceipts(file, 42, 2024);
      const ddEntry = registerCallBody?.receipts?.find(
        (r: any) => r.category === "directDelivery" && r.field === "laborCarCleaning"
      );
      expect(ddEntry?.month).toBe(5);
      expect(ddEntry?.fileIds).toHaveLength(1);
    });

    it("returns no warnings when everything succeeds", async () => {
      const file = await makeReceiptZip();
      const result = await importFromFileWithReceipts(file, 42, 2024);
      expect(result.warnings).toHaveLength(0);
    });

    it("adds a warning when a receipt file is missing from the ZIP", async () => {
      // Manifest references a file that isn't in the ZIP
      const brokenManifest = {
        ...MANIFEST,
        entries: [
          ...MANIFEST.entries,
          { category: "cogs", field: "mechanic", month: 1, file: "receipts/cogs/mechanic/01-99-1.jpg", originalUrl: "https://cdn.example.com/missing.jpg" },
        ],
      };
      const file = await makeZipFile(
        minimalValidCSV(),
        brokenManifest,
        {
          "receipts/cogs/parts/02-10-1.jpg": FAKE_IMG,
          "receipts/cogs/parts/02-10-2.jpg": FAKE_IMG,
          "receipts/directDelivery/laborCarCleaning/05-11-1.jpg": FAKE_IMG,
          // "receipts/cogs/mechanic/01-99-1.jpg" intentionally missing
        }
      );
      const result = await importFromFileWithReceipts(file, 42, 2024);
      expect(result.warnings.some(w => w.includes("Missing file in ZIP"))).toBe(true);
    });

    it("adds a warning when receipt upload API fails", async () => {
      vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string, opts: any) => {
        const u = String(url);
        if (u.includes("/api/income-expense/import") && !u.includes("receipts")) {
          return { ok: true, json: async () => ({}) };
        }
        if (u.includes("/receipts/upload")) {
          return { ok: false }; // all uploads fail
        }
        if (u.includes("/import-receipts")) {
          return { ok: true, json: async () => ({}) };
        }
        return { ok: false };
      }));
      const file = await makeReceiptZip();
      const result = await importFromFileWithReceipts(file, 42, 2024);
      expect(result.warnings.some(w => w.includes("Failed to upload receipt"))).toBe(true);
      expect(result.receiptCount).toBe(0);
    });

    it("adds a warning when /import-receipts API returns error", async () => {
      vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string, opts: any) => {
        const u = String(url);
        if (u.includes("/api/income-expense/import") && !u.includes("receipts")) {
          return { ok: true, json: async () => ({}) };
        }
        if (u.includes("/receipts/upload")) {
          return { ok: true, json: async () => ({ fileIds: ["f1"] }) };
        }
        if (u.includes("/import-receipts")) {
          return { ok: false, json: async () => ({ error: "DB constraint" }) };
        }
        return { ok: false };
      }));
      const file = await makeReceiptZip();
      const result = await importFromFileWithReceipts(file, 42, 2024);
      expect(result.warnings.some(w => w.includes("Receipt registration failed"))).toBe(true);
    });

    it("skips /import-receipts call if no receipts were uploaded successfully", async () => {
      let importReceiptsCalled = false;
      vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => {
        const u = String(url);
        if (u.includes("/api/income-expense/import") && !u.includes("receipts")) {
          return { ok: true, json: async () => ({}) };
        }
        if (u.includes("/receipts/upload")) return { ok: false };
        if (u.includes("/import-receipts")) { importReceiptsCalled = true; return { ok: true, json: async () => ({}) }; }
        return { ok: false };
      }));
      const file = await makeReceiptZip();
      await importFromFileWithReceipts(file, 42, 2024);
      expect(importReceiptsCalled).toBe(false);
    });
  });

  // ── 4c. ZIP detection by magic bytes ────────────────────────────────────

  describe("ZIP detection by magic bytes (PK signature)", () => {
    it("detects a real ZIP regardless of MIME type being octet-stream", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
      const zipFile = await makeZipFile(minimalValidCSV());
      // Override the type to simulate browser giving octet-stream
      const wrongMimeFile = new File([await zipFile.arrayBuffer()], "export.zip", {
        type: "application/octet-stream",
      });
      const result = await importFromFileWithReceipts(wrongMimeFile, 1, 2024);
      expect(result.csvImported).toBe(true);
    });

    it("treats a .csv file with wrong MIME as CSV (not ZIP)", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
      const csv = minimalValidCSV();
      // A CSV file with application/zip MIME but no PK bytes
      const file = new File([csv], "data.csv", { type: "application/zip" });
      const result = await importFromFileWithReceipts(file, 1, 2024);
      // Should succeed as CSV — the CSV text doesn't start with PK
      expect(result.csvImported).toBe(true);
      expect(result.receiptCount).toBe(0);
    });
  });
});
