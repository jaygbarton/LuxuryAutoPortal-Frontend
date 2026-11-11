import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { cn } from "@/lib/utils";

type OptionProps = React.OptionHTMLAttributes<HTMLOptionElement> & { searchKeywords?: string[] };

export function SearchableOption({ searchKeywords, ...props }: OptionProps) {
  return <option {...props} />;
}

function collectOptions(children: React.ReactNode): React.ReactElement<OptionProps>[] {
  return React.Children.toArray(children).flatMap((child) => {
    if (!React.isValidElement<OptionProps>(child)) return [];
    if (child.type === "option" || child.type === SearchableOption) return [child];
    return collectOptions(child.props.children);
  });
}

/** Preserve native form values/events/validation while adding the shared searchable menu. */
export const SearchableNativeSelect = React.forwardRef<HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ children, className, style, id, value, defaultValue, disabled, onChange, onInvalid, ...props }, ref) => {
  const options = collectOptions(children);
  const nativeRef = React.useRef<HTMLSelectElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [localValue, setLocalValue] = React.useState(String(defaultValue ?? options[0]?.props.value ?? ""));
  const selected = String(value ?? localValue);
  const placeholder = options.find((option) => String(option.props.value ?? "") === "")?.props.children ?? "Select an option";

  return <>
    <Select value={selected} disabled={disabled} onValueChange={(next) => {
      if (!nativeRef.current) return;
      nativeRef.current.value = next === "__empty_option__" ? "" : next;
      nativeRef.current.dispatchEvent(new Event("change", { bubbles: true }));
    }}>
      <SelectTrigger
        ref={triggerRef}
        id={id}
        title={props.title}
        aria-label={props["aria-label"]}
        aria-labelledby={props["aria-labelledby"]}
        aria-describedby={props["aria-describedby"]}
        aria-required={props.required}
        aria-invalid={props["aria-invalid"]}
        className={cn("w-auto", className)}
        style={style}
      ><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{options.map((option, index) => <SelectItem
        key={option.key ?? index}
        value={String(option.props.value ?? "") || "__empty_option__"}
        disabled={option.props.disabled}
        searchKeywords={option.props.searchKeywords}
      >{option.props.children}</SelectItem>)}</SelectContent>
    </Select>
    <select
      {...props}
      ref={(node) => {
        nativeRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      id={id ? `${id}-native` : undefined}
      value={selected}
      disabled={disabled}
      aria-hidden="true"
      tabIndex={-1}
      className="sr-only"
      // sr-only is position:absolute, and this fragment has no positioned
      // wrapper: the select was placed against the whole page at its flow
      // position inside the scrolled <main>, making the window itself
      // scrollable (a second scrollbar). Pinned, the 1px box never extends
      // any scroll area.
      style={{ position: "fixed", top: 0, left: 0 }}
      onChange={(event) => { setLocalValue(event.target.value); onChange?.(event); }}
      onInvalid={(event) => { onInvalid?.(event); event.preventDefault(); triggerRef.current?.focus(); }}
    >{children}</select>
  </>;
});
SearchableNativeSelect.displayName = "SearchableNativeSelect";
