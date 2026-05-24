import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to manually load environment variables from .env and .env.local
function loadEnv() {
  const envPaths = [
    path.join(__dirname, '.env'),
    path.join(__dirname, '.env.local')
  ];

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split(/\r?\n/);
        for (let line of lines) {
          line = line.trim();
          if (!line || line.startsWith('#')) continue;
          
          const equalsIdx = line.indexOf('=');
          if (equalsIdx === -1) continue;
          
          const key = line.substring(0, equalsIdx).trim();
          let value = line.substring(equalsIdx + 1).trim();
          
          // Remove surrounding quotes if they exist
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.substring(1, value.length - 1);
          }
          
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      } catch (err) {
        console.error(`[Env Parser] Error parsing ${envPath}:`, err);
      }
    }
  }
}

// Load env variables dynamically
loadEnv();

// Sandbox credentials populated in the workspace environment
const ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN || 'APP_USR-8031810500488798-052318-0be1b24b83aca883358816554baef786-3422205278';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

// Initialize the official Mercado Pago Config client SDK
const mpClient = new MercadoPagoConfig({
  accessToken: ACCESS_TOKEN
});

// Initialize Supabase Client securely
let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('[Supabase Client] Successfully initialized Supabase client securely.');
} else {
  console.warn('[Supabase Client] WARNING: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not configured in variables. Supabase features will be offline.');
}

const PORT = 3001;

// Perform the order status updates idempotently, preventing demoting a PAID order back to PENDING or REJECTED.
async function updateOrderStatusIdempotently(orderId, targetStatus) {
  if (!supabase) {
    console.error('[Supabase Client] Cannot update order status: Supabase client is not initialized.');
    return;
  }

  console.log(`[Supabase Update] Attempting to update order ${orderId} status to ${targetStatus}...`);

  try {
    // Fetch the current order state from Supabase to check for idempotency safety
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single();

    if (fetchError) {
      console.error(`[Supabase Update] Error fetching order ${orderId}:`, fetchError.message);
      return;
    }

    if (!order) {
      console.error(`[Supabase Update] Error: Order ${orderId} not found in database.`);
      return;
    }

    const currentStatus = order.status ? order.status.toUpperCase() : 'PENDING';
    const newStatus = targetStatus.toUpperCase();

    console.log(`[Supabase Update] Order ${orderId} current status in DB: "${currentStatus}", Target status: "${newStatus}"`);

    // Perform the order status updates idempotently:
    // 1. Prevent demoting a PAID order back to PENDING or REJECTED.
    // 2. Prevent changing status of an already REFUNDED order.
    if (currentStatus === 'PAID') {
      if (newStatus === 'PENDING' || newStatus === 'REJECTED') {
        console.log(`[Supabase Update] Idempotency Safe Guard: Order ${orderId} is already PAID. Demotion to ${newStatus} is rejected.`);
        return;
      }
    } else if (currentStatus === 'REFUNDED') {
      console.log(`[Supabase Update] Idempotency Safe Guard: Order ${orderId} is already REFUNDED. Updates rejected.`);
      return;
    }

    if (currentStatus === newStatus) {
      console.log(`[Supabase Update] Idempotency Safe Guard: Order ${orderId} is already in state ${newStatus}.`);
      return;
    }

    // Update status in database
    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (updateError) {
      console.error(`[Supabase Update] Error updating order ${orderId} status to ${newStatus}:`, updateError.message);
    } else {
      console.log(`[Supabase Update] Success! Order ${orderId} updated from ${currentStatus} to ${newStatus}.`);
    }
  } catch (err) {
    console.error(`[Supabase Update Error] Failed during database update execution for order ${orderId}:`, err);
  }
}

