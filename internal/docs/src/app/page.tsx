import { FileText, ArrowRight, BookOpen } from 'lucide-react';
import Link from 'next/link';

import { getAllDocuments } from '@/lib/markdown';

export default function DocsHome() {
  const documents = getAllDocuments();

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="from-background to-muted/20 border-b bg-gradient-to-b">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 flex justify-center">
              <div className="bg-primary/10 rounded-full p-4">
                <BookOpen className="text-primary h-12 w-12" />
              </div>
            </div>
            <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
              Documentación
            </h1>
            <p className="text-muted-foreground mb-8 text-lg md:text-xl">
              Encuentra toda la información que necesitas para trabajar con nuestros sistemas y
              herramientas
            </p>
            {documents.length > 0 && documents[0] && (
              <Link
                href={`/docs/${documents[0].slug}`}
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-6 py-3 font-semibold transition-colors"
              >
                Empezar
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Documents Grid */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="mb-8 text-3xl font-bold tracking-tight">Documentos Disponibles</h2>

        {documents.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
            <p className="text-muted-foreground text-lg">No hay documentos disponibles todavía</p>
            <p className="text-muted-foreground mt-2 text-sm">
              Agrega archivos .md en la carpeta src/content
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc) => (
              <Link
                key={doc.slug}
                href={`/docs/${doc.slug}`}
                className="group bg-card hover:border-primary/50 relative rounded-lg border p-6 transition-all hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 group-hover:bg-primary/20 rounded-md p-2 transition-colors">
                    <FileText className="text-primary h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="group-hover:text-primary mb-2 text-lg font-semibold transition-colors">
                      {doc.metadata.title}
                    </h3>
                    {doc.metadata.description && (
                      <p className="text-muted-foreground line-clamp-2 text-sm">
                        {doc.metadata.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-primary mt-4 flex items-center text-sm opacity-0 transition-opacity group-hover:opacity-100">
                  Leer más
                  <ArrowRight className="ml-1 h-4 w-4" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Quick Links */}
      <section className="bg-muted/30 border-t">
        <div className="container mx-auto px-4 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-6 text-center text-2xl font-bold tracking-tight">
              ¿Necesitas ayuda?
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="bg-card rounded-lg border p-6">
                <h3 className="mb-2 font-semibold">¿Cómo agregar documentación?</h3>
                <p className="text-muted-foreground mb-3 text-sm">
                  Crea archivos .md en{' '}
                  <code className="bg-muted rounded px-1 py-0.5 text-xs">src/content</code>
                </p>
                <p className="text-muted-foreground text-xs">
                  Usa frontmatter para agregar título, descripción y orden.
                </p>
              </div>
              <div className="bg-card rounded-lg border p-6">
                <h3 className="mb-2 font-semibold">Formato Markdown</h3>
                <p className="text-muted-foreground mb-3 text-sm">
                  Soporta Markdown estándar con GFM (tablas, listas de tareas, etc.)
                </p>
                <p className="text-muted-foreground text-xs">
                  Incluye syntax highlighting para código.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
