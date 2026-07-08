import { DocsSidebar } from '@/components/docs-sidebar';
import { getAllDocuments } from '@/lib/markdown';

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const documents = getAllDocuments();

  return (
    <div className="min-h-screen">
      <DocsSidebar documents={documents} />
      <div className="lg:pl-64">
        <main className="container mx-auto px-4 py-8 lg:px-8 lg:py-12">{children}</main>
      </div>
    </div>
  );
}
