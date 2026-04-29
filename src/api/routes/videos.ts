import _ from 'lodash';

import Request from '@/lib/request/Request.ts';
import Response from '@/lib/response/Response.ts';
import { tokenSplit } from '@/api/controllers/core.ts';
import { generateVideo, DEFAULT_MODEL } from '@/api/controllers/videos.ts';
import util from '@/lib/util.ts';
import { taskManager } from '@/lib/jobs/task-manager.ts';
import APIException from '@/lib/exceptions/APIException.ts';
import EX from '@/api/consts/exceptions.ts';
import { validateOmniReferenceMaterialLimits } from '@/api/models/video-request-validation.ts';

function invalidRequest(message: string, param?: string) {
    return new APIException(EX.API_REQUEST_PARAMS_INVALID, message, {
        httpStatusCode: 400,
        type: "invalid_request_error",
        param,
        code: "invalid_request",
    });
}

export default {

    prefix: '/v1/videos',

    post: {

        '/generations': async (request: Request) => {
            const contentType = request.headers['content-type'] || '';
            const isMultiPart = contentType.startsWith('multipart/form-data');

            request
                .validate('body.model', v => _.isUndefined(v) || _.isString(v))
                .validate('body.prompt', _.isString)
                .validate('body.ratio', v => _.isUndefined(v) || _.isString(v))
                .validate('body.resolution', v => _.isUndefined(v) || _.isString(v))
                .validate('body.functionMode', v => _.isUndefined(v) || (_.isString(v) && ['first_last_frames', 'omni_reference'].includes(v)))
                .validate('body.response_format', v => _.isUndefined(v) || _.isString(v))
                .validate('headers.authorization', _.isString);

            const functionMode = request.body.functionMode || 'first_last_frames';
            const isOmniMode = functionMode === 'omni_reference';

            // 验证 duration（根据模型）
            if (!_.isUndefined(request.body.duration)) {
                const modelName = request.body.model || DEFAULT_MODEL;
                let durationValue: number;
                if (isMultiPart && typeof request.body.duration === 'string') {
                    durationValue = parseInt(request.body.duration, 10);
                    // 严格检查 parseInt 结果
                    if (!Number.isInteger(durationValue) || request.body.duration.trim() !== String(durationValue)) {
                        throw invalidRequest(`duration 必须是整数，当前值: ${request.body.duration}`, "duration");
                    }
                } else if (_.isFinite(request.body.duration)) {
                    durationValue = request.body.duration as number;
                    if (!Number.isInteger(durationValue)) {
                        throw invalidRequest(`duration 必须是整数，当前值: ${durationValue}`, "duration");
                    }
                } else {
                    throw invalidRequest(`duration 参数格式错误`, "duration");
                }

                // 根据模型验证 duration 有效值
                let validDurations: number[] = [];
                let errorMessage = '';

                if (modelName.includes('veo3.1') || modelName.includes('veo3')) {
                    validDurations = [8];
                    errorMessage = 'veo3 模型仅支持 8 秒时长';
                } else if (modelName.includes('sora2')) {
                    validDurations = [4, 8, 12];
                    errorMessage = 'sora2 模型仅支持 4、8、12 秒时长';
                } else if (modelName.includes('3.5-pro') || modelName.includes('3.5_pro')) {
                    validDurations = [5, 10, 12];
                    errorMessage = '3.5-pro 模型仅支持 5、10、12 秒时长';
                } else if (modelName.includes('seedance-2.0') || modelName.includes('40_pro') || modelName.includes('40-pro') || modelName.includes('seedance-2.0-fast')) {
                    // seedance 2.0 和 2.0-fast 支持 4~15 秒任意整数
                    if (durationValue < 4 || durationValue > 15) {
                        throw invalidRequest(`seedance 2.0/2.0-fast 模型支持 4~15 秒时长，当前值: ${durationValue}`, "duration");
                    }
                } else {
                    // 其他模型支持 5 或 10 秒
                    validDurations = [5, 10];
                    errorMessage = '该模型仅支持 5、10 秒时长';
                }

                // 检查是否在有效值列表中
                if (validDurations.length > 0 && !validDurations.includes(durationValue)) {
                    throw invalidRequest(`${errorMessage}，当前值: ${durationValue}`, "duration");
                }
            }

            // 验证 file_paths 和 filePaths
            request
                .validate('body.file_paths', v => _.isUndefined(v) || (_.isArray(v) && v.length <= 2))
                .validate('body.filePaths', v => _.isUndefined(v) || (_.isArray(v) && v.length <= 2));

            if (isOmniMode) {
                validateOmniReferenceMaterialLimits({
                    body: request.body,
                    files: request.files,
                    filePaths: [...(request.body.filePaths || []), ...(request.body.file_paths || [])],
                });
            } else {
                // 普通模式验证逻辑（保持原有逻辑）
                const uploadedFiles = request.files ? _.values(request.files) : [];
                if (uploadedFiles.length > 2) {
                    throw invalidRequest('最多只能上传2个图片文件');
                }
            }

            // refresh_token切分
            const tokens = tokenSplit(request.headers.authorization);
            // 随机挑选一个refresh_token
            const token = _.sample(tokens);

            const {
                model = DEFAULT_MODEL,
                prompt,
                ratio = "1:1",
                resolution = "720p",
                duration = 5,
                file_paths = [],
                filePaths = [],
                response_format = "url"
            } = request.body;

            // 如果是 multipart/form-data，需要将字符串转换为数字
            const finalDuration = isMultiPart && typeof duration === 'string'
                ? parseInt(duration)
                : duration;

            // 兼容两种参数名格式：file_paths 和 filePaths
            const finalFilePaths = filePaths.length > 0 ? filePaths : file_paths;

            return taskManager.enqueue("video_generation", async () => {
                const generatedVideoUrl = await generateVideo(
                    model,
                    prompt,
                    {
                        ratio,
                        resolution,
                        duration: finalDuration,
                        filePaths: finalFilePaths,
                        files: request.files,
                        httpRequest: request,
                        functionMode,
                    },
                    token
                );

                if (response_format === "b64_json") {
                    const videoBase64 = await util.fetchFileBASE64(generatedVideoUrl);
                    return {
                        created: util.unixTimestamp(),
                        data: [{
                            b64_json: videoBase64,
                            revised_prompt: prompt
                        }]
                    };
                }

                return {
                    created: util.unixTimestamp(),
                    data: [{
                        url: generatedVideoUrl,
                        revised_prompt: prompt
                    }]
                };
            });
        }

    }

}