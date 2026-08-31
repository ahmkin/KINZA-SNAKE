import { useEffect, useRef } from "react";
import type { SnakeEngine } from "../game/engine";

/**
 * Canvas host + touch swipe steering. The engine owns all drawing;
 * this component only wires up sizing and gestures.
 */
export function GameBoard({ engine }: { engine: SnakeEngine }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    engine.attach(canvas);
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      engine.resize(Math.max(120, Math.min(rect.width, rect.height)));
    });
    ro.observe(wrap);
    return () => {
      ro.disconnect();
      engine.detach();
    };
  }, [engine]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      touchRef.current = { x: t.clientX, y: t.clientY };
    };
    const onMove = (e: TouchEvent) => {
      // stop the page from scrolling while steering
      e.preventDefault();
      const origin = touchRef.current;
      if (!origin) return;
      const t = e.touches[0];
      const dx = t.clientX - origin.x;
      const dy = t.clientY - origin.y;
      const THRESHOLD = 24;
      if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return;
      if (Math.abs(dx) > Math.abs(dy)) engine.queueDir({ x: dx > 0 ? 1 : -1, y: 0 });
      else engine.queueDir({ x: 0, y: dy > 0 ? 1 : -1 });
      // continuous steering — reset origin so long swipes can chain turns
      touchRef.current = { x: t.clientX, y: t.clientY };
    };
    const onCtx = (e: Event) => e.preventDefault();

    wrap.addEventListener("touchstart", onStart, { passive: true });
    wrap.addEventListener("touchmove", onMove, { passive: false });
    wrap.addEventListener("contextmenu", onCtx);
    return () => {
      wrap.removeEventListener("touchstart", onStart);
      wrap.removeEventListener("touchmove", onMove);
      wrap.removeEventListener("contextmenu", onCtx);
    };
  }, [engine]);

  return (
    <div ref={wrapRef} className="canvas-stage absolute inset-0">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
