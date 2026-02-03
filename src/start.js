// start.js - Run both API and WebSocket servers
require('dotenv').config();

console.log('🚀 Starting SoulDungeon Servers...\n');

let startAPIServer, startWSServer;

// ============= LOAD MODULES =============
try {
  console.log('📋 Loading app.js...');
  const app = require('./app');
  startAPIServer = app.startAPIServer;
  console.log('✅ app.js loaded\n');
  
  console.log('📋 Loading server.js...');
  const server = require('./server');
  startWSServer = server.startWSServer;
  console.log('✅ server.js loaded\n');
  
} catch (error) {
  console.error('❌ Module loading error:', error);
  process.exit(1);
}

// ============= START BOTH SERVERS =============
const startAll = async () => {
  try {
    console.log('🎯 Starting both servers...\n');
    
    // Start both servers in parallel
    const [apiServer, wsServer] = await Promise.all([
      startAPIServer().catch(err => {
        console.error('❌ API Server failed:', err.message);
        throw err;
      }),
      startWSServer().catch(err => {
        console.error('❌ WS Server failed:', err.message);
        throw err;
      })
    ]);
    
    // Success message
    if (apiServer && wsServer) {
      const API_PORT = process.env.API_PORT || 3000;
      const WS_PORT = process.env.WS_PORT || 3001;
      
      console.log('\n╔════════════════════════════════════════════════════════╗');
      console.log('║           ✅ All Servers Running ✅                   ║');
      console.log('╠════════════════════════════════════════════════════════╣');
      console.log(`║  API:       http://localhost:${API_PORT}                      ║`);
      console.log(`║  WebSocket: ws://localhost:${WS_PORT}                        ║`);
      console.log(`║  Monitor:   http://localhost:${WS_PORT}/colyseus            ║`);
      console.log(`║  Stats:     http://localhost:${WS_PORT}/stats               ║`);
      console.log('╚════════════════════════════════════════════════════════╝\n');
      
      console.log('✅ All servers started successfully\n');
      console.log('📝 Press Ctrl+C to stop all servers\n');
    }
    
  } catch (error) {
    console.error('\n❌ Startup failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
};

// ============= RUN =============
startAll();

// ============= GRACEFUL SHUTDOWN =============
process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM - Shutting down all servers...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT - Shutting down all servers...');
  process.exit(0);
});
