import axios, { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { getToken, setToken, getRefreshToken, setRefreshToken, removeToken, removeRefreshToken } from '@/utils/auth';
import { tansParams, blobValidate } from '@/utils/ruoyi';
import cache from '@/plugins/cache';
import { HttpStatus } from '@/enums/RespEnum';
import { errorCode } from '@/utils/errorCode';
import { LoadingInstance } from 'element-plus/es/components/loading/src/loading';
import FileSaver from 'file-saver';
import { getLanguage } from '@/lang';
import { encryptBase64, encryptWithAes, generateAesKey, decryptWithAes, decryptBase64 } from '@/utils/crypto';
import { encrypt, decrypt } from '@/utils/jsencrypt';
import router from '@/router';

const encryptHeader = 'encrypt-key';
let downloadLoadingInstance: LoadingInstance;
// 是否显示重新登录（路由守卫拉用户信息时也会置位，不能再用来阻止跳转登录页）
export const isRelogin = { show: false };
// 是否正在刷新令牌
let isRefreshing = false;
// 等待刷新的请求队列
let pendingRequests: Array<{ resolve: (value: any) => void; reject: (reason?: any) => void; config: any }> = [];
let sessionRedirectScheduled = false;
const sessionExpiredMessage = '登录状态已过期，请重新登录';

const isRefreshTokenRequest = (config: any) => {
  if (!config) {
    return false;
  }
  if (config._isRefreshRequest) {
    return true;
  }
  const url = String(config.url || '');
  if (!url.includes('/oauth2/token')) {
    return false;
  }
  const data = config.data;
  if (typeof data === 'string') {
    return /(^|&)grant_type=refresh_token(&|$)/.test(data);
  }
  return data?.grant_type === 'refresh_token';
};

const isOAuthErrorBody = (data: any) => !!data && typeof data === 'object' && typeof data.error === 'string' && !data.access_token;

export const resetSessionGuard = () => {
  sessionRedirectScheduled = false;
  isRelogin.show = false;
  isRefreshing = false;
  pendingRequests = [];
};

/**
 * 统一接管 access_token / refresh_token 失效场景。
 * 会话已无法继续时不再允许留在当前页，避免进入重复刷新和 401 循环。
 */
const handleSessionExpired = () => {
  const sessionError = new Error(sessionExpiredMessage);
  removeToken();
  removeRefreshToken();
  pendingRequests.forEach((request) => request.reject(sessionError));
  pendingRequests = [];
  isRefreshing = false;

  const currentPath = router.currentRoute.value.fullPath;
  if (sessionRedirectScheduled || currentPath.startsWith('/login')) {
    return sessionError;
  }

  sessionRedirectScheduled = true;
  isRelogin.show = true;
  ElMessage({ message: sessionExpiredMessage, type: 'warning', duration: 3000 });

  const loginUrl = router.resolve({
    path: '/login',
    query: currentPath ? { redirect: currentPath } : undefined
  }).href;
  location.replace(loginUrl);

  return sessionError;
};

export const globalHeaders = () => {
  return {
    Authorization: 'Bearer ' + getToken(),
    clientid: import.meta.env.VITE_APP_CLIENT_ID
  };
};

axios.defaults.headers['Content-Type'] = 'application/json;charset=utf-8';
axios.defaults.headers['clientid'] = import.meta.env.VITE_APP_CLIENT_ID;
// 创建 axios 实例
const service = axios.create({
  baseURL: import.meta.env.VITE_APP_BASE_API,
  timeout: 50000,
  transitional: {
    // 超时错误更明确
    clarifyTimeoutError: true
  }
});

// 请求拦截器
service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const hideErrorNotify = config.headers?.hideErrorNotify === true || config.headers?.hideErrorNotify === 'true';
    (config as any).hideErrorNotify = hideErrorNotify;
    if (config.headers?.hideErrorNotify !== undefined) {
      delete config.headers.hideErrorNotify;
    }
    // 对应国际化资源文件后缀
    config.headers['Content-Language'] = getLanguage();
    const language = getLanguage();
    if (language === 'zh_CN' || language === 'zh-CN') {
      config.headers['Language'] = 'zh-CN';
    } else if (language === 'en_US' || language === 'en-US') {
      config.headers['Language'] = 'en-US';
    } else {
      // 如果没有设置 Language，尝试从 Accept-Language 获取（虽然浏览器会自动发送 Accept-Language，但这里可以显式处理逻辑如果需要）
      // 但根据需求：优先读取请求头 Language，如果没有则读取 Accept-Language。
      // 这里是在设置请求头，所以我们应该确保 Language 头被正确设置。
      // 如果 getLanguage() 返回空或者其他值，我们可能需要根据浏览器的语言设置来决定。
      // 不过通常 getLanguage() 会返回默认值。
      // 假设 getLanguage() 返回的是我们应用内部维护的语言设置。

      // 如果 getLanguage() 没有匹配到，我们可以检查 navigator.language
      const browserLang = navigator.language;
      if (browserLang === 'zh-CN' || browserLang === 'zh') {
        config.headers['Language'] = 'zh-CN';
      } else if (browserLang === 'en-US' || browserLang === 'en') {
        config.headers['Language'] = 'en-US';
      }
    }

    const isToken = config.headers?.isToken === false;
    // 是否需要防止数据重复提交
    const isRepeatSubmit = config.headers?.repeatSubmit === false;
    // 是否需要加密
    const isEncrypt = config.headers?.isEncrypt === 'true';

    if (getToken() && !isToken) {
      config.headers['Authorization'] = 'Bearer ' + getToken(); // 让每个请求携带自定义token 请根据实际情况自行修改
    }
    // get请求映射params参数
    if (config.method === 'get' && config.params) {
      let url = config.url + '?' + tansParams(config.params);
      url = url.slice(0, -1);
      config.params = {};
      config.url = url;
    }

    if (!isRepeatSubmit && (config.method === 'post' || config.method === 'put')) {
      const requestObj = {
        url: config.url,
        data: typeof config.data === 'object' ? JSON.stringify(config.data) : config.data,
        time: new Date().getTime()
      };
      const sessionObj = cache.session.getJSON('sessionObj');
      if (sessionObj === undefined || sessionObj === null || sessionObj === '') {
        cache.session.setJSON('sessionObj', requestObj);
      } else {
        const s_url = sessionObj.url; // 请求地址
        const s_data = sessionObj.data; // 请求数据
        const s_time = sessionObj.time; // 请求时间
        const interval = 50; // 间隔时间(ms)，小于此时间视为重复提交
        if (s_data === requestObj.data && requestObj.time - s_time < interval && s_url === requestObj.url) {
          const message = '数据正在处理，请勿重复提交';
          console.warn(`[${s_url}]: ` + message);
          return Promise.reject(new Error(message));
        } else {
          cache.session.setJSON('sessionObj', requestObj);
        }
      }
    }
    if (import.meta.env.VITE_APP_ENCRYPT === 'true') {
      // 当开启参数加密
      if (isEncrypt && (config.method === 'post' || config.method === 'put')) {
        // 生成一个 AES 密钥
        const aesKey = generateAesKey();
        config.headers[encryptHeader] = encrypt(encryptBase64(aesKey));
        config.data = typeof config.data === 'object' ? encryptWithAes(JSON.stringify(config.data), aesKey) : encryptWithAes(config.data, aesKey);
      }
    }
    // FormData数据去请求头Content-Type
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    // 添加 request-id
    config.headers['request-id'] = new Date().getTime();
    return config;
  },
  (error: any) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
