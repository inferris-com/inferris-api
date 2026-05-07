import type { ColumnType, Generated, Insertable, Selectable, Updateable } from "kysely";

export type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;

export interface Servers {
  id: Generated<string>;
  name: string;
  type: "paper" | "velocity" | "other";
  version: string | null;
  player_count: Generated<number>;
  last_heartbeat_ms: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface Players {
  id: string;
  username: string;
  flags: Generated<number>;
  orbs: Generated<number>;
  last_server_id: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface DB {
  players: Players;
  servers: Servers;
}

export type Server = Selectable<Servers>;
export type NewServer = Insertable<Servers>;
export type ServerUpdate = Updateable<Servers>;
export type Player = Selectable<Players>;
export type NewPlayer = Insertable<Players>;
export type PlayerUpdate = Updateable<Players>;
