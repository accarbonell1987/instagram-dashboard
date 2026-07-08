import fs from 'node:fs/promises';
import path from 'node:path';

import type { FilterParams, PaginatedResponse, Repository } from '../repository.interface.js';

export abstract class FileBaseRepository<
  T extends { id: string },
  TCreate,
  TUpdate,
> implements Repository<T, TCreate, TUpdate> {
  private readonly filePath: string;

  constructor(dataDirectory: string, entityName: string) {
    this.filePath = path.join(dataDirectory, `${entityName}.json`);
  }

  private async readAll(): Promise<T[]> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const raw = JSON.parse(content) as Record<string, unknown>[];
      return raw.map((item) => this.deserialize(item));
    } catch {
      return [];
    }
  }

  private async writeAll(items: T[]): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(items, null, 2), 'utf-8');
  }

  async findAll(): Promise<T[]> {
    return this.readAll();
  }

  async findById(id: string): Promise<T | null> {
    const items = await this.readAll();
    return items.find((item) => item.id === id) ?? null;
  }

  async create(data: TCreate): Promise<T> {
    const items = await this.readAll();
    const entity = this.buildEntity(data);
    items.push(entity);
    await this.writeAll(items);
    return entity;
  }

  async update(id: string, data: TUpdate): Promise<T | null> {
    const items = await this.readAll();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;
    const updated = {
      ...items[index],
      ...data,
      updatedAt: new Date(),
    } as unknown as T;
    items[index] = updated;
    await this.writeAll(items);
    return updated;
  }

  async remove(id: string): Promise<boolean> {
    const items = await this.readAll();
    const filtered = items.filter((item) => item.id !== id);
    if (filtered.length === items.length) return false;
    await this.writeAll(filtered);
    return true;
  }

  async filter(params: FilterParams): Promise<PaginatedResponse<T>> {
    const allItems = await this.readAll();
    const filtered = this.applySearch(allItems, params);
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const start = (page - 1) * pageSize;
    const data = filtered.slice(start, start + pageSize);
    return { data, total: filtered.length, page, pageSize };
  }

  protected applySearch(items: T[], _params: FilterParams): T[] {
    return items;
  }

  protected abstract buildEntity(data: TCreate): T;
  protected abstract deserialize(raw: Record<string, unknown>): T;
}
