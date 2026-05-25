import express from 'express';
import dotenv from 'dotenv';
import QRCode from 'qrcode';
import pino from 'pino';
import { createClient } from '@supabase/supabase-js';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import fs from 'fs';

dotenv.config();

// ─── Logger (REQUIRED by Baileys v6) ────────────────────
const logger = pino({ level: 'warn' });

// ─── Environment ────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ ERRO: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ─── Bot State ──────────────────────────────────────────
const AUTH_DIR = './auth_info_baileys';
let currentQR = null;
let botStatus = 'starting';
let connectedAt = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

// ─── Express Server ─────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (_req, res) => {
  res.json({ status: botStatus, connectedAt, timestamp: new Date().toISOString() });
});

app.get('/status', (_req, res) => {
  const colors = { starting: '#f59e0b', waiting_qr: '#3b82f6', connected: '#22c55e', disconnected: '#ef4444' };
  const labels = { starting: 'Iniciando...', waiting_qr: 'Aguardando QR Scan', connected: 'Conectado', disconnected: 'Desconectado' };
  const emojis = { starting: '🔄', waiting_qr: '📱', connected: '✅', disconnected: '⚠️' };

  res.send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="10"><title>Bot Status</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',system-ui,sans-serif;background:#0a0a0a;color:#e5e5e5;min-height:100vh;display:flex;align-items:center;justify-content:center}
  .card{background:linear-gradient(145deg,#1a1a1a,#111);border:1px solid #2a2a2a;border-radius:20px;padding:40px;text-align:center;max-width:400px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.5)}
  .emoji{font-size:64px;margin-bottom:16px}.lbl{font-size:14px;text-transform:uppercase;letter-spacing:2px;color:#888;margin-bottom:8px}
  .val{font-size:24px;font-weight:700;color:${colors[botStatus]};margin-bottom:24px}
  .btn{display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#c2884d,#a06830);color:#fff;text-decoration:none;border-radius:12px;font-weight:600;transition:transform .2s}
  .btn:hover{transform:scale(1.05)}.ft{margin-top:24px;font-size:12px;color:#555}</style></head>
  <body><div class="card"><div class="emoji">${emojis[botStatus]}</div><div class="lbl">Status do Bot</div><div class="val">${labels[botStatus]}</div>
  ${botStatus === 'waiting_qr' ? '<a href="/qr" class="btn">📱 Escanear QR Code</a>' : ''}
  ${botStatus === 'connected' ? `<p style="color:#22c55e;font-size:14px">Desde ${connectedAt}</p>` : ''}
  <div class="ft">🍪 Sr. Cookies Bot v1.2.0 · Auto-refresh 10s</div></div></body></html>`);
});

app.get('/qr', async (_req, res) => {
  if (botStatus === 'connected') {
    return res.send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Conectado!</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',system-ui,sans-serif;background:#0a0a0a;color:#e5e5e5;min-height:100vh;display:flex;align-items:center;justify-content:center}
    .card{background:linear-gradient(145deg,#1a1a1a,#111);border:1px solid #22c55e33;border-radius:20px;padding:48px;text-align:center;max-width:420px;width:90%;box-shadow:0 0 40px rgba(34,197,94,.1)}
    h1{color:#22c55e;font-size:28px;margin:12px 0}p{color:#888;line-height:1.6}</style></head>
    <body><div class="card"><div style="font-size:80px">✅</div><h1>Conectado!</h1><p>Bot ativo e escutando mensagens de verificação.</p>
    <p style="margin-top:16px;color:#555;font-size:13px">Desde ${connectedAt}</p></div></body></html>`);
  }

  if (!currentQR) {
    return res.send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="3"><title>Aguardando QR</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',system-ui,sans-serif;background:#0a0a0a;color:#e5e5e5;min-height:100vh;display:flex;align-items:center;justify-content:center}
    .card{background:linear-gradient(145deg,#1a1a1a,#111);border:1px solid #2a2a2a;border-radius:20px;padding:48px;text-align:center;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.5)}
    .sp{width:48px;height:48px;border:4px solid #333;border-top-color:#c2884d;border-radius:50%;animation:s 1s linear infinite;margin:0 auto 24px}
    @keyframes s{to{transform:rotate(360deg)}}h1{font-size:22px;margin-bottom:8px}p{color:#888;font-size:14px}</style></head>
    <body><div class="card"><div class="sp"></div><h1>Gerando QR Code...</h1><p>Atualizando a cada 3 segundos.<br>Aguarde o bot inicializar.</p>
    <p style="margin-top:16px;color:#555;font-size:12px">Status: ${botStatus} · Tentativas: ${reconnectAttempts}</p></div></body></html>`);
  }

  try {
    const qrDataUrl = await QRCode.toDataURL(currentQR, { width: 300, margin: 2, color: { dark: '#000', light: '#fff' } });
    res.send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="20"><title>Escanear QR</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',system-ui,sans-serif;background:#0a0a0a;color:#e5e5e5;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
    .card{background:linear-gradient(145deg,#1a1a1a,#111);border:1px solid #2a2a2a;border-radius:24px;padding:40px 32px;text-align:center;max-width:440px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.5)}
    .qr{background:#fff;border-radius:16px;padding:16px;display:inline-block;box-shadow:0 8px 32px rgba(0,0,0,.3);margin:20px 0}
    .qr img{display:block;width:268px;height:268px}
    .steps{text-align:left;background:#151515;border-radius:12px;padding:20px 24px;margin:20px 0}
    .steps h3{font-size:13px;color:#c2884d;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px}
    .steps ol{padding-left:20px}.steps li{color:#aaa;font-size:14px;line-height:1.8}.steps li strong{color:#e5e5e5}
    .pulse{display:inline-block;width:8px;height:8px;background:#f59e0b;border-radius:50%;animation:p 2s infinite;margin-right:6px}
    @keyframes p{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}</style></head>
    <body><div class="card">
    <div style="font-size:48px">🍪</div><h1 style="font-size:22px;margin:8px 0">Sr. Cookies</h1><p style="color:#888;font-size:14px">Conectar WhatsApp do Bot</p>
    <div class="qr"><img src="${qrDataUrl}" alt="QR Code"/></div>
    <div class="steps"><h3>📋 Como escanear</h3><ol>
    <li>Abra o <strong>WhatsApp</strong> no celular</li>
    <li><strong>⋮ Menu</strong> (Android) ou <strong>Ajustes</strong> (iPhone)</li>
    <li><strong>Dispositivos conectados</strong></li>
    <li><strong>Conectar dispositivo</strong></li>
    <li>Aponte a câmera para o QR acima</li>
    </ol></div>
    <p><span class="pulse"></span><span style="color:#f59e0b;font-size:13px">Aguardando scan...</span></p>
    <p style="color:#555;font-size:12px;margin-top:8px">Atualiza a cada 20s</p>
    </div></body></html>`);
  } catch (err) {
    console.error('Erro QR image:', err);
    res.status(500).send('Erro ao gerar QR');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 HTTP na porta ${PORT}`);
  console.log(`📱 QR Code: http://localhost:${PORT}/qr`);
});

// ─── WhatsApp Connection ────────────────────────────────
async function connectToWhatsApp() {
  console.log(`🔄 Conectando ao WhatsApp... (tentativa ${reconnectAttempts + 1})`);
  botStatus = 'starting';
  currentQR = null;

  // Clean auth if too many failed attempts
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.log('🧹 Muitas tentativas. Limpando auth e reiniciando...');
    try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch {}
    reconnectAttempts = 0;
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  const createSocket = makeWASocket.default || makeWASocket;
  const sock = createSocket({
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: true,
    browser: ['Ubuntu', 'Chrome', '22.04.4'],
    connectTimeoutMs: 60_000,
    defaultQueryTimeoutMs: undefined,
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQR = qr;
      botStatus = 'waiting_qr';
      reconnectAttempts = 0;
      console.log('');
      console.log('══════════════════════════════════════════════════════════════');
      console.log('📌 QR CODE PRONTO!');
      console.log('🌐 Abra: https://srcookies-whatsapp-bot.onrender.com/qr');
      console.log('══════════════════════════════════════════════════════════════');
      console.log('');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      botStatus = 'disconnected';
      currentQR = null;
      connectedAt = null;

      console.log(`⚠️ Desconectado (código: ${statusCode}). Reconectando: ${shouldReconnect}`);

      if (shouldReconnect) {
        reconnectAttempts++;
        // Exponential backoff: 3s, 6s, 12s, 24s... max 60s
        const delay = Math.min(3000 * Math.pow(2, reconnectAttempts - 1), 60_000);
        console.log(`⏳ Aguardando ${Math.round(delay / 1000)}s (tentativa ${reconnectAttempts})...`);
        setTimeout(connectToWhatsApp, delay);
      } else {
        console.log('❌ Logout detectado. Limpando sessão...');
        try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch {}
        reconnectAttempts = 0;
        setTimeout(connectToWhatsApp, 5000);
      }
    } else if (connection === 'open') {
      botStatus = 'connected';
      currentQR = null;
      connectedAt = new Date().toISOString();
      reconnectAttempts = 0;
      console.log('');
      console.log('✅✅✅ CONECTADO AO WHATSAPP! ✅✅✅');
      console.log('🤖 Escutando mensagens #COOKIE-XXXX...');
      console.log('');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg?.key?.fromMe && m.type === 'notify') {
      const senderJid = msg.key.remoteJid;
      const text = msg.message?.conversation ||
                   msg.message?.extendedTextMessage?.text || '';

      const match = text.match(/#COOKIE-(\d{4})/i);
      if (!match) return;

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

        if (fetchError) { console.error('❌ Erro Supabase:', fetchError); return; }

        if (profile) {
          console.log(`🎉 Match! Cliente: ${profile.name}`);
          let formattedPhone = profile.phone;
          if (!formattedPhone) {
            formattedPhone = `(${senderPhone.slice(2, 4)}) ${senderPhone.slice(4, 9)}-${senderPhone.slice(9)}`;
          }

          const { error: updateError } = await supabase
            .from('profiles')
            .update({ phone_verified: true, phone_verification_code: null, phone: formattedPhone })
            .eq('id', profile.id);

          if (updateError) {
            console.error(`❌ Update falhou (${profile.name}):`, updateError);
          } else {
            console.log(`✅ ${profile.name} validado!`);
            await sock.sendMessage(senderJid, {
              text: `Olá, ${profile.name.split(' ')[0]}! 🍪\n\nSeu número foi validado com sucesso no Sr. Cookies!\n\nAgora você receberá notificações e rastreamento em tempo real aqui no WhatsApp.`
            });
          }
        } else {
          console.warn(`⚠️ Código #${code} de [${senderPhone}] não encontrado.`);
        }
      } catch (dbErr) {
        console.error('💥 Exceção DB:', dbErr);
      }
    }
  });
}

// ─── Boot ───────────────────────────────────────────────
console.log('🍪 Sr. Cookies WhatsApp Bot v1.2.0');
connectToWhatsApp().catch(err => {
  console.error('💥 Erro crítico:', err);
  try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch {}
  setTimeout(() => connectToWhatsApp().catch(() => process.exit(1)), 5000);
});
