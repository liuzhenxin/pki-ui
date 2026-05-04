export interface KmcRuntimeConfig {
  keyGeneration: {
    enableHardwareGeneration: boolean;
    defaultKeyType: string;
    defaultKeySize: number;
    batchSize: number;
  };
  reservePool: {
    enableAutoReplenish: boolean;
    watermarkCheckInterval: number;
    generationRateLimit: number;
  };
  audit: {
    enabled: boolean;
    retentionDays: number;
  };
}
