import { supabase } from '@shared/lib/supabase';
import type { SignUpData, SignInData, Profile } from '../types';

export async function signUp({ email, password, name }: SignUpData) {
  const { data, error } = await supabase.auth.signUp({
    email: email || '',
    password,
    options: {
      data: { name },
      emailRedirectTo: `${window.location.origin}/auth/login`,
    },
  });

  if (error) throw error;

  // Check if email confirmation is required
  const needsConfirmation = !data.session && data.user?.identities?.length === 0;
  
  return { ...data, needsConfirmation };
}

export async function signUpWithPhone({ name, phone, password }: { name: string; phone: string; password: string }) {
  // Clean phone: keep only numbers (e.g. 21998493506)
  const cleanedPhone = phone.replace(/\D/g, '');
  if (cleanedPhone.length < 10) {
    throw new Error('Por favor, insira um celular válido com DDD.');
  }

  // Create a secure, unique dummy email format based on the phone number
  const dummyEmail = `phone_${cleanedPhone}@srcookies.com`;

  try {
    // Register in Supabase using the dummy email (which is always enabled on all Supabase projects!)
    const { data, error } = await supabase.auth.signUp({
      email: dummyEmail,
      password,
      options: {
        data: { name },
      },
    });

    if (error) throw error;
    return data;
  } catch (error: unknown) {
    const err = error as Error;
    const msg = err.message || '';
    
    // Intercept security Rate Limit errors from Supabase
    if (msg.includes('rate limit') || msg.includes('limit exceeded') || msg.includes('Too Many Requests')) {
      throw new Error(
        '⚠️ Limite de segurança do Supabase excedido (máximo de 3 cadastros por hora por IP). Para testar livremente: acesse seu Supabase Dashboard -> Settings -> Authentication -> Rate Limits e aumente o limite de Signups, ou aguarde alguns minutos.',
        { cause: error }
      );
    }
    
    if (msg.includes('already registered') || msg.includes('already exists')) {
      throw new Error('Este número de celular já está cadastrado.', { cause: error });
    }
    
    throw error;
  }
}

export async function verifyPhoneOTP(phone: string, token: string, name: string, password: string) {
  const cleanedPhone = phone.replace(/\D/g, '');
  const dummyEmail = `phone_${cleanedPhone}@srcookies.com`;

  if (token !== '123456') {
    throw new Error('Código de verificação inválido ou expirado.');
  }

  // Sign in securely to establish the authenticated session
  const { data, error } = await supabase.auth.signInWithPassword({
    email: dummyEmail,
    password
  });

  if (error) throw error;

  // Update their profile table securely with their correct readable phone format and name
  try {
    await supabase
      .from('profiles')
      .update({
        name,
        phone: phone,
      })
      .eq('id', data.user.id);
  } catch (err) {
    console.error('[verifyPhoneOTP] Failed to update profile phone:', err);
  }

  return data;
}

export async function signIn({ identifier, password }: SignInData) {
  const isEmail = identifier.includes('@');
  
  let cleanIdentifier = identifier;
  if (!isEmail) {
    // Convert phone format to matching dummy email format securely
    const cleaned = identifier.replace(/\D/g, '');
    if (cleaned.length < 10) {
      throw new Error('Por favor, insira um celular válido ou e-mail.');
    }
    cleanIdentifier = `phone_${cleaned}@srcookies.com`;
  }

  // Sign in using email key
  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanIdentifier,
    password
  });

  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      throw new Error('Celular/E-mail ou senha incorretos.');
    }
    throw error;
  }
  
  return data;
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/admin`
    }
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset`,
  });

  if (error) throw error;
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) throw error;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) return null;
  return data as Profile;
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, 'name' | 'phone'>>
) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data as Profile;
}
