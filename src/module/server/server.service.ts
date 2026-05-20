import type {ServerRepository} from "./server.repository.js";
import {ServerNotFoundError} from "./server.errors.js";
import {toServerResponse} from "./server.mapper.js";

export class ServerService {
  constructor(private readonly repo: ServerRepository){}

  async getServer(id: string){
    const server = await this.repo.findServerById(id);

    if(!server){
      throw new ServerNotFoundError(id);
    }

    return server;
  }
}
