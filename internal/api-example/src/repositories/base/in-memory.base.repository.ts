import type { FilterParams, PaginatedResponse, Repository } from '../repository.interface.js';

export abstract class InMemoryBaseRepository<
  T extends { id: string },
  TCreate,
  TUpdate,
> implements Repository<T, TCreate, TUpdate> {
  protected store = new Map<string, T>();

  findAll(): Promise<T[]> {
    return Promise.resolve(Array.from(this.store.values()));
  }

  findById(id: string): Promise<T | null> {
    return Promise.resolve(this.store.get(id) ?? null);
  }

  create(data: TCreate): Promise<T> {
    const entity = this.buildEntity(data);
    this.store.set(entity.id, entity);
    return Promise.resolve(entity);
  }

  update(id: string, data: TUpdate): Promise<T | null> {
    const existing = this.store.get(id);
    if (!existing) return Promise.resolve(null);
    const updated = { ...existing, ...data, updatedAt: new Date() } as T;
    this.store.set(id, updated);
    return Promise.resolve(updated);
  }

  remove(id: string): Promise<boolean> {
    return Promise.resolve(this.store.delete(id));
  }

  filter(params: FilterParams): Promise<PaginatedResponse<T>> {
    const allItems = Array.from(this.store.values());
    const filtered = this.applySearch(allItems, params);
    const sorted = this.applySort(filtered, params);
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const start = (page - 1) * pageSize;
    const data = sorted.slice(start, start + pageSize);
    return Promise.resolve({ data, total: sorted.length, page, pageSize });
  }

  protected applySearch(items: T[], _params: FilterParams): T[] {
    return items;
  }

  protected applySort(items: T[], params: FilterParams): T[] {
    if (!params.sortBy) return items;
    const { sortBy, sortOrder = 'asc' } = params;
    return [...items].sort((a, b) => {
      const aValue = (a as Record<string, unknown>)[sortBy];
      const bValue = (b as Record<string, unknown>)[sortBy];
      if (aValue === bValue) return 0;
      const comparison = String(aValue) < String(bValue) ? -1 : 1;
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  protected abstract buildEntity(data: TCreate): T;
}
