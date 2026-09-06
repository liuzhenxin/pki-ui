import { to } from 'await-to-js';
import { markCertLogin } from '@/utils/certSessionWatcher';
import { getToken, removeToken, setToken, setRefreshToken, removeRefreshToken } from '@/utils/auth';
import { exchangeCertificateCode, login as loginApi, logout as logoutApi, getInfo as getUserInfo } from '@/api/login';
import { LoginData, LoginResult, Result } from '@/api/types';
import defAva from '@/assets/images/profile.jpg';
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { UserInfo } from '@/api/system/user/types';

export const useUserStore = defineStore('user', () => {
  const token = ref(getToken());
  const name = ref('');
  const nickname = ref('');
  const userId = ref<string | number>('');
  const tenantId = ref<string>('');
  const tenantInitStatus = ref<number | undefined>(undefined);
  const avatar = ref('');
  const roles = ref<Array<string>>([]); // 用户角色编码集合 → 判断路由权限
  const permissions = ref<Array<string>>([]); // 用户权限编码集合 → 判断按钮权限

  /**
   * 登录
   * @param userInfo
   * @returns
   */
  const login = async (userInfo: LoginData): Promise<LoginResult> => {
    const [err, res] = await to(loginApi(userInfo));
    if (res) {
      setToken(res.access_token);
      if (res.refresh_token) setRefreshToken(res.refresh_token);
      token.value = res.access_token;
      tenantId.value = userInfo.tenantId || '';
      return Promise.resolve(res);
    }
    return Promise.reject(err);
  };

  const certificateLogin = async (certificateCode: string, currentTenantId: string): Promise<LoginResult> => {
    const [err, res] = await to(exchangeCertificateCode(certificateCode));
    if (res) {
      setToken(res.access_token);
      if (res.refresh_token) setRefreshToken(res.refresh_token);
      else removeRefreshToken();
      token.value = res.access_token;
      tenantId.value = currentTenantId;
      markCertLogin(true);
      return Promise.resolve(res);
    }
    return Promise.reject(err);
  };

  // 获取用户信息
  const getInfo = async (): Promise<void> => {
    const [err, res] = await to(getUserInfo());
    if (res) {
      const user = res.data;
      const profile = user.avatar == '' || user.avatar == null ? defAva : user.avatar;

      if (user.permissions && user.permissions.length > 0) {
        // 验证返回的roles是否是一个非空数组
        //roles.value = data.roles;
        permissions.value = user.permissions;
      } else {
        roles.value = ['ROLE_DEFAULT'];
      }
      name.value = user.username;
      avatar.value = profile;
      userId.value = user.id;
      // 从 extValues 中尝试获取 tenantId
      if (user.extValues && user.extValues.tenantId) {
        tenantId.value = String(user.extValues.tenantId);
      }
      return Promise.resolve();
    }
    return Promise.reject(err);
  };

  // 注销
  const logout = async (): Promise<void> => {
    try {
      await logoutApi();
    } catch {
      // 令牌已失效时服务端注销会失败，本地会话仍须清掉
    } finally {
      token.value = '';
      roles.value = [];
      permissions.value = [];
      tenantInitStatus.value = undefined;
      removeToken();
      removeRefreshToken();
      markCertLogin(false);
    }
  };

  const setAvatar = (value: string) => {
    avatar.value = value;
  };

  const setTenantInitStatus = (value: number | undefined) => {
    tenantInitStatus.value = value;
  };

  return {
    userId,
    tenantId,
    tenantInitStatus,
    token,
    name,
    nickname,
    avatar,
    roles,
    permissions,
    login,
    certificateLogin,
    getInfo,
    logout,
    setAvatar,
    setTenantInitStatus
  };
});
