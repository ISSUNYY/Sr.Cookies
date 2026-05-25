import express from 'express';
import dotenv from 'dotenv';
import qrcode from 'qrcode-terminal';
import { createClient } from '@supabase/supabase-js';
import makeWASocket, { 
  useMultiFileAuthState, 
  DisconnectReason 
} from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ ERRO: As variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.');
  process.exit(1);
}

// Initialize Supabase Client with Admin/Service Role privileges to bypass RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Initialize Express server for Render free tier compatibility (HTTP Health Check binding)
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.status(200).send({
    status: 'online',
    message: 'Sr. Cookies WhatsApp Bot is active and running!',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor HTTP de Health Check iniciado na porta ${PORT}`);
});

// Main WhatsApp Client connection function
async function connectToWhatsApp() {
  console.log('🔄 Iniciando conexão com o WhatsApp...');
  
  // Save auth state sessions locally in the workspace (survives restarts)
  const authDir = './auth_info_baileys';
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  const sock = makeWASocket.default({
    auth: state,
    printQRInTerminal: false // We will handle printing manually for maximum control
  });

  // Listen to connection updates
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      console.log('📌 ESCANEIE O QR CODE ABAIXO NO SEU WHATSAPP DO SR. COOKIES:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('⚠️ Conexão fechada devido a:', lastDisconnect?.error, '. Reconectando:', shouldReconnect);
      
      if (shouldReconnect) {
        connectToWhatsApp();
      } else {
        console.error('❌ Sessão expirada/desconectada pelo usuário. Limpando credenciais...');
        try {
          fs.rmSync(authDir, { recursive: true, force: true });
        } catch (e) {
          console.warn('Falha ao limpar pasta de credenciais:', e.message);
        }
        setTimeout(connectToWhatsApp, 5000);
      }
    } else if (connection === 'open') {
      console.log('✅ Conexão com o WhatsApp estabelecida com sucesso!');
    }
  });

  // Save credentials on updates
  sock.ev.on('creds.update', saveCreds);

  // Listen for incoming messages
  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.key.fromMe && m.type === 'notify') {
      const senderJid = msg.key.remoteJid;
      const text = msg.message?.conversation || 
                   msg.message?.extendedTextMessage?.text || '';

      // Match the pattern "#COOKIE-XXXX" (case-insensitive)
      const match = text.match(/#COOKIE-(\d{4})/i);
      
      if (match) {
        const code = match[1];
        const senderPhone = senderJid.split('@')[0]; // Extract phone number digits
        
        console.log(`💬 Mensagem recebida de [${senderPhone}]: "${text}"`);
        console.log(`🔍 Buscando código de verificação #${code} no banco de dados...`);

        try {
          // Find the profile waiting for this verification code
          const { data: profile, error: fetchError } = await supabase
            .from('profiles')
            .select('id, name, phone')
            .eq('phone_verification_code', code)
            .maybeSingle();

          if (fetchError) {
            console.error('❌ Erro ao buscar perfil no Supabase:', fetchError);
            return;
          }

          if (profile) {
            console.log(`🎉 Código correspondente encontrado para o cliente: ${profile.name}!`);
            
            // Format phone beautifully for storage if it is raw, or keep what was input
            let formattedPhone = profile.phone;
            if (!formattedPhone) {
              // Fallback to sender's number formatted cleanly
              formattedPhone = `(${senderPhone.slice(2, 4)}) ${senderPhone.slice(4, 9)}-${senderPhone.slice(9)}`;
            }

            // Update user profile status: phone_verified = true and clear code
            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                phone_verified: true,
                phone_verification_code: null,
                phone: formattedPhone
              })
              .eq('id', profile.id);

            if (updateError) {
              console.error(`❌ Falha ao atualizar perfil de ${profile.name}:`, updateError);
            } else {
              console.log(`✅ Sucesso! Celular de ${profile.name} foi validado.`);
              
              // Send a professional automated confirmation receipt back to customer
              await sock.sendMessage(senderJid, { 
                text: `Olá, ${profile.name.split(' ')[0]}! 🍪\n\nSeu número de celular foi validado com sucesso no Sr. Cookies!\n\nAgora você está pronto para receber todas as notificações e links de rastreamento em tempo real direto aqui no seu WhatsApp.` 
              });
            }
          } else {
            console.warn(`⚠️ Código #${code} enviado por [${senderPhone}] não foi localizado ou já foi validado.`);
          }
        } catch (dbErr) {
          console.error('💥 Exceção ao atualizar no banco de dados:', dbErr);
        }
      }
    }
  });
}

// Run bot
connectToWhatsApp().catch(err => {
  console.error('💥 Erro crítico no inicializador do bot:', err);
});
