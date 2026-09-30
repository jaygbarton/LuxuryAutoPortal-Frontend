import { describe, expect, it } from "vitest";
import { hasPaymentReceiptAttachment } from "./PaymentReceiptModal";

describe("hasPaymentReceiptAttachment", () => {
  it("rejects missing and empty payment receipt values", () => {
    expect(hasPaymentReceiptAttachment(null)).toBe(false);
    expect(hasPaymentReceiptAttachment("")).toBe(false);
    expect(hasPaymentReceiptAttachment("[]")).toBe(false);
    expect(hasPaymentReceiptAttachment("[\"\"]")).toBe(false);
  });

  it("accepts every supported stored payment receipt shape", () => {
    expect(hasPaymentReceiptAttachment('["drive-file-id"]')).toBe(true);
    expect(hasPaymentReceiptAttachment('["/uploads/receipts/payment.png"]')).toBe(true);
    expect(hasPaymentReceiptAttachment('{"id_str":"drive-file-id","name":"receipt.png"}')).toBe(true);
  });
});
