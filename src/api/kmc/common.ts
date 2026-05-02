export interface KmcPageResult<T = any> {
  records: T[];
  total: number;
}

export const unwrapKmcData = <T = any>(res: any): T => {
  const body = res?.data ?? res;
  return (body?.data ?? body) as T;
};

export const readKmcPage = <T = any>(res: any): KmcPageResult<T> => {
  const data: any = unwrapKmcData(res);
  const records = data?.records ?? data?.rows ?? data?.data ?? (Array.isArray(data) ? data : []);
  const total = data?.total ?? data?.totalCount ?? data?.count ?? records.length ?? 0;
  return {
    records,
    total
  };
};

