import { Clock, Calendar } from 'lucide-react';
import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';

import { getDocumentBySlug, generateDocumentMetadata, getAllDocuments } from '@/lib/markdown';

const MarkdownRenderer = dynamic(
  () => import('@/components/markdown-renderer').then((m) => ({ default: m.MarkdownRenderer })),
  { loading: () => <div className="bg-muted h-96 animate-pulse rounded-lg" /> }
);

interface PageProps {
  params: Promise<{ slug: string[] }>;
}

export function generateStaticParams() {
  const documents = getAllDocuments();
  return documents.map((doc) => ({
    slug: doc.slug.split('/'),
  }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const slugPath = slug.join('/');
  return generateDocumentMetadata(slugPath);
}

export default async function DocPage({ params }: PageProps) {
  const { slug } = await params;
  const slugPath = slug.join('/');
  const document = getDocumentBySlug(slugPath);

  if (!document) {
    notFound();
  }

  const readTime = document.metadata['readTime'];
  const readTimeString =
    typeof readTime === 'string' || typeof readTime === 'number' ? String(readTime) : null;

  return (
    <article className="mx-auto max-w-4xl">
      {/* Header */}
      <header className="mb-8 border-b pb-8">
        <h1 className="mb-2 text-4xl font-bold tracking-tight">{document.metadata.title}</h1>
        {document.metadata.description && (
          <p className="text-muted-foreground mt-2 text-xl">{document.metadata.description}</p>
        )}

        {/* Metadata */}
        <div className="text-muted-foreground mt-4 flex flex-wrap gap-4 text-sm">
          {document.metadata.date && (
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {new Date(document.metadata.date).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          )}
          {readTimeString && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {readTimeString}
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <MarkdownRenderer content={document.content} />

      {/* Footer */}
      <footer className="mt-16 border-t pt-8">
        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <p>¿Encontraste un error en esta página?</p>
          <a
            href={`https://github.com/tu-usuario/tu-repo/edit/main/src/content/${slugPath}.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Editar en GitHub
          </a>
        </div>
      </footer>
    </article>
  );
}
