"use client";

// The site's dropdown: a trigger button and a compact menu of options
// (select.css). The menu sizes itself to its options, opens just under (or,
// near the bottom of the screen, just over) its trigger, and lives in the
// page itself rather than pinned to the screen, so it scrolls with the page
// exactly -- no chasing the trigger a frame behind while scrolling. A
// trigger inside a fixed panel gets a fixed menu for the same reason.
// A wrapper marked [data-select-field] (a filter bar with its label) opens
// the menu from anywhere on it.

import {
  forwardRef,
  useRef,
  useEffect,
  useLayoutEffect,
  useState,
  useCallback,
  useId,
  createContext,
  useContext,
  type ReactNode,
  type HTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import "./select.css";

function cn(...inputs: (string | undefined | null | false | Record<string, boolean>)[]) {
  return twMerge(clsx(inputs));
}

// ─── Select Context ──────────────────────────────────────────────────────────

interface SelectContextValue {
  value: string;
  onChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  disabled: boolean;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  labelMap: React.MutableRefObject<Map<string, string>>;
}

const SelectContext = createContext<SelectContextValue | null>(null);
function useSelectContext() {
  const ctx = useContext(SelectContext);
  if (!ctx) throw new Error("Select compound components must be inside <Select>");
  return ctx;
}

interface SelectContentContextValue {
  id: string;
  activeIndex: number | null;
  setActiveIndex: (index: number | null) => void;
}

const SelectContentContext = createContext<SelectContentContextValue | null>(null);

// ─── Select (root) ───────────────────────────────────────────────────────────

interface SelectProps {
  children: ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  name?: string;
  required?: boolean;
}

function Select({ children, value, defaultValue, onValueChange, disabled = false, name, required }: SelectProps) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const currentValue = value !== undefined ? value : internalValue;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const labelMap = useRef(new Map<string, string>());
  const [, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const onChange = useCallback((v: string) => {
    if (value === undefined) setInternalValue(v);
    onValueChange?.(v);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  }, [value, onValueChange]);

  return (
    <SelectContext.Provider value={{ value: currentValue, onChange, open, setOpen, disabled, triggerRef, labelMap }}>
      {children}
      {name && <input type="hidden" name={name} value={currentValue} required={required} />}
    </SelectContext.Provider>
  );
}

Select.displayName = "Select";

// ─── SelectTrigger ───────────────────────────────────────────────────────────

const triggerVariants = cva(
  ["ace-select-trigger group inline-flex items-center justify-between gap-2 outline-none cursor-pointer",
   "text-[13px] h-9 px-3 min-w-[160px]", "transition-colors duration-100",
   "disabled:opacity-50 disabled:pointer-events-none", "focus-visible:ring-1 focus-visible:ring-[#5CF8B2]"],
  {
    variants: {
      variant: {
        bordered: "border border-border bg-transparent text-foreground hover:bg-muted",
        borderless: "border border-transparent bg-transparent text-foreground hover:bg-muted",
      },
    },
    defaultVariants: { variant: "bordered" },
  }
);

interface SelectTriggerProps extends Omit<HTMLAttributes<HTMLButtonElement>, "children">, VariantProps<typeof triggerVariants> {
  displayValue?: ReactNode;
  icon?: LucideIcon;
  placeholder?: string;
  error?: string;
}

const SelectTrigger = forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, variant, icon: Icon, placeholder = "Select…", error, displayValue, ...props }, ref) => {
    const { value, open, setOpen, disabled, triggerRef, labelMap } = useSelectContext();
    const label = value ? labelMap.current.get(value) ?? value : undefined;

    // A labelled bar around the trigger ([data-select-field]) opens it from anywhere on it.
    useEffect(() => {
      const area = triggerRef.current?.closest("[data-select-field]");
      if (!area) return undefined;
      const onClick = (event: Event) => {
        const trigger = triggerRef.current;
        if (!trigger || trigger.disabled || trigger.contains(event.target as Node)) return;
        trigger.click();
        trigger.focus({ preventScroll: true });
      };
      area.addEventListener("click", onClick);
      return () => area.removeEventListener("click", onClick);
    }, [triggerRef]);

    return (
      <div className="flex flex-col gap-1">
        <button
          ref={(node) => {
            (triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
          }}
          type="button" role="combobox" aria-expanded={open} aria-haspopup="listbox" disabled={disabled}
          onClick={() => setOpen(!open)}
          onKeyDown={(e) => { if (!open && ["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); setOpen(true); } }}
          aria-invalid={!!error || undefined}
          className={cn(triggerVariants({ variant }), "rounded-[12px]", error && "border-destructive/50", className)}
          {...props}
        >
          <span className="flex items-center gap-2 min-w-0 flex-1">
            {Icon && <Icon size={16} strokeWidth={1.5} className="shrink-0 text-muted-foreground transition-colors duration-100 group-hover:text-foreground" />}
            <span className="min-w-0 flex-1 text-left truncate">
              {displayValue ?? label ?? <span className="text-muted-foreground">{placeholder}</span>}
            </span>
          </span>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="ace-select-chevron shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {error && <span className="text-[12px] text-destructive pl-3">{error}</span>}
      </div>
    );
  }
);

SelectTrigger.displayName = "SelectTrigger";

// ─── SelectContent ───────────────────────────────────────────────────────────

interface SelectContentProps {
  className?: string;
  children: ReactNode;
  /** Which edge of the trigger the menu lines up with. */
  align?: "start" | "end";
}

const GAP = 6;
const EDGE = 8;
const MAX_HEIGHT = 300;

function inFixedLayer(node: Element | null) {
  for (let el = node; el && el !== document.body; el = el.parentElement) {
    if (getComputedStyle(el).position === "fixed") return true;
  }
  return false;
}

const SelectContent = forwardRef<HTMLDivElement, SelectContentProps>(
  ({ className, children, align = "start" }, ref) => {
    const { open, setOpen, value, triggerRef } = useSelectContext();
    const menuRef = useRef<HTMLDivElement>(null);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const id = useId();

    // Place the menu against its trigger. Written straight to the element's
    // style (no re-render), before the browser paints.
    const place = useCallback(() => {
      const menu = menuRef.current, trigger = triggerRef.current;
      if (!menu || !trigger) return;
      if (!trigger.isConnected) { setOpen(false); return; }
      const rect = trigger.getBoundingClientRect();
      const fixed = menu.dataset.fixed === "true";
      const below = window.innerHeight - rect.bottom - GAP - EDGE;
      const above = rect.top - GAP - EDGE;
      menu.style.maxHeight = `${Math.max(120, Math.min(MAX_HEIGHT, below))}px`;
      let height = menu.offsetHeight;
      const up = height > below && above > below;
      if (up) { menu.style.maxHeight = `${Math.max(120, Math.min(MAX_HEIGHT, above))}px`; height = menu.offsetHeight; }
      const width = menu.offsetWidth;
      let left = align === "end" ? rect.right - width : rect.left;
      left = Math.min(Math.max(EDGE, left), Math.max(EDGE, window.innerWidth - width - EDGE));
      const top = up ? rect.top - GAP - height : rect.bottom + GAP;
      // A menu in the page scrolls with it; one beside a fixed panel stays on screen with it.
      const dx = fixed ? 0 : window.scrollX, dy = fixed ? 0 : window.scrollY;
      menu.style.left = `${Math.round(left + dx)}px`;
      menu.style.top = `${Math.round(top + dy)}px`;
      menu.dataset.side = up ? "top" : "bottom";
    }, [align, triggerRef, setOpen]);

    useLayoutEffect(() => {
      if (!open) { setActiveIndex(null); return undefined; }
      const menu = menuRef.current;
      if (!menu) return undefined;
      menu.dataset.fixed = String(inFixedLayer(triggerRef.current));
      place();
      // Start on the chosen option, scrolled into view.
      const items = Array.from(menu.querySelectorAll<HTMLElement>('[role="option"]'));
      const checked = items.findIndex((el) => el.dataset.value === value);
      setActiveIndex(checked >= 0 ? checked : null);
      if (checked >= 0) items[checked].scrollIntoView({ block: "nearest" });
      menu.focus({ preventScroll: true });
      // The page's own scroll moves the menu with it; a scroll inside some
      // other box (or a resize) moves the trigger alone, so follow that.
      const onScroll = (event: Event) => {
        const target = event.target as Node;
        if (target === document || target === document.documentElement || menu.contains(target)) return;
        place();
      };
      window.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", place);
      const observer = typeof ResizeObserver === "function" ? new ResizeObserver(() => place()) : null;
      if (observer && triggerRef.current) observer.observe(triggerRef.current);
      return () => {
        window.removeEventListener("scroll", onScroll, true);
        window.removeEventListener("resize", place);
        observer?.disconnect();
      };
    }, [open, place, triggerRef, value]);

    // Escape and Tab close it; a press anywhere outside the trigger (or its labelled bar) and the menu closes it.
    useEffect(() => {
      if (!open) return undefined;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") { setOpen(false); triggerRef.current?.focus({ preventScroll: true }); }
        else if (e.key === "Tab") setOpen(false);
      };
      const onPointer = (e: PointerEvent) => {
        const target = e.target as Node;
        const area = triggerRef.current?.closest("[data-select-field]") ?? triggerRef.current;
        if (!menuRef.current?.contains(target) && !area?.contains(target)) setOpen(false);
      };
      document.addEventListener("keydown", onKey);
      document.addEventListener("pointerdown", onPointer);
      return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onPointer); };
    }, [open, setOpen, triggerRef]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
      const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="option"]:not([data-disabled])') ?? []);
      if (!items.length) return;
      const all = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
      const current = activeIndex == null ? -1 : items.indexOf(all[activeIndex]);
      let next: number | null = null;
      if (e.key === "ArrowDown") next = current < 0 ? 0 : (current + 1) % items.length;
      else if (e.key === "ArrowUp") next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = items.length - 1;
      else if ((e.key === "Enter" || e.key === " ") && current >= 0) { e.preventDefault(); items[current].click(); return; }
      if (next == null) return;
      e.preventDefault();
      setActiveIndex(all.indexOf(items[next]));
      items[next].scrollIntoView({ block: "nearest" });
    }, [activeIndex]);

    // Closed, the options still render (hidden) so the trigger knows their labels.
    if (!open) return <SelectContentContext.Provider value={{ id, activeIndex: null, setActiveIndex }}><div hidden aria-hidden="true">{children}</div></SelectContentContext.Provider>;

    return createPortal(
      <SelectContentContext.Provider value={{ id, activeIndex, setActiveIndex }}>
        <div
          ref={(node) => {
            (menuRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
          }}
          role="listbox" tabIndex={-1}
          aria-activedescendant={activeIndex != null ? `${id}-${activeIndex}` : undefined}
          onKeyDown={handleKeyDown}
          onMouseLeave={() => setActiveIndex(null)}
          className={cn("ace-select-menu", className)}
        >
          {children}
        </div>
      </SelectContentContext.Provider>,
      triggerRef.current?.closest("dialog[open]") ?? document.body
    );
  }
);

