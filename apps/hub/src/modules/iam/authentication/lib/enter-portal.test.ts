import { describe, it, expect, vi, afterEach } from 'vitest';

import { enterPortal } from './enter-portal';

describe('enterPortal', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Lo que se prueba aca no es "navega", es "navega DURO". Un router.push de
  // Next sirve la respuesta RSC que cacheo antes de existir la cookie de sesion
  // y rebota al login; solo una navegacion de documento descarta esa cache.
  it('navega el documento entero a la raiz', () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });

    enterPortal();

    expect(assign).toHaveBeenCalledWith('/');
  });
});
