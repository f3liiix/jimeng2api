"use strict";

import environment from "@/lib/environment.ts";
import config from "@/lib/config.ts";
import "@/lib/initialize.ts";
import server from "@/lib/server.ts";
import routes from "@/api/routes/index.ts";
import logger from "@/lib/logger.ts";
import { runMigrations } from "@/lib/db/migrations.ts";
import { bootstrapAuth } from "@/lib/auth/bootstrap.ts";
import { tokenHealthChecker } from "@/lib/tokens/health-checker.ts";

const startupTime = performance.now();

(async () => {
  logger.header();

  logger.info("<<<< Jimeng2API >>>>");
  logger.info("Version:", environment.package.version);
  logger.info("Process id:", process.pid);
  logger.info("Environment:", environment.env);
  logger.info("Service name:", config.service.name);

  await runMigrations();
  await bootstrapAuth();
  tokenHealthChecker.start();
  server.attachRoutes(routes);
  await server.listen();

  config.service.bindAddress &&
    logger.success("Service bind address:", config.service.bindAddress);
})()
  .then(() =>
    logger.success(
      `Service startup completed (${Math.floor(performance.now() - startupTime)}ms)`
    )
  )
  .catch((err) => console.error(err));
