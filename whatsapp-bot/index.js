import express from 'express';
import dotenv from 'dotenv';
import QRCode from 'qrcode';
import { createClient } from '@supabase/supabase-js';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
} from '@whiskeysockets/baileys';
import fs from 'fs';

dotenv.config();

// ─── Environment ────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ ERRO: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ─── State ──────────────────────────────────────────────
const AUTH_DIR = './auth_info_baileys';
let currentQR = null;       // stores latest QR string
let botStatus = 'starting'; // starting | waiting_qr | connected | disconnected
let connectedAt = null;

// ─── Express Server ─────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;

// Health check
app.get('/', (_req, res) => {
  res.json({
    status: botStatus,
    connectedAt,
    timestamp: new Date().toISOString()
  });
});

// Status page
app.get('/status', (_req, res) => {
  const statusEmoji = {
    starting: '🔄',
    waiting_qr: '📱',
    connected: '✅',
    disconnected: '⚠️'
  };
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Sr. Cookies Bot — Status</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
          background: #0a0a0a;
          color: #e5e5e5;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .card {
          background: linear-gradient(145deg, #1a1a1a, #111);
          border: 1px solid #2a2a2a;
          border-radius: 20px;
          padding: 40px;
          text-align: center;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        }
        .emoji { font-size: 64px; margin-bottom: 16px; }
        .status-label {
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 2px;
          color: #888;
          margin-bottom: 8px;
        }
        .status-value {
          font-size: 24px;
          font-weight: 700;
          color: ${botStatus === 'connected' ? '#22c55e' : '#f59e0b'};
          margin-bottom: 24px;
        }
        .action-btn {
          display: inline-block;
          padding: 12px 32px;
          background: linear-gradient(135deg, #c2884d, #a06830);
          color: white;
          text-decoration: none;
          border-radius: 12px;
          font-weight: 600;
          transition: transform 0.2s;
        }
        .action-btn:hover { transform: scale(1.05); }
        .footer { margin-top: 24px; font-size: 12px; color: #555; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="emoji">${statusEmoji[botStatus] || '❓'}</div>
        <div class="status-label">Status do Bot</div>
        <div class="status-value">${botStatus.replace('_', ' ').toUpperCase()}</div>
        ${botStatus === 'waiting_qr' ? '<a href="/qr" class="action-btn">📱 Escanear QR Code</a>' : ''}
        ${botStatus === 'connected' ? `<p style="color:#22c55e">Conectado desde ${connectedAt}</p>` : ''}
        <div class="footer">🍪 Sr. Cookies WhatsApp Bot v1.1.0</div>
      </div>
    </body>
    </html>
  `);
});

// QR Code page — the main feature
app.get('/qr', async (_req, res) => {
  if (botStatus === 'connected') {
    return res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sr. Cookies Bot — Conectado!</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', system-ui, sans-serif;
            background: #0a0a0a; color: #e5e5e5;
            min-height: 100vh; display: flex;
            align-items: center; justify-content: center;
          }
          .card {
            background: linear-gradient(145deg, #1a1a1a, #111);
            border: 1px solid #22c55e33;
            border-radius: 20px; padding: 48px;
            text-align: center; max-width: 420px; width: 90%;
            box-shadow: 0 0 40px rgba(34,197,94,0.1);
          }
          .check { font-size: 80px; margin-bottom: 16px; }
          h1 { color: #22c55e; font-size: 28px; margin-bottom: 8px; }
          p { color: #888; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="check">✅</div>
          <h1>Já conectado!</h1>
          <p>O bot do WhatsApp está ativo e escutando mensagens de verificação.</p>
          <p style="margin-top:16px;color:#555;font-size:13px">Conectado desde ${connectedAt}</p>
        </div>
      </body>
      </html>
    `);
  }

  if (!currentQR) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="refresh" content="5">
        <title>Sr. Cookies Bot — Aguardando QR</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', system-ui, sans-serif;
            background: #0a0a0a; color: #e5e5e5;
            min-height: 100vh; display: flex;
            align-items: center; justify-content: center;
          }
          .card {
            background: linear-gradient(145deg, #1a1a1a, #111);
            border: 1px solid #2a2a2a;
            border-radius: 20px; padding: 48px;
            text-align: center; max-width: 420px; width: 90%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
          }
          .spinner {
            width: 48px; height: 48px;
            border: 4px solid #333; border-top-color: #c2884d;
            border-radius: 50%; animation: spin 1s linear infinite;
            margin: 0 auto 24px;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
          h1 { font-size: 22px; margin-bottom: 8px; }
          p { color: #888; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="spinner"></div>
          <h1>Gerando QR Code...</h1>
          <p>A página vai atualizar automaticamente.<br>Aguarde alguns segundos.</p>
        </div>
      </body>
      </html>
    `);
  }

  // Generate QR as base64 PNG
  try {
    const qrDataUrl = await QRCode.toDataURL(currentQR, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    });

    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="refresh" content="30">
        <title>Sr. Cookies Bot — Escanear QR</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', system-ui, sans-serif;
            background: #0a0a0a; color: #e5e5e5;
            min-height: 100vh; display: flex;
            align-items: center; justify-content: center;
            padding: 20px;
          }
          .card {
            background: linear-gradient(145deg, #1a1a1a, #111);
            border: 1px solid #2a2a2a;
            border-radius: 24px; padding: 40px 32px;
            text-align: center; max-width: 440px; width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
          }
          .logo { font-size: 48px; margin-bottom: 8px; }
          h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
          .subtitle { color: #888; font-size: 14px; margin-bottom: 24px; }
          .qr-container {
            background: white; border-radius: 16px;
            padding: 16px; display: inline-block;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            margin-bottom: 24px;
          }
          .qr-container img { display: block; width: 268px; height: 268px; }
          .steps {
            text-align: left; background: #151515;
            border-radius: 12px; padding: 20px 24px;
            margin-bottom: 20px;
          }
          .steps h3 { font-size: 13px; color: #c2884d; text-transform: uppercase;
            letter-spacing: 1.5px; margin-bottom: 12px; }
          .steps ol { padding-left: 20px; }
          .steps li { color: #aaa; font-size: 14px; line-height: 1.8; }
          .steps li strong { color: #e5e5e5; }
          .pulse {
            display: inline-block; width: 8px; height: 8px;
            background: #f59e0b; border-radius: 50%;
            animation: pulse 2s infinite; margin-right: 6px;
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.3); }
          }
          .timer { color: #555; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="logo">🍪</div>
          <h1>Sr. Cookies</h1>
          <div class="subtitle">Conectar WhatsApp do Bot</div>

          <div class="qr-container">
            <img src="${qrDataUrl}" alt="QR Code WhatsApp" />
          </div>

          <div class="steps">
            <h3>📋 Como escanear</h3>
            <ol>
              <li>Abra o <strong>WhatsApp</strong> no celular</li>
              <li>Toque em <strong>⋮ Menu</strong> (Android) ou <strong>Ajustes</strong> (iPhone)</li>
              <li>Toque em <strong>Dispositivos conectados</strong></li>
              <li>Toque em <strong>Conectar dispositivo</strong></li>
              <li>Escaneie o QR Code acima</li>
            </ol>
          </div>

          <p><span class="pulse"></span> <span style="color:#f59e0b;font-size:13px">Aguardando scan...</span></p>
          <p class="timer">A página atualiza automaticamente a cada 30s</p>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('Erro ao gerar QR image:', err);
    res.status(500).send('Erro ao gerar QR Code');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor HTTP iniciado na porta ${PORT}`);
  console.log(`📱 Página do QR Code: http://localhost:${PORT}/qr`);
});

// ─── WhatsApp Connection ────────────────────────────────
async function connectToWhatsApp() {
  console.log('🔄 Iniciando conexão com o WhatsApp...');
  botStatus = 'starting';
  currentQR = null;

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  const createSocket = makeWASocket.default || makeWASocket;
  const sock = createSocket({
    auth: state,
    printQRInTerminal: true,
    browser: ['Sr.Cookies Bot', 'Chrome', '22.0'],
    connectTimeoutMs: 60_000,
    defaultQueryTimeoutMs: undefined,
  });

  // Connection updates
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQR = qr;
      botStatus = 'waiting_qr';
      console.log('');
      console.log('══════════════════════════════════════════════════════════════');
      console.log('📌 QR CODE GERADO! Escaneie de uma destas formas:');
      console.log('');
      console.log(`   🌐 Via Browser: https://srcookies-whatsapp-bot.onrender.com/qr`);
      console.log('   📱 Ou escaneie o QR acima direto dos logs');
      console.log('══════════════════════════════════════════════════════════════');
      console.log('');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`⚠️ Conexão fechada (código: ${statusCode}). Reconectando: ${shouldReconnect}`);
      botStatus = 'disconnected';
      currentQR = null;
      connectedAt = null;

      if (shouldReconnect) {
        const delay = statusCode === 515 ? 5000 : 3000;
        console.log(`⏳ Reconectando em ${delay / 1000}s...`);
        setTimeout(connectToWhatsApp, delay);
      } else {
        console.log('❌ Sessão encerrada. Limpando credenciais...');
        try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch {}
        console.log('🔄 Reiniciando em 5s...');
        setTimeout(connectToWhatsApp, 5000);
      }
    } else if (connection === 'open') {
      botStatus = 'connected';
      currentQR = null;
      connectedAt = new Date().toISOString();
      console.log('');
      console.log('✅✅✅ CONECTADO AO WHATSAPP COM SUCESSO! ✅✅✅');
      console.log('🤖 Bot ouvindo mensagens #COOKIE-XXXX...');
      console.log('');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // Message listener
  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg?.key?.fromMe && m.type === 'notify') {
      const senderJid = msg.key.remoteJid;
      const text = msg.message?.conversation ||
                   msg.message?.extendedTextMessage?.text || '';

      const match = text.match(/#COOKIE-(\d{4})/i);

      if (match) {
        const code = match[1];
        const senderPhone = senderJid.split('@')[0];

        console.log(`💬 [${senderPhone}]: "${text}"`);
        console.log(`🔍 Buscando código #${code}...`);

        try {
          const { data: profile, error: fetchError } = await supabase
            .from('profiles')
            .select('id, name, phone')
            .eq('phone_verification_code', code)
            .maybeSingle();

          if (fetchError) {
            console.error('❌ Erro Supabase:', fetchError);
            return;
          }

          if (profile) {
            console.log(`🎉 Match! Cliente: ${profile.name}`);

            let formattedPhone = profile.phone;
            if (!formattedPhone) {
              formattedPhone = `(${senderPhone.slice(2, 4)}) ${senderPhone.slice(4, 9)}-${senderPhone.slice(9)}`;
            }

            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                phone_verified: true,
                phone_verification_code: null,
                phone: formattedPhone
              })
              .eq('id', profile.id);

            if (updateError) {
              console.error(`❌ Falha ao atualizar ${profile.name}:`, updateError);
            } else {
              console.log(`✅ Celular de ${profile.name} validado!`);

              await sock.sendMessage(senderJid, {
                text: `Olá, ${profile.name.split(' ')[0]}! 🍪\n\nSeu número de celular foi validado com sucesso no Sr. Cookies!\n\nAgora você está pronto para receber todas as notificações e links de rastreamento em tempo real direto aqui no seu WhatsApp.`
              });
            }
          } else {
            console.warn(`⚠️ Código #${code} de [${senderPhone}] não encontrado.`);
          }
        } catch (dbErr) {
          console.error('💥 Exceção DB:', dbErr);
        }
      }
    }
  });
}

// ─── Boot ───────────────────────────────────────────────
console.log('🍪 Sr. Cookies WhatsApp Bot v1.1.0');
console.log(`📡 Ambiente: ${process.env.NODE_ENV || 'production'}`);

connectToWhatsApp().catch(err => {
  console.error('💥 Erro crítico:', err);
  try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch {}
  setTimeout(() => {
    connectToWhatsApp().catch(e => {
      console.error('💥 Falha definitiva:', e);
      process.exit(1);
    });
  }, 3000);
});
