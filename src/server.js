// server.js
require('dotenv').config();

const http = require('http');
const express = require('express');
const { Server, matchMaker } = require('colyseus');
const { monitor } = require('@colyseus/monitor');
const { MatchmakingRoom } = require('./Colyseus/rooms/MatchmakingRoom');
const { GameRoom } = require('./Colyseus/rooms/GameRoom');

const startWSServer = async () => {
  const WS_PORT = process.env.WS_PORT || 3001;
  const HOST = process.env.HOST || '0.0.0.0';

  const app = express();
  app.use(express.json());
  
  // CORS
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  const httpServer = http.createServer(app);
  const gameServer = new Server({ 
    server: httpServer,
    gracefullyShutdown: true
  });

  // ✅ Register rooms
  gameServer.define("matchmaking", MatchmakingRoom)
    .filterBy(['mode']); // Optional: filter by game mode
    
  gameServer.define("game_room", GameRoom);
  
  console.log('✅ Rooms registered');

  // ============= MATCHMAKING ENDPOINTS (REQUIRED BY SDK!) =============
  
  // JoinOrCreate endpoint
  app.post('/matchmake/joinOrCreate/:roomName', async (req, res) => {
    try {
      const { roomName } = req.params;
      const options = req.body || {};
      
      console.log(`\n📨 JoinOrCreate: ${roomName}`);
      console.log('   Options:', options);
      
      // Use Colyseus matchMaker
      const reservation = await matchMaker.joinOrCreate(roomName, options);
      
      console.log('✅ Reservation created:', reservation.sessionId);
      
      // Return reservation in Colyseus format
      res.json({
        room: {
          roomId: reservation.room.roomId,
          processId: reservation.room.processId,
          name: roomName,
          locked: false
        },
        sessionId: reservation.sessionId
      });
      
    } catch (error) {
      console.error('❌ JoinOrCreate error:', error.message);
      res.status(500).json({ 
        error: error.message,
        code: error.code || 500
      });
    }
  });

  // Join endpoint
  app.post('/matchmake/join/:roomName', async (req, res) => {
    try {
      const { roomName } = req.params;
      const options = req.body || {};
      
      console.log(`\n📨 Join: ${roomName}`);
      
      const reservation = await matchMaker.join(roomName, options);
      
      res.json({
        room: {
          roomId: reservation.room.roomId,
          processId: reservation.room.processId,
          name: roomName,
          locked: false
        },
        sessionId: reservation.sessionId
      });
      
    } catch (error) {
      console.error('❌ Join error:', error.message);
      res.status(500).json({ 
        error: error.message,
        code: error.code || 500
      });
    }
  });

  // Create endpoint
  app.post('/matchmake/create/:roomName', async (req, res) => {
    try {
      const { roomName } = req.params;
      const options = req.body || {};
      
      console.log(`\n📨 Create: ${roomName}`);
      
      const reservation = await matchMaker.create(roomName, options);
      
      res.json({
        room: {
          roomId: reservation.room.roomId,
          processId: reservation.room.processId,
          name: roomName,
          locked: false
        },
        sessionId: reservation.sessionId
      });
      
    } catch (error) {
      console.error('❌ Create error:', error.message);
      res.status(500).json({ 
        error: error.message,
        code: error.code || 500
      });
    }
  });

  // JoinById endpoint
  app.post('/matchmake/joinById/:roomId', async (req, res) => {
    try {
      const { roomId } = req.params;
      const options = req.body || {};
      
      console.log(`\n📨 JoinById: ${roomId}`);
      
      const reservation = await matchMaker.joinById(roomId, options);
      
      res.json({
        room: {
          roomId: reservation.room.roomId,
          processId: reservation.room.processId,
          name: reservation.room.name,
          locked: false
        },
        sessionId: reservation.sessionId
      });
      
    } catch (error) {
      console.error('❌ JoinById error:', error.message);
      res.status(500).json({ 
        error: error.message,
        code: error.code || 500
      });
    }
  });

  // ✅ Monitor
  app.use('/colyseus', monitor());

  // ✅ Simple routes
  app.get('/', (req, res) => {
    res.json({
      name: 'SoulDungeon WebSocket Server',
      status: 'online',
      port: WS_PORT,
      rooms: ['matchmaking', 'game_room'],
      activeRooms: gameServer.rooms.size
    });
  });

  app.get('/health', (req, res) => {
    res.json({ 
      status: 'healthy',
      rooms: gameServer.rooms.size
    });
  });

  // ✅ START
  await new Promise((resolve) => {
    httpServer.listen(WS_PORT, HOST, () => {
      console.log('\n╔═══════════════════════════════════════════════╗');
      console.log('║      🎮 SoulDungeon WebSocket Server 🎮     ║');
      console.log('╠═══════════════════════════════════════════════╣');
      console.log(`║  WebSocket: ws://localhost:${WS_PORT}              ║`);
      console.log(`║  HTTP:      http://localhost:${WS_PORT}              ║`);
      console.log(`║  Monitor:   http://localhost:${WS_PORT}/colyseus    ║`);
      console.log('╠═══════════════════════════════════════════════╣');
      console.log('║  Rooms: matchmaking, game_room                ║');
      console.log('╚═══════════════════════════════════════════════╝\n');
      console.log('✅ Server ready - Press Ctrl+C to stop\n');
      resolve();
    });
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    await gameServer.gracefullyShutdown();
    httpServer.close(() => process.exit(0));
  });

  return { httpServer, gameServer };
};

if (require.main === module) {
  startWSServer().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
}

module.exports = { startWSServer };
