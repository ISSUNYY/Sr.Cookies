/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { supabase } from '@shared/lib/supabase';
import type { AuthState, SupabaseUser, SupabaseSession } from '../types';
import { fetchProfile } from '../services/authService';

interface AuthContextValue extends AuthState {
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const INITIAL_STATE: AuthState = {
  user: null,
  profile: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);

  const loadProfile = useCallback(async (user: SupabaseUser) => {
    const profile = await fetchProfile(user.id);
    setState((prev) => ({ ...prev, profile }));
  }, []);

  const handleSession = useCallback(
    (session: SupabaseSession | null) => {
      const user = session?.user ?? null;

      setState({
        user,
        profile: null,
        session,
        isLoading: false,
        isAuthenticated: !!user,
      });

      if (user) {
        loadProfile(user);
      }
    },
    [loadProfile]
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    return () => subscription.unsubscribe();
  }, [handleSession]);

  const refreshProfile = useCallback(async () => {
    if (state.user) {
      await loadProfile(state.user);
    }
  }, [state.user, loadProfile]);

  return (
    <AuthContext.Provider value={{ ...state, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