service.interceptors.response.use(
  (res: AxiosResponse) => {
    if (import.meta.env.VITE_APP_ENCRYPT === 'true') {
      // 加密后的 AES 秘钥
      const keyStr = res.headers[encryptHeader];
      // 加密
      if (keyStr != null && keyStr != '') {
        const data = res.data;
        // 请求体 AES 解密
        const base64Str = decrypt(keyStr);
        // base64 解码 得到请求头的 AES 秘钥
        const aesKey = decryptBase64(base64Str.toString());
        // aesKey 解码 data
        const decryptData = decryptWithAes(data, aesKey);
        // 将结果 (得到的是 JSON 字符串) 转为 JSON
        res.data = JSON.parse(decryptData);
      }
    }
    // 未设置状态码则默认成功状态
    //const code = res.data.code || HttpStatus.SUCCESS;
    // 未设置状态码则默认成功状态
    //const code = res.data.code === 'OK' ? HttpStatus.SUCCESS : res.data.code;
    let code = res.data.code === 'OK' || res.data.code === undefined ? 200 : res.data.code;
    // 获取错误信息
    const msg = errorCode[code] || res.data.msg || errorCode['default'];

    // 二进制数据则直接返回
    if (res.request.responseType === 'blob' || res.request.responseType === 'arraybuffer') {
      return res.data;
    }
    if (res.data.code === 'Unauthorized' || res.data.code === 'Bad credentials' || res.data.code === 'oauth2_token_error') {
      code = 401;
    }
    const config = (res as any).config;
    if (isRefreshTokenRequest(config) && (isOAuthErrorBody(res.data) || !res.data?.access_token)) {
      return Promise.reject(handleSessionExpired());
    }
    if (code === 401) {
      // 如果本身就是刷新令牌的请求返回了 401，说明 refresh_token 也过期了
      if (isRefreshTokenRequest(config)) {
        return Promise.reject(handleSessionExpired());
      }

      // 如果正在刷新令牌，将当前请求加入等待队列
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingRequests.push({ resolve, reject, config });
        });
      }

      // 开始刷新令牌
      const refreshTokenValue = getRefreshToken();
      if (!refreshTokenValue) {
        return Promise.reject(handleSessionExpired());
      }

      isRefreshing = true;
      return service({
        url: '/auth/v1/oauth2/token',
        headers: {
          isToken: false,
          repeatSubmit: false,
          Authorization: 'Basic OTVUeFNzVFBGQTN0RjEyVEJTTW1VVkswZGE6RnBId0lmdzR3WTkyZE8=',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        },
        transformRequest: (params: any = {}) =>
          Object.entries(params)
            .map((ent: any) => ent.join('='))
            .join('&'),
        method: 'post',
        data: { grant_type: 'refresh_token', refresh_token: encodeURIComponent(refreshTokenValue) },
        _isRefreshRequest: true
      } as any)
        .then((refreshRes: any) => {
          const newToken = refreshRes.access_token;
          const newRefreshToken = refreshRes.refresh_token;
          setToken(newToken);
          setRefreshToken(newRefreshToken);
          // 重放排队中的请求
          pendingRequests.forEach(({ resolve, reject, config: reqConfig }) => {
            reqConfig.headers['Authorization'] = 'Bearer ' + newToken;
            service(reqConfig).then(resolve).catch(reject);
          });
          pendingRequests = [];
          isRefreshing = false;
          // 重试当前失败的请求
          config.headers['Authorization'] = 'Bearer ' + newToken;
          return service(config);
        })
        .catch(() => {
          return Promise.reject(handleSessionExpired());
        });
    } else if (code === HttpStatus.SERVER_ERROR) {
      if (!(res.config as any).hideErrorNotify) {
        ElMessage({ message: msg, type: 'error' });
      }
      return Promise.reject(new Error(msg));
    } else if (code === HttpStatus.WARN) {
      if (!(res.config as any).hideErrorNotify) {
        ElMessage({ message: msg, type: 'warning' });
      }
      return Promise.reject(new Error(msg));
    } else if (code !== HttpStatus.SUCCESS) {
      if (!(res.config as any).hideErrorNotify) {
        ElNotification.error({ title: msg });
      }
      return Promise.reject('error');
    } else {
      return Promise.resolve(res.data);
    }
  },
  (error: any) => {
    const status = error.response?.status;
    const refreshFailed =
      isRefreshTokenRequest(error.config) &&
      (status === HttpStatus.PARAM_ERROR ||
        status === HttpStatus.UNAUTHORIZED ||
        isOAuthErrorBody(error.response?.data) ||
        error.response?.data?.error === 'invalid_grant');
    if (refreshFailed) {
      return Promise.reject(handleSessionExpired());
    }

    console.log(error);
    let { message } = error;
    const responseMsg = error.response?.data?.msg;
    if (error.response != null && error.response.data != null && error.response.data.error_description != null) {
      message = error.response.data.error_description;
    } else if (responseMsg) {
      message = responseMsg;
    } else if (message == 'Network Error') {
      message = '后端接口连接异常';
    } else if (message.includes('timeout')) {
      message = '系统接口请求超时';
    } else if (message.includes('Request failed with status code')) {
      message = '系统接口' + message.substr(message.length - 3) + '异常';
    }
    if (!(error.config as any)?.hideErrorNotify) {
      ElMessage({ message: message, type: 'error', duration: 5 * 1000 });
    }
    return Promise.reject(error);
  }
);
// 通用下载方法
export function download(url: string, params: any, fileName: string) {
  downloadLoadingInstance = ElLoading.service({ text: '正在下载数据，请稍候', background: 'rgba(0, 0, 0, 0.7)' });
  // prettier-ignore
  return service.post(url, params, {
      transformRequest: [
        (params: any) => {
          return tansParams(params);
        }
      ],
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      responseType: 'blob'
    }).then(async (resp: any) => {
      const isLogin = blobValidate(resp);
      if (isLogin) {
        const blob = new Blob([resp]);
        FileSaver.saveAs(blob, fileName);
      } else {
        const blob = new Blob([resp]);
        const resText = await blob.text();
        const rspObj = JSON.parse(resText);
        const errMsg = errorCode[rspObj.code] || rspObj.msg || errorCode['default'];
        ElMessage.error(errMsg);
      }
      downloadLoadingInstance.close();
    }).catch((r: any) => {
      console.error(r);
      ElMessage.error('下载文件出现错误，请联系管理员！');
      downloadLoadingInstance.close();
    });
}
// 导出 axios 实例
export default service;
