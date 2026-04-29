import type { HoverAnimation } from '@/types/pet'
import type { Variants, Transition } from 'motion/react'

export const HOVER_ANIMATIONS: HoverAnimation[] = ['spin', 'stretch', 'think', 'bounce', 'heart']

export function pickRandomHover(last?: HoverAnimation | null): HoverAnimation {
  const candidates = last ? HOVER_ANIMATIONS.filter((a) => a !== last) : HOVER_ANIMATIONS
  return candidates[Math.floor(Math.random() * candidates.length)]
}

export const containerVariants: Variants = {
  idle: { scale: 1 },
  hovered: { scale: 1.12 },
}

export const containerTransition: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 22,
}

export const bodyVariants: Variants = {
  wiggle: {
    rotate: [0, 4, 0, -4, 0],
    y: 0,
    scaleY: 1,
    scaleX: 1,
  },
  spin: {
    rotate: [0, 360],
    transition: { duration: 0.8, ease: 'easeInOut' },
  },
  spinCCW: {
    rotate: [0, -360],
    transition: { duration: 0.8, ease: 'easeInOut' },
  },
  stretch: {
    scaleY: [1, 1.3, 0.9, 1],
    scaleX: [1, 0.85, 1.1, 1],
    transition: { duration: 1.2, ease: 'easeInOut' },
  },
  bounce: {
    y: [0, -20, 0, -10, 0],
    rotate: [0, -10, 0, 10, 0],
    transition: { duration: 0.8, ease: 'easeInOut' },
  },
  think: {
    rotate: [0, 6, -6, 4, -4, 0],
    y: 0,
    scaleY: 1,
    scaleX: 1,
    transition: { duration: 1.5, ease: 'easeInOut' },
  },
  heart: {
    scaleY: [1, 1.15, 1],
    scaleX: [1, 0.9, 1],
    y: [0, -4, 0],
    transition: { duration: 1, ease: 'easeInOut' },
  },
}

export const wiggleTransition: Transition = {
  duration: 4,
  ease: 'easeInOut',
  repeat: Infinity,
}
