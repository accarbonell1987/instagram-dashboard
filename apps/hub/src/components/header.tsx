'use client';

import { ThemeToggleSelector } from '@core/shared/components';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@core/ui';
import { LayoutDashboard, LogOut, Settings, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useSession } from '@/modules/iam/identity/hooks/use-session';
import { useAuth } from '@/providers';

export function Header() {
  const { session, signOut } = useAuth();
  const sessionState = useSession();
  const pathname = usePathname();

  const isAuthenticated = session.status === 'authenticated';
  const user = session.session?.user ?? null;
  const userRole = sessionState.session?.role ?? null;
  const tenantName = sessionState.session?.tenant.name ?? sessionState.session?.tenant.slug;
  const canAccessSettings = userRole === 'TenantAdmin' || userRole === 'SuperAdmin';
  const isSuperAdmin = userRole === 'SuperAdmin';

  const userName = user?.fullName ?? user?.email ?? '';
  const userPicture = user?.picture;

  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="bg-card border-border fixed left-0 right-0 top-0 z-50 h-12 border-b">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-sm">
            <span className="text-primary-foreground text-sm font-semibold">T</span>
          </div>
          <span className="text-foreground hidden font-semibold sm:block">
            {isAuthenticated && tenantName ? `Corehub | ${tenantName}` : 'Corehub'}
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {/* No per-user colour picker: the visual style belongs to the
                tenant and is set by an admin in Configuración → Organización.
                Dark/light stays personal — it is a comfort setting, not brand. */}
          <ThemeToggleSelector />

          {isAuthenticated ? (
            <>
              {canAccessSettings && (
                <Button asChild variant="ghost-border" size="icon-sm" aria-label="Configuración">
                  <Link href="/settings">
                    <Settings />
                  </Link>
                </Button>
              )}
              {isSuperAdmin && (
                <Button asChild variant="ghost-border" size="icon-sm" aria-label="Backoffice">
                  <Link href="/backoffice/modules">
                    <LayoutDashboard />
                  </Link>
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 rounded-sm px-2 py-1">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={userPicture} alt={userName} />
                      <AvatarFallback className="bg-muted text-muted-foreground text-xs font-medium">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-foreground hidden max-w-32 truncate text-sm font-medium sm:block">
                      {userName}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {/* Personal settings live here, not behind the gear: that
                        button is admin-only, so a regular user had no way to
                        reach their own profile. */}
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/profile">
                      <User className="mr-2 h-4 w-4" />
                      Mi Perfil
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer text-red-600 focus:text-red-600"
                    onClick={() => void signOut()}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            pathname !== '/login' && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Iniciar sesión</Link>
              </Button>
            )
          )}
        </div>
      </div>
    </header>
  );
}
