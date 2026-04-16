export interface PoolStrategyVO {
  id: string | number;
  algType: string;
  keyUsage: string;
  lowWatermark: number;
  highWatermark: number;
  status: number | string;
  createTime?: string;
}

export interface PoolStrategyForm {
  id?: string | number;
  algType: string;
  keyUsage: string;
  lowWatermark: number;
  highWatermark: number;
  status: number | string;
}

export interface PoolStrategyQuery extends PageQuery {
  algType?: string;
  status?: string | number;
}
