import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";

import { isDatabaseConfigured, query } from "@/lib/db/client.ts";
import logger from "@/lib/logger.ts";

export type TaskStatus = "queued" | "running" | "succeeded" | "failed";
export type TaskType = "image_generation" | "image_composition" | "video_generation";

export interface TaskError {
  message: string;
  type: string;
  code: string | number;
}

export interface TaskRecord<T = any> {
  id: string;
  object: "task";
  type: TaskType;
  status: TaskStatus;
  created: number;
  updated: number;
  result_url: string;
  result?: T;
  error?: TaskError;
  api_key_id?: string | null;
  token_id?: string | null;
}

export interface TaskManagerOptions {
  concurrency?: number;
  resultUrlPrefix?: string;
}

export interface TaskRunnerContext<T = any> {
  task: TaskRecord<T>;
  updateTokenId: (tokenId: string) => Promise<void>;
}

type TaskRunner<T = any> = (context: TaskRunnerContext<T>) => Promise<T>;

export interface EnqueueTaskOptions {
  requestPayload?: any;
  apiKeyId?: string | null;
  tokenId?: string | null;
}

interface QueueItem<T = any> {
  task: TaskRecord<T>;
  runner: TaskRunner<T>;
}

export class TaskManager {
  private tasks = new Map<string, TaskRecord>();
  private queue: QueueItem[] = [];
  private runningCount = 0;
  private events = new EventEmitter();
  private concurrency: number;
  private resultUrlPrefix: string;

  constructor(options: TaskManagerOptions = {}) {
    this.concurrency = Math.max(1, options.concurrency ?? 2);
    this.resultUrlPrefix = options.resultUrlPrefix ?? "/v1/tasks";
  }

  async enqueue<T>(type: TaskType, runner: TaskRunner<T>, options: EnqueueTaskOptions = {}): Promise<TaskRecord<T>> {
    const now = Math.floor(Date.now() / 1000);
    const id = randomUUID();
    const task: TaskRecord<T> = {
      id,
      object: "task",
      type,
      status: "queued",
      created: now,
      updated: now,
      result_url: `${this.resultUrlPrefix}/${id}`,
      api_key_id: options.apiKeyId || null,
      token_id: options.tokenId || null,
    };

    this.tasks.set(id, task);
    if (isDatabaseConfigured()) {
      await query(
        `INSERT INTO tasks (
          id, type, status, request_payload, result_url, api_key_id, token_id, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, to_timestamp($8), to_timestamp($9))`,
        [
          task.id,
          task.type,
          task.status,
          JSON.stringify(options.requestPayload || {}),
          task.result_url,
          task.api_key_id,
          task.token_id,
          task.created,
          task.updated,
        ],
      );
    }
    this.queue.push({ task, runner });
    queueMicrotask(() => this.processQueue());
    return { ...task };
  }

  async get(id: string, options: { apiKeyId?: string | null } = {}): Promise<TaskRecord | null> {
    if (isDatabaseConfigured()) {
      const values: any[] = [id];
      const apiKeyFilter = options.apiKeyId ? "AND api_key_id = $2" : "";
      if (options.apiKeyId) values.push(options.apiKeyId);
      const result = await query(
        `SELECT *
         FROM tasks
         WHERE id = $1 ${apiKeyFilter}
         LIMIT 1`,
        values,
      );
      return result.rowCount ? this.mapTaskRow(result.rows[0]) : null;
    }
    const task = this.tasks.get(id);
    return task ? this.cloneTask(task) : null;
  }

  async waitFor(id: string, timeoutMs: number): Promise<TaskRecord> {
    const existing = this.tasks.get(id);
    if (!existing) throw new Error(`Task ${id} not found`);
    if (existing.status === "succeeded" || existing.status === "failed") {
      return this.cloneTask(existing);
    }

    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out waiting for task ${id}`));
      }, timeoutMs);

      const onUpdate = (task: TaskRecord) => {
        if (task.id !== id) return;
        if (task.status === "succeeded" || task.status === "failed") {
          cleanup();
          resolve(this.cloneTask(task));
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.events.off("updated", onUpdate);
      };

      this.events.on("updated", onUpdate);
    });
  }

  private processQueue() {
    while (this.runningCount < this.concurrency && this.queue.length > 0) {
      const item = this.queue.shift()!;
      this.runTask(item).catch((error) => logger.error(`Task ${item.task.id} failed outside normal handling:`, error));
    }
  }

  private async runTask<T>({ task, runner }: QueueItem<T>) {
    this.runningCount++;

    try {
      await this.updateTask(task.id, { status: "running" });
      const result = await runner({
        task: this.cloneTask(task),
        updateTokenId: async (tokenId: string) => {
          await this.updateTask(task.id, { token_id: tokenId });
        },
      });
      await this.updateTask(task.id, { status: "succeeded", result });
    } catch (error: any) {
      await this.updateTask(task.id, {
        status: "failed",
        error: {
          message: error?.message || "Task failed",
          type: error?.type || "api_error",
          code: error?.code || error?.errcode || "task_failed",
        },
      });
    } finally {
      this.runningCount--;
      this.processQueue();
    }
  }

  private async updateTask(id: string, patch: Partial<TaskRecord>) {
    const task = this.tasks.get(id);
    if (!task) return;
    Object.assign(task, patch, { updated: Math.floor(Date.now() / 1000) });
    if (isDatabaseConfigured()) {
      await query(
        `UPDATE tasks
         SET status = $1,
             response_payload = $2::jsonb,
             error = $3::jsonb,
             token_id = $4,
             updated_at = to_timestamp($5),
             finished_at = CASE WHEN $1 IN ('succeeded', 'failed') THEN now() ELSE finished_at END
         WHERE id = $6`,
        [
          task.status,
          task.result === undefined ? null : JSON.stringify(task.result),
          task.error === undefined ? null : JSON.stringify(task.error),
          task.token_id || null,
          task.updated,
          task.id,
        ],
      );
    }
    this.events.emit("updated", this.cloneTask(task));
  }

  private mapTaskRow(row: any): TaskRecord {
    const created = Math.floor(new Date(row.created_at).getTime() / 1000);
    const updated = Math.floor(new Date(row.updated_at).getTime() / 1000);
    return {
      id: row.id,
      object: "task",
      type: row.type,
      status: row.status,
      created,
      updated,
      result_url: row.result_url,
      result: row.response_payload || undefined,
      error: row.error || undefined,
      api_key_id: row.api_key_id,
      token_id: row.token_id,
    };
  }

  private cloneTask<T>(task: TaskRecord<T>): TaskRecord<T> {
    return {
      ...task,
      result: task.result,
      error: task.error ? { ...task.error } : undefined,
    };
  }
}

export const taskManager = new TaskManager();
