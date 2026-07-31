const TokenKey = 'Admin-Token';
const RefreshTokenKey = 'Admin-Refresh-Token';

const tokenStorage = useStorage<null | string>(TokenKey, null);
const refreshTokenStorage = useStorage<null | string>(RefreshTokenKey, null);

export const getToken = () => tokenStorage.value;

export const setToken = (access_token: string) => (tokenStorage.value = access_token);

export const removeToken = () => (tokenStorage.value = null);

export const getRefreshToken = () => refreshTokenStorage.value;

export const setRefreshToken = (refresh_token: string) => (refreshTokenStorage.value = refresh_token);

export const removeRefreshToken = () => (refreshTokenStorage.value = null);
