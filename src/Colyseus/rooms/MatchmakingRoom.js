// Colyseus/rooms/MatchmakingRoom.js
const { Room } = require("colyseus");
const { MatchmakingState, MmPlayer, QueueEntry } = require("../schema/MatchmakingState");

class MatchmakingRoom extends Room {
  constructor() {
    super();
    this.maxClients = 100;
    this.autoDispose = false; // ← Keep room alive!
  }

  onCreate(options) {
    console.log('\n🎮 Creating Matchmaking Room...');
    console.log('   Options:', options);
    
    // Initialize state
    this.setState(new MatchmakingState());
    
    console.log('✅ Matchmaking room created');
    console.log(`   RoomId: ${this.roomId}`);

    // Message handlers
    this.onMessage("queue:join", (client) => {
      this.handleQueueJoin(client);
    });

    this.onMessage("queue:leave", (client) => {
      this.handleQueueLeave(client);
    });

    // Matchmaking tick (every 1 second)
    this.clock.setInterval(() => {
      this.matchmakingTick();
    }, 1000);
    
    console.log('⏰ Matchmaking tick started\n');
  }

  onJoin(client, options) {
    try {
      const name = options?.name || "Player";
      const level = typeof options?.level === "number" ? options.level : 1;
      
      console.log(`\n👤 Player joined:`);
      console.log(`   Name: ${name}`);
      console.log(`   SessionId: ${client.sessionId}`);
      console.log(`   Level: ${level}`);

      // Create player
      const player = new MmPlayer();
      player.sessionId = client.sessionId;
      player.name = name;
      player.level = level;
      player.status = "idle";
      player.lastPingMs = 0;

      this.state.players.set(client.sessionId, player);
      this.updateStats();
      
      console.log(`✅ ${name} added (Total: ${this.state.players.size})`);
      
      // Send welcome message
      client.send("welcome", {
        message: `Welcome ${name}!`,
        sessionId: client.sessionId,
        onlineCount: this.state.onlineCount,
        queueCount: this.state.queueCount
      });
      
      console.log(`📤 Sent welcome message to ${name}\n`);
      
    } catch (error) {
      console.error(`❌ Error in onJoin:`, error);
      throw error;
    }
  }

  onLeave(client, consented) {
    try {
      const player = this.state.players.get(client.sessionId);
      const name = player?.name || client.sessionId;
      
      console.log(`\n👋 ${name} left (consented: ${consented})`);
      
      // Remove from queue
      if (this.state.queue.has(client.sessionId)) {
        this.state.queue.delete(client.sessionId);
        console.log(`   Removed from queue`);
      }
      
      // Remove player
      this.state.players.delete(client.sessionId);
      this.updateStats();
      
      console.log(`   Remaining: ${this.state.players.size} players\n`);
      
    } catch (error) {
      console.error(`❌ Error in onLeave:`, error);
    }
  }

  handleQueueJoin(client) {
    try {
      const player = this.state.players.get(client.sessionId);
      if (!player) {
        console.warn(`⚠️  Player ${client.sessionId} not found`);
        return;
      }

      // Check if already in queue
      if (this.state.queue.has(client.sessionId)) {
        console.log(`⚠️  ${player.name} already in queue`);
        client.send("error", { message: "Already in queue" });
        return;
      }

      // Add to queue
      const queueEntry = new QueueEntry();
      queueEntry.sessionId = client.sessionId;
      queueEntry.joinedAt = Date.now();
      queueEntry.mmr = player.level * 100;

      this.state.queue.set(client.sessionId, queueEntry);
      player.status = "queue";
      this.updateStats();

      const position = this.state.queue.size;
      console.log(`\n🎯 ${player.name} joined queue`);
      console.log(`   Position: ${position}`);
      console.log(`   Queue size: ${this.state.queue.size}\n`);

      // Send confirmation
      client.send("queue:joined", {
        position: position,
        estimatedWait: position * 5
      });

    } catch (error) {
      console.error(`❌ Error in handleQueueJoin:`, error);
      client.send("error", { message: "Failed to join queue" });
    }
  }

  handleQueueLeave(client) {
    try {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      if (!this.state.queue.has(client.sessionId)) {
        console.log(`⚠️  ${player.name} not in queue`);
        return;
      }

      this.state.queue.delete(client.sessionId);
      player.status = "idle";
      this.updateStats();

      console.log(`\n🚪 ${player.name} left queue`);
      console.log(`   Queue size: ${this.state.queue.size}\n`);

      client.send("queue:left", {
        reason: "manual"
      });

    } catch (error) {
      console.error(`❌ Error in handleQueueLeave:`, error);
    }
  }

  matchmakingTick() {
    // Simple matchmaking: Group every 4 players
    if (this.state.queue.size >= 4) {
      console.log('\n🎮 Creating match...');
      
      const players = Array.from(this.state.queue.values()).slice(0, 4);
      
      console.log(`   Players: ${players.length}`);
      
      // Notify players
      players.forEach(queueEntry => {
        const client = Array.from(this.clients).find(c => c.sessionId === queueEntry.sessionId);
        if (client) {
          const player = this.state.players.get(queueEntry.sessionId);
          
          client.send("match:found", {
            roomId: "game_room_123",
            players: players.map(p => {
              const pl = this.state.players.get(p.sessionId);
              return {
                name: pl?.name || "Unknown",
                level: pl?.level || 1
              };
            })
          });
          
          console.log(`   ✅ Notified ${player?.name}`);
          
          // Remove from queue
          this.state.queue.delete(queueEntry.sessionId);
          if (player) player.status = "matched";
        }
      });
      
      this.updateStats();
      console.log('✅ Match created!\n');
    }
  }

  updateStats() {
    this.state.onlineCount = this.state.players.size;
    this.state.queueCount = this.state.queue.size;
  }

  onDispose() {
    console.log('🗑️  Matchmaking room disposed');
  }
}

module.exports = { MatchmakingRoom };