SelectContent.displayName = "SelectContent";

// ─── SelectItem ──────────────────────────────────────────────────────────────

interface SelectItemProps extends HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  index: number;
  value: string;
  disabled?: boolean;
}

const SelectItem = forwardRef<HTMLDivElement, SelectItemProps>(
  ({ className, children, icon: Icon, value, index, disabled = false, ...props }, ref) => {
    const selectCtx = useSelectContext();
    const contentCtx = useContext(SelectContentContext);

    useEffect(() => { if (typeof children === "string") selectCtx.labelMap.current.set(value, children); }, [value, children, selectCtx.labelMap]);

    const isActive = contentCtx?.activeIndex === index;
    const isChecked = selectCtx.value === value;

    return (
      <div
        ref={ref}
        id={contentCtx ? `${contentCtx.id}-${index}` : undefined}
        data-value={value} data-disabled={disabled || undefined} data-active={isActive || undefined}
        role="option" aria-selected={isChecked} aria-disabled={disabled || undefined}
        aria-label={typeof children === "string" ? children : undefined}
        onMouseMove={() => { if (!isActive) contentCtx?.setActiveIndex(index); }}
        onClick={() => { if (!disabled) selectCtx.onChange(value); }}
        className={cn("ace-select-item", className)}
        {...props}
      >
        {Icon && <Icon size={15} strokeWidth={isChecked ? 2 : 1.6} className="shrink-0" />}
        <span className="ace-select-text">{children}</span>
        {isChecked && (
          <svg className="ace-select-check" width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 12L9 17L20 6" />
          </svg>
        )}
      </div>
    );
  }
);

SelectItem.displayName = "SelectItem";

// ─── SelectGroup / SelectLabel / SelectSeparator ─────────────────────────────

function SelectGroup({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div role="group" className={className} {...props}>{children}</div>;
}
SelectGroup.displayName = "SelectGroup";

const SelectLabel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("ace-select-label", className)} {...props} />
);
SelectLabel.displayName = "SelectLabel";

const SelectSeparator = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} role="separator" className={cn("ace-select-separator", className)} {...props} />
);
SelectSeparator.displayName = "SelectSeparator";

export { Select, SelectTrigger, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectSeparator, triggerVariants };
export type { SelectProps, SelectTriggerProps, SelectContentProps, SelectItemProps };
