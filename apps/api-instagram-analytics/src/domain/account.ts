export interface InstagramAccount {
  id: string;
  tenantId: string;
  userId: string;
  igUserId: string;
  username: string;
  displayName: string | null;
  profilePictureUrl: string | null;
  followersCount: number | null;
  mediaCount: number | null;
  accountType: 'BUSINESS' | 'CREATOR';
  facebookPageId: string | null;
  accessTokenHash: string;
  tokenExpiresAt: Date;
  syncStatus: 'idle' | 'syncing' | 'paused' | 'error' | 'disconnected';
  lastSyncAt: Date | null;
  connectedAt: Date;
}

export interface ConnectAccountInput {
  userId: string;
  igUserId: string;
  username: string;
  accountType: 'BUSINESS' | 'CREATOR';
  facebookPageId?: string;
  displayName?: string;
  profilePictureUrl?: string;
  followersCount?: number;
  mediaCount?: number;
}

export interface ConnectionStatus {
  connected: boolean;
  username?: string;
  accountType?: string;
  tokenExpiresAt?: string;
}

export interface AgentConfig {
  niche: string;
  tags: string[];
  customPrompt?: string;
}
