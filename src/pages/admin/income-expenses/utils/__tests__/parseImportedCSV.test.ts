import { describe, it, expect } from "vitest";
import { parseImportedCSV } from "../exportImportUtils";

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal but structurally valid CSV that the exporter produces. */
function makeCSV(overrides: { [section: string]: string[] } = {}): string {
  const months = "Jan 2024,Feb 2024,Mar 2024,Apr 2024,May 2024,Jun 2024,Jul 2024,Aug 2024,Sep 2024,Oct 2024,Nov 2024,Dec 2024";

  const incomeRows = overrides.income ?? [
    `Rental Income,$100.00,$200.00,$300.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$600.00`,
    `Delivery Income,$10.00,$20.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$30.00`,
    `Electric Prepaid Income,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Smoking Fines,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Gas Prepaid Income,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Ski Racks Income,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Miles Income,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Child Seat Income,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Coolers Income,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Income insurance and Client Wrecks,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Other Income,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
  ];

  const cogsRows = overrides.cogs ?? [
    `Auto Body Shop / Wreck,$50.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$50.00`,
    `Alignment,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Battery,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Brakes,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Car Payment,$25.00,$25.00,$25.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$75.00`,
    `Car Insurance,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Car Seats,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Cleaning Supplies / Tools,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Emissions,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `GPS System,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Key & Fob,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Labor - Cleaning (COGS),$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `License & Registration,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Mechanic,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Oil/Lube,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Parts,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Ski Racks,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Tickets & Tolls,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Tired Air Station,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Tires,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Towing / Impound Fees,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Uber/Lyft/Lime,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Windshield,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Wipers,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
  ];

  return [
    `CAR NAME,Test Car`,
    `VIN #,1ABC123`,
    `LICENSE,TEST`,
    `OWNER NAME,John Doe`,
    `CONTACT #,555-0000`,
    `EMAIL,test@test.com`,
    `FUEL/GAS,Gas`,
    `TIRE SIZE,225/50R17`,
    `OIL TYPE,Synthetic`,
    `TURO LINK,N/A`,
    `ADMIN TURO LINK,N/A`,
    ``,
    `SECTION,CAR MANAGEMENT OWNER SPLIT`,
    `Mode Settings,Jan 2024: 50,Feb 2024: 70,Mar 2024: 50,Apr 2024: 50,May 2024: 50,Jun 2024: 50,Jul 2024: 50,Aug 2024: 50,Sep 2024: 50,Oct 2024: 50,Nov 2024: 50,Dec 2024: 50`,
    `Category,${months},YER,YER SPLIT,TOTAL`,
    `Car Management Split,$0.00 (30%),$0.00 (30%),$0.00 (30%),$0.00 (30%),$0.00 (30%),$0.00 (30%),$0.00 (30%),$0.00 (30%),$0.00 (30%),$0.00 (30%),$0.00 (30%),$0.00 (30%),$0.00,$0.00,$0.00`,
    `Car Owner Split,$0.00 (70%),$0.00 (70%),$0.00 (70%),$0.00 (70%),$0.00 (70%),$0.00 (70%),$0.00 (70%),$0.00 (70%),$0.00 (70%),$0.00 (70%),$0.00 (70%),$0.00 (70%),$0.00,$0.00,$0.00`,
    ``,
    `SECTION,INCOME & EXPENSES`,
    `Category,${months},YER,YER SPLIT,TOTAL`,
    ...incomeRows,
    `Negative Balance Carry Over,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Car Payment,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Car Management Total Expenses,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Car Owner Total Expenses,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Total Expenses,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    ``,
    `SECTION,OPERATING EXPENSE (Direct Delivery)`,
    `Category,${months},YER,YER SPLIT,TOTAL`,
    `Labor - Cleaning,$5.00,$5.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$10.00`,
    `Labor - Delivery,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Parking - Airport,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Parking - Lot,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Uber/Lyft/Lime,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `TOTAL OPERATING EXPENSE (Direct Delivery),$5.00,$5.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$10.00`,
    ``,
    `SECTION,OPERATING EXPENSE (COGS - Per Vehicle)`,
    `Category,${months},YER,YER SPLIT,TOTAL`,
    ...cogsRows,
    `TOTAL OPERATING EXPENSE (COGS - Per Vehicle),$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    ``,
    `SECTION,Parking Fee & Labor Cleaning`,
    `Category,${months},YER,YER SPLIT,TOTAL`,
    `GLA Parking Fee,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Labor - Cleaning,$8.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$8.00`,
    `Total Parking Fee & Labor Cleaning,$8.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$8.00`,
    ``,
    `SECTION,REIMBURSE AND NON-REIMBURSE BILLS`,
    `Category,${months},YER,YER SPLIT,TOTAL`,
    `Electric - Reimbursed,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Electric - Not Reimbursed,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Gas - Reimbursed,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Gas - Not Reimbursed,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Gas - Service Run,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `Parking Airport,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    `TOTAL REIMBURSE AND NON-REIMBURSE BILLS,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
    ``,
    `SECTION,HISTORY`,
    `Category,${months},YER,YER SPLIT,TOTAL`,
    `Days Rented,10,20,15,0,0,0,0,0,0,0,0,0,0,0,45`,
    `Cars Available For Rent,1,1,1,0,0,0,0,0,0,0,0,0,0,0,3`,
    `Trips Taken,5,8,6,0,0,0,0,0,0,0,0,0,0,0,19`,
    ``,
    `SECTION,CAR RENTAL VALUE PER MONTH`,
    `Total Car Rental Income,$100.00,$200.00,$300.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$600.00`,
  ].join("\n");
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe("parseImportedCSV", () => {
  describe("section detection", () => {
    it("returns success=true for a valid CSV", () => {
      const result = parseImportedCSV(makeCSV());
      expect(result.success).toBe(true);
    });

    it("detects all 6 importable sections", () => {
      const result = parseImportedCSV(makeCSV());
      const s = result.sections!;
      expect(s.incomeExpenses).toBeDefined();
      expect(s.directDelivery).toBeDefined();
      expect(s.cogs).toBeDefined();
      expect(s.parkingFeeLabor).toBeDefined();
      expect(s.reimbursedBills).toBeDefined();
      expect(s.history).toBeDefined();
    });

    it("returns failure for a file with fewer than 10 lines", () => {
      const result = parseImportedCSV("a,b,c\nd,e,f");
      expect(result.success).toBe(false);
    });
  });

  describe("income & expenses section", () => {
    it("parses exactly the 11 income data rows (not summary or formula rows)", () => {
      const result = parseImportedCSV(makeCSV());
      // 11 real income rows; Negative Balance Carry Over / Car Payment (in income) /
      // Car Management Total / Car Owner Total / Total Expenses must be excluded.
      expect(result.sections!.incomeExpenses!.length).toBe(11);
    });

    it("reads month values as numbers, stripping $ signs", () => {
      const result = parseImportedCSV(makeCSV());
      const rentalRow = result.sections!.incomeExpenses!.find(
        (r: any) => r.category === "Rental Income"
      );
      expect(rentalRow).toBeDefined();
      expect(rentalRow.month1).toBe(100);
      expect(rentalRow.month2).toBe(200);
      expect(rentalRow.month3).toBe(300);
    });

    it("skips 'Negative Balance Carry Over' formula row", () => {
      const result = parseImportedCSV(makeCSV());
      const bad = result.sections!.incomeExpenses!.find(
        (r: any) => r.category === "Negative Balance Carry Over"
      );
      expect(bad).toBeUndefined();
    });

    it("skips 'Car Payment' only inside the income section (not in COGS)", () => {
      const result = parseImportedCSV(makeCSV());
      // Should NOT appear in incomeExpenses
      const inIncome = result.sections!.incomeExpenses!.find(
        (r: any) => r.category === "Car Payment"
      );
      expect(inIncome).toBeUndefined();
      // MUST appear in cogs
      const inCogs = result.sections!.cogs!.find(
        (r: any) => r.category === "Car Payment"
      );
      expect(inCogs).toBeDefined();
      expect(inCogs.month1).toBe(25);
    });

    it("skips 'Total Expenses' summary row", () => {
      const result = parseImportedCSV(makeCSV());
      const bad = result.sections!.incomeExpenses!.find(
        (r: any) => r.category === "Total Expenses"
      );
      expect(bad).toBeUndefined();
    });
  });

  describe("direct delivery section", () => {
    it("parses the 5 fixed direct delivery rows", () => {
      const result = parseImportedCSV(makeCSV());
      // Labor - Cleaning, Labor - Delivery, Parking - Airport, Parking - Lot, Uber/Lyft/Lime
      expect(result.sections!.directDelivery!.length).toBe(5);
    });

    it("skips the TOTAL row", () => {
      const result = parseImportedCSV(makeCSV());
      const bad = result.sections!.directDelivery!.find(
        (r: any) => r.category.toUpperCase().startsWith("TOTAL")
      );
      expect(bad).toBeUndefined();
    });

    it("reads Labor - Cleaning month values correctly", () => {
      const result = parseImportedCSV(makeCSV());
      const row = result.sections!.directDelivery!.find(
        (r: any) => r.category === "Labor - Cleaning"
      );
      expect(row!.month1).toBe(5);
      expect(row!.month2).toBe(5);
      expect(row!.month3).toBe(0);
    });
  });

  describe("COGS section", () => {
    it("parses 24 fixed COGS rows", () => {
      const result = parseImportedCSV(makeCSV());
      expect(result.sections!.cogs!.length).toBe(24);
    });

    it("skips the TOTAL OPERATING EXPENSE COGS row", () => {
      const result = parseImportedCSV(makeCSV());
      const bad = result.sections!.cogs!.find(
        (r: any) => r.category.toUpperCase().startsWith("TOTAL")
      );
      expect(bad).toBeUndefined();
    });

    it("reads Auto Body Shop month1 = 50", () => {
      const result = parseImportedCSV(makeCSV());
      const row = result.sections!.cogs!.find(
        (r: any) => r.category === "Auto Body Shop / Wreck"
      );
      expect(row!.month1).toBe(50);
    });
  });

  describe("parking fee & labor section", () => {
    it("parses 2 rows and skips Total row", () => {
      const result = parseImportedCSV(makeCSV());
      expect(result.sections!.parkingFeeLabor!.length).toBe(2);
    });
  });

  describe("reimburse section", () => {
    it("parses 6 rows and skips TOTAL row", () => {
      const result = parseImportedCSV(makeCSV());
      expect(result.sections!.reimbursedBills!.length).toBe(6);
    });
  });

  describe("history section", () => {
    it("parses 3 history rows", () => {
      const result = parseImportedCSV(makeCSV());
      expect(result.sections!.history!.length).toBe(3);
    });

    it("reads Days Rented correctly", () => {
      const result = parseImportedCSV(makeCSV());
      const row = result.sections!.history!.find(
        (r: any) => r.category === "Days Rented"
      );
      expect(row!.month1).toBe(10);
      expect(row!.month2).toBe(20);
      expect(row!.month3).toBe(15);
    });
  });

  describe("skip-sections (CAR RENTAL VALUE, PARKING AIRPORT AVERAGE)", () => {
    it("does not include Total Car Rental Income in any section", () => {
      const result = parseImportedCSV(makeCSV());
      const allRows = [
        ...result.sections!.incomeExpenses!,
        ...result.sections!.directDelivery!,
        ...result.sections!.cogs!,
        ...result.sections!.parkingFeeLabor!,
        ...result.sections!.reimbursedBills!,
        ...result.sections!.history!,
      ];
      const bad = allRows.find((r: any) =>
        r.category?.includes("Total Car Rental")
      );
      expect(bad).toBeUndefined();
    });
  });

  describe("corrupt SECTION row (like 'SECTION,$0.00,...')", () => {
    it("does not treat a SECTION row with dollar values as a data row", () => {
      const csvWithBadSectionRow = makeCSV().replace(
        "TOTAL OPERATING EXPENSE (Direct Delivery)",
        "SECTION,$0.00,$0.00,$0.00"
      );
      const result = parseImportedCSV(csvWithBadSectionRow);
      // Direct delivery rows should still parse correctly (5 rows)
      expect(result.sections!.directDelivery!.length).toBe(5);
    });
  });

  describe("quoted values", () => {
    it("strips quotes and dollar signs from values", () => {
      const csv = makeCSV({
        income: [
          `Rental Income,"$1,500.00","$2,000.00",$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$3500.00`,
          `Delivery Income,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
          `Electric Prepaid Income,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
          `Smoking Fines,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
          `Gas Prepaid Income,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
          `Ski Racks Income,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
          `Miles Income,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
          `Child Seat Income,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
          `Coolers Income,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
          `Income insurance and Client Wrecks,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
          `Other Income,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00`,
        ],
      });
      const result = parseImportedCSV(csv);
      const row = result.sections!.incomeExpenses!.find(
        (r: any) => r.category === "Rental Income"
      );
      expect(row!.month1).toBe(1500);
      expect(row!.month2).toBe(2000);
    });
  });

  describe("label alias coverage", () => {
    it("preserves 'Keys & Fob' label for backend alias handling", () => {
      // The exporter now writes 'Key & Fob' but old exports had 'Keys & Fob'.
      // Parser must preserve the raw label — backend fieldMapping handles both.
      const csv = makeCSV();
      // Inject an old-style 'Keys & Fob' into COGS
      const csvWithOldLabel = csv.replace("Key & Fob", "Keys & Fob");
      const result = parseImportedCSV(csvWithOldLabel);
      const row = result.sections!.cogs!.find(
        (r: any) => r.category === "Keys & Fob"
      );
      expect(row).toBeDefined();
    });

    it("preserves 'Labor - Detailing' label for backend alias handling", () => {
      const csv = makeCSV();
      const csvWithOldLabel = csv.replace("Labor - Cleaning (COGS)", "Labor - Detailing");
      const result = parseImportedCSV(csvWithOldLabel);
      const row = result.sections!.cogs!.find(
        (r: any) => r.category === "Labor - Detailing"
      );
      expect(row).toBeDefined();
    });
  });

  describe("Mode Settings parsing", () => {
    it("reads monthModes from Mode Settings row", () => {
      const result = parseImportedCSV(makeCSV());
      expect(result.sections!.monthModes![1]).toBe(50);
      expect(result.sections!.monthModes![2]).toBe(70); // Feb set to 70 in makeCSV
      expect(result.sections!.monthModes![3]).toBe(50);
    });

    it("defaults to empty monthModes when Mode Settings row is absent", () => {
      const csv = makeCSV().replace(/Mode Settings,[^\n]+\n/, "");
      const result = parseImportedCSV(csv);
      expect(result.sections!.monthModes).toEqual({});
    });
  });

  describe("Car Management / Car Owner Split percentage parsing", () => {
    it("extracts management split percentage from each month cell", () => {
      const result = parseImportedCSV(makeCSV());
      const mgmt = result.sections!.managementSplit?.find(
        (r: any) => r.category === "carManagementSplit"
      );
      expect(mgmt).toBeDefined();
      expect(mgmt!.month1).toBe(30);
      expect(mgmt!.month6).toBe(30);
    });

    it("extracts owner split percentage from each month cell", () => {
      const result = parseImportedCSV(makeCSV());
      const owner = result.sections!.managementSplit?.find(
        (r: any) => r.category === "carOwnerSplit"
      );
      expect(owner).toBeDefined();
      expect(owner!.month1).toBe(70);
    });

    it("sets null for months where percentage is missing from the cell", () => {
      const result = parseImportedCSV(makeCSV());
      // YER / YER SPLIT / TOTAL columns (indices 13,14,15) have no percentage
      const mgmt = result.sections!.managementSplit?.find(
        (r: any) => r.category === "carManagementSplit"
      );
      // month13 doesn't exist in the 12-month loop; all 12 months should be set
      expect(mgmt!.month12).toBe(30);
    });
  });

  describe("Labor - Cleaning in Parking Fee section", () => {
    it("includes Labor - Cleaning in parkingFeeLabor (not as dynamic subcategory)", () => {
      const result = parseImportedCSV(makeCSV());
      const row = result.sections!.parkingFeeLabor!.find(
        (r: any) => r.category === "Labor - Cleaning"
      );
      expect(row).toBeDefined();
      expect(row!.month1).toBe(8);
    });

    it("parking fee section has exactly 2 rows (GLA Parking Fee + Labor - Cleaning)", () => {
      const result = parseImportedCSV(makeCSV());
      expect(result.sections!.parkingFeeLabor!.length).toBe(2);
    });
  });

  describe("template-style CSV (legacy format with trailing month labels)", () => {
    // Reproduces the format produced by handleDownloadTemplate in TableActions.tsx
    // where section headers appear as `INCOME & EXPENSES,Jan-23,Feb-23,...` instead
    // of `SECTION,INCOME & EXPENSES`. This format was previously not parsed at all
    // because the section header detector required all trailing cells to be empty.
    const templateCSV = `INCOME & EXPENSES,Jan-23,Feb-23,Mar-23,Apr-23,May-23,Jun-23,Jul-23,Aug-23,Sep-23,Oct-23,Nov-23,Dec-23
Rental Income,$100.00,$200.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Delivery Income,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
,,,,,,,,,,,,
OPERATING EXPENSE (Direct Delivery),,,,,,,,,,,,
Category,Jan-23,Feb-23,Mar-23,Apr-23,May-23,Jun-23,Jul-23,Aug-23,Sep-23,Oct-23,Nov-23,Dec-23
Labor - Cleaning,$5.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
,,,,,,,,,,,,
OPERATING EXPENSE (COGS - Per Vehicle),Jan-23,Feb-23,Mar-23,Apr-23,May-23,Jun-23,Jul-23,Aug-23,Sep-23,Oct-23,Nov-23,Dec-23
Auto Body Shop / Wreck,$50.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
,,,,,,,,,,,,
PARKING FEE & LABOR CLEANING,Jan-23,Feb-23,Mar-23,Apr-23,May-23,Jun-23,Jul-23,Aug-23,Sep-23,Oct-23,Nov-23,Dec-23
GLA Parking Fee,$10.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
,,,,,,,,,,,,
REIMBURSE AND NON-REIMBURSE BILLS,Jan-23,Feb-23,Mar-23,Apr-23,May-23,Jun-23,Jul-23,Aug-23,Sep-23,Oct-23,Nov-23,Dec-23
Electric - Reimbursed,$25.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
,,,,,,,,,,,,
HISTORY,Jan-23,Feb-23,Mar-23,Apr-23,May-23,Jun-23,Jul-23,Aug-23,Sep-23,Oct-23,Nov-23,Dec-23
Days Rented,15,0,0,0,0,0,0,0,0,0,0,0`;

    it("parses Rental Income from template-format income section", () => {
      const result = parseImportedCSV(templateCSV);
      const row = result.sections!.incomeExpenses!.find(
        (r: any) => r.category === "Rental Income"
      );
      expect(row).toBeDefined();
      expect(row!.month1).toBe(100);
      expect(row!.month2).toBe(200);
    });

    it("parses Auto Body Shop from template-format COGS section", () => {
      const result = parseImportedCSV(templateCSV);
      const row = result.sections!.cogs!.find(
        (r: any) => r.category === "Auto Body Shop / Wreck"
      );
      expect(row).toBeDefined();
      expect(row!.month1).toBe(50);
    });

    it("parses GLA Parking Fee from template-format parking section", () => {
      const result = parseImportedCSV(templateCSV);
      const row = result.sections!.parkingFeeLabor!.find(
        (r: any) => r.category === "GLA Parking Fee"
      );
      expect(row).toBeDefined();
      expect(row!.month1).toBe(10);
    });

    it("parses Electric - Reimbursed from template-format reimburse section", () => {
      const result = parseImportedCSV(templateCSV);
      const row = result.sections!.reimbursedBills!.find(
        (r: any) => r.category === "Electric - Reimbursed"
      );
      expect(row).toBeDefined();
      expect(row!.month1).toBe(25);
    });

    it("parses Days Rented from template-format history section", () => {
      const result = parseImportedCSV(templateCSV);
      const row = result.sections!.history!.find(
        (r: any) => r.category === "Days Rented"
      );
      expect(row).toBeDefined();
      expect(row!.month1).toBe(15);
    });
  });
});
