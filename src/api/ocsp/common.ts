export const unwrapOcspData = <T = any>(res: any): T => {
  const body = res?.data ?? res;
  return (body?.data ?? body) as T;
};

