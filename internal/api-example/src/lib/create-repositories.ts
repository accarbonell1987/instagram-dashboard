import type { PrismaClient } from "@core/database";

import type { Config } from "../config.js";
import type { PartyRepository } from "../repositories/party/index.js";
import {
  PartyFileRepository,
  PartyInMemoryRepository,
  PartyPrismaRepository,
} from "../repositories/party/index.js";
import type { RoleRepository } from "../repositories/role/index.js";
import {
  RoleFileRepository,
  RoleInMemoryRepository,
  RolePrismaRepository,
} from "../repositories/role/index.js";
import type { UserRepository } from "../repositories/user/index.js";
import {
  UserFileRepository,
  UserInMemoryRepository,
  UserPrismaRepository,
} from "../repositories/user/index.js";

export interface Repositories {
  users: UserRepository;
  roles: RoleRepository;
  parties: PartyRepository;
}

export function createRepositories(
  config: Config,
  prisma?: PrismaClient,
): Repositories {
  switch (config.DATA_SOURCE) {
    case "memory":
      return {
        users: new UserInMemoryRepository(),
        roles: new RoleInMemoryRepository(),
        parties: new PartyInMemoryRepository(),
      };

    case "file":
      return {
        users: new UserFileRepository(config.DATA_DIR),
        roles: new RoleFileRepository(config.DATA_DIR),
        parties: new PartyFileRepository(config.DATA_DIR),
      };

    case "prisma": {
      if (!prisma) {
        throw new Error("PrismaClient is required when DATA_SOURCE=prisma");
      }
      return {
        users: new UserPrismaRepository(prisma),
        roles: new RolePrismaRepository(prisma),
        parties: new PartyPrismaRepository(prisma),
      };
    }
  }
}
