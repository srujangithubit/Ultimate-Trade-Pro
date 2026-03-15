/* ─── Framer Motion Animation Presets ───────────────────── */
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
} as const;

export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 20 },
  transition: { duration: 0.3, ease: 'easeOut' as const },
} as const;

export const fadeInDown = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.3, ease: 'easeOut' as const },
} as const;

export const scaleIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2, ease: 'easeOut' as const },
} as const;

export const slideInLeft = {
  initial: { opacity: 0, x: -30 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 },
  transition: { duration: 0.3 },
} as const;

export const slideInRight = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 30 },
  transition: { duration: 0.3 },
} as const;

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.06,
    },
  },
} as const;

export const staggerItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
} as const;

export const pulse = {
  animate: {
    scale: [1, 1.05, 1],
    transition: { duration: 0.3 },
  },
} as const;

/* ─── 3D Animation Presets ──────────────────────────────────────────────── */

/**
 * cardTilt3D — mouse-tracking rotateX/rotateY up to 8°, translateZ(12px) on hover.
 * Use with onMouseMove handler to compute rotateX/rotateY from cursor position.
 */
export const cardTilt3D = {
  rest: {
    rotateX: 0,
    rotateY: 0,
    z: 0,
    transition: { duration: 0.4, ease: 'easeOut' as const },
  },
  hover: {
    z: 12,
    transition: { duration: 0.25, ease: 'easeOut' as const },
  },
  /** Max tilt angle in degrees for mouse-tracking */
  maxTilt: 8,
} as const;

/**
 * buttonPress3D — hover lifts with subtle rotateX, tap squishes.
 */
export const buttonPress3D = {
  rest: {
    z: 0,
    rotateX: 0,
    scale: 1,
    transition: { duration: 0.2, ease: 'easeOut' as const },
  },
  hover: {
    z: 6,
    rotateX: 3,
    scale: 1.02,
    transition: { duration: 0.2, ease: 'easeOut' as const },
  },
  tap: {
    z: 0,
    rotateX: 0,
    scale: 0.97,
    transition: { duration: 0.1 },
  },
} as const;

/**
 * pageEnter3D — enter from rotateX(4deg) translateZ(-40px) opacity:0 → flat, 280ms spring.
 * Designed to overlay on existing page-transition variants.
 */
export const pageEnter3D = {
  hidden: {
    opacity: 0,
    rotateX: 4,
    z: -40,
    y: 20,
  },
  enter: {
    opacity: 1,
    rotateX: 0,
    z: 0,
    y: 0,
  },
  exit: {
    opacity: 0,
    rotateX: -2,
    z: -20,
    y: -20,
  },
  transition: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 25,
    duration: 0.28,
  },
} as const;

