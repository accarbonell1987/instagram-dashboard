'use client';

import { FileText, Menu, X, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';

import { type Document } from '@/lib/markdown';

interface DocsSidebarProps {
  documents: Document[];
}

type GroupedDocs = Record<string, Document[]>;

export function DocsSidebar({ documents }: DocsSidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDocs = documents.filter((doc) =>
    doc.metadata.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group documents by category
  const grouped = useMemo(() => {
    return filteredDocs.reduce<GroupedDocs>((acc, doc) => {
      const category = doc.metadata.category ?? 'General';
      const categoryDocs = acc[category];
      if (!categoryDocs) {
        acc[category] = [];
      }
      acc[category]?.push(doc);
      return acc;
    }, {});
  }, [filteredDocs]);

  // Sort categories: "General" first, then API categories alphabetically
  const sortedCategories = useMemo(() => {
    return Object.keys(grouped).sort((a, b) => {
      if (a === 'General') return -1;
      if (b === 'General') return 1;
      return a.localeCompare(b);
    });
  }, [grouped]);

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <Link
          href="/"
          className="hover:text-primary flex items-center gap-2 text-lg font-semibold transition-colors"
        >
          <FileText className="h-5 w-5" />
          Documentación
        </Link>
      </div>

      {/* Search */}
      <div className="border-b p-4">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar documentos..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
            }}
            className="bg-background focus:ring-primary w-full rounded-md border px-9 py-2 text-sm focus:ring-2 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
              }}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        {sortedCategories.length > 0 ? (
          <div className="space-y-6">
            {sortedCategories.map((category) => {
              const categoryDocs = grouped[category] ?? [];
              return (
                <div key={category}>
                  <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                    {category}
                  </h3>
                  <ul className="space-y-1">
                    {categoryDocs.map((doc) => {
                      const isActive = pathname === `/docs/${doc.slug}`;
                      return (
                        <li key={doc.slug}>
                          <Link
                            href={`/docs/${doc.slug}`}
                            onClick={() => {
                              setIsOpen(false);
                            }}
                            className={`hover:bg-muted block rounded-md px-3 py-2 text-sm transition-colors ${
                              isActive
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {doc.metadata.title}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No se encontraron documentos
          </p>
        )}
      </nav>

      {/* Footer */}
      <div className="text-muted-foreground border-t p-4 text-xs">
        {documents.length} documento{documents.length !== 1 ? 's' : ''} disponible
        {documents.length !== 1 ? 's' : ''}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
        }}
        className="bg-background fixed top-4 left-4 z-50 rounded-md border p-2 shadow-md lg:hidden"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => {
            setIsOpen(false);
          }}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`bg-background fixed top-0 left-0 z-40 h-screen w-64 border-r transition-transform lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
