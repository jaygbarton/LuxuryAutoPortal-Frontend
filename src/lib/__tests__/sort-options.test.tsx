import React from "react";
import { expect, it } from "vitest";
import { sortOptionNodes } from "../sort-options";
it("sorts by vehicle name rather than year without altering saved IDs", () => {
  const nodes = sortOptionNodes(
    <>
      <option value="55">2019 Toyota Sienna</option>
      <option value="88">2026 Audi Q8</option>
      <option value="91">2020 BMW X5</option>
    </>,
  ) as React.ReactElement[];
  expect(nodes.map((node) => node.props.value)).toEqual(["88", "91", "55"]);
});
it("keeps placeholder and driver exceptions before alphabetized employees", () => {
  const nodes = sortOptionNodes([
    <option key="z" value="902">
      Zoe
    </option>,
    <option key="u" value="uber">
      Uber
    </option>,
    <option key="a" value="15">
      Andy
    </option>,
    <option key="n" value="na">
      N/A
    </option>,
    <option key="e" value="">
      Select driver
    </option>,
  ]) as React.ReactElement[];
  expect(nodes.map((node) => node.props.value)).toEqual([
    "",
    "uber",
    "na",
    "15",
    "902",
  ]);
});
