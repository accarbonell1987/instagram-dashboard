const PARTICLES_DATA = [
  { top: '10%', left: '15%', animationDelay: '0s' },
  { top: '25%', left: '80%', animationDelay: '0.8s' },
  { top: '60%', left: '5%', animationDelay: '1.2s' },
  { top: '80%', left: '70%', animationDelay: '2s' },
  { top: '40%', left: '50%', animationDelay: '0.4s' },
  { top: '15%', left: '62%', animationDelay: '1.6s' },
  { top: '90%', left: '30%', animationDelay: '2.4s' },
];

export function Particles() {
  return (
    <>
      {PARTICLES_DATA.map((particle, index) => (
        <span
          key={index}
          className="absolute w-1.5 h-1.5 rounded-full bg-brand-light animate-floaty"
          style={{
            top: particle.top,
            left: particle.left,
            animationDelay: particle.animationDelay,
            opacity: 0.6,
          }}
          aria-hidden="true"
        />
      ))}
    </>
  );
}
