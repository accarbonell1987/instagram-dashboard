import { getTranslations } from 'next-intl/server';
import { GlassmorphismStats } from './glassmorphism-stats';

export async function Stats() {
  const t = await getTranslations('stats');

  const metrics = [
    {
      label: t('name1'),
      value: `${t('value1')}%`,
      delta: '+18%',
      description: t('desc1'),
      counterTo: parseFloat(t('value1')),
      counterSuffix: '%',
    },
    {
      label: t('name2'),
      value: `+${t('value2').replace('+', '')}%`,
      delta: '+42%',
      description: t('desc2'),
      counterTo: parseFloat(t('value2').replace('+', '')),
      counterSuffix: '%',
      counterPrefix: '+',
    },
    {
      label: t('name3'),
      value: `${t('value3')} ${t('unit3')}`,
      delta: '×2',
      description: t('desc3'),
      counterTo: parseFloat(t('value3')),
      counterSuffix: '',
      counterPostfix: ` ${t('unit3')}`,
    },
    {
      label: t('name4'),
      value: t('value4'),
      delta: '−100%',
      description: t('desc4'),
      counterTo: parseFloat(t('value4')),
      counterSuffix: '',
    },
  ] as const;

  const ctaLabel = t('ctaLabel');
  const ctaDesc = t('ctaDesc');

  return <GlassmorphismStats metrics={metrics} ctaLabel={ctaLabel} ctaDesc={ctaDesc} />;
}
