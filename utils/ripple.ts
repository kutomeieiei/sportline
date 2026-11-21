// Material-style ripple: any element with the class "ripple" shows a soft
// circle spreading from where it was pressed. One listener for the whole app.
let installed = false;

export function installRipple() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('pointerdown', (event) => {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('.ripple');
    if (!target || (target as HTMLButtonElement).disabled) return;
    const rect = target.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const wave = document.createElement('span');
    wave.className = 'ripple-wave';
    wave.style.width = wave.style.height = `${size}px`;
    wave.style.left = `${event.clientX - rect.left - size / 2}px`;
    wave.style.top = `${event.clientY - rect.top - size / 2}px`;
    target.appendChild(wave);
    wave.addEventListener('animationend', () => wave.remove(), { once: true });
  }, { passive: true });
}
