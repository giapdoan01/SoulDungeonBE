const { Room } = require("colyseus");
const { MatchmakingState, MmPlayer, QueueEntry } = require("../schema/MatchmakingState");

class MatchmakingRoom extends Room {
  constructor() {
    super();
    this.maxClients = 100;
    this.autoDispose = false; // lobby không tự dispose
  }

  onCreate(options) {
    this.setState(new MatchmakingState());

    this.onMessage("queue:join", (client) => {
      this.enqueue(client);
    });

    this.onMessage("queue:leave", (client) => {
      this.dequeue(client);
    });

    this.onMessage("ping", (client, data) => {
      const p = this.state.players.get(client.sessionId);
      if (p) p.lastPingMs = typeof data?.ms === "number" ? data.ms : 0;
    });

    this.setSimulationInterval(() => this.matchmakeTick(), 250);
  }

  onJoin(client, options) {
    console.log(`[MM] ${client.sessionId} joined`);

    const p = new MmPlayer();
    p.sessionId = client.sessionId;
    p.name = options?.name || "Player";
    p.level = typeof options?.level === "number" ? options.level : 1;
    p.status = "idle";
    p.lastPingMs = 0;

    this.state.players.set(client.sessionId, p);
    this.recount();
  }

  onLeave(client, consented) {
    console.log(`[MM] ${client.sessionId} left`);
    this.dequeue(client);
    this.state.players.delete(client.sessionId);
    this.recount();
  }

  // ===== Queue logic =====
  enqueue(client) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;

    if (!this.state.queue.has(client.sessionId)) {
      const q = new QueueEntry();
      q.sessionId = client.sessionId;
      q.joinedAt = Date.now();
      q.mmr = 0;

      this.state.queue.set(client.sessionId, q);
      console.log(`[MM] ${client.sessionId} entered queue`);
    }

    p.status = "searching";
    this.recount();
  }

  dequeue(client) {
    const p = this.state.players.get(client.sessionId);
    if (p) p.status = "idle";

    this.state.queue.delete(client.sessionId);
    this.recount();
  }

  recount() {
    this.state.onlineCount = this.state.players.size;
    this.state.queueCount = this.state.queue.size;
  }

  // ===== Matchmaking tick =====
  async matchmakeTick() {
    if (this.state.queue.size < 4) return;

    const selected = [];
    for (const [sid] of this.state.queue) {
      selected.push(sid);
      if (selected.length === 4) break;
    }

    const players = selected
      .map((sid) => this.state.players.get(sid))
      .filter((p) => p !== undefined);

    if (players.length < 4) {
      for (const sid of selected) {
        if (!this.state.players.has(sid)) this.state.queue.delete(sid);
      }
      this.recount();
      return;
    }

    console.log(`[MM] Creating game for:`, players.map((p) => p.name));

    try {
      const room = await this.matchMaker.createRoom("game_room", {
        mode: "2v2",
        players: players.map((p) => ({ sessionId: p.sessionId, name: p.name })),
      });

      for (const p of players) {
        p.status = "in_game";
        this.state.queue.delete(p.sessionId);
      }
      this.recount();

      for (const p of players) {
        const c = this.clients.find((x) => x.sessionId === p.sessionId);
        if (c) {
          c.send("match:found", { roomId: room.roomId });
          console.log(`[MM] Sent roomId to ${p.name}`);
        }
      }
    } catch (err) {
      console.error("[MM] Failed to create room:", err);
    }
  }
}

module.exports = { MatchmakingRoom };
