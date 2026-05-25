// Auth feature types -- Sprint 2
import type { User as SupabaseUser, Session as SupabaseSession } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  name: string;
  phone: string | null;
  role?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: SupabaseUser | null;
  profile: Profile | null;
  session: SupabaseSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface SignUpData {
  email?: string;
  phone?: string;
  password: string;
  name: string;
}

export interface SignInData {
  identifier: string;
  password: string;
}

export type { SupabaseUser, SupabaseSession };
