import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";

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
}

export interface TaskManagerOptions {
  concurrency?: number;
  resultUrlPrefix?: string;
}

type TaskRunner<T = any> = () => Promise<T>;

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

  enqueue<T>(type: TaskType, runner: TaskRunner<T>): TaskRecord<T> {
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
    };

    this.tasks.set(id, task);
    this.queue.push({ task, runner });
    queueMicrotask(() => this.processQueue());
    return { ...task };
  }

  get(id: string): TaskRecord | null {
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
      this.runTask(item).catch(() => undefined);
    }
  }

  private async runTask<T>({ task, runner }: QueueItem<T>) {
    this.runningCount++;
    this.updateTask(task.id, { status: "running" });

    try {
      const result = await runner();
      this.updateTask(task.id, { status: "succeeded", result });
    } catch (error: any) {
      this.updateTask(task.id, {
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

  private updateTask(id: string, patch: Partial<TaskRecord>) {
    const task = this.tasks.get(id);
    if (!task) return;
    Object.assign(task, patch, { updated: Math.floor(Date.now() / 1000) });
    this.events.emit("updated", this.cloneTask(task));
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
