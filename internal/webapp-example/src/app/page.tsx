import { ArrowRight, BoxesIcon, UsersIcon } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="from-background to-muted/20 border-b bg-gradient-to-b">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 flex justify-center">
              <div className="bg-primary/10 rounded-full p-4">
                <BoxesIcon className="text-primary h-12 w-12" />
              </div>
            </div>
            <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
              WebApp Example
            </h1>
            <p className="text-muted-foreground mb-8 text-lg md:text-xl">
              Explora nuestra colección de componentes UI y funcionalidades
            </p>
          </div>
        </div>
      </section>

      {/* Navigation Cards */}
      <section className="container mx-auto px-4 py-16">
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          {/* Componentes Card */}
          <Link
            href="/components"
            className="group bg-card hover:border-primary/50 relative rounded-lg border p-8 transition-all hover:shadow-lg"
          >
            <div className="mb-4 flex items-start gap-4">
              <div className="bg-primary/10 group-hover:bg-primary/20 rounded-lg p-3 transition-colors">
                <BoxesIcon className="text-primary h-8 w-8" />
              </div>
            </div>
            <h3 className="group-hover:text-primary mb-3 text-2xl font-semibold transition-colors">
              Componentes
            </h3>
            <p className="text-muted-foreground mb-6 text-sm">
              Explora todos los componentes UI disponibles con ejemplos interactivos y casos de uso.
            </p>
            <div className="text-primary flex items-center text-sm font-medium opacity-0 transition-opacity group-hover:opacity-100">
              Ver componentes
              <ArrowRight className="ml-1 h-4 w-4" />
            </div>
          </Link>

          {/* Users Card */}
          <Link
            href="/users"
            className="group bg-card hover:border-primary/50 relative rounded-lg border p-8 transition-all hover:shadow-lg"
          >
            <div className="mb-4 flex items-start gap-4">
              <div className="bg-primary/10 group-hover:bg-primary/20 rounded-lg p-3 transition-colors">
                <UsersIcon className="text-primary h-8 w-8" />
              </div>
            </div>
            <h3 className="group-hover:text-primary mb-3 text-2xl font-semibold transition-colors">
              Users
            </h3>
            <p className="text-muted-foreground mb-6 text-sm">
              Gestión completa de usuarios con operaciones CRUD, paginación y filtros avanzados.
            </p>
            <div className="text-primary flex items-center text-sm font-medium opacity-0 transition-opacity group-hover:opacity-100">
              Ver demo
              <ArrowRight className="ml-1 h-4 w-4" />
            </div>
          </Link>
        </div>
      </section>
    </main>
  );
}
