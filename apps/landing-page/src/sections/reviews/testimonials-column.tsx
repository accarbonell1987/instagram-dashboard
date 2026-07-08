'use client';

import { motion } from 'motion/react';

interface Testimonial {
  text: string;
  image: string;
  name: string;
  role: string;
}

interface TestimonialsColumnProps {
  testimonials: Testimonial[];
  duration?: number;
  className?: string;
}

export function TestimonialsColumn({
  testimonials,
  duration = 10,
  className,
}: TestimonialsColumnProps) {
  return (
    <div className={className}>
      <motion.div
        animate={{ translateY: '-50%' }}
        transition={{
          duration,
          repeat: Infinity,
          ease: 'linear',
          repeatType: 'loop',
        }}
        className="flex flex-col gap-6 pb-6"
      >
        {[...new Array(2)].map((_, index) => (
          <div key={index} className="flex flex-col gap-6">
            {testimonials.map(({ text, image, name, role }, i) => (
              <article
                key={`${index}-${i}`}
                className="border-border-default rounded-card bg-surface shadow-card flex w-full max-w-xs flex-col border p-7"
              >
                <p className="text-text-dim flex-1 text-sm leading-relaxed">{text}</p>
                <div className="mt-5 flex items-center gap-3">
                  <img
                    src={image}
                    alt={name}
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-full object-cover"
                    loading="lazy"
                  />
                  <div className="flex flex-col">
                    <span className="font-display text-text-default text-sm leading-tight font-semibold">
                      {name}
                    </span>
                    <span className="text-text-mute mt-0.5 text-xs leading-tight">{role}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ))}
      </motion.div>
    </div>
  );
}
