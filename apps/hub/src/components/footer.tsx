export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-border bg-card border-t px-4 py-4">
      <div className="mx-auto max-w-7xl">
        <p className="text-muted-foreground text-center text-sm">
          {currentYear} Corehub. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
