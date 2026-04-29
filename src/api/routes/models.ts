import _ from 'lodash';
import { listModels } from '@/api/models/registry.ts';

export default {

    prefix: '/v1',

    get: {
        '/models': async () => {
            return {
                "data": listModels()
            };
        }

    }
}