// Fetch payment details securely using the official SDK new Payment(mpClient).get({ id: paymentId })
async function processPaymentNotification(paymentId) {
  try {
    console.log(`[Webhook Background] Fetching payment details securely from Mercado Pago for payment ID: ${paymentId}`);
    
    const payment = new Payment(mpClient);
    const paymentDetails = await payment.get({ id: paymentId });

    console.log(`[Webhook Background] Retrieved payment details successfully:`);
    console.log(`  - Payment ID: ${paymentDetails.id}`);
    console.log(`  - Status: ${paymentDetails.status}`);
    console.log(`  - Status Detail: ${paymentDetails.status_detail}`);
    console.log(`  - External Reference (Order ID): ${paymentDetails.external_reference}`);

    const orderId = paymentDetails.external_reference;
    if (!orderId) {
      console.warn(`[Webhook Background] WARNING: Payment ${paymentId} has no external_reference (orderId). Aborting DB update.`);
      return;
    }

    const mpStatus = paymentDetails.status;
    let targetStatus = 'PENDING';
    
    if (mpStatus === 'approved') {
      targetStatus = 'PAID';
    } else if (mpStatus === 'rejected' || mpStatus === 'cancelled') {
      targetStatus = 'REJECTED';
    } else if (mpStatus === 'refunded' || mpStatus === 'charged_back') {
      targetStatus = 'REFUNDED';
    }

    await updateOrderStatusIdempotently(orderId, targetStatus);
  } catch (err) {
    console.error(`[Webhook Background Error] Failed to process payment ID ${paymentId}:`, err);
  }
}

