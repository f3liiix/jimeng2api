import serviceConfig from "./configs/service-config.ts";
import systemConfig from "./configs/system-config.ts";
import databaseConfig from "./configs/database-config.ts";

class Config {
    
    /** 服务配置 */
    service = serviceConfig;
    
    /** 系统配置 */
    system = systemConfig;

    /** 数据库配置 */
    database = databaseConfig;

}

export default new Config();