export type PartyType = "person" | "organization";

export interface Party {
  id: string;
  type: PartyType;
  displayName: string;
  email?: string | undefined;
  phone?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePartyInput {
  type: PartyType;
  displayName: string;
  email?: string | undefined;
  phone?: string | undefined;
}

export interface UpdatePartyInput {
  type?: PartyType | undefined;
  displayName?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
}
