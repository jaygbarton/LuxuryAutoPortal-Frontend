import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GLA_EMAIL_SENDER, SpamFolderNotice } from "../SpamFolderNotice";

describe("SpamFolderNotice", () => {
  it("tells applicants to check spam and names the sender to look for", () => {
    const html = renderToStaticMarkup(<SpamFolderNotice />);
    expect(html).toContain("Check your spam or junk folder");
    expect(html).toContain(GLA_EMAIL_SENDER);
    expect(html).toContain('role="note"');
  });
});
