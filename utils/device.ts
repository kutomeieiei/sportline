import { useEffect, useState } from 'react';

/** True on phones/tablets (finger is the main pointer), false with a mouse. */
export const isTouchDevice = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;


/** True while the screen is phone-sized (narrower than 640px). Updates on resize/rotate. */
export function useIsPhone() {
  const query = '(max-width: 639px)';
  const [isPhone, setIsPhone] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const update = () => setIsPhone(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return isPhone;
}
