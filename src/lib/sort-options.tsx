import * as React from "react";
export function optionLabel(node: React.ReactNode): string {
  return React.Children.toArray(node)
    .map((child) =>
      typeof child === "string" || typeof child === "number"
        ? String(child)
        : React.isValidElement<{ children?: React.ReactNode }>(child)
          ? optionLabel(child.props.children)
          : "",
    )
    .join(" ")
    .trim();
}
const collator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});
export function compareOptionLabels(a: string, b: string) {
  const name = (s: string) => s.replace(/^(?:19|20)\d{2}\s+(?=[A-Za-z])/, "");
  return collator.compare(name(a), name(b)) || collator.compare(a, b);
}
function priority(value: unknown, label: string) {
  const v = String(value ?? "").toLowerCase();
  if (v === "" || v === "__empty_option__") return -5;
  if (v === "uber") return -4;
  if (v === "na" || v === "n/a") return -3;
  if (
    /^(all|allcars|all_cars|none|unassigned)$/.test(v) ||
    /^(all |select |choose |no selection)/i.test(label)
  )
    return -2;
  return 0;
}
/** Sort within groups without changing option values, keys or event handlers. */
export function sortOptionNodes(children: React.ReactNode): React.ReactNode[] {
  const flatten = (nodes: React.ReactNode): React.ReactNode[] =>
    React.Children.toArray(nodes).flatMap((child) =>
      React.isValidElement<{ children?: React.ReactNode }>(child) &&
      child.type === React.Fragment
        ? flatten(child.props.children)
        : [child],
    );
  const nodes = flatten(children);
  const options = nodes.filter(
    (child) =>
      React.isValidElement<any>(child) && child.props.value !== undefined,
  ) as React.ReactElement<any>[];
  options.sort((a, b) => {
    const x = a.props.textValue || optionLabel(a.props.children),
      y = b.props.textValue || optionLabel(b.props.children);
    return (
      priority(a.props.value, x) - priority(b.props.value, y) ||
      compareOptionLabels(x, y)
    );
  });
  let index = 0;
  return nodes.map((child) =>
    React.isValidElement<any>(child) && child.props.value !== undefined
      ? options[index++]
      : child,
  );
}
