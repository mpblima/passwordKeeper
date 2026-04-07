export type VaultPermission = "owner" | "editor" | "reader";

export interface SharedUser {
  email: string;
  role: VaultPermission;
  addedAt: string;
}

export interface DeletionRequest {
  id: string;
  entryId: string;
  entryName: string;
  requestedBy: string;
  requestedAt: string;
}

export interface PasswordEntry {
  id: string;
  name: string;
  description: string;
  icon: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  groupId?: string;
  favorite?: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PasswordGroup {
  id: string;
  name: string;
  description: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
}

export interface VaultData {
  version: string;
  owner: string;
  sharedWith: SharedUser[];
  deletionRequests: DeletionRequest[];
  groups: PasswordGroup[];
  entries: PasswordEntry[];
}

export interface GoogleToken {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  token_type: string;
}

export type ViewMode = "grid" | "list";
export type ActiveView = "all" | "favorites" | "group";
