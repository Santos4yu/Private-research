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

const spanVariants = {
  initial: { opacity: 0, scaleX: 0.86, x: -3 },
  animate: { opacity: 1, scaleX: 1, x: 0 },
  exit: { opacity: 0, scaleX: 0.9, x: -2 },
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
    : { type: "spring" as const, bounce: 0, stiffness: 520, damping: 38, mass: 0.65 };

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
    <motion.div
      layout={!reduceMotion}
      ref={outsideClickRef}
      className={cn(
        "flex flex-wrap items-center gap-1 rounded-xl! border bg-background/90 p-1! shadow-xl backdrop-blur-xl",
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
            layout={!reduceMotion}
            onClick={() => handleSelect(index)}
            transition={transition}
            className={cn(
              "expandable-tab relative flex items-center justify-center overflow-hidden rounded-lg! text-sm font-medium transition-[color,background-color,transform] hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2",
              isSelected
                ? cn("bg-muted", activeColor)
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            data-tab={tab.value}
            data-selected={isSelected ? "true" : "false"}
            aria-current={isSelected ? "page" : undefined}
            aria-label={tab.title}
          >
            <motion.span layout="position" className="expandable-tab-icon" aria-hidden="true">
              <Icon size={17} strokeWidth={1.8} />
            </motion.span>
            <AnimatePresence initial={false} mode="popLayout">
              {isSelected && (
                <motion.span
                  variants={spanVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={transition}
                  className="expandable-tab-label overflow-hidden whitespace-nowrap"
                >
                  {tab.title}
                </motion.span>
              )}
            </AnimatePresence>
            {tab.badge}
          </motion.button>
        );
      })}
    </motion.div>
  );
}
