import { ThemeToggleSelector } from '@core/shared/components';
import Link from 'next/link';

import { ThemeInfo } from '@/components/theme-info';

export default function ColorsPage() {
  return (
    <main className="from-primary/5 via-background to-secondary/10 min-h-screen bg-gradient-to-br">
      {/* Navigation */}
      <nav className="bg-background/80 border-b backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="from-primary to-secondary h-8 w-8 rounded-xl bg-gradient-to-br" />
            <span className="font-display text-xl font-bold">Pixel Studio</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/" className="hover:text-primary text-sm font-medium transition-colors">
              ← Back to Home
            </Link>
            <ThemeToggleSelector />
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <div className="mb-12">
            <div className="border-primary/20 bg-primary/10 text-primary mb-4 inline-block rounded-full border px-4 py-1.5 text-sm font-medium">
              Design System
            </div>
            <h1 className="font-display from-primary via-accent to-secondary mb-4 bg-gradient-to-r bg-clip-text text-5xl font-bold text-transparent">
              Creative Theme Colors
            </h1>
            <p className="text-muted-foreground text-lg">
              Vibrant creative palette with purple, cyan, and pink electric colors. Designed for
              bold expression and innovative brands.
            </p>
          </div>

          {/* Theme Info Component */}
          <section className="mb-12">
            <h2 className="font-display mb-6 text-3xl font-bold">Programmatic Theme Access</h2>
            <ThemeInfo />
          </section>

          {/* Primary Colors */}
          <section className="mb-12">
            <h2 className="font-display mb-6 text-3xl font-bold">Primary Colors</h2>
            <div className="grid gap-6 md:grid-cols-3">
              {/* Primary */}
              <div className="space-y-3">
                <div className="bg-primary shadow-primary/20 h-32 rounded-2xl shadow-xl" />
                <div>
                  <div className="text-lg font-bold">Primary</div>
                  <div className="text-primary text-sm">Vibrant Purple</div>
                  <code className="bg-muted mt-1 inline-block rounded-lg px-2 py-1 text-xs">
                    hsl(271, 91%, 65%)
                  </code>
                  <p className="text-muted-foreground mt-2 text-xs">
                    Creative energy and innovation. The heart of our brand identity.
                  </p>
                </div>
              </div>

              {/* Secondary */}
              <div className="space-y-3">
                <div className="bg-secondary shadow-secondary/20 h-32 rounded-2xl shadow-xl" />
                <div>
                  <div className="text-lg font-bold">Secondary</div>
                  <div className="text-secondary text-sm">Electric Cyan</div>
                  <code className="bg-muted mt-1 inline-block rounded-lg px-2 py-1 text-xs">
                    hsl(189, 94%, 43%)
                  </code>
                  <p className="text-muted-foreground mt-2 text-xs">
                    Tech-forward and fresh. Used for innovative and modern elements.
                  </p>
                </div>
              </div>

              {/* Accent */}
              <div className="space-y-3">
                <div className="bg-accent shadow-accent/20 h-32 rounded-2xl shadow-xl" />
                <div>
                  <div className="text-lg font-bold">Accent</div>
                  <div className="text-accent text-sm">Hot Pink</div>
                  <code className="bg-muted mt-1 inline-block rounded-lg px-2 py-1 text-xs">
                    hsl(330, 81%, 60%)
                  </code>
                  <p className="text-muted-foreground mt-2 text-xs">
                    Bold expression and excitement. For standout moments.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Gradient Combinations */}
          <section className="mb-12">
            <h2 className="font-display mb-6 text-3xl font-bold">Gradient Magic</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="from-primary to-secondary h-32 rounded-2xl bg-gradient-to-r shadow-xl" />
              <div className="from-secondary to-accent h-32 rounded-2xl bg-gradient-to-r shadow-xl" />
              <div className="from-primary via-accent to-secondary h-32 rounded-2xl bg-gradient-to-br shadow-xl" />
              <div className="from-accent via-primary to-secondary h-32 rounded-2xl bg-gradient-to-tr shadow-xl" />
            </div>
            <p className="text-muted-foreground mt-4 text-sm">
              Dynamic gradients create visual interest and energy throughout the design
            </p>
          </section>

          {/* UI Colors */}
          <section className="mb-12">
            <h2 className="font-display mb-6 text-3xl font-bold">UI Colors</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="bg-card rounded-2xl border p-6">
                <div className="mb-2 font-semibold">Background</div>
                <div className="bg-background h-20 rounded-xl border" />
                <code className="bg-muted mt-2 inline-block rounded px-2 py-1 text-xs">
                  hsl(270, 40%, 99%)
                </code>
              </div>

              <div className="bg-card rounded-2xl border p-6">
                <div className="mb-2 font-semibold">Card</div>
                <div className="bg-card h-20 rounded-xl border" />
                <code className="bg-muted mt-2 inline-block rounded px-2 py-1 text-xs">
                  hsl(270, 50%, 98%)
                </code>
              </div>

              <div className="bg-card rounded-2xl border p-6">
                <div className="mb-2 font-semibold">Muted</div>
                <div className="bg-muted h-20 rounded-xl border" />
                <code className="bg-muted mt-2 inline-block rounded px-2 py-1 text-xs">
                  hsl(270, 30%, 95%)
                </code>
              </div>

              <div className="bg-card rounded-2xl border p-6">
                <div className="mb-2 font-semibold">Border</div>
                <div className="border-border bg-background h-20 rounded-xl border-4" />
                <code className="bg-muted mt-2 inline-block rounded px-2 py-1 text-xs">
                  hsl(270, 20%, 88%)
                </code>
              </div>
            </div>
          </section>

          {/* Chart Colors */}
          <section className="mb-12">
            <h2 className="font-display mb-6 text-3xl font-bold">Data Visualization</h2>
            <div className="bg-card rounded-2xl border p-8">
              <div className="flex h-48 gap-2">
                <div
                  className="flex-1 rounded-xl"
                  style={{ backgroundColor: 'hsl(271, 91%, 65%)' }}
                />
                <div
                  className="flex-1 rounded-xl"
                  style={{ backgroundColor: 'hsl(189, 94%, 43%)' }}
                />
                <div
                  className="flex-1 rounded-xl"
                  style={{ backgroundColor: 'hsl(330, 81%, 60%)' }}
                />
                <div
                  className="flex-1 rounded-xl"
                  style={{ backgroundColor: 'hsl(280, 65%, 75%)' }}
                />
                <div
                  className="flex-1 rounded-xl"
                  style={{ backgroundColor: 'hsl(190, 80%, 55%)' }}
                />
              </div>
              <div className="text-muted-foreground mt-4 text-sm">
                Vibrant, high-contrast palette perfect for engaging data stories
              </div>
            </div>
          </section>

          {/* Examples */}
          <section>
            <h2 className="font-display mb-6 text-3xl font-bold">Component Showcase</h2>
            <div className="space-y-4">
              <div className="bg-card rounded-2xl border p-6">
                <h3 className="mb-4 font-bold">Buttons</h3>
                <div className="flex flex-wrap gap-3">
                  <button className="from-primary to-accent rounded-xl bg-gradient-to-r px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90">
                    Gradient Button
                  </button>
                  <button className="bg-secondary text-secondary-foreground rounded-xl px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90">
                    Cyan Button
                  </button>
                  <button className="border-accent bg-accent/10 text-accent hover:bg-accent/20 rounded-xl border-2 px-4 py-2 text-sm font-medium transition-colors">
                    Pink Outline
                  </button>
                  <button className="border-input bg-background hover:bg-muted rounded-xl border px-4 py-2 text-sm font-medium transition-colors">
                    Default
                  </button>
                </div>
              </div>

              <div className="bg-card rounded-2xl border p-6">
                <h3 className="mb-4 font-bold">Creative Cards</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="from-primary/20 to-accent/20 group relative overflow-hidden rounded-2xl bg-gradient-to-br p-6 transition-transform hover:scale-105">
                    <div className="from-primary/40 absolute inset-0 bg-gradient-to-br to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                    <div className="relative">
                      <div className="bg-primary mb-3 h-4 w-4 rounded-full" />
                      <div className="text-primary font-bold">Purple Vibe</div>
                      <div className="text-muted-foreground mt-1 text-sm">Creative energy</div>
                    </div>
                  </div>
                  <div className="from-secondary/20 to-primary/20 group relative overflow-hidden rounded-2xl bg-gradient-to-br p-6 transition-transform hover:scale-105">
                    <div className="from-secondary/40 absolute inset-0 bg-gradient-to-br to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                    <div className="relative">
                      <div className="bg-secondary mb-3 h-4 w-4 rounded-full" />
                      <div className="text-secondary font-bold">Cyan Flow</div>
                      <div className="text-muted-foreground mt-1 text-sm">Innovation spark</div>
                    </div>
                  </div>
                  <div className="from-accent/20 to-secondary/20 group relative overflow-hidden rounded-2xl bg-gradient-to-br p-6 transition-transform hover:scale-105">
                    <div className="from-accent/40 absolute inset-0 bg-gradient-to-br to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                    <div className="relative">
                      <div className="bg-accent mb-3 h-4 w-4 rounded-full" />
                      <div className="text-accent font-bold">Pink Pop</div>
                      <div className="text-muted-foreground mt-1 text-sm">Bold expression</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
