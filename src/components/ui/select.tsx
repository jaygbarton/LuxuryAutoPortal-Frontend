"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp, Search, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { matchesOption } from "@/lib/select-search"

const SelectSearchContext = React.createContext("")

function optionText(node: React.ReactNode): string {
  return React.Children.toArray(node).map((child) => {
    if (typeof child === "string" || typeof child === "number") return String(child)
    if (React.isValidElement<{ children?: React.ReactNode }>(child)) return optionText(child.props.children)
    return ""
  }).join(" ")
}

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-9 min-h-11 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9 [&>span]:line-clamp-1",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> & { searchPlaceholder?: string }
>(({ className, children, position = "popper", searchPlaceholder = "Search options…", onCloseAutoFocus, ...props }, ref) => {
  const [query, setQuery] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const [hasResults, setHasResults] = React.useState(true)
  React.useEffect(() => {
    if (!query.trim()) { setHasResults(true); return }
    if (!contentRef.current) return
    setHasResults(Boolean(contentRef.current.querySelector('[role="option"]:not([hidden])')))
  }, [query, children])
  return (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={(node) => {
        contentRef.current = node
        if (typeof ref === "function") ref(node)
        else if (ref) ref.current = node
      }}
      onCloseAutoFocus={(event) => { setQuery(""); setHasResults(true); onCloseAutoFocus?.(event) }}
      className={cn(
        // z-[4100] sits above Dialog overlay/content (z-[4000]/z-[4001]) so
        // portaled Select menus remain clickable inside modals.
        "relative z-[4100] max-h-[min(24rem,var(--radix-select-content-available-height))] max-w-[calc(100vw-1rem)] min-w-[min(16rem,calc(100vw-1rem))] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-select-content-transform-origin]",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <div className="flex shrink-0 items-center gap-2 border-b p-2">
        <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          aria-label={searchPlaceholder}
          placeholder={searchPlaceholder}
          type="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") return
            // Keep Radix typeahead from stealing typed characters or spaces.
            event.stopPropagation()
            if (["ArrowDown", "ArrowUp", "Enter"].includes(event.key) && !event.nativeEvent.isComposing) {
              event.preventDefault()
              const options = Array.from(contentRef.current?.querySelectorAll<HTMLElement>('[role="option"]:not([hidden]):not([data-disabled])') ?? [])
              const option = event.key === "ArrowUp" ? options.at(-1) : options[0]
              option?.focus()
              if (event.key === "Enter") option?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
            }
          }}
          className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        {query && <button type="button" aria-label="Clear search" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-accent" onClick={() => { setQuery(""); inputRef.current?.focus() }}><X className="h-4 w-4" /></button>}
      </div>
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "max-h-[min(18rem,calc(var(--radix-select-content-available-height)-4rem))] overflow-y-auto overscroll-contain p-1",
          position === "popper" &&
            "min-h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        <SelectSearchContext.Provider value={query}>{children}</SelectSearchContext.Provider>
        {query.trim() && !hasResults && <div role="status" className="px-3 py-6 text-center text-sm text-muted-foreground">No matching options.</div>}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
)
})
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> & { searchKeywords?: string[] }
>(({ className, children, searchKeywords = [], disabled, ...props }, ref) => {
  const query = React.useContext(SelectSearchContext)
  const matches = matchesOption(query, optionText(children), props.textValue ?? "", ...searchKeywords)
  return (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex min-h-11 w-full cursor-pointer select-none items-center rounded-sm py-2 pl-8 pr-3 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
    hidden={!matches}
    disabled={disabled || !matches}
    style={{ ...props.style, ...(!matches ? { display: "none" } : {}) }}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>

    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
)
})
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
