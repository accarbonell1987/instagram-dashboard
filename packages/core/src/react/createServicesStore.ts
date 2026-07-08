import { create, type StoreApi, useStore } from 'zustand';

import type { CoreServices } from '../services/createCoreServices';

/**
 * Estado del store de servicios.
 *
 * - Antes de `initialize()`: todos los campos son null
 * - Después de `initialize()`: todos los campos tienen valor
 *
 * Esto permite crear el store al inicio de la app y poblar
 * los servicios cuando la configuración esté lista (ej: después
 * de cargar variables de entorno o configuración async).
 */
export interface ServicesState {
  /** Servicios del core (null hasta que se inicialice) */
  services: CoreServices | null;
  /** Si los servicios ya fueron inicializados */
  initialized: boolean;
  /** Poblar el store con los servicios */
  initialize: (services: CoreServices) => void;
  /** Limpiar el store (ej: logout) */
  reset: () => void;
}

export interface ServicesStore {
  /** Store de Zustand (para uso avanzado o testing) */
  store: StoreApi<ServicesState>;
  /**
   * Hook de React para acceder a los servicios.
   *
   * Lanza error si se usa antes de `initialize()`.
   *
   * @example
   * ```tsx
   * const { services } = useServices();
   * const users = services.createService<User>('/users');
   * ```
   */
  useServices: () => CoreServices;
  /**
   * Hook de React para seleccionar una parte del estado.
   *
   * @example
   * ```tsx
   * const initialized = useServicesStore(state => state.initialized);
   * ```
   */
  useServicesStore: <U>(selector: (state: ServicesState) => U) => U;
}

/**
 * Crea un store de Zustand para los servicios del core.
 *
 * Patrón recomendado: crear una sola instancia al nivel de la app
 * y exportar los hooks.
 *
 * @example
 * ```ts
 * // services-store.ts
 * export const { useServices, useServicesStore, store } = createServicesStore();
 *
 * // app.tsx (inicialización)
 * const core = createCoreServices({ ... });
 * store.getState().initialize(core);
 *
 * // component.tsx (consumo)
 * function UserList() {
 *   const services = useServices();
 *   const usersService = services.createService<User>('/users');
 *   // ...
 * }
 * ```
 */
export function createServicesStore(): ServicesStore {
  const store = create<ServicesState>((set) => ({
    services: null,
    initialized: false,
    initialize: (services: CoreServices) => { set({ services, initialized: true }); },
    reset: () => { set({ services: null, initialized: false }); },
  }));

  const useServicesStore = <U,>(selector: (state: ServicesState) => U): U => {
    return useStore(store, selector);
  };

  const useServices = (): CoreServices => {
    const services = useStore(store, (state) => state.services);

    if (!services) {
      throw new Error(
        'Services not initialized. Call store.getState().initialize(coreServices) before using useServices().'
      );
    }

    return services;
  };

  return { store, useServices, useServicesStore };
}
