/** Bubble field (EXECUTIONPLAN §9.0): ≤ 40 bubbles, 30 fps cap, reacts to the cursor, paused when hidden or Motion OFF. */
import { onMotion } from '../lib/lifecycle';

type B = { x: number; y: number; r: number; vy: number; ph: number; pop: number };

export function startBubbles(canvas: HTMLCanvasElement, max = 40): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => undefined;
  let w = 0;
  let h = 0;
  let raf = 0;
  let last = 0;
  let running = false;
  const mouse = { x: -999, y: -999 };
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const bubbles: B[] = [];
  const spawn = (y?: number): B => ({
    x: Math.random() * w,
    y: y ?? h + 20,
    r: 3 + Math.random() * 11,
    vy: 0.25 + Math.random() * 0.6,
    ph: Math.random() * 6.28,
    pop: 0,
  });

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    w = rect.width;
    h = rect.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(max, Math.round((w * h) / 42000));
    while (bubbles.length < n) bubbles.push(spawn(Math.random() * h));
    bubbles.length = n;
  };
  const draw = (t: number) => {
    raf = requestAnimationFrame(draw);
    if (t - last < 33) return; // 30 fps
    last = t;
    ctx.clearRect(0, 0, w, h);
    for (const b of bubbles) {
      b.y -= b.vy;
      b.ph += 0.02;
      const x = b.x + Math.sin(b.ph) * 6;
      const dx = x - mouse.x;
      const dy = b.y - mouse.y;
      if (!b.pop && dx * dx + dy * dy < (b.r + 18) ** 2) b.pop = 1;
      if (b.pop) b.pop += 0.12;
      if (b.y < -20 || b.pop > 1.6) Object.assign(b, spawn());
      const r = b.r * (b.pop ? 1 + b.pop * 0.6 : 1);
      ctx.globalAlpha = b.pop ? Math.max(0, 1.6 - b.pop) * 0.6 : 0.6;
      ctx.beginPath();
      ctx.arc(x, b.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = '#9ED2F2';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x - r * 0.35, b.y - r * 0.35, r * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  };
  const start = () => {
    if (running) return;
    running = true;
    raf = requestAnimationFrame(draw);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
    ctx.clearRect(0, 0, w, h);
  };
  let motionOn = false;
  const sync = () => (motionOn && !document.hidden ? start() : stop());
  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  const offMotion = onMotion((on) => {
    motionOn = on;
    sync();
  });
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pointermove', onMove, { passive: true });
  return () => {
    stop();
    ro.disconnect();
    offMotion();
    document.removeEventListener('visibilitychange', sync);
    window.removeEventListener('pointermove', onMove);
  };
}
