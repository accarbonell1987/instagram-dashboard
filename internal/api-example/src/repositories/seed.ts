import type { Party } from "../domain/party.js";
import type { Role } from "../domain/role.js";
import type { User } from "../domain/user.js";

const now = new Date();

export const SEED_PARTIES: Party[] = [
  {
    id: "party-001",
    type: "person",
    displayName: "Alice Smith",
    email: "alice@example.com",
    phone: "+1-555-0101",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "party-002",
    type: "person",
    displayName: "Bob Jones",
    email: "bob@example.com",
    phone: "+1-555-0102",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "party-003",
    type: "organization",
    displayName: "Acme Corp",
    email: "contact@acme.com",
    createdAt: now,
    updatedAt: now,
  },
];

export const SEED_USERS: User[] = [
  {
    id: "user-001",
    email: "alice@example.com",
    name: "Alice Smith",
    partyId: "party-001",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "user-002",
    email: "bob@example.com",
    name: "Bob Jones",
    partyId: "party-002",
    createdAt: now,
    updatedAt: now,
  },
];

export const SEED_ROLES: Role[] = [
  {
    id: "role-001",
    name: "admin",
    description: "Full system access",
    permissions: [
      "users:read",
      "users:write",
      "roles:read",
      "roles:write",
      "parties:read",
      "parties:write",
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "role-002",
    name: "viewer",
    description: "Read-only access",
    permissions: ["users:read", "roles:read", "parties:read"],
    createdAt: now,
    updatedAt: now,
  },
];
