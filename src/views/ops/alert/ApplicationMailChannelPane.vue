<template>
  <el-form v-loading="busy" :model="form" label-position="top" @submit.prevent="save">
    <el-alert v-if="!identityConfigured && !busy" title="请先登记 RA 业务邮件服务账号" type="warning" :closable="false" />
    <el-alert v-if="result" :title="result" :type="failed ? 'error' : 'success'" :closable="false" />
    <el-row :gutter="16">
      <el-col :xs="24" :sm="12">
        <el-form-item label="SMTP 主机" required><el-input v-model.trim="form.host" /></el-form-item>
        <el-form-item label="端口" required><el-input-number v-model="form.port" :min="1" :max="65535" /></el-form-item>
        <el-form-item label="TLS 模式">
          <el-select v-model="form.tls">
            <el-option label="直接 TLS" value="TLS" />
            <el-option label="STARTTLS" value="STARTTLS" />
          </el-select>
        </el-form-item>
      </el-col>
      <el-col :xs="24" :sm="12">
        <el-form-item label="RA 专用 SMTP 账号" required><el-input v-model.trim="form.username" /></el-form-item>
        <el-form-item label="SMTP 密码或授权码">
          <el-input
            v-model="password"
            type="password"
            autocomplete="new-password"
            :placeholder="form.revision ? '留空保留原凭据' : '请输入应用专用凭据'"
          />
        </el-form-item>
        <el-form-item label="发件地址" required><el-input v-model.trim="form.from" /></el-form-item>
      </el-col>
    </el-row>
    <el-form-item label="授权 RA 使用此渠道">
      <el-switch v-model="form.enabled" :disabled="!identityConfigured && !form.enabled" />
    </el-form-item>
    <el-button type="primary" native-type="submit" :disabled="busy || !loaded">保存渠道与授权</el-button>
  </el-form>
</template>

<script setup lang="ts">
import { opsApiBaseURL } from '@/api/ops';
import request from '@/utils/request';

type Settings = {
  revision: string | null;
  host: string;
  port: number;
  tls: 'TLS' | 'STARTTLS';
  username: string;
  from: string;
  enabled: boolean;
};

type Channel = { settings: Settings | null; identityConfigured: boolean };

const url = '/v1/application-notifications/ra/mail';
const form = reactive<Settings>({ revision: null, host: '', port: 465, tls: 'TLS', username: '', from: '', enabled: false });
const busy = ref(false);
const loaded = ref(false);
const failed = ref(false);
const result = ref('');
const password = ref('');
const identityConfigured = ref(false);

function show(channel: Channel) {
  identityConfigured.value = channel.identityConfigured;
  if (channel.settings) Object.assign(form, channel.settings);
}

onMounted(async () => {
  busy.value = true;
  try {
    show(await request<unknown, Channel>({ baseURL: opsApiBaseURL, url, method: 'get' }));
    loaded.value = true;
  } catch {
    failed.value = true;
    result.value = 'RA 邮件渠道读取失败';
  } finally {
    busy.value = false;
  }
});

async function save() {
  if (busy.value || !loaded.value) return;
  busy.value = true;
  result.value = '';
  try {
    show(
      await request<unknown, Channel>({
        baseURL: opsApiBaseURL,
        url,
        method: 'put',
        headers: { sensitive: true, repeatSubmit: false },
        data: { settings: { ...form }, password: password.value }
      })
    );
    password.value = '';
    failed.value = false;
    result.value = 'RA 邮件渠道与授权已保存';
  } catch {
    failed.value = true;
    result.value = '保存失败，请检查配置或刷新后重试';
  } finally {
    busy.value = false;
  }
}
</script>
