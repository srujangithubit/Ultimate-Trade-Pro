'use client';

import { useState, useEffect } from 'react';

/* ─── Animation Tier Types ───────────────────────────────────────────────── */

export type AnimationTier = 'high' | 'medium' | 'low';

/* ─── WebGL Detection ────────────────────────────────────────────────────── */

/**
 * Checks whether WebGL is available in the current environment.
 * Returns false on SSR or when the GPU context cannot be created.
 */
export function canUseWebGL(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    if (!gl) return false;

    // Clean up context
    if (gl instanceof WebGLRenderingContext || gl instanceof WebGL2RenderingContext) {
      const ext = gl.getExtension('WEBGL_lose_context');
      ext?.loseContext();
    }
    return true;
  } catch {
    return false;
  }
}

/* ─── Canvas Benchmark ───────────────────────────────────────────────────── */

function benchmarkCanvas(): AnimationTier {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return 'low';

    // Simple draw-call benchmark: render 60 frames and measure time
    const start = performance.now();
    const iterations = 60;

    for (let i = 0; i < iterations; i++) {
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.flush();
    }
    gl.finish();

    const elapsed = performance.now() - start;

    // Clean up
    if (gl instanceof WebGLRenderingContext || gl instanceof WebGL2RenderingContext) {
      const ext = gl.getExtension('WEBGL_lose_context');
      ext?.loseContext();
    }

    // Under 16ms for 60 clear-calls → high performance GPU
    if (elapsed < 16) return 'high';
    // Under 50ms → medium
    if (elapsed < 50) return 'medium';
    return 'low';
  } catch {
    return 'low';
  }
}

/* ─── useAnimationTier Hook ──────────────────────────────────────────────── */

/**
 * Determines the animation tier for the current device.
 * - Forces 'low' on mobile (< 768px) or when WebGL is unavailable.
 * - Runs a quick canvas benchmark on mount to classify 'high' | 'medium' | 'low'.
 * - Result is memoized for the lifetime of the component.
 */
export function useAnimationTier(): AnimationTier {
  const [tier, setTier] = useState<AnimationTier>('low');

  useEffect(() => {
    // Mobile devices → always low
    if (window.innerWidth < 768) {
      setTier('low');
      return;
    }

    // No WebGL → low
    if (!canUseWebGL()) {
      setTier('low');
      return;
    }

    // Run benchmark
    const result = benchmarkCanvas();
    setTier(result);
  }, []);

  return tier;
}
