import Request from "@/lib/request/Request.ts";
import APIException from "@/lib/exceptions/APIException.ts";
import EX from "@/api/consts/exceptions.ts";
import { taskManager } from "@/lib/jobs/task-manager.ts";
import { authenticateApiKey } from "@/lib/auth/request-auth.ts";

export default {
  prefix: "/v1/tasks",
  get: {
    "/:id": async (request: Request) => {
      const apiKey = await authenticateApiKey(request);
      const task = await taskManager.get(request.params.id, { apiKeyId: apiKey.id });
      if (!task) {
        throw new APIException(EX.API_REQUEST_PARAMS_INVALID, `Task ${request.params.id} not found`, {
          httpStatusCode: 404,
          type: "invalid_request_error",
          param: "id",
          code: "task_not_found",
        });
      }
      return task;
    },

    "/:id/result": async (request: Request) => {
      const apiKey = await authenticateApiKey(request);
      const task = await taskManager.get(request.params.id, { apiKeyId: apiKey.id });
      if (!task) {
        throw new APIException(EX.API_REQUEST_PARAMS_INVALID, `Task ${request.params.id} not found`, {
          httpStatusCode: 404,
          type: "invalid_request_error",
          param: "id",
          code: "task_not_found",
        });
      }
      if (task.status !== "succeeded") return task;
      return task.result;
    },
  },
};
