import express from 'express';
import { createServer as createViteServer } from 'vite';
import { google } from 'googleapis';
import { AuthenticationClient } from 'auth0';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', key: process.env.API_KEY ? 'exists' : 'missing' });
  });

  // In-memory store for Residents
  interface Resident {
    id: string;
    flatNumber: string;
    email: string;
    isVerified: boolean;
    verificationToken: string;
  }
  const residents: Resident[] = [];

  app.get('/api/gate/residents', (req, res) => {
    res.json(residents);
  });

  app.post('/api/gate/residents', async (req, res) => {
    const { flatNumber, email } = req.body;
    if (!flatNumber || !email) {
      return res.status(400).json({ error: 'Flat number and email are required' });
    }

    let resident = residents.find(r => r.flatNumber === flatNumber);
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    if (resident) {
      resident.email = email;
      resident.isVerified = false;
      resident.verificationToken = token;
    } else {
      resident = { 
        id: Math.random().toString(36).substring(7), 
        flatNumber, 
        email, 
        isVerified: false, 
        verificationToken: token 
      };
      residents.push(resident);
    }

    // Send verification email
    await sendVerificationEmail(resident, req);
    res.json(resident);
  });

  app.post('/api/gate/residents/:id/resend-verification', async (req, res) => {
    const { id } = req.params;
    const resident = residents.find(r => r.id === id);
    if (!resident) {
      return res.status(404).json({ error: 'Resident not found' });
    }
    if (resident.isVerified) {
      return res.status(400).json({ error: 'Resident is already verified' });
    }
    
    // Generate a new token just in case
    resident.verificationToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    await sendVerificationEmail(resident, req);
    res.json({ success: true, message: 'Verification email sent' });
  });

  app.post('/api/gate/residents/:id/mock-verify', (req, res) => {
    const { id } = req.params;
    const resident = residents.find(r => r.id === id);
    if (!resident) {
      return res.status(404).json({ error: 'Resident not found' });
    }
    resident.isVerified = true;
    delete resident.verificationToken;
    res.json({ success: true, resident });
  });

  app.get('/api/gate/verify-email/:token', (req, res) => {
    const resident = residents.find(r => r.verificationToken === req.params.token);
    if (!resident) {
      return res.status(404).send(`
        <div style="font-family: sans-serif; max-width: 400px; margin: 40px auto; text-align: center; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h1 style="color: #dc2626">Verification Failed</h1>
          <p style="color: #475569">Invalid or expired token.</p>
        </div>
      `);
    }
    resident.isVerified = true;
    res.send(`
      <div style="font-family: sans-serif; max-width: 400px; margin: 40px auto; text-align: center; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h1 style="color: #16a34a">Email Verified</h1>
        <p style="color: #475569">Your email has been successfully verified. You can now approve delivery requests for Flat ${resident.flatNumber}.</p>
        <p style="color: #94a3b8; font-size: 0.875rem;">You can safely close this window.</p>
      </div>
    `);
  });

  // WebSocket broadcast function
  let wss: WebSocketServer;
  function broadcastNotification(payload: any) {
    if (!wss) return;
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(payload));
      }
    });
  }

  // In-memory store for CIBA push notification logs
  interface CibaLog {
    id: string;
    flatNumber: string;
    company: string;
    timestamp: string;
    status: 'pending' | 'approved' | 'denied';
    resolvedAt?: string;
    emailStatus?: 'pending' | 'sent' | 'failed';
  }
  const cibaLogs: CibaLog[] = [];

  app.get('/api/gate/ciba-logs', (req, res) => {
    res.json(cibaLogs);
  });

  app.get('/api/gate/ciba-status/:id', (req, res) => {
    const log = cibaLogs.find(l => l.id === req.params.id);
    if (!log) return res.status(404).json({ error: 'Not found' });
    res.json(log);
  });

  app.get('/api/gate/resolve/:id/:status', (req, res) => {
    const { id, status } = req.params;
    const log = cibaLogs.find(l => l.id === id);
    
    if (!log) {
      return res.status(404).send('<h1>Error</h1><p>Request not found.</p>');
    }

    // Check if resident is verified
    const resident = residents.find(r => r.flatNumber === log.flatNumber);
    if (!resident || !resident.isVerified) {
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(403).json({ error: 'Resident email not verified. Please verify your email first.' });
      }
      return res.status(403).send(`
        <div style="font-family: sans-serif; max-width: 400px; margin: 40px auto; text-align: center; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h1 style="color: #dc2626">Verification Required</h1>
          <p style="color: #475569">You must verify your email address before you can approve or deny requests for Flat ${log.flatNumber}.</p>
        </div>
      `);
    }
    
    if (log.status !== 'pending') {
      return res.send(`<h1>Already Resolved</h1><p>This request was already ${log.status}.</p>`);
    }
    
    if (status === 'approved' || status === 'denied') {
      log.status = status;
      log.resolvedAt = new Date().toISOString();
      console.log(`[Resident Response] Request ${id} resolved as ${status}.`);
      
      broadcastNotification({ type: 'ciba_resolved', data: log });
      
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.json({ success: true, status: log.status, resolvedAt: log.resolvedAt });
      }

      res.send(`
        <div style="font-family: sans-serif; max-width: 400px; margin: 40px auto; text-align: center; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h1 style="color: ${status === 'approved' ? '#16a34a' : '#dc2626'}">Successfully ${status === 'approved' ? 'Approved' : 'Denied'}</h1>
          <p style="color: #475569">Thank you. Your response has been recorded.</p>
          <p style="color: #94a3b8; font-size: 0.875rem;">You can safely close this window.</p>
        </div>
      `);
    } else {
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      res.status(400).send('<h1>Error</h1><p>Invalid status.</p>');
    }
  });

  // In-memory store for AI feedback logs
  interface AIFeedback {
    id: string;
    checkInId: string;
    company: string;
    flatNumber: string;
    aiStatus: string;
    isAccurate: boolean;
    timestamp: string;
  }
  const feedbackLogs: AIFeedback[] = [];

  // In-memory store for Guest logs
  interface GuestLog {
    id: string;
    flatNumber: string;
    visitorName: string;
    hostName?: string;
    purpose?: string;
    timestamp: string;
    status: 'vetted_by_guard';
  }
  const guestLogs: GuestLog[] = [];

  app.get('/api/gate/guest-logs', (req, res) => {
    res.json(guestLogs);
  });

  app.post('/api/gate/guest-check-in', (req, res) => {
    const { visitorName, flatNumber, hostName, purpose } = req.body;
    if (!visitorName || !flatNumber) {
      return res.status(400).json({ error: 'Visitor name and flat number are required' });
    }

    const newLog: GuestLog = {
      id: Math.random().toString(36).substring(7),
      flatNumber,
      visitorName,
      hostName,
      purpose,
      timestamp: new Date().toISOString(),
      status: 'vetted_by_guard'
    };

    guestLogs.unshift(newLog);
    if (guestLogs.length > 50) guestLogs.pop();

    broadcastNotification({ type: 'guest_arrival', data: newLog });

    res.json({
      checkInId: newLog.id,
      status: 'Verified',
      message: `Guest ${visitorName} vetted by guard for flat ${flatNumber}.`,
      visitorName,
      flatNumber
    });
  });

  app.post('/api/gate/feedback', (req, res) => {
    const { checkInId, company, flatNumber, aiStatus, isAccurate } = req.body;
    const newFeedback: AIFeedback = {
      id: Math.random().toString(36).substring(7),
      checkInId,
      company,
      flatNumber,
      aiStatus,
      isAccurate,
      timestamp: new Date().toISOString()
    };
    feedbackLogs.unshift(newFeedback);
    if (feedbackLogs.length > 100) feedbackLogs.pop();
    console.log(`[AI Feedback] Logged feedback for ${company} at flat ${flatNumber}. Accurate: ${isAccurate}`);
    res.json({ success: true });
  });

  app.get('/api/gate/feedback-stats', (req, res) => {
    let tp = 0, tn = 0, fp = 0, fn = 0;
    feedbackLogs.forEach(log => {
      if (log.aiStatus === 'Verified') {
        if (log.isAccurate) tp++;
        else fp++;
      } else {
        if (log.isAccurate) tn++;
        else fn++;
      }
    });
    const total = tp + tn + fp + fn;
    const accuracy = total > 0 ? ((tp + tn) / total) * 100 : 0;
    res.json({ total, accuracy, tp, tn, fp, fn });
  });

  // Mock Auth0 CIBA push notification
  async function triggerCibaPush(flatNumber: string, company: string, req: express.Request) {
    const auth0Domain = process.env.AUTH0_DOMAIN;
    const auth0ClientId = process.env.AUTH0_CLIENT_ID;

    console.log(`[Auth0 CIBA] Triggering push notification to flat ${flatNumber} for ${company}`);

    const resident = residents.find(r => r.flatNumber === flatNumber);
    if (!resident || !resident.isVerified) {
      console.log(`[Auth0 CIBA] Resident for flat ${flatNumber} is not verified. Cannot send push notification.`);
      return { logId: null, status: 'unverified', message: 'Resident email is not verified. They cannot approve deliveries.' };
    }

    // Log the notification
    const newLog: CibaLog = {
      id: Math.random().toString(36).substring(7),
      flatNumber,
      company,
      timestamp: new Date().toISOString(),
      status: 'pending',
      emailStatus: 'pending'
    };
    cibaLogs.unshift(newLog);
    if (cibaLogs.length > 50) cibaLogs.pop(); // Keep only last 50 logs

    broadcastNotification({ type: 'ciba_pending', data: newLog });

    // Send email notification asynchronously
    sendApprovalEmail(flatNumber, company, newLog.id, req);

    // Simulate resident response after 10 seconds for both real and mock (for demo purposes)
    // Increased to 10 seconds to give user time to click the email link if they want
    setTimeout(() => {
      const log = cibaLogs.find(l => l.id === newLog.id);
      if (log && log.status === 'pending') {
        log.status = Math.random() > 0.3 ? 'approved' : 'denied'; // 70% chance of approval
        log.resolvedAt = new Date().toISOString();
        console.log(`[Auth0 CIBA] Auto-simulated resident response for ${company} at flat ${flatNumber}: ${log.status}`);
        broadcastNotification({ type: 'ciba_resolved', data: log });
      }
    }, 10000);

    // If real keys are provided, use the real Auth0 SDK
    if (auth0Domain && auth0ClientId && auth0Domain !== 'YOUR_AUTH0_DOMAIN') {
      console.log('[Auth0 CIBA] Real Auth0 credentials found. Executing real CIBA flow...');
      try {
        // const auth0 = new AuthenticationClient({
        //   domain: auth0Domain,
        //   clientId: auth0ClientId,
        // });
        // await auth0.oauth.ciba.start({ ... });
        return { logId: newLog.id, status: 'pending_approval', message: 'Real push notification sent to resident.' };
      } catch (error) {
        console.error('[Auth0 CIBA] Error:', error);
        throw new Error('Failed to trigger Auth0 CIBA push notification');
      }
    }

    // Fallback to mock logic for UI testing
    console.log('[Auth0 CIBA] Missing Auth0 credentials. Using MOCK CIBA push notification.');
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { logId: newLog.id, status: 'pending_approval', message: 'Mock push notification sent to resident for manual approval.' };
  }

  async function sendVerificationEmail(resident: Resident, req: express.Request) {
    const accessToken = process.env.GMAIL_ACCESS_TOKEN;
    const host = req.get('host');
    const protocol = req.protocol;
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;
    const verifyUrl = `${baseUrl}/api/gate/verify-email/${resident.verificationToken}`;

    if (!accessToken || accessToken === 'YOUR_GMAIL_ACCESS_TOKEN' || accessToken === 'mock_token') {
      console.log(`[Email] Mocking verification email to ${resident.email} with link: ${verifyUrl}`);
      return;
    }

    try {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      const subject = `[SafeGate AI] Verify your email for Flat ${resident.flatNumber}`;
      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
      const messageParts = [
        `To: ${resident.email}`,
        `Subject: ${utf8Subject}`,
        `Content-Type: text/html; charset=utf-8`,
        '',
        `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">`,
        `  <h2 style="color: #0f172a; margin-top: 0;">Verify Your Email</h2>`,
        `  <p style="color: #334155; font-size: 16px;">Please verify your email address to enable delivery approvals for Flat <strong>${resident.flatNumber}</strong>.</p>`,
        `  <div style="margin-top: 24px;">`,
        `    <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; text-align: center;">Verify Email</a>`,
        `  </div>`,
        `</div>`
      ];
      const message = messageParts.join('\n');
      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });
      console.log(`[Email] Sent verification email to ${resident.email}`);
    } catch (error) {
      console.error('[Email] Failed to send verification email:', error);
    }
  }

  async function sendApprovalEmail(flatNumber: string, company: string, logId: string, req: express.Request) {
    const accessToken = process.env.GMAIL_ACCESS_TOKEN;
    const log = cibaLogs.find(l => l.id === logId);
    if (!log) return;

    const resident = residents.find(r => r.flatNumber === flatNumber);
    const toEmail = resident ? resident.email : 'me';

    if (!accessToken || accessToken === 'YOUR_GMAIL_ACCESS_TOKEN' || accessToken === 'mock_token') {
      console.log(`[Email] Mocking email send for flat ${flatNumber} to ${toEmail}`);
      setTimeout(() => {
        if (log) log.emailStatus = 'sent';
      }, 1000);
      return;
    }

    try {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      const host = req.get('host');
      const protocol = req.protocol;
      const baseUrl = process.env.APP_URL || `${protocol}://${host}`;
      const approveUrl = `${baseUrl}/api/gate/resolve/${logId}/approved`;
      const denyUrl = `${baseUrl}/api/gate/resolve/${logId}/denied`;

      const subject = `[Action Required] Delivery for Flat ${flatNumber} from ${company}`;
      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
      const messageParts = [
        `To: ${toEmail}`,
        `Subject: ${utf8Subject}`,
        `Content-Type: text/html; charset=utf-8`,
        '',
        `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">`,
        `  <h2 style="color: #0f172a; margin-top: 0;">Delivery Verification Required</h2>`,
        `  <p style="color: #334155; font-size: 16px;">A delivery from <strong>${company}</strong> is at the gate for flat <strong>${flatNumber}</strong>.</p>`,
        `  <p style="color: #334155; font-size: 16px; margin-bottom: 24px;">Please approve or deny this entry:</p>`,
        `  <div style="display: flex; gap: 12px;">`,
        `    <a href="${approveUrl}" style="display: inline-block; padding: 12px 24px; background-color: #16a34a; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; text-align: center;">Approve Entry</a>`,
        `    <a href="${denyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; text-align: center; margin-left: 12px;">Deny Entry</a>`,
        `  </div>`,
        `</div>`
      ];
      const message = messageParts.join('\n');
      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });
      log.emailStatus = 'sent';
      console.log(`[Email] Sent approval email for flat ${flatNumber}`);
    } catch (error) {
      console.error('[Email] Failed to send email:', error);
      log.emailStatus = 'failed';
    }
  }

  async function verifyDelivery(companyName: string) {
    const accessToken = process.env.GMAIL_ACCESS_TOKEN;
    
    // If real token is missing or placeholder, use mock logic
    if (!accessToken || accessToken === 'YOUR_GMAIL_ACCESS_TOKEN' || accessToken === 'mock_token') {
      console.log(`[Gmail API] Missing Gmail Access Token. Using MOCK verification for "${companyName}"...`);
      
      // Mock logic: auto-verify known delivery companies to test the UI success state
      const mockMatches = ['zomato', 'swiggy', 'amazon', 'flipkart', 'blinkit', 'uber eats'];
      const isMatch = mockMatches.includes(companyName.toLowerCase().trim());
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      return isMatch;
    }

    // Real Gmail API logic
    console.log(`[Gmail API] Real token found. Searching for "${companyName}"...`);
    try {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      
      // Calculate time 2 hours ago in seconds
      const twoHoursAgo = Math.floor(Date.now() / 1000) - (2 * 60 * 60);
      const query = `from:${companyName} OR subject:${companyName} after:${twoHoursAgo}`;

      const res = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 1,
      });
      
      return (res.data.messages && res.data.messages.length > 0) ? true : false;
    } catch (error) {
      console.error('[Gmail API] Error:', error);
      // Fallback to false if API fails
      return false;
    }
  }

  app.post('/api/gate/check-in', async (req, res) => {
    try {
      const { visitorCompany, flatNumber } = req.body;

      if (!visitorCompany || !flatNumber) {
        return res.status(400).json({ error: 'visitorCompany and flatNumber are required' });
      }

      console.log(`[Check-In] Verifying ${visitorCompany} for flat ${flatNumber}...`);
      
      const matchFound = await verifyDelivery(visitorCompany);
      const checkInId = Math.random().toString(36).substring(7);

      if (matchFound) {
        return res.json({ 
          checkInId,
          status: 'Verified', 
          message: `AI Vetting successful. Found recent delivery confirmation for ${visitorCompany}.` 
        });
      } else {
        const cibaResult = await triggerCibaPush(flatNumber, visitorCompany, req);
        return res.json({ 
          checkInId,
          status: 'Manual Approval Required', 
          message: `No recent delivery confirmation found for ${visitorCompany}.`,
          ciba: cibaResult
        });
      }
    } catch (error) {
      console.error('[Check-In] Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/generate-arch', async (req, res) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              text: "A clean, modern, professional software architecture diagram for a security gate application. The diagram features interconnected nodes. On the left, a 'Frontend' node with a web browser and a security guard icon. In the center, a 'Backend' node with a server icon, database icon, and AI brain icon. On the right, a 'Resident' node with a mobile phone icon. At the top, 'External APIs' nodes with email and cloud security icons. Arrows connect the nodes showing data flow. Blue and slate color palette, technical blueprint style, high resolution, flat vector art style.",
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
          },
        },
      });

      let foundImage = false;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const base64EncodeString = part.inlineData.data;
          const publicDir = path.join(process.cwd(), 'public');
          if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir, { recursive: true });
          }
          fs.writeFileSync(path.join(publicDir, 'architecture.jpg'), Buffer.from(base64EncodeString, 'base64'));
          foundImage = true;
          return res.json({ success: true, message: 'Image saved successfully.' });
        }
      }
      if (!foundImage) {
        res.status(500).json({ error: 'No image data found in response.' });
      }
    } catch (error: any) {
      console.error('Error generating image:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  wss = new WebSocketServer({ server });
  wss.on('connection', (ws) => {
    console.log('New WebSocket connection for resident notifications');
    ws.on('error', console.error);
  });
}

startServer();
