import Response from '@/lib/response/Response.ts';
import images from "./images.ts";
import ping from "./ping.ts";
import models from './models.ts';
import videos from './videos.ts';
import tasks from './tasks.ts';
import admin from './admin.ts';

export default [
    {
        get: {
            '/': async () => {
                return {
                    service: 'jimeng2api',
                    status: 'running',
                    version: '1.0.0',
                    description: '将即梦AI网页版转换成API服务',
                    endpoints: {
                        images: '/v1/images/generations',
                        compositions: '/v1/images/compositions',
                        videos: '/v1/videos/generations',
                        tasks: '/v1/tasks/{id}',
                        models: '/v1/models',
                        health: '/ping'
                    }
                };
            }
        }
    },
    images,
    ping,
    models,
    videos,
    tasks,
    admin
];
