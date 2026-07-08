import { ModuleShell } from '@/modules/shared/modules/index';

interface ModulePageProps {
  params: Promise<{ slug: string }>;
}

export default async function ModulePage({ params }: ModulePageProps) {
  const { slug } = await params;
  return <ModuleShell moduleId={slug} />;
}
