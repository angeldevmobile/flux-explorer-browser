import { useEffect, useRef, useCallback } from "react";

/* ═══════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════ */
interface Bubble {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  r: number; // RGB red
  g: number; // RGB green
  b: number; // RGB blue
  phase: number;      // for organic sine wobble
  phaseSpeed: number;
  life: number;       // 0–1, spawned bubbles fade in then persist
}

interface BubbleBackgroundProps {
  /** Hex accent colors from the active theme */
  colorFrom: string;
  colorTo: string;
}

/* ═══════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════ */
let _idCounter = 0;

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.trim().replace("#", "");
  const full = clean.length === 3
    ? clean.split("").map(c => c + c).join("")
    : clean;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function createBubble(
  x: number, y: number,
  radius: number,
  rgb: [number, number, number],
  vx = 0, vy = 0,
): Bubble {
  const speed = 0.08 + Math.random() * 0.18;
  const angle = vx === 0 && vy === 0
    ? Math.random() * Math.PI * 2
    : Math.atan2(vy, vx);
  return {
    id: _idCounter++,
    x, y,
    vx: vx !== 0 || vy !== 0 ? vx : Math.cos(angle) * speed,
    vy: vy !== 0 || vx !== 0 ? vy : Math.sin(angle) * speed - 0.04,
    radius,
    opacity: 0.12 + Math.random() * 0.18,
    r: rgb[0], g: rgb[1], b: rgb[2],
    phase: Math.random() * Math.PI * 2,
    phaseSpeed: 0.003 + Math.random() * 0.005,
    life: 1,
  };
}

/* ═══════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════ */
export function BubbleBackground({ colorFrom, colorTo }: BubbleBackgroundProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const bubblesRef   = useRef<Bubble[]>([]);
  const mouseRef     = useRef({ x: -9999, y: -9999 });
  const animRef      = useRef<number>(0);
  const colorsRef    = useRef({ from: colorFrom, to: colorTo });

  /* Keep colors ref up to date without re-creating canvas */
  useEffect(() => {
    colorsRef.current = { from: colorFrom, to: colorTo };
    // Re-tint existing bubbles toward new palette
    const rgb0 = hexToRgb(colorFrom);
    const rgb1 = hexToRgb(colorTo);
    bubblesRef.current.forEach((b, i) => {
      const [r, g, bl] = i % 2 === 0 ? rgb0 : rgb1;
      b.r = r; b.g = g; b.b = bl;
    });
  }, [colorFrom, colorTo]);

  /* Initialize bubble field */
  const initBubbles = useCallback((w: number, h: number) => {
    const rgb0 = hexToRgb(colorsRef.current.from);
    const rgb1 = hexToRgb(colorsRef.current.to);

    bubblesRef.current = Array.from({ length: 20 }, (_, i) => {
      const rgb = i % 2 === 0 ? rgb0 : rgb1;
      return createBubble(
        Math.random() * w,
        Math.random() * h,
        22 + Math.random() * 88,
        rgb,
      );
    });
  }, []);

  /* Split a bubble on click */
  const handleSplit = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    const bubbles = bubblesRef.current;
    let hitIdx = -1;
    let maxR = 0;

    for (let i = 0; i < bubbles.length; i++) {
      const b = bubbles[i];
      const dist = Math.hypot(b.x - mx, b.y - my);
      if (dist < b.radius && b.radius > maxR) {
        maxR = b.radius;
        hitIdx = i;
      }
    }

    if (hitIdx < 0 || bubbles[hitIdx].radius < 24) return;

    const parent = bubbles.splice(hitIdx, 1)[0];
    const childCount = 3 + Math.floor(Math.random() * 2); // 3 or 4

    for (let i = 0; i < childCount; i++) {
      const angle = (i / childCount) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 0.7 + Math.random() * 1.2;
      const childR = parent.radius * (0.28 + Math.random() * 0.22);

      bubbles.push(createBubble(
        parent.x + Math.cos(angle) * parent.radius * 0.25,
        parent.y + Math.sin(angle) * parent.radius * 0.25,
        childR,
        [parent.r, parent.g, parent.b],
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
      ));
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    /* DPR-aware resize */
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      canvas.width  = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initBubbles(w, h);
    };

    /* Window-level listeners (canvas is pointer-events:none) */
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onClick = (e: MouseEvent) => handleSplit(e.clientX, e.clientY);

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("click", onClick);

    /* Animation loop */
    let lastTime = performance.now();

    const animate = (now: number) => {
      const rawDt = now - lastTime;
      lastTime = now;
      // clamp dt to avoid huge jumps on tab-switch
      const dt = Math.min(rawDt / 16.67, 2.5);

      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;

      ctx.clearRect(0, 0, w, h);

      const mouse = mouseRef.current;
      const bubbles = bubblesRef.current;

      for (const b of bubbles) {
        /* Organic wobble */
        b.phase += b.phaseSpeed * dt;
        const wX = Math.sin(b.phase) * 0.12;
        const wY = Math.cos(b.phase * 0.7) * 0.09;

        /* Mouse repulsion — soft liquid push */
        const dx   = b.x - mouse.x;
        const dy   = b.y - mouse.y;
        const dist = Math.hypot(dx, dy);
        const repR = b.radius * 4;

        if (dist < repR && dist > 0.5) {
          const force = (1 - dist / repR) * 0.6;
          b.vx += (dx / dist) * force * dt;
          b.vy += (dy / dist) * force * dt;
        }

        /* Damping — fluid-like drag */
        b.vx *= Math.pow(0.96, dt);
        b.vy *= Math.pow(0.96, dt);

        b.x += (b.vx + wX) * dt;
        b.y += (b.vy + wY) * dt;

        /* Soft boundary bounce */
        const pad = b.radius * 0.4;
        if (b.x < pad)     { b.x = pad;     b.vx =  Math.abs(b.vx) * 0.45; }
        if (b.x > w - pad) { b.x = w - pad; b.vx = -Math.abs(b.vx) * 0.45; }
        if (b.y < pad)     { b.y = pad;     b.vy =  Math.abs(b.vy) * 0.45; }
        if (b.y > h - pad) { b.y = h - pad; b.vy = -Math.abs(b.vy) * 0.45; }

        /* Draw — soft radial gradient bubble */
        const grad = ctx.createRadialGradient(
          b.x - b.radius * 0.28,
          b.y - b.radius * 0.28,
          b.radius * 0.05,
          b.x, b.y,
          b.radius,
        );
        grad.addColorStop(0,   `rgba(${b.r}, ${b.g}, ${b.b}, ${b.opacity * 0.65})`);
        grad.addColorStop(0.45, `rgba(${b.r}, ${b.g}, ${b.b}, ${b.opacity * 0.28})`);
        grad.addColorStop(1,   `rgba(${b.r}, ${b.g}, ${b.b}, 0)`);

        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        /* Subtle rim — only visible on larger bubbles */
        if (b.radius > 35) {
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${b.r}, ${b.g}, ${b.b}, ${b.opacity * 0.35})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("click", onClick);
    };
  }, [initBubbles, handleSplit]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
        opacity: 0.85,
      }}
    />
  );
}
