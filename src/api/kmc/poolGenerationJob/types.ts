export type PoolGenerationExecuteType = 'IMMEDIATE' | 'CRON' | 'FIXED_INTERVAL';

export interface PoolGenerationJobVO {
  id: string | number;
  jobName: string;
  strategyId: string | number;
  strategyLabel?: string;
  executeType: PoolGenerationExecuteType;
  cronExpression?: string;
  fixedIntervalSeconds?: number;
  status: number;
  runStatus?: string;
  lastRunTime?: string;
  nextRunTime?: string;
  successCount?: number;
  failureCount?: number;
  lastFailureReason?: string;
}

export interface PoolGenerationJobForm {
  id?: string | number;
  jobName: string;
  strategyId?: string | number;
  executeType: PoolGenerationExecuteType;
  cronExpression?: string;
  fixedIntervalSeconds?: number;
  status: number;
}

export interface PoolGenerationJobQuery extends PageQuery {
  strategyId?: string | number;
  executeType?: PoolGenerationExecuteType;
  status?: number | string;
}

export interface PoolGenerationJobLogVO {
  id: string | number;
  jobId: string | number;
  strategyId: string | number;
  triggerType: string;
  requestedCount: number;
  actualCount: number;
  status: string;
  startTime?: string;
  endTime?: string;
  failureReason?: string;
}

export interface PoolGenerationJobLogQuery extends PageQuery {
  jobId?: string | number;
  strategyId?: string | number;
  triggerType?: string;
  status?: string;
}
