"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useOnClickOutside } from "usehooks-ts";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ExpandableTab {
  title: string;
  icon: LucideIcon;
  value?: string;
  badge?: React.ReactNode;
  type?: never;
}

export interface ExpandableTabSeparator {
  type: "separator";
  title?: never;
  icon?: never;
  value?: never;
  badge?: never;
}

export type ExpandableTabItem = ExpandableTab | ExpandableTabSeparator;

interface ExpandableTabsProps {
  tabs: ExpandableTabItem[];
  className?: string;
  activeColor?: string;
  selectedIndex?: number | null;
  defaultSelectedIndex?: number | null;
  collapseOnOutside?: boolean;
  ariaLabel?: string;
  onChange?: (index: number | null) => void;
}

const buttonVariants = {
  initial: { gap: 0, paddingLeft: ".75rem", paddingRight: ".75rem" },
  animate: (isSelected: boolean) => ({
    gap: isSelected ? ".5rem" : 0,
    paddingLeft: isSelected ? "1rem" : ".75rem",
    paddingRight: isSelected ? "1rem" : ".75rem",
  }),
};

const spanVariants = {
  initial: { width: 0, opacity: 0 },
  animate: { width: "auto", opacity: 1 },
  exit: { width: 0, opacity: 0 },
};

export function ExpandableTabs({
  tabs,
  className,
  activeColor = "text-[var(--theme-accent)]",
  selectedIndex,
  defaultSelectedIndex = 0,
  collapseOnOutside = true,
  ariaLabel = "Primary navigation",
  onChange,
}: ExpandableTabsProps) {
  const [internalSelected, setInternalSelected] = React.useState<number | null>(defaultSelectedIndex);
  const outsideClickRef = React.useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const isControlled = selectedIndex !== undefined;
  const selected = isControlled ? selectedIndex : internalSelected;
  const transition = reduceMotion
    ? { duration: 0 }
    : { delay: 0.04, type: "spring" as const, bounce: 0, duration: 0.48 };

  useOnClickOutside(outsideClickRef as React.RefObject<HTMLElement>, () => {
    if (!collapseOnOutside) return;
    if (!isControlled) setInternalSelected(null);
    onChange?.(null);
  });

  const handleSelect = (index: number) => {
    if (!isControlled) setInternalSelected(index);
    onChange?.(index);
  };

  return (
    <div
      ref={outsideClickRef}
      className={cn(
        "flex flex-wrap items-center gap-1 rounded-2xl border bg-background p-1 shadow-sm",
        className,
      )}
      aria-label={ariaLabel}
    >
      {tabs.map((tab, index) => {
        if (tab.type === "separator") {
          return <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" key={`separator-${index}`} />;
        }

        const Icon = tab.icon;
        const isSelected = selected === index;
        return (
          <motion.button
            key={tab.title}
            type="button"
            variants={buttonVariants}
            initial={false}
            animate="animate"
            custom={isSelected}
            onClick={() => handleSelect(index)}
            transition={transition}
            className={cn(
              "expandable-tab relative flex min-h-11 min-w-11 items-center justify-center overflow-hidden rounded-xl py-2 text-sm font-medium transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2",
              isSelected
                ? cn("bg-muted", activeColor)
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            data-tab={tab.value}
            data-selected={isSelected ? "true" : "false"}
            aria-current={isSelected ? "page" : undefined}
            aria-label={tab.title}
          >
            <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
            <AnimatePresence initial={false}>
              {isSelected && (
                <motion.span
                  variants={spanVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={transition}
                  className="overflow-hidden whitespace-nowrap"
                >
                  {tab.title}
                </motion.span>
              )}
            </AnimatePresence>
            {tab.badge}
          </motion.button>
        );
      })}
    </div>
  );
}
