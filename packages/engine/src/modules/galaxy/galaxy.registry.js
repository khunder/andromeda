import {AndromedaLogger} from "../../config/andromeda-logger.js";
const Logger = new AndromedaLogger();

class GalaxyRegistry {
  constructor(){
    this.store = new Map();
  }
  upsert(deploymentId, port){
    const key = `${deploymentId}:${port}`;
    const now = Date.now();
    const value = { deploymentId, port, lastSeen: now };
    this.store.set(key, value);
    return value;
  }
  list(){
    return Array.from(this.store.values());
  }
  remove(deploymentId, port){
    return this.store.delete(`${deploymentId}:${port}`);
  }
  clear(){
    this.store.clear();
  }
}

export const galaxyRegistry = new GalaxyRegistry();
export default galaxyRegistry;