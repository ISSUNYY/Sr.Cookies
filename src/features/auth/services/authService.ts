import { supabase } from '@shared/lib/supabase';
import type { SignUpData, SignInData, Profile } from '../types';

export async function signUp({ email, password, name, phone }: SignUpData) {
  if (phone) {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10) {
      throw new Error('Por favor, insira um celular válido com DDD.');
    }

    // Check if another profile already has this phone number
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', phone)
      .maybeSingle();

    let isDuplicate = !!existingProfile;

    if (!isDuplicate) {
      const { data: existingProfileClean } = await supabase
        .from('profiles')
        .select('id')
        .ilike('phone', `%${cleaned}%`)
        .maybeSingle();
      isDuplicate = !!existingProfileClean;
    }

    if (isDuplicate) {
      throw new Error('Este número de celular já está cadastrado em outra conta.');
    }
  }

  const { data, error } = await supabase.auth.signUp({
    email: email || '',
    password,
    options: {
      data: { name },
      emailRedirectTo: `${window.location.origin}/auth/login`,
    },
  });

  if (error) throw error;

  // Sincronizar o telefone e o e-mail real na tabela de perfis públicos
  if (data.user) {
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          name,
          phone: phone || null,
          email: email || null,
          phone_verified: true,
          phone_verification_code: null,
        })
        .eq('id', data.user.id);
        
      if (updateError) {
        // Fallback: se o perfil ainda não existir na trigger, fazemos upsert
        await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            name,
            phone: phone || null,
            email: email || null,
            phone_verified: true,
            phone_verification_code: null,
          });
      }
    } catch (err) {
      console.error('[signUp] Falha ao atualizar perfil com telefone/e-mail:', err);
    }
  }

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

  // Pre-check if phone is already registered in profiles
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('phone', phone)
    .maybeSingle();

  let isDuplicate = !!existingProfile;

  if (!isDuplicate) {
    const { data: existingProfileClean } = await supabase
      .from('profiles')
      .select('id')
      .ilike('phone', `%${cleanedPhone}%`)
      .maybeSingle();
    isDuplicate = !!existingProfileClean;
  }

  if (isDuplicate) {
    throw new Error('Este número de celular já está cadastrado em outra conta.');
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
    // Se não for e-mail, limpamos o número de telefone
    const cleaned = identifier.replace(/\D/g, '');
    if (cleaned.length < 10) {
      throw new Error('Por favor, insira um celular válido ou e-mail.');
    }
    
    // 1. Tentar buscar o e-mail real associado a este telefone no profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('phone', identifier)
      .maybeSingle();

    let resolvedEmail = profile?.email;

    if (!resolvedEmail) {
      // Se não achou com a máscara, tenta buscar com o número limpo
      const { data: profileClean } = await supabase
        .from('profiles')
        .select('email')
        .like('phone', `%${cleaned}%`)
        .maybeSingle();
      resolvedEmail = profileClean?.email;
    }

    if (resolvedEmail) {
      cleanIdentifier = resolvedEmail;
    } else {
      // 2. Fallback para contas legadas criadas com o formato de celular simulado
      cleanIdentifier = `phone_${cleaned}@srcookies.com`;
    }
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
  updates: Partial<Profile>
) {
  let finalUpdates = { ...updates };

  if (updates.phone !== undefined) {
    const phone = updates.phone;
    if (phone) {
      const cleaned = phone.replace(/\D/g, '');
      if (cleaned.length < 10) {
        throw new Error('Por favor, insira um celular válido com DDD.');
      }

      // Se o telefone estiver sendo alterado de fato
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('phone, phone_verified')
        .eq('id', userId)
        .single();

      const currentCleaned = currentProfile?.phone ? currentProfile.phone.replace(/\D/g, '') : '';

      if (cleaned !== currentCleaned || !currentProfile?.phone_verified) {
        // Verificar se outro usuário já usa este telefone
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('phone', phone)
          .neq('id', userId)
          .maybeSingle();

        let isDuplicate = !!existingProfile;

        if (!isDuplicate) {
          const { data: existingProfileClean } = await supabase
            .from('profiles')
            .select('id')
            .ilike('phone', `%${cleaned}%`)
            .neq('id', userId)
            .maybeSingle();
          isDuplicate = !!existingProfileClean;
        }

        if (isDuplicate) {
          throw new Error('Este número de celular já está cadastrado em outra conta.');
        }

        // Sempre marca como verificado e sem código ao atualizar telefone
        finalUpdates = {
          ...finalUpdates,
          phone_verified: true,
          phone_verification_code: null
        };
      }
    } else {
      finalUpdates = {
        ...finalUpdates,
        phone_verified: true,
        phone_verification_code: null
      };
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(finalUpdates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    if (error.code === '23505' || error.message?.includes('profiles_phone_unique')) {
      throw new Error('Este número de celular já está em uso por outra conta.');
    }
    throw error;
  }
  return data as Profile;
}
