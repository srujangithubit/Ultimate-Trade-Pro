'use client';

import { Suspense, useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import dynamic from 'next/dynamic';
import { useAnimationTier } from '@/lib/3d/utils/performance';
import { gridVertexShader, gridFragmentShader } from '@/lib/3d/shaders/grid.glsl';

/* ─── Neon Grid Floor ────────────────────────────────────────────────────── */

function NeonGrid() {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 0.6 },
    }),
    []
  );

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]}>
      <planeGeometry args={[20, 20, 64, 64]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={gridVertexShader}
        fragmentShader={gridFragmentShader}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/* ─── Floating Candlestick Bars ──────────────────────────────────────────── */

function CandlestickBars() {
  const groupRef = useRef<THREE.Group>(null);

  const bars = useMemo(() => {
    const result: Array<{
      x: number;
      z: number;
      height: number;
      color: string;
      speed: number;
      offset: number;
    }> = [];
    for (let i = 0; i < 18; i++) {
      const isProfit = Math.random() > 0.4;
      result.push({
        x: (Math.random() - 0.5) * 12,
        z: (Math.random() - 0.5) * 12,
        height: 0.1 + Math.random() * 0.5,
        color: isProfit ? '#29c05e' : '#d4453a',
        speed: 0.2 + Math.random() * 0.6,
        offset: Math.random() * Math.PI * 2,
      });
    }
    return result;
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, i) => {
      const bar = bars[i];
      if (!bar) return;
      child.position.y = -0.5 + Math.sin(state.clock.elapsedTime * bar.speed + bar.offset) * 0.3;
    });
  });

  return (
    <group ref={groupRef}>
      {bars.map((bar, i) => (
        <mesh key={i} position={[bar.x, -0.5, bar.z]}>
          <boxGeometry args={[0.06, bar.height, 0.06]} />
          <meshBasicMaterial color={bar.color} transparent opacity={0.35} />
        </mesh>
      ))}
    </group>
  );
}

/* ─── Particle Tick Stream ───────────────────────────────────────────────── */

function ParticleStream() {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 120;

  const [positions, velocities] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      pos[i3] = (Math.random() - 0.5) * 14;
      pos[i3 + 1] = (Math.random() - 0.5) * 4 - 0.5;
      pos[i3 + 2] = (Math.random() - 0.5) * 14;
      vel[i3] = (Math.random() - 0.5) * 0.005;
      vel[i3 + 1] = 0.003 + Math.random() * 0.008;
      vel[i3 + 2] = (Math.random() - 0.5) * 0.005;
    }
    return [pos, vel];
  }, []);

  useFrame(() => {
    if (!pointsRef.current) return;
    const attr = pointsRef.current.geometry.attributes.position;
    const posArray = attr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      posArray[i3] += velocities[i3];
      posArray[i3 + 1] += velocities[i3 + 1];
      posArray[i3 + 2] += velocities[i3 + 2];

      // Reset particles that drift too high
      if (posArray[i3 + 1] > 2.5) {
        posArray[i3] = (Math.random() - 0.5) * 14;
        posArray[i3 + 1] = -2;
        posArray[i3 + 2] = (Math.random() - 0.5) * 14;
      }
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#4d6fff"
        size={0.025}
        transparent
        opacity={0.4}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

/* ─── Scene Composition ──────────────────────────────────────────────────── */

function TradingScene() {
  return (
    <>
      <NeonGrid />
      <CandlestickBars />
      <ParticleStream />
    </>
  );
}

/* ─── Main Background Component ──────────────────────────────────────────── */

function TradingGridBackgroundInner() {
  const tier = useAnimationTier();
  const [paused, setPaused] = useState(false);

  const handleVisibility = useCallback(() => {
    setPaused(document.hidden);
  }, []);

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [handleVisibility]);

  // Skip render entirely on 'low' tier
  if (tier === 'low') return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        pointerEvents: 'none',
        opacity: 0.12,
      }}
      aria-hidden="true"
    >
      <Suspense fallback={null}>
        <Canvas
          gl={{
            antialias: false,
            alpha: true,
            powerPreference: 'low-power',
            failIfMajorPerformanceCaveat: true,
          }}
          camera={{ position: [0, 3, 6], fov: 50, near: 0.1, far: 30 }}
          frameloop={paused ? 'never' : 'always'}
          dpr={[1, 1.5]}
          style={{ width: '100%', height: '100%' }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
          }}
        >
          <TradingScene />
        </Canvas>
      </Suspense>
    </div>
  );
}

/* ─── Error Boundary Wrapper ─────────────────────────────────────────────── */

function TradingGridBackgroundSafe() {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      if (
        e.message?.includes('WebGL') ||
        e.message?.includes('THREE') ||
        e.message?.includes('canvas')
      ) {
        setHasError(true);
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) return null;

  return <TradingGridBackgroundInner />;
}

/* ─── Dynamic Export (no SSR) ────────────────────────────────────────────── */

const TradingGridBackground = dynamic(
  () => Promise.resolve(TradingGridBackgroundSafe),
  { ssr: false }
);

export default TradingGridBackground;
