'use client';

export function GradientMesh() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute -top-1/2 left-1/4 h-96 w-96 rounded-full opacity-20 blur-3xl"
        style={{
          background: 'radial-gradient(circle, #E1306C, transparent 70%)',
          animation: 'float 8s ease-in-out infinite',
        }}
      />
      <div
        className="absolute -bottom-1/2 right-1/4 h-96 w-96 rounded-full opacity-15 blur-3xl"
        style={{
          background: 'radial-gradient(circle, #F77737, transparent 70%)',
          animation: 'float 10s ease-in-out infinite 2s',
        }}
      />
    </div>
  );
}
