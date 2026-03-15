'use client';

import { Suspense, useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import dynamic from 'next/dynamic';
import { useAnimationTier, type AnimationTier } from '@/lib/3d/utils/performance';

/* ─── Rotating Financial Grid ────────────────────────────────────────────── */

function FinancialGrid() {
  const groupRef = useRef<THREE.Group>(null);

  // Generate grid lines
  const lines = useMemo(() => {
    const result: Array<{ start: THREE.Vector3; end: THREE.Vector3; color: string }> = [];
    const gridSize = 4;
    const divisions = 12;
    const step = gridSize / divisions;

    for (let i = 0; i <= divisions; i++) {
      const pos = -gridSize / 2 + i * step;
      // Horizontal lines
      result.push({
        start: new THREE.Vector3(-gridSize / 2, 0, pos),
        end: new THREE.Vector3(gridSize / 2, 0, pos),
        color: i % 3 === 0 ? '#15d6ef' : '#4d6fff',
      });
      // Vertical lines
      result.push({
        start: new THREE.Vector3(pos, 0, -gridSize / 2),
        end: new THREE.Vector3(pos, 0, gridSize / 2),
        color: i % 3 === 0 ? '#15d6ef' : '#4d6fff',
      });
    }
    return result;
  }, []);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.08;
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.15) * 0.05;
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.2, 0]}>
      {lines.map((line, i) => {
        const points = [line.start, line.end];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        return (
          <lineSegments key={i} geometry={geometry}>
            <lineBasicMaterial
              color={line.color}
              transparent
              opacity={0.4}
              linewidth={1}
            />
          </lineSegments>
        );
      })}
    </group>
  );
}

/* ─── Floating Holographic Panels ────────────────────────────────────────── */

function HoloPanels() {
  const groupRef = useRef<THREE.Group>(null);

  const panels = useMemo(() => {
    return [
      { pos: [-1.8, 0.6, -0.5] as [number, number, number], w: 0.8, h: 0.5, rot: 0.15 },
      { pos: [1.6, 0.3, 0.3] as [number, number, number], w: 0.7, h: 0.4, rot: -0.2 },
      { pos: [0.0, 0.9, -1.0] as [number, number, number], w: 0.6, h: 0.35, rot: 0.1 },
      { pos: [-0.8, -0.1, 0.8] as [number, number, number], w: 0.5, h: 0.3, rot: -0.08 },
    ];
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, i) => {
      child.position.y =
        panels[i].pos[1] + Math.sin(state.clock.elapsedTime * 0.5 + i * 1.2) * 0.08;
    });
  });

  return (
    <group ref={groupRef}>
      {panels.map((panel, i) => (
        <mesh key={i} position={panel.pos} rotation={[0, panel.rot, 0]}>
          <planeGeometry args={[panel.w, panel.h]} />
          <meshBasicMaterial
            color="#15d6ef"
            transparent
            opacity={0.08}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
      {/* Panel edge glow lines */}
      {panels.map((panel, i) => {
        const hw = panel.w / 2;
        const hh = panel.h / 2;
        const corners = [
          new THREE.Vector3(-hw, -hh, 0),
          new THREE.Vector3(hw, -hh, 0),
          new THREE.Vector3(hw, -hh, 0),
          new THREE.Vector3(hw, hh, 0),
          new THREE.Vector3(hw, hh, 0),
          new THREE.Vector3(-hw, hh, 0),
          new THREE.Vector3(-hw, hh, 0),
          new THREE.Vector3(-hw, -hh, 0),
        ];
        const geo = new THREE.BufferGeometry().setFromPoints(corners);
        return (
          <lineSegments key={`edge-${i}`} geometry={geo} position={panel.pos} rotation={[0, panel.rot, 0]}>
            <lineBasicMaterial color="#15d6ef" transparent opacity={0.5} />
          </lineSegments>
        );
      })}
    </group>
  );
}

/* ─── Glow Particles ─────────────────────────────────────────────────────── */

function GlowParticles() {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 60;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      pos[i3] = (Math.random() - 0.5) * 6;
      pos[i3 + 1] = (Math.random() - 0.5) * 3;
      pos[i3 + 2] = (Math.random() - 0.5) * 6;
    }
    return pos;
  }, []);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const attr = pointsRef.current.geometry.attributes.position;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      arr[i3 + 1] += Math.sin(state.clock.elapsedTime * 0.3 + i) * 0.001;
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
        color="#15d6ef"
        size={0.03}
        transparent
        opacity={0.5}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

/* ─── 3D Scene ───────────────────────────────────────────────────────────── */

function HeroSceneContent() {
  return (
    <>
      <ambientLight intensity={0.2} />
      <FinancialGrid />
      <HoloPanels />
      <GlowParticles />
    </>
  );
}

/* ─── Static Gradient Fallback ───────────────────────────────────────────── */

function GradientFallback() {
  return (
    <div
      style={{
        width: '100%',
        height: '280px',
        borderRadius: '16px',
        background:
          'linear-gradient(135deg, oklch(0.14 0.02 260) 0%, oklch(0.18 0.04 260) 40%, oklch(0.14 0.015 200) 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative glow dots */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '20%',
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'oklch(0.65 0.22 260 / 8%)',
          filter: 'blur(30px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '20%',
          right: '25%',
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: 'oklch(0.65 0.2 145 / 6%)',
          filter: 'blur(40px)',
        }}
      />
    </div>
  );
}

/* ─── Main Export ─────────────────────────────────────────────────────────── */

function HeroSceneInner() {
  const tier = useAnimationTier();

  // Low tier — render nothing
  if (tier === 'low') return null;

  // Medium tier — static gradient fallback
  if (tier === 'medium') return <GradientFallback />;

  // High tier — full 3D scene
  return (
    <div
      style={{
        width: '100%',
        height: '280px',
        borderRadius: '16px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Suspense fallback={<GradientFallback />}>
        <Canvas
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
            failIfMajorPerformanceCaveat: true,
          }}
          camera={{ position: [0, 2, 5], fov: 45, near: 0.1, far: 20 }}
          dpr={[1, 2]}
          style={{ width: '100%', height: '100%' }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
          }}
        >
          <HeroSceneContent />
        </Canvas>
      </Suspense>
    </div>
  );
}

/* ─── Error-safe wrapper ─────────────────────────────────────────────────── */

function HeroSceneSafe() {
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

  return <HeroSceneInner />;
}

const HeroScene = dynamic(() => Promise.resolve(HeroSceneSafe), { ssr: false });

export default HeroScene;
