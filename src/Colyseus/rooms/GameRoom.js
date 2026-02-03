const { Room } = require("colyseus");
const { GameState, PlayerState, SkillState } = require("../schema/GameState");

class GameRoom extends Room {
  constructor() {
    super();
    this.maxClients = 4;
    this.roster = [];
  }

  onCreate(options) {
    this.setState(new GameState());
    this.roster = options?.players || [];
    console.log(`[Game] Room created, roster:`, this.roster);

    // ===== Messages =====

    this.onMessage("player:move", (client, data) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !p.alive) return;

      if (typeof data?.x === "number") p.x = data.x;
      if (typeof data?.y === "number") p.y = data.y;
      if (typeof data?.animSpeed === "number") p.animSpeed = data.animSpeed;
      if (typeof data?.facingRight === "boolean") p.facingRight = data.facingRight;
    });

    this.onMessage("skill:cast", (client, data) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !p.alive) return;

      const skill = new SkillState();
      skill.id = `${client.sessionId}_${Date.now()}`;
      skill.ownerId = client.sessionId;
      skill.skillType = data.skillType || "Q";
      skill.x = p.x;
      skill.y = p.y;
      skill.dirX = typeof data.dirX === "number" ? data.dirX : 1;
      skill.dirY = typeof data.dirY === "number" ? data.dirY : 0;
      skill.facingRight = p.facingRight;
      skill.createdAt = Date.now();

      this.state.skills.set(skill.id, skill);
      console.log(`[Game] ${p.name} cast ${skill.skillType}`);

      setTimeout(() => {
        this.state.skills.delete(skill.id);
      }, 3000);
    });

    this.onMessage("player:damage", (client, data) => {
      const target = this.state.players.get(data.targetId);
      if (!target || !target.alive) return;

      const damage = typeof data.damage === "number" ? data.damage : 10;
      target.hp = Math.max(0, target.hp - damage);

      if (target.hp === 0) {
        target.alive = false;
        target.deaths++;

        const attacker = this.state.players.get(client.sessionId);
        if (attacker) attacker.kills++;

        console.log(`[Game] ${target.name} died`);
      }
    });

    this.setSimulationInterval(() => this.tick(), 100);
  }

  onJoin(client, options) {
    if (this.roster.length > 0 && !this.roster.some((p) => p.sessionId === client.sessionId)) {
      console.log(`[Game] ${client.sessionId} not in roster, rejected`);
      throw new Error("not_allowed");
    }

    const ps = new PlayerState();
    ps.sessionId = client.sessionId;
    ps.name = this.roster.find((p) => p.sessionId === client.sessionId)?.name || "Player";

    const team = this.state.teamA.length < 2 ? 0 : 1;
    ps.team = team;
    ps.x = team === 0 ? -5 : 5;
    ps.y = 0;
    ps.hp = 100;
    ps.maxHp = 100;
    ps.alive = true;

    this.state.players.set(client.sessionId, ps);

    if (team === 0) this.state.teamA.push(client.sessionId);
    else this.state.teamB.push(client.sessionId);

    console.log(`[Game] ${ps.name} joined team ${team === 0 ? "A" : "B"}`);

    if (this.clients.length === this.maxClients) {
      this.startMatch();
    }
  }

  onLeave(client, consented) {
    console.log(`[Game] ${client.sessionId} left`);
    const p = this.state.players.get(client.sessionId);
    if (p) p.alive = false;
  }

  // ===== Game logic =====

  startMatch() {
    this.state.status = "playing";
    this.state.matchStartTime = Date.now();
    this.state.remainingSec = this.state.durationSec;

    console.log(`[Game] Match started`);
    this.broadcast("game:start", {});
  }

  tick() {
    this.state.tick++;
    this.state.serverTime = Date.now();

    if (this.state.status === "playing") {
      const elapsed = Math.floor((Date.now() - this.state.matchStartTime) / 1000);
      this.state.remainingSec = Math.max(0, this.state.durationSec - elapsed);

      if (this.state.remainingSec === 0) {
        this.endMatch();
      }
    }
  }

  endMatch() {
    this.state.status = "finished";
    console.log(`[Game] Match ended`);

    const teamAKills = Array.from(this.state.players.values())
      .filter((p) => p.team === 0)
      .reduce((sum, p) => sum + p.kills, 0);

    const teamBKills = Array.from(this.state.players.values())
      .filter((p) => p.team === 1)
      .reduce((sum, p) => sum + p.kills, 0);

    const winner = teamAKills > teamBKills ? "A" : teamBKills > teamAKills ? "B" : "draw";

    this.broadcast("game:end", { winner, teamAKills, teamBKills });

    setTimeout(() => this.disconnect(), 10000);
  }
}

module.exports = { GameRoom };
