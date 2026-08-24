'use client';

import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { Children, cloneElement, useEffect, useMemo, useRef, useState } from 'react';

import './Dock.css';

function DockItem({ children, active = false, onClick, mouseX, spring, distance, magnification, baseItemSize, label }) {
  const ref = useRef(null);
  const isHovered = useMotionValue(0);

  const mouseDistance = useTransform(mouseX, val => {
    const rect = ref.current?.getBoundingClientRect() ?? {
      x: 0,
      width: baseItemSize
    };
    return val - rect.x - baseItemSize / 2;
  });

  const targetSize = useTransform(mouseDistance, [-distance, 0, distance], [baseItemSize, magnification, baseItemSize]);
  const size = useSpring(targetSize, spring);

  const handleKeyDown = e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <motion.div
      ref={ref}
      style={{
        width: size,
        height: size
      }}
      onHoverStart={() => isHovered.set(1)}
      onHoverEnd={() => isHovered.set(0)}
      onFocus={() => isHovered.set(1)}
      onBlur={() => isHovered.set(0)}
      onClick={onClick}
      className={active
        ? 'dock-item active rounded-xl! border-transparent!'
        : 'dock-item rounded-xl! bg-transparent! border-transparent!'}
      tabIndex={0}
      role="button"
      aria-label={label}
      onKeyDown={handleKeyDown}
    >
      {Children.map(children, child => cloneElement(child, { isHovered }))}
    </motion.div>
  );
}

function DockIcon({ children, className = '' }) {
  return <div className={`dock-icon ${className}`}>{children}</div>;
}

export default function Dock({
  items,
  spring = { mass: 0.1, stiffness: 150, damping: 12 },
  magnification = 70,
  distance = 200,
  panelHeight = 68,
  dockHeight = 256,
  baseItemSize = 50
}) {
  const mouseX = useMotionValue(Infinity);
  const isHovered = useMotionValue(0);
  const [isMobileVisible, setIsMobileVisible] = useState(true);

  useEffect(() => {
    let frame = 0;
    const syncMobileDock = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const isMobile = window.matchMedia('(max-width: 700px)').matches;
        setIsMobileVisible(!isMobile || window.scrollY <= 8);
      });
    };
    window.addEventListener('scroll', syncMobileDock, { passive: true });
    window.addEventListener('resize', syncMobileDock);
    syncMobileDock();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', syncMobileDock);
      window.removeEventListener('resize', syncMobileDock);
    };
  }, []);

  const maxHeight = useMemo(
    () => Math.max(dockHeight, magnification + magnification / 2 + 4),
    [magnification, dockHeight]
  );
  const heightRow = useTransform(isHovered, [0, 1], [panelHeight, maxHeight]);
  const height = useSpring(heightRow, spring);

  return (
    <motion.div style={{ height, scrollbarWidth: 'none' }} className="dock-outer">
      <motion.div
        onMouseMove={({ pageX }) => {
          isHovered.set(1);
          mouseX.set(pageX);
        }}
        onMouseLeave={() => {
          isHovered.set(0);
          mouseX.set(Infinity);
        }}
        className={isMobileVisible
          ? 'dock-panel rounded-2xl! border-white/10! shadow-2xl! backdrop-blur-xl!'
          : 'dock-panel dock-mobile-hidden rounded-2xl! border-white/10! shadow-2xl! backdrop-blur-xl!'}
        style={{ height: panelHeight }}
        role="toolbar"
        aria-label="Application dock"
      >
        {items.map((item, index) => (
          <DockItem
            key={index}
            onClick={item.onClick}
            active={item.className === 'active'}
            mouseX={mouseX}
            spring={spring}
            distance={distance}
            magnification={magnification}
            baseItemSize={baseItemSize}
            label={item.label}
          >
            <DockIcon>{item.icon}</DockIcon>
          </DockItem>
        ))}
      </motion.div>
    </motion.div>
  );
}

