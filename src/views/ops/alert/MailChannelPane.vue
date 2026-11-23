<template>
  <el-form v-loading="busy" :model="form" label-position="top" class="mail-channel-form" @submit.prevent="save">
    <el-alert v-if="result" :title="result" type="info" :closable="false" show-icon />
    <div class="mail-fields">
      <el-form-item label="SMTP 主机" required><el-input v-model.trim="form.host" /></el-form-item>
      <el-form-item label="端口" required><el-input-number v-model="form.port" :min="1" :max="65535" /></el-form-item>
      <el-form-item label="TLS 模式" required>
        <el-select v-model="form.tls">
          <el-option label="直接 TLS" value="TLS" />
          <el-option label="STARTTLS" value="STARTTLS" />
        </el-select>
      </el-form-item>
      <el-form-item label="SMTP 账号" required><el-input v-model.trim="form.username" /></el-form-item>
      <el-form-item label="SMTP 密码或授权码">
        <el-input
          v-model="password"
          type="password"
          autocomplete="new-password"
          :placeholder="form.passwordConfigured ? '已配置，留空保留' : '请输入密码或授权码'"
        />
      </el-form-item>
      <el-form-item label="发件地址" required><el-input v-model.trim="form.from" /></el-form-item>
      <el-form-item label="收件地址" required><el-input v-model.trim="form.to" /></el-form-item>
      <el-form-item label="启用邮件发送"><el-switch v-model="form.enabled" /></el-form-item>
    </div>
    <el-space wrap>
      <el-button type="primary" native-type="submit" :disabled="busy">保存配置</el-button>
      <el-button :disabled="busy || !form.passwordConfigured || dirty" @click="test('test-connection')">测试连接</el-button>
      <el-button :disabled="busy || !form.enabled || !form.passwordConfigured || dirty" @click="test('test-send')">试发邮件</el-button>
    </el-space>
  </el-form>
</template>

<script setup lang="ts">
import request from '@/utils/request';
import { opsApiBaseURL } from '@/api/ops';

type Settings = {
  host: string;
  port: number;
  tls: 'TLS' | 'STARTTLS';
  username: string;
  from: string;
  to: string;
  enabled: boolean;
  passwordConfigured: boolean;
};

const emit = defineEmits<{ saved: [] }>();
const url = '/v1/alert/mail-channel';
const baseURL = opsApiBaseURL;
const form = reactive<Settings>({
  host: '',
  port: 465,
  tls: 'TLS',
  username: '',
  from: '',
  to: '',
  enabled: false,
  passwordConfigured: false
});
const busy = ref(false);
const password = ref('');
const result = ref('');
const saved = ref('');
const dirty = computed(() => !!password.value || JSON.stringify(form) !== saved.value);

onMounted(async () => {
  busy.value = true;
  try {
    const data = (await request({ baseURL, url, method: 'get' })) as unknown as { settings: Settings | null };
    if (data.settings) Object.assign(form, data.settings);
    saved.value = JSON.stringify(form);
  } finally {
    busy.value = false;
  }
});

async function save() {
  if (busy.value) return;
  busy.value = true;
  result.value = '';
  try {
    const data = (await request({
      baseURL,
      url,
      method: 'put',
      headers: { sensitive: true, repeatSubmit: false },
      data: { settings: { ...form }, password: password.value }
    })) as unknown as { settings: Settings };
    Object.assign(form, data.settings);
    password.value = '';
    saved.value = JSON.stringify(form);
    result.value = '邮件渠道已保存';
    emit('saved');
  } catch (error) {
    result.value = error instanceof Error ? error.message : '保存失败，请重试';
  } finally {
    busy.value = false;
  }
}

async function test(action: 'test-connection' | 'test-send') {
  busy.value = true;
  result.value = '';
  try {
    const data = (await request({ baseURL, url: `${url}/${action}`, method: 'post', timeout: 35000 })) as unknown as {
      message: string;
    };
    result.value = data.message;
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.mail-channel-form {
  max-width: 850px;
}
.mail-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
  gap: 0 20px;
  margin-top: 16px;
}
</style>
