export type UserRole = 'admin' | 'gerente_comercial' | 'ejecutivo_ventas';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at?: string;
}

export interface AuthSession {
  access_token: string;
  token_type: string;
  user: User;
}

export interface HealthStatus {
  status: string;
  app: string;
  version: string;
  environment: string;
  timestamp: string;
  database_connected: boolean;
}
