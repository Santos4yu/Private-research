// Adapted from the Aceternity UI sidebar for this project's actual stack:
// Vite + React Router-less SPA (no Next.js), so `next/link`/`next/image`
// are replaced with a plain `<button>` (nav here is a custom-event tab
// switch, not a real route change) and `<img>`. Behavior (hover-to-expand
// width animation, animated label reveal) is unchanged from the original.
import { cn } from "@/lib/utils";
import React, { useState, createContext, useContext } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";

interface Links {
  label: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  badge?: React.ReactNode;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
  // A wider open width, and no collapse on mouse-out, while something is
  // shown inside the rail (the Pick Builder).
  width?: string;
  pinned?: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) throw new Error("useSidebar must be used within a SidebarProvider");
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
  width,
  pinned = false,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
  width?: string;
  pinned?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);
  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;
  return <SidebarContext.Provider value={{ open, setOpen, animate, width, pinned }}>{children}</SidebarContext.Provider>;
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
  width,
  pinned,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
  width?: string;
  pinned?: boolean;
}) => (
  <SidebarProvider open={open} setOpen={setOpen} animate={animate} width={width} pinned={pinned}>
    {children}
  </SidebarProvider>
);

// Desktop rail only: phones navigate with the bottom dock and the side
// panel, and the mobile variant here was always hidden (vortex-sidebar.css)
// -- rendering it just duplicated the rail's contents in the page.
export const SidebarBody = (props: React.ComponentProps<typeof motion.div>) => <DesktopSidebar {...props} />;

export const DesktopSidebar = ({ className, children, ...props }: React.ComponentProps<typeof motion.div>) => {
  const { open, setOpen, animate, width, pinned } = useSidebar();
  const wide = width || "220px";
  return (
    <motion.div
      className={cn("vortex-sidebar-desktop", className)}
      animate={{ width: pinned ? wide : animate ? (open ? wide : "64px") : wide }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => { if (!pinned) setOpen(false); }}
      transition={{ type: "spring", stiffness: 400, damping: 38, mass: 0.6 }}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const MobileSidebar = ({ className, children, ...props }: React.ComponentProps<"div">) => {
  const { open, setOpen } = useSidebar();
  return (
    <div className="vortex-sidebar-mobile" {...props}>
      <button type="button" className="vortex-sidebar-mobile-toggle" aria-label="Open navigation" onClick={() => setOpen(!open)}>
        <Menu size={20} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className={cn("vortex-sidebar-mobile-panel", className)}
          >
            <button type="button" className="vortex-sidebar-mobile-close" aria-label="Close navigation" onClick={() => setOpen(false)}>
              <X size={20} />
            </button>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const SidebarLink = ({ link, className, ...props }: { link: Links; className?: string }) => {
  const { open, animate, pinned } = useSidebar();
  const shown = pinned || open;
  return (
    <button
      type="button"
      className={cn("vortex-sidebar-link", link.active && "active", className)}
      onClick={link.onClick}
      aria-current={link.active ? "page" : undefined}
      aria-label={link.label}
      {...props}
    >
      <span className="vortex-sidebar-link-icon">{link.icon}</span>
      <motion.span
        animate={{
          display: animate ? (shown ? "inline-block" : "none") : "inline-block",
          opacity: animate ? (shown ? 1 : 0) : 1,
        }}
        className="vortex-sidebar-link-label"
      >
        {link.label}
      </motion.span>
      {link.badge}
    </button>
  );
};
