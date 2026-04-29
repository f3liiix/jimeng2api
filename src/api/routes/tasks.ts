import Request from "@/lib/request/Request.ts";
import APIException from "@/lib/exceptions/APIException.ts";
import EX from "@/api/consts/exceptions.ts";
import { taskManager } from "@/lib/jobs/task-manager.ts";

export default {
  prefix: "/v1/tasks",
  get: {
    "/:id": async (request: Request) => {
      const task = taskManager.get(request.params.id);
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
      const task = taskManager.get(request.params.id);
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
