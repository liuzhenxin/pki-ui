<template>
  <el-form v-loading="busy" label-position="top" @submit.prevent="save">
    <el-alert v-if="!identityConfigured && !busy" title="请先登记 RA 业务邮件服务账号" type="warning" :closable="false" />
    <el-alert v-if="result" :title="result" :type="failed ? 'error' : 'success'" :closable="false" />
    <el-alert
      v-if="loaded && (!smtpConfigured || !smtpEnabled)"
      :title="smtpConfigured ? 'SMTP 邮件渠道已关闭，RA 暂时无法取用' : '请先保存上方 SMTP 邮件渠道'"
      type="info"
      :closable="false"
    />
    <el-form-item label="授权 RA 使用此 SMTP 渠道">
      <el-switch v-model="authorized" :disabled="busy || !smtpConfigured || (!identityConfigured && !authorized)" />
    </el-form-item>
    <el-button type="primary" native-type="submit" :disabled="busy || !loaded || !smtpConfigured || authorized === saved">保存授权</el-button>
  </el-form>
</template>

<script setup lang="ts">
import { opsApiBaseURL } from '@/api/ops';
import request from '@/utils/request';

type Channel = {
  settings: { authorized: boolean; smtpConfigured: boolean; smtpEnabled: boolean };
  identityConfigured: boolean;
};

const url = '/v1/application-notifications/ra/mail';
const authorized = ref(false);
const saved = ref(false);
const smtpConfigured = ref(false);
const smtpEnabled = ref(false);
const busy = ref(false);
const loaded = ref(false);
const failed = ref(false);
const result = ref('');
const identityConfigured = ref(false);

function show(channel: Channel) {
  identityConfigured.value = channel.identityConfigured;
  authorized.value = channel.settings.authorized;
  saved.value = authorized.value;
  smtpConfigured.value = channel.settings.smtpConfigured;
  smtpEnabled.value = channel.settings.smtpEnabled;
}

onMounted(async () => {
  busy.value = true;
  try {
    show(await request<unknown, Channel>({ baseURL: opsApiBaseURL, url, method: 'get' }));
    loaded.value = true;
  } catch {
    failed.value = true;
    result.value = 'RA SMTP 授权读取失败';
  } finally {
    busy.value = false;
  }
});

async function save() {
  if (busy.value || !loaded.value || !smtpConfigured.value || authorized.value === saved.value) return;
  busy.value = true;
  result.value = '';
  try {
    show(
      await request<unknown, Channel>({
        baseURL: opsApiBaseURL,
        url,
        method: 'put',
        headers: { sensitive: true, repeatSubmit: false },
        data: { authorized: authorized.value }
      })
    );
    failed.value = false;
    result.value = 'RA SMTP 授权已保存';
  } catch {
    failed.value = true;
    result.value = '保存失败，请检查配置或刷新后重试';
  } finally {
    busy.value = false;
  }
}
</script>
