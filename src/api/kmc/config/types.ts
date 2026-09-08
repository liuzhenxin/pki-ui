export interface KmcRuntimeConfig {
  keyGeneration: {
    batchSize: number;
  };
  reservePool: {
    enableAutoReplenish: boolean;
    watermarkCheckInterval: number;
    generationRateLimit: number;
  };
  keyRecovery: {
    enabled: boolean;
    totalApprovers: number;
    requiredApprovers: number;
  };
}
