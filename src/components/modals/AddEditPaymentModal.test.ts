import { describe, expect, it } from "vitest";
import { parseExistingReceipts } from "./AddEditPaymentModal";

// Regression test: the "Saved receipts" list in the edit-payment modal used
// to call .startsWith()/.toLowerCase() directly on each parsed
// payments_attachment entry, assuming every entry was a string. Every
// production payment with a receipt actually stores the legacy
// { id_str, name, url, datetime } object shape, so the list threw instead of
// rendering. Verified to FAIL before the fix: existingReceiptIds held the
// raw object, and id.startsWith(...) threw a TypeError.
describe("parseExistingReceipts", () => {
  it("returns an empty list for no attachment", () => {
    expect(parseExistingReceipts(null)).toEqual([]);
    expect(parseExistingReceipts(undefined)).toEqual([]);
    expect(parseExistingReceipts("")).toEqual([]);
  });

  it("parses bare Drive-ID / local-path / URL string entries", () => {
    expect(parseExistingReceipts('["drive-file-id"]')).toEqual([{ id: "drive-file-id" }]);
    expect(parseExistingReceipts('["/uploads/receipts/payment.png"]')).toEqual([
      { id: "/uploads/receipts/payment.png" },
    ]);
  });

  it("parses the legacy { id_str, name, url } object shape without throwing", () => {
    const attachment = JSON.stringify([
      { id_str: "1IfCjO891XCbuXZ7wuIhStjoNoa4I4s2n", name: "bill 2025-01.pdf", datetime: "2025-01-08 00:51:06" },
    ]);
    expect(parseExistingReceipts(attachment)).toEqual([
      { id: "1IfCjO891XCbuXZ7wuIhStjoNoa4I4s2n", name: "bill 2025-01.pdf" },
    ]);
  });

  it("parses a mix of legacy objects and bare strings in the same list", () => {
    const attachment = JSON.stringify([
      { id_str: "driveId1", name: "receipt1.pdf" },
      "/uploads/receipts/receipt2.png",
    ]);
    expect(parseExistingReceipts(attachment)).toEqual([
      { id: "driveId1", name: "receipt1.pdf" },
      { id: "/uploads/receipts/receipt2.png" },
    ]);
  });

  it("handles a single non-array JSON value", () => {
    expect(parseExistingReceipts('{"id_str":"driveId1","name":"receipt.pdf"}')).toEqual([
      { id: "driveId1", name: "receipt.pdf" },
    ]);
  });

  it("returns an empty list for malformed JSON", () => {
    expect(parseExistingReceipts("not json")).toEqual([]);
  });
});
