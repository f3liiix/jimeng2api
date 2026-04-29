# Jimeng2API 接口文档

这份文档面向后台管理员和接入方，覆盖视频生成和任务查询接口。视频生成接口采用异步任务模式：提交接口立即返回任务对象，生成完成后通过任务接口读取最终结果。

## 基础信息

- Base URL: `http://192.168.5.10:5100`
- 认证方式: 在请求头中传入 `Authorization: Bearer <API_KEY>`
- JSON 请求需要设置 `Content-Type: application/json`
- 文件上传请求使用 `multipart/form-data`，不要手动设置 `Content-Type`
- 任务 ID 为标准 UUID 字符串，例如 `550e8400-e29b-41d4-a716-446655440000`

```bash
curl http://192.168.5.10:5100/v1/tasks/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## 异步任务流程

1. 调用生成接口提交任务。
2. 使用返回的 `id` 轮询 `GET /v1/tasks/{id}`。
3. 当 `status` 为 `succeeded` 后，读取任务中的 `result`，或调用 `GET /v1/tasks/{id}/result` 获取最终结果。
4. 当 `status` 为 `failed` 时，查看 `error` 字段并按错误信息调整参数或重试。

```bash
# 1. 提交视频生成任务
curl -X POST http://192.168.5.10:5100/v1/videos/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "jimeng-video-3.0",
    "prompt": "一只狮子在草原上奔跑，镜头跟拍",
    "duration": 5
  }'

# 2. 查询任务状态
curl http://192.168.5.10:5100/v1/tasks/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer YOUR_API_KEY"

# 3. 获取最终结果
curl http://192.168.5.10:5100/v1/tasks/550e8400-e29b-41d4-a716-446655440000/result \
  -H "Authorization: Bearer YOUR_API_KEY"
```

任务提交响应示例：

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "object": "task",
  "type": "video_generation",
  "status": "queued",
  "created": 1703123456,
  "updated": 1703123456,
  "result_url": "/v1/tasks/550e8400-e29b-41d4-a716-446655440000"
}
```

任务状态说明：

| 状态 | 含义 |
| --- | --- |
| `queued` | 已进入队列，等待执行 |
| `running` | 正在生成 |
| `succeeded` | 生成成功，可读取结果 |
| `failed` | 生成失败，查看 `error` |

## 视频生成

`POST /v1/videos/generations`

用于生成视频，支持文生视频、图生视频、首尾帧视频和全能参考模式。

常用参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `model` | string | 否 | 视频模型名称，默认 `jimeng-video-3.5-pro`。Seedance 2.0 模型值参考下方表格 |
| `prompt` | string | 是 | 视频内容描述 |
| `ratio` | string | 否 | 视频比例，默认 `1:1`。支持 `1:1`、`4:3`、`3:4`、`16:9`、`9:16`、`21:9` |
| `resolution` | string | 否 | 视频分辨率，如 `720p`、`1080p`。仅 `jimeng-video-3.0` 和 `jimeng-video-3.0-fast` 生效，其他模型会忽略 |
| `duration` | number | 否 | 视频时长，具体范围取决于模型 |
| `filePaths` | array | 否 | 图片 URL 数组，第一个为首帧，第二个为尾帧。兼容旧参数名 `file_paths`，二选一传入即可 |
| `functionMode` | string | 否 | `first_last_frames` 或 `omni_reference`，默认 `first_last_frames` |
| `response_format` | string | 否 | 最终结果格式，支持 `url` 或 `b64_json`，默认 `url` |

常用视频模型：

| 模型值 | 说明 |
| --- | --- |
| `jimeng-video-seedance-2.0` | Seedance 2.0，仅国内站支持，支持 4 到 15 秒时长，支持全能参考模式 |
| `jimeng-video-seedance-2.0-fast` | Seedance 2.0 Fast，仅国内站支持，支持 4 到 15 秒时长，支持全能参考模式，速度更快 |
| `jimeng-video-seedance-2.0-vip` | Seedance 2.0 VIP 通道，仅国内站支持，支持 4 到 15 秒时长，支持全能参考模式 |
| `jimeng-video-seedance-2.0-fast-vip` | Seedance 2.0 Fast VIP 通道，仅国内站支持，支持 4 到 15 秒时长，支持全能参考模式 |

文生视频示例：

```bash
curl -X POST http://192.168.5.10:5100/v1/videos/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "jimeng-video-seedance-2.0-fast-vip",
    "prompt": "一只狮子在草原上奔跑，镜头跟拍",
    "ratio": "9:16",
    "duration": 5
  }'
```

使用 URL 图片作为首帧/尾帧时，推荐使用 `filePaths`。`file_paths` 仅作为兼容别名保留；如果两个字段同时传入，服务端会优先使用 `filePaths`。

首帧图片上传示例：

```bash
curl -X POST http://192.168.5.10:5100/v1/videos/generations \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "prompt=让画面中的人物自然挥手" \
  -F "model=jimeng-video-seedance-2.0-fast-vip" \
  -F "duration=5" \
  -F "image_file_1=@/path/to/first-frame.png"
```

全能参考模式示例：

```bash
curl -X POST http://192.168.5.10:5100/v1/videos/generations \
  -H "Authorization: Bearer YOUR_API_KEY" \
  --form-string "prompt=@image_file_1作为首帧，运动动作参考@video_file_1" \
  -F "model=jimeng-video-seedance-2.0-fast-vip" \
  -F "functionMode=omni_reference" \
  -F "duration=5" \
  -F "image_file_1=@/path/to/first.png" \
  -F "video_file_1=@/path/to/reference.mp4"
```

## 任务查询

### 查询任务状态

`GET /v1/tasks/{id}`

```bash
curl http://192.168.5.10:5100/v1/tasks/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer YOUR_API_KEY"
```

成功任务示例：

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "object": "task",
  "type": "video_generation",
  "status": "succeeded",
  "result": {
    "created": 1703123456,
    "data": [
      {
        "url": "https://example.com/result.mp4"
      }
    ]
  }
}
```

### 获取任务结果

`GET /v1/tasks/{id}/result`

```bash
curl http://192.168.5.10:5100/v1/tasks/550e8400-e29b-41d4-a716-446655440000/result \
  -H "Authorization: Bearer YOUR_API_KEY"
```

视频结果示例：

```json
{
  "created": 1703123456,
  "data": [
    {
      "url": "https://example.com/result.mp4"
    }
  ]
}
```

## 常见错误

| HTTP 状态 | 类型 | 常见原因 | 处理方式 |
| --- | --- | --- | --- |
| `400` | `invalid_request_error` | 缺少必填参数、模型不可用、素材数量超限 | 检查请求参数和模型支持范围 |
| `401` | `authentication_error` | API Key 缺失、无效或已停用，错误代码为 `invalid_api_key` | 更换有效 API Key |
| `404` | `invalid_request_error` | 任务不存在或不属于当前 API Key，错误代码为 `task_not_found` | 确认任务 ID，稍后重试 |
| `500` | `server_error` | 上游服务异常或任务执行失败 | 查看任务 `error` 字段后重试 |

错误响应示例：

```json
{
  "error": {
    "message": "Invalid request parameters",
    "type": "invalid_request_error",
    "code": "invalid_request"
  }
}
```

## 接入建议

- 生成接口不要同步等待结果，始终按异步任务轮询。
- 轮询间隔建议 5 到 10 秒，长视频或复杂任务可适当放慢。
- 使用文件上传时，`prompt` 中包含 `@` 引用请用 `--form-string`。
