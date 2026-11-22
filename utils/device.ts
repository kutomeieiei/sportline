/** True on phones/tablets (finger is the main pointer), false with a mouse. */
export const isTouchDevice = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
