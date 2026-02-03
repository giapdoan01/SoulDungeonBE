const { Schema, type, MapSchema, ArraySchema } = require("@colyseus/schema");

class PlayerState extends Schema {
  constructor() {
    super();
    this.sessionId = "";
    this.name = "";
    this.team = 0;
    this.x = 0;
    this.y = 0;
    this.animSpeed = 0;
    this.facingRight = true;
    this.hp = 100;
    this.maxHp = 100;
    this.alive = true;
    this.kills = 0;
    this.deaths = 0;
  }
}
type("string")(PlayerState.prototype, "sessionId");
type("string")(PlayerState.prototype, "name");
type("number")(PlayerState.prototype, "team");
type("number")(PlayerState.prototype, "x");
type("number")(PlayerState.prototype, "y");
type("number")(PlayerState.prototype, "animSpeed");
type("boolean")(PlayerState.prototype, "facingRight");
type("number")(PlayerState.prototype, "hp");
type("number")(PlayerState.prototype, "maxHp");
type("boolean")(PlayerState.prototype, "alive");
type("number")(PlayerState.prototype, "kills");
type("number")(PlayerState.prototype, "deaths");

class SkillState extends Schema {
  constructor() {
    super();
    this.id = "";
    this.ownerId = "";
    this.skillType = "Q";
    this.x = 0;
    this.y = 0;
    this.dirX = 0;
    this.dirY = 0;
    this.facingRight = true;
    this.createdAt = 0;
  }
}
type("string")(SkillState.prototype, "id");
type("string")(SkillState.prototype, "ownerId");
type("string")(SkillState.prototype, "skillType");
type("number")(SkillState.prototype, "x");
type("number")(SkillState.prototype, "y");
type("number")(SkillState.prototype, "dirX");
type("number")(SkillState.prototype, "dirY");
type("boolean")(SkillState.prototype, "facingRight");
type("number")(SkillState.prototype, "createdAt");

class GameState extends Schema {
  constructor() {
    super();
    this.status = "waiting";
    this.players = new MapSchema();
    this.skills = new MapSchema();
    this.teamA = new ArraySchema();
    this.teamB = new ArraySchema();
    this.matchStartTime = 0;
    this.durationSec = 300;
    this.remainingSec = 300;
    this.tick = 0;
    this.serverTime = 0;
  }
}
type("string")(GameState.prototype, "status");
type({ map: PlayerState })(GameState.prototype, "players");
type({ map: SkillState })(GameState.prototype, "skills");
type(["string"])(GameState.prototype, "teamA");
type(["string"])(GameState.prototype, "teamB");
type("number")(GameState.prototype, "matchStartTime");
type("number")(GameState.prototype, "durationSec");
type("number")(GameState.prototype, "remainingSec");
type("number")(GameState.prototype, "tick");
type("number")(GameState.prototype, "serverTime");

module.exports = {
  GameState,
  PlayerState,
  SkillState,
};
