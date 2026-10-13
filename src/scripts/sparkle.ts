/**
 * Click sparkles (Motion ON only): a small burst of anchors, stars and hearts where you click or tap.
 * One fixed, non-interactive layer; each sparkle removes itself when its animation ends.
 */
const GLYPHS = ['⚓', '✦', '♡', '●', '✦', '⚓', '♡', '✦', '●', '♡'];
const COLORS = ['#ec6fae', '#25b6e3', '#8d6ad8', '#3b4583', '#f29a3c'];
let layer: HTMLElement | null = null;

document.addEventListener(
  'pointerdown',
  (e) => {
    if (document.documentElement.dataset.motion !== 'on' || e.button !== 0) return;
    const t = e.target as HTMLElement | null;
    if (t?.closest?.('input, textarea, select, [contenteditable], iframe, .lightbox')) return;
    if (!layer?.isConnected) {
      layer = document.createElement('div');
      layer.className = 'sparkles';
      layer.setAttribute('aria-hidden', 'true');
      document.body.append(layer);
    }
    for (let i = 0; i < GLYPHS.length; i++) {
      const s = document.createElement('span');
      s.textContent = GLYPHS[i]!;
      s.style.left = `${e.clientX}px`;
      s.style.top = `${e.clientY}px`;
      s.style.color = COLORS[i % COLORS.length]!;
      s.style.fontSize = `${13 + Math.random() * 11}px`;
      layer.append(s);
      const a = (Math.PI * 2 * i) / GLYPHS.length + Math.random() * 0.7;
      const d = 34 + Math.random() * 46;
      s.animate(
        [
          { transform: 'translate(-50%, -50%) scale(0.3)', opacity: 1 },
          { opacity: 1, offset: 0.55 },
          {
            transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d - 10}px)) scale(1) rotate(${Math.random() * 120 - 60}deg)`,
            opacity: 0,
          },
        ],
        { duration: 620 + Math.random() * 280, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      ).onfinish = () => s.remove();
    }
  },
  { passive: true },
);
