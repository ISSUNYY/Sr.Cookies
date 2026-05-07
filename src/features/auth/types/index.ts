// Auth feature types -- Sprint 2
export interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  created_at: string;
}

export interface Session {
  user: User;
  access_token: string;
}
