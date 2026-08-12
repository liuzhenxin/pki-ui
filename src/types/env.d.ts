declare module '*.vue' {
  import { DefineComponent } from 'vue';
  const Component: DefineComponent<{}, {}, any>;
  export default Component;
}

// 环境变量
interface ImportMetaEnv {
  VITE_APP_TITLE: string;
  VITE_APP_PORT: number;
  VITE_APP_BASE_API: string;
  VITE_APP_OPS_API: string;
  VITE_APP_BASE_URL: string;
  VITE_APP_CONTEXT_PATH: string;
  VITE_APP_MONITOR_ADMIN: string;
  VITE_APP_SNAILJOB_ADMIN: string;
  VITE_APP_ENV: string;
  VITE_APP_ENCRYPT: string;
  VITE_APP_RSA_PUBLIC_KEY: string;
  VITE_APP_RSA_PRIVATE_KEY: string;
  VITE_APP_CLIENT_ID: string;
  // 本 UI 部署服务的租户 ID（逗号分隔；空 = 全部 PKI 租户）
  VITE_APP_TENANT_IDS: string;
  VITE_APP_WEBSOCKET: string;
  VITE_APP_SSE: string;
  VITE_APP_VERSION: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
  // readonly glob: any;
}
