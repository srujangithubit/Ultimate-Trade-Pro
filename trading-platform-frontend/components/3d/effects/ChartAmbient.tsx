'use client';

import { Suspense, useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import dynamic from 'next/dynamic';
import { useAnimationTier } from '@/lib/3d/utils/performance';

/* ─── Ambient Glow Grid ──────────────────────────────────────────────────── */

function GlowGrid() {
  const groupRef = useRef<THREE.Group>(null);

  const lines = useMemo(() => {
    const result: Array<{ start: THREE.Vector3; end: THREE.Vector3 }> = [];
    const size = 10;
    const divisions = 20;
    const step = size / divisions;

    for (let i = 0; i <= divisions; i++) {
      const pos = -size / 2 + i * step;
      result.push({
        start: new THREE.Vector3(-size / 2, pos, 0),
        end: new THREE.Vector3(size / 2, pos, 0),
      });
      result.push({
        start: new THREE.Vector3(pos, -size / 2, 0),
        end: new THREE.Vector3(pos, size / 2, 0),
      });
    }
    return result;
  }, []);

  useFrame((state) => {
    if (groupRef.current) {
      // Very subtle breathing
      const s = 1 + Math.sin(state.clock.elapsedTime * 0.3) * 0.01;
      groupRef.current.scale.set(s, s, 1);
    }
  });

  return (
    <group ref={groupRef}>
      {lines.map((line, i) => {
        const geo = new THREE.BufferGeometry().setFromPoints([line.start, line.end]);
        return (
          <lineSegments key={i} geometry={geo}>
            <lineBasicMaterial
              color="#4d6fff"
              transparent
              opacity={0.08}
              linewidth={1}
            />
          </lineSegments>
        );
      })}
    </group>
  );
}

/* ─── Market Particles ───────────────────────────────────────────────────── */

function MarketParticles() {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 80;

  const [positions, speeds] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      pos[i3] = (Math.random() - 0.5) * 10;
      pos[i3 + 1] = (Math.random() - 0.5) * 6;
      pos[i3 + 2] = (Math.random() - 0.5) * 2 - 1;
      spd[i] = 0.002 + Math.random() * 0.006;
    }
    return [pos, spd];
  }, []);

  useFrame(() => {
    if (!pointsRef.current) return;
    const attr = pointsRef.current.geometry.attributes.position;
    const arr = attr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // Drift upward like market ticks
      arr[i3 + 1] += speeds[i];
      // Reset when drifted out
      if (arr[i3 + 1] > 3.5) {
        arr[i3] = (Math.random() - 0.5) * 10;
        arr[i3 + 1] = -3.5;
        arr[i3 + 2] = (Math.random() - 0.5) * 2 - 1;
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
        color="#29c05e"
        size={0.02}
        transparent
        opacity={0.35}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

/* ─── Scene Composition ──────────────────────────────────────────────────── */

function AmbientScene() {
  return (
    <>
      <GlowGrid />
      <MarketParticles />
    </>
  );
}

/* ─── Chart Ambient Wrapper ──────────────────────────────────────────────── */

function ChartAmbientInner({ children }: { children: React.ReactNode }) {
  const tier = useAnimationTier();
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const handler = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // On 'low' tier, just render children without any 3D layer
  if (tier === 'low') {
    return <>{children}</>;
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* WebGL ambient layer behind chart */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          opacity: 0.08,
          borderRadius: '12px',
          overflow: 'hidden',
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
            camera={{ position: [0, 0, 5], fov: 50 }}
            frameloop={paused ? 'never' : 'always'}
            dpr={[1, 1]}
            style={{ width: '100%', height: '100%' }}
            onCreated={({ gl }) => {
              gl.setClearColor(0x000000, 0);
            }}
          >
            <AmbientScene />
          </Canvas>
        </Suspense>
      </div>

      {/* Actual chart content on top */}
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}

/* ─── Error-safe wrapper ─────────────────────────────────────────────────── */

function ChartAmbientSafe({ children }: { children: React.ReactNode }) {
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

  if (hasError) return <>{children}</>;

  return <ChartAmbientInner>{children}</ChartAmbientInner>;
}

const ChartAmbient = dynamic(() => Promise.resolve(ChartAmbientSafe), { ssr: false });

export default ChartAmbient;
