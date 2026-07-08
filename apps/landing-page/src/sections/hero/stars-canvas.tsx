'use client';

import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';

export function StarsCanvas() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: false }}
      camera={{ position: [0, 0, 1] }}
      style={{ width: '100%', height: '100%' }}
    >
      <Stars radius={50} count={1500} factor={4} fade speed={2} />
    </Canvas>
  );
}