const server = http.createServer(async (req, res) => {
  // CORS Headers for secure local proxy redirection
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-signature, x-request-id');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // 1. Webhook endpoint: POST /api/mp/webhook
  if (req.method === 'POST' && urlObj.pathname === '/api/mp/webhook') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        console.log('\n--- [Webhook Received] ---');

        // Extract parameters from URL and/or body
        const dataIdQuery = urlObj.searchParams.get('data.id') || urlObj.searchParams.get('id');
        const typeQuery = urlObj.searchParams.get('type') || urlObj.searchParams.get('action');

        let reqData = {};
        if (body) {
          try {
            reqData = JSON.parse(body);
          } catch (e) {
            console.warn('[Webhook] Failed to parse request body as JSON:', e.message);
          }
        }

        const dataId = dataIdQuery || reqData.data?.id || reqData.id;
        const eventType = typeQuery || reqData.type || reqData.action;

        console.log(`[Webhook Details]`);
        console.log(`  - Request URL: ${req.url}`);
        console.log(`  - Extracted Data ID: ${dataId}`);
        console.log(`  - Extracted Event Type: ${eventType}`);

        // Dynamic validation of the x-signature header using crypto (HMAC-SHA256)
        const signatureHeader = req.headers['x-signature'];
        const xRequestId = req.headers['x-request-id'];

        console.log(`[Webhook Signature Verification]`);
        console.log(`  - x-signature Header: ${signatureHeader || 'NOT PRESENT'}`);
        console.log(`  - x-request-id Header: ${xRequestId || 'NOT PRESENT'}`);

        const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;

        if (!webhookSecret) {
          console.warn('[Webhook Validation] WARNING: MERCADO_PAGO_WEBHOOK_SECRET is not configured in environment variables.');
          console.warn('[Webhook Validation] Bypassing cryptographic validation to not block local development.');
        } else {
          // Cryptographic Validation
          if (!signatureHeader || !xRequestId || !dataId) {
            console.error('[Webhook Validation] Error: Missing required headers or data.id for signature verification.');
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Bad Request: Missing verification data' }));
            return;
          }

          // 1. Extract ts and v1 from header
          let ts = null;
          let v1 = null;
          const parts = signatureHeader.split(',');
          for (const part of parts) {
            const [key, val] = part.split('=');
            if (key && val) {
              if (key.trim() === 'ts') ts = val.trim();
              if (key.trim() === 'v1') v1 = val.trim();
            }
          }

          console.log(`  - Extracted ts (Timestamp): ${ts}`);
          console.log(`  - Extracted v1 (Signature Hash): ${v1}`);

          if (!ts || !v1) {
            console.error('[Webhook Validation] Error: Invalid x-signature format.');
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Bad Request: Invalid x-signature format' }));
            return;
          }

          // 2. Format signature template string: id:[data.id_url];request-id:[x-request-id_header];ts:[ts_header];
          const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
          console.log(`  - Structured Manifest String: "${manifest}"`);

          // 3. Generate HMAC hex signature and verify with v1
          const calculatedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(manifest)
            .digest('hex');

          console.log(`  - Calculated HMAC: ${calculatedSignature}`);
          console.log(`  - Expected v1 Hash: ${v1}`);

          if (calculatedSignature !== v1) {
            console.error('[Webhook Validation] ERROR: Cryptographic signature mismatch! Webhook notification discarded.');
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized: Invalid cryptographic signature' }));
            return;
          }

          console.log('[Webhook Validation] SUCCESS: Authentic Mercado Pago request verified.');
        }

        // Always respond with 200 OK (or 201 Created) swiftly under 100ms
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'received' }));
        console.log('[Webhook Response] Responded immediately with 200 OK (under 100ms).');

        // Async Processing in background
        if (eventType === 'payment') {
          if (dataId) {
            processPaymentNotification(dataId).catch(err => {
              console.error('[Webhook Background Error] Error in background processor:', err);
            });
          } else {
            console.warn('[Webhook Background] WARNING: Payment ID missing from notification. Cannot process.');
          }
        } else {
          console.log(`[Webhook Background] Ignoring event of type "${eventType}" (only "payment" events trigger updates).`);
        }

      } catch (err) {
        console.error('[Webhook Error] Error during request handling:', err);
        if (!res.writableEnded) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
      }
    });
    return;
  }

  // 2. Create Preference endpoint: POST /api/mp/preference
  if (req.method === 'POST' && req.url === '/api/mp/preference') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const reqData = JSON.parse(body);
        console.log('[MP Server] Creating preference for Order:', reqData.orderId);

        const preference = new Preference(mpClient);
        
        // Mapped to exact Mercado Pago Preference v3 structures
        const items = reqData.items.map(item => ({
          title: item.name,
          quantity: item.quantity,
          unit_price: parseFloat(item.price),
          currency_id: 'BRL'
        }));

        const result = await preference.create({
          body: {
            items,
            external_reference: reqData.orderId,
            back_urls: {
              success: 'http://localhost:5173/',
              failure: 'http://localhost:5173/',
              pending: 'http://localhost:5173/'
            },
            auto_return: 'approved'
          }
        });

        console.log('[MP Server] Preference successfully generated. ID:', result.id);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: result.id,
          init_point: result.init_point,
          sandbox_init_point: result.sandbox_init_point
        }));
      } catch (err) {
        console.error('[MP Server] Failed to create Preference:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Internal preference creation error' }));
      }
    });
    return;
  }

  // 3. Create Pix Payment endpoint: POST /api/mp/pix
  if (req.method === 'POST' && req.url === '/api/mp/pix') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const reqData = JSON.parse(body);
        console.log('[MP Server] Generating Pix payment for order:', reqData.orderId, 'Amount:', reqData.amount);

        const payment = new Payment(mpClient);
        
        const result = await payment.create({
          body: {
            transaction_amount: parseFloat(reqData.amount),
            description: `Pedido Sr. Cookies - Ref: ${reqData.orderId.split('-')[0]}`,
            payment_method_id: 'pix',
            payer: {
              email: reqData.email || 'cliente@srcookies.com'
            }
          }
        });

        console.log('[MP Server] Pix Payment generated successfully. ID:', result.id);
        
        // Return standard Pix structure expected by client
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: result.id,
          qr_code: result.point_of_interaction?.transaction_data?.qr_code || 'MOCK_COPY_PASTE_PIX_KEY',
          qr_code_base64: result.point_of_interaction?.transaction_data?.qr_code_base64 || '',
          status: result.status
        }));
      } catch (err) {
        console.error('[MP Server] Failed to create Pix payment:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Internal Pix generation error' }));
      }
    });
    return;
  }

  // Fallback 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🍪 Sr. Cookies - Mercado Pago Official Node SDK Server`);
  console.log(`🚀 Running securely on http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
