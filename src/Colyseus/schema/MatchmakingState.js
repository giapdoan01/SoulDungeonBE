const { Schema, type, MapSchema, ArraySchema } = require("@colyseus/schema");

class MmPlayer extends Schema {
  constructor() {
    super();
    this.sessionId = "";
    this.name = "";
    this.level = 1;
    this.status = "idle";
    this.lastPingMs = 0;
  }
}
type("string")(MmPlayer.prototype, "sessionId");
type("string")(MmPlayer.prototype, "name");
type("number")(MmPlayer.prototype, "level");
type("string")(MmPlayer.prototype, "status");
type("number")(MmPlayer.prototype, "lastPingMs");

class QueueEntry extends Schema {
  constructor() {
    super();
    this.sessionId = "";
    this.joinedAt = 0;
    this.mmr = 0;
  }
}
type("string")(QueueEntry.prototype, "sessionId");
type("number")(QueueEntry.prototype, "joinedAt");
type("number")(QueueEntry.prototype, "mmr");

class Party extends Schema {
  constructor() {
    super();
    this.code = "";
    this.hostId = "";
    this.members = new ArraySchema();
    this.maxPlayers = 4;
    this.createdAt = 0;
    this.locked = false;
  }
}
type("string")(Party.prototype, "code");
type("string")(Party.prototype, "hostId");
type(["string"])(Party.prototype, "members");
type("number")(Party.prototype, "maxPlayers");
type("number")(Party.prototype, "createdAt");
type("boolean")(Party.prototype, "locked");

class MatchmakingState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
    this.queue = new MapSchema();
    this.parties = new MapSchema();
    this.onlineCount = 0;
    this.queueCount = 0;
  }
}
type({ map: MmPlayer })(MatchmakingState.prototype, "players");
type({ map: QueueEntry })(MatchmakingState.prototype, "queue");
type({ map: Party })(MatchmakingState.prototype, "parties");
type("number")(MatchmakingState.prototype, "onlineCount");
type("number")(MatchmakingState.prototype, "queueCount");

module.exports = {
  MatchmakingState,
  MmPlayer,
  QueueEntry,
  Party,
};
