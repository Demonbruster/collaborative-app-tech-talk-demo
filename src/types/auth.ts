import { User } from "firebase/auth";

export interface TenantVerification {
  tenantEmail: string;
  isVerified: boolean;
  error?: string;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  tenantVerification: TenantVerification | null;
  login: (username: string, password: string) => Promise<User>;
  register: (username: string, password: string) => Promise<User>;
  loginWithGoogle: () => Promise<User>;
  logout: () => Promise<void>;
  verifyTenant: (tenantEmail: string) => Promise<boolean>;
}