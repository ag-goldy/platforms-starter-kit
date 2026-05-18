import http from 'node:http';
import { Server } from 'socket.io';
import { verifyRealtimeSignature } from '../lib/realtime/signing';

const port = Number(process.env.REALTIME_PORT || 4001);
const allowedOrigin = process.env.REALTIME_ALLOWED_ORIGIN || '*';

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method !== 'POST' || req.url !== '/broadcast') {
    res.writeHead(404);
    res.end();
    return;
  }

  const chunks: Buffer[] = [];
  req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  req.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8');
    const valid = verifyRealtimeSignature({
      body,
      timestamp: req.headers['x-atlas-timestamp']?.toString() || null,
      signature: req.headers['x-atlas-signature']?.toString() || null,
    });

    if (!valid) {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    try {
      const payload = JSON.parse(body) as {
        orgId: string;
        channel: string;
        event: string;
        data: Record<string, unknown>;
      };

      if (!payload.orgId || !payload.channel || !payload.event) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid payload' }));
        return;
      }

      io.to(`org:${payload.orgId}:${payload.channel}`).emit(payload.event, {
        ...payload.data,
        orgId: payload.orgId,
        channel: payload.channel,
      });

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } catch {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });
});

const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    credentials: true,
  },
});

io.on('connection', (socket) => {
  socket.on('subscribe', (payload: { orgId?: string; channel?: string }) => {
    if (!payload.orgId || !payload.channel) return;
    socket.join(`org:${payload.orgId}:${payload.channel}`);
    socket.emit('subscribed', payload);
  });

  socket.on('presence:join', (payload: { orgId?: string; ticketId?: string; userId?: string; userName?: string }) => {
    if (!payload.orgId || !payload.ticketId || !payload.userId) return;
    const room = `ticket:${payload.ticketId}`;
    socket.join(room);
    socket.to(room).emit('presence:joined', payload);
  });

  socket.on('typing', (payload: { ticketId?: string; userId?: string; userName?: string; isTyping?: boolean }) => {
    if (!payload.ticketId || !payload.userId) return;
    socket.to(`ticket:${payload.ticketId}`).emit('typing', payload);
  });
});

server.listen(port, () => {
  console.log(`[Realtime] Socket.io bridge listening on :${port}`);
});
