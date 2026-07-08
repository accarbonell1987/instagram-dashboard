import { HttpService } from '../http/HttpService';

import type { FilterParams, PaginatedResponse } from './types';

/**
 * Servicio genérico con operaciones CRUD + filtro.
 *
 * Extiende HttpService con métodos de negocio estándar:
 * - getAll(): obtener todos los registros
 * - getById(id): obtener un registro por ID
 * - create(data): crear un nuevo registro
 * - update(id, data): actualizar un registro existente
 * - remove(id): eliminar un registro
 * - filter(params): consulta paginada con filtros
 *
 * Genéricos:
 * - T: tipo de la entidad (lo que devuelve el servidor)
 * - TCreate: payload para crear (default: Omit<T, 'id'>)
 * - TUpdate: payload para actualizar (default: Partial<TCreate>)
 *
 * Los servicios de dominio extienden esta clase cuando necesitan
 * agregar métodos específicos. Si solo necesitan CRUD, se instancia
 * directamente:
 *
 * @example
 * ```ts
 * // Uso directo (sin herencia)
 * const usersService = new CrudService<User>(http, '/users');
 *
 * // Con herencia para métodos específicos
 * class OrdersService extends CrudService<Order> {
 *   async getByStatus(status: string): Promise<Order[]> {
 *     return this.get(`/status/${status}`);
 *   }
 * }
 * ```
 */
export class CrudService<
  T extends { id: string | number },
  TCreate = Omit<T, 'id'>,
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- TUpdate allows subclasses to customize update payload type
  TUpdate = Partial<TCreate>,
> extends HttpService {
  async getAll(): Promise<T[]> {
    return this.get<T[]>('');
  }

  async getById(id: T['id']): Promise<T> {
    return this.get<T>(`/${String(id)}`);
  }

  async create(data: TCreate): Promise<T> {
    return this.post<T>('', data);
  }

  async update(id: T['id'], data: TUpdate): Promise<T> {
    return this.put<T>(`/${String(id)}`, data);
  }

  async remove(id: T['id']): Promise<void> {
    await this.delete(`/${String(id)}`);
  }

  async filter(params: FilterParams = {}): Promise<PaginatedResponse<T>> {
    return this.get<PaginatedResponse<T>>('/filter', params);
  }
}
