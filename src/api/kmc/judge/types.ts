export interface JudgeVO {
  id: string | number;
  decision?: string;
  reason?: string;
  operator?: string;
  targetId?: string | number;
  targetType?: string;
  status?: string;
  operatorIp?: string;
  operatorUkeySn?: string;
}

export interface JudgeForm {
  id?: string | number;
  decision?: string;
  reason?: string;
  operator?: string;
  targetId?: string | number;
  targetType?: string;
  status?: string;
  operatorIp?: string;
  operatorUkeySn?: string;
}

export interface JudgeQuery extends PageQuery {
  operator?: string;
  targetId?: string | number;
  targetType?: string;
  status?: string;
}

export interface JudgeApproveForm {
  id: string | number;
  decision: string;
  reason?: string;
  operator: string;
  operatorIp: string;
  operatorUkeySn: string;
}

