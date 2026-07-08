import { getTranslations } from 'next-intl/server';
import { SectionHead } from '@/components/ui/SectionHead';
import { AccentItalic } from '@/components/ui/AccentItalic';
import { AnimatedSection } from '@/components/layout';
import { TestimonialsColumn } from './testimonials-column';

const REVIEWS_DATA = [
  // Column 1
  [
    {
      name: 'Mariana Rojas',
      roleKey: 'review1Role',
      image:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&fit=crop&crop=face',
    },
    {
      name: 'Diego Valenzuela',
      roleKey: 'review2Role',
      image:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=96&h=96&fit=crop&crop=face',
    },
    {
      name: 'Lucía Paredes',
      roleKey: 'review3Role',
      image:
        'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=96&h=96&fit=crop&crop=face',
    },
  ],
  // Column 2
  [
    {
      name: 'Andrés Kovacs',
      roleKey: 'review4Role',
      image:
        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=96&h=96&fit=crop&crop=face',
    },
    {
      name: 'Carla Mendoza',
      roleKey: 'review5Role',
      image:
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=96&h=96&fit=crop&crop=face',
    },
    {
      name: 'Sofía Navarro',
      roleKey: 'review6Role',
      image:
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=96&h=96&fit=crop&crop=face',
    },
  ],
  // Column 3
  [
    {
      name: 'Ricardo Montero',
      roleKey: 'review7Role',
      image:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=96&h=96&fit=crop&crop=face',
    },
    {
      name: 'Paula Jiménez',
      roleKey: 'review8Role',
      image:
        'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=96&h=96&fit=crop&crop=face',
    },
    {
      name: 'Felipe Torres',
      roleKey: 'review9Role',
      image:
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=96&h=96&fit=crop&crop=face',
    },
  ],
] as const;

const COLUMN_SPEEDS = [15, 19, 17] as const;

export async function Reviews() {
  const t = await getTranslations('reviews');

  const columns = REVIEWS_DATA.map((column, colIndex) => ({
    testimonials: column.map((review, i) => ({
      text: t(`review${colIndex * 3 + i + 1}Body` as Parameters<typeof t>[0]),
      image: review.image,
      name: review.name,
      role: t(review.roleKey as Parameters<typeof t>[0]),
    })),
    speed: COLUMN_SPEEDS[colIndex],
  }));

  return (
    <section id="reviews" className="sec-reviews py-[var(--spacing-section-y)]">
      <div className="mx-auto max-w-[var(--width-content)] px-[var(--spacing-pad)]">
        <AnimatedSection variant="fadeUp">
          <SectionHead
            eyebrow={t('eyebrow')}
            heading={
              <>
                {t('heading1')}
                <br />
                {t('heading2')} <AccentItalic>{t('heading2Gold')}</AccentItalic>.
              </>
            }
            lead={t('lead')}
          />
        </AnimatedSection>

        <div className="mt-14 flex max-h-[700px] justify-center gap-6 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)]">
          <TestimonialsColumn testimonials={columns[0].testimonials} duration={columns[0].speed} />
          <TestimonialsColumn
            testimonials={columns[1].testimonials}
            duration={columns[1].speed}
            className="hidden md:block"
          />
          <TestimonialsColumn
            testimonials={columns[2].testimonials}
            duration={columns[2].speed}
            className="hidden lg:block"
          />
        </div>
      </div>
    </section>
  );
}
