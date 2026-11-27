export {};
declare module 'axios' {
  interface AxiosRequestConfig<D = any> {
    returnBinaryResponse?: boolean;
  }

  interface AxiosResponse<T = any> {
    code: number;
    msg: string;
    rows: T;
    total: number;
  }
}
