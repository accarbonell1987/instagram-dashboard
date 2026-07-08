import type { CreateUserInput, UpdateUserInput, User } from "../../domain/user.js";
import { FileBaseRepository } from "../base/file.base.repository.js";
import type { FilterParams } from "../repository.interface.js";

export class UserFileRepository extends FileBaseRepository<
  User,
  CreateUserInput,
  UpdateUserInput
> {
  constructor(dataDirectory: string) {
    super(dataDirectory, "users");
  }

  async findByEmail(email: string): Promise<User | null> {
    const users = await this.findAll();
    return users.find((user) => user.email === email) ?? null;
  }

  protected override applySearch(
    items: User[],
    params: FilterParams,
  ): User[] {
    if (!params.search) return items;
    const term = params.search.toLowerCase();
    return items.filter(
      (user) =>
        user.email.toLowerCase().includes(term) ||
        user.name?.toLowerCase().includes(term),
    );
  }

  protected buildEntity(data: CreateUserInput): User {
    const now = new Date();
    return {
      id: crypto.randomUUID(),
      email: data.email,
      name: data.name,
      partyId: data.partyId,
      createdAt: now,
      updatedAt: now,
    };
  }

  protected deserialize(raw: Record<string, unknown>): User {
    return {
      id: raw["id"] as string,
      email: raw["email"] as string,
      name: raw["name"] as string | undefined,
      partyId: raw["partyId"] as string,
      createdAt: new Date(raw["createdAt"] as string),
      updatedAt: new Date(raw["updatedAt"] as string),
    };
  }
}
