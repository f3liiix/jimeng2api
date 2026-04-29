import _ from "lodash";

import environment from "../environment.ts";

export class DatabaseConfig {
  url?: string;
  ssl: boolean;
  migrationsEnabled: boolean;

  constructor(options?: any) {
    const { url, ssl, migrationsEnabled } = options || {};
    this.url = _.defaultTo(url, environment.envVars.DATABASE_URL || undefined);
    this.ssl = _.defaultTo(ssl, environment.envVars.DATABASE_SSL === "true");
    this.migrationsEnabled = _.defaultTo(
      migrationsEnabled,
      environment.envVars.DATABASE_MIGRATIONS !== "false",
    );
  }

  get enabled() {
    return !!this.url;
  }
}

export default new DatabaseConfig();
