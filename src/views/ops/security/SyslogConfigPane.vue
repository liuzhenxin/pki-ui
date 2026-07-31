<template>
  <div>
    <div class="pane-actions">
      <div>
        <h3>Syslog 日志转发</h3>
        <el-space>
          <el-tag :type="form.enabled ? 'success' : 'info'">{{ form.enabled ? '已启用' : '未启用' }}</el-tag>
          <el-tag v-if="form.tested" type="success" effect="plain">当前配置已测试</el-tag>
          <el-tag v-else type="warning" effect="plain">启用前需要测试</el-tag>
        </el-space>
      </div>
      <el-space>
        <el-button v-hasPermi="['ops:security:syslog:test']" :loading="testing" @click="test">发送测试消息</el-button>
        <el-button v-hasPermi="['ops:security:syslog:edit']" type="primary" :loading="saving" @click="save">保存</el-button>
      </el-space>
    </div>

    <el-alert v-if="status.lastError" type="error" :closable="false" :title="`最后发送错误：${status.lastError}`" />
    <el-descriptions class="status" :column="4" border>
      <el-descriptions-item label="成功发送">{{ status.sentCount }}</el-descriptions-item>
      <el-descriptions-item label="发送失败">{{ status.failedCount }}</el-descriptions-item>
      <el-descriptions-item label="最后成功">{{ formatTime(status.lastSuccessTime) }}</el-descriptions-item>
      <el-descriptions-item label="最后失败">{{ formatTime(status.lastFailureTime) }}</el-descriptions-item>
    </el-descriptions>

    <el-form ref="formRef" v-loading="loading" :model="form" :rules="rules" label-position="top">
      <section class="band switch-band">
        <div>
          <strong>启用日志转发</strong>
          <p>转发失败不会阻塞登录、签发及运维接口。</p>
        </div>
        <el-switch v-model="form.enabled" inline-prompt active-text="启用" inactive-text="关闭" />
      </section>

      <section class="band">
        <h4>范围与事件</h4>
        <div class="grid two">
          <el-form-item label="服务范围" prop="serviceScopes">
            <el-select v-model="form.serviceScopes" multiple>
              <el-option v-for="item in services" :key="item" :label="item === 'ALL' ? '全部服务' : item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="事件类型" prop="eventTypes">
            <el-checkbox-group v-model="form.eventTypes">
              <el-checkbox value="LOGIN">登录日志</el-checkbox>
              <el-checkbox value="OPERATION">操作日志</el-checkbox>
              <el-checkbox value="HEALTH_ALERT">健康告警</el-checkbox>
            </el-checkbox-group>
          </el-form-item>
        </div>
      </section>

      <section class="band">
        <div class="server-title">
          <h4>服务器</h4>
          <el-switch v-model="secondaryEnabled" active-text="备用服务器" />
        </div>
        <div class="grid two">
          <ServerForm v-model="form.primary" title="主 Syslog 服务器" prefix="primary" />
          <ServerForm v-if="secondaryEnabled && form.secondary" v-model="form.secondary" title="备用 Syslog 服务器" prefix="secondary" />
        </div>
      </section>

      <section class="band">
        <h4>报文参数</h4>
        <div class="grid four">
          <el-form-item label="格式"><el-input model-value="RFC5424" disabled /></el-form-item>
          <el-form-item label="Facility"
            ><el-select v-model="form.facility"><el-option v-for="n in 8" :key="n" :label="`LOCAL${n - 1}`" :value="`LOCAL${n - 1}`" /></el-select
          ></el-form-item>
          <el-form-item label="最低级别"
            ><el-select v-model="form.minimumSeverity"
              ><el-option v-for="item in ['DEBUG', 'INFO', 'WARN', 'ERROR']" :key="item" :label="item" :value="item" /></el-select
          ></el-form-item>
          <el-form-item label="应用名前缀"><el-input v-model.trim="form.appNamePrefix" /></el-form-item>
        </div>
      </section>

      <section class="band">
        <h4>TLS 与外部 Secret</h4>
        <p class="hint">证书和私钥不写入数据库，这里仅保存外部 Secret 引用。运行时信任链由 JVM TrustStore 或容器挂载提供。</p>
        <div class="grid two">
          <el-form-item label="TLS Server Name"><el-input v-model.trim="form.tlsServerName" placeholder="syslog.example.com" /></el-form-item>
          <el-form-item label="信任证书 Secret 引用"
            ><el-input v-model.trim="form.trustSecretRef" placeholder="secret://ops/syslog/ca"
          /></el-form-item>
          <el-form-item label="客户端证书 Secret 引用"
            ><el-input v-model.trim="form.clientCertSecretRef" placeholder="secret://ops/syslog/client-cert"
          /></el-form-item>
          <el-form-item label="客户端私钥 Secret 引用"
            ><el-input v-model.trim="form.clientKeySecretRef" placeholder="secret://ops/syslog/client-key"
          /></el-form-item>
        </div>
      </section>

      <section class="band">
        <h4>传输参数</h4>
        <div class="grid four">
          <el-form-item label="连接超时（毫秒）"><el-input-number v-model="form.connectTimeoutMillis" :min="500" :max="30000" /></el-form-item>
          <el-form-item label="发送超时（毫秒）"><el-input-number v-model="form.writeTimeoutMillis" :min="500" :max="30000" /></el-form-item>
          <el-form-item label="重试次数"><el-input-number v-model="form.retries" :min="0" :max="5" /></el-form-item>
          <el-form-item label="最大报文字节"><el-input-number v-model="form.maxMessageBytes" :min="512" :max="65535" /></el-form-item>
        </div>
      </section>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { getSyslogConfig, getSyslogStatus, saveSyslogConfig, testSyslogConfig } from '@/api/ops';
import type { SyslogConfig, SyslogStatus } from '@/api/ops/types';
import ServerForm from './SyslogServerForm.vue';

const defaults = (): SyslogConfig => ({
  enabled: false,
  serviceScopes: ['ALL'],
  eventTypes: ['LOGIN', 'OPERATION', 'HEALTH_ALERT'],
  primary: { host: '', port: 514, protocol: 'UDP' },
  format: 'RFC5424',
  facility: 'LOCAL0',
  minimumSeverity: 'INFO',
  appNamePrefix: 'liuzx',
  connectTimeoutMillis: 3000,
  writeTimeoutMillis: 5000,
  retries: 2,
  maxMessageBytes: 8192
});
const services = ['ALL', 'liuzx-admin', 'liuzx-auth', 'liuzx-ops', 'liuzx-ca', 'liuzx-ra', 'liuzx-kmc', 'liuzx-ocsp', 'liuzx-crypto'];
const form = reactive<SyslogConfig>(defaults());
const status = reactive<SyslogStatus>({ enabled: false, sentCount: 0, failedCount: 0 });
const formRef = ref<FormInstance>();
const loading = ref(false);
const saving = ref(false);
const testing = ref(false);
const secondaryEnabled = ref(false);
const testedSnapshot = ref('');
const rules: FormRules = {
  serviceScopes: [{ type: 'array', required: true, min: 1, message: '请选择服务范围' }],
  eventTypes: [{ type: 'array', required: true, min: 1, message: '请选择事件类型' }],
  'primary.host': [{ required: true, message: '请输入主服务器地址' }]
};
const fingerprint = () => JSON.stringify({ ...form, enabled: undefined, tested: undefined, lastTestTime: undefined });
watch(secondaryEnabled, (enabled) => {
  form.secondary = enabled ? form.secondary || { host: '', port: 514, protocol: 'UDP' } : undefined;
});
watch(
  form,
  () => {
    if (testedSnapshot.value && fingerprint() !== testedSnapshot.value) form.tested = false;
  },
  { deep: true }
);
const load = async () => {
  loading.value = true;
  try {
    const [configResponse, statusResponse] = await Promise.all([getSyslogConfig(), getSyslogStatus()]);
    Object.assign(form, defaults(), configResponse.data || {});
    Object.assign(status, statusResponse.data || {});
    secondaryEnabled.value = Boolean(form.secondary?.host);
    testedSnapshot.value = form.tested ? fingerprint() : '';
  } finally {
    loading.value = false;
  }
};
const validate = async () => {
  await formRef.value?.validate();
};
const test = async () => {
  await validate();
  testing.value = true;
  try {
    await testSyslogConfig(JSON.parse(JSON.stringify(form)));
    form.tested = true;
    form.lastTestTime = new Date().toISOString();
    testedSnapshot.value = fingerprint();
    ElMessage.success(form.primary.protocol === 'UDP' ? '测试消息已发送（UDP 无法确认接收）' : 'Syslog 测试发送成功');
    Object.assign(status, (await getSyslogStatus()).data || {});
  } finally {
    testing.value = false;
  }
};
const save = async () => {
  await validate();
  if (form.enabled && !form.tested) return ElMessage.warning('启用 Syslog 前必须发送测试消息');
  saving.value = true;
  try {
    await saveSyslogConfig(JSON.parse(JSON.stringify(form)));
    ElMessage.success('Syslog 配置已保存');
    await load();
  } finally {
    saving.value = false;
  }
};
const formatTime = (value?: string) => (value ? new Date(value).toLocaleString() : '-');
onMounted(load);
</script>

<style scoped lang="scss">
.pane-actions,
.switch-band,
.server-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.status {
  margin: 18px 0;
}
.band {
  padding: 22px 24px;
  border-top: 1px solid #e5e7eb;
  background: #fff;
}
.band h4 {
  margin: 0 0 18px;
}
.band p,
.hint {
  margin: 5px 0;
  color: #64748b;
  font-size: 13px;
}
.grid {
  display: grid;
  gap: 20px;
}
.two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.four {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
:deep(.el-select),
:deep(.el-input-number) {
  width: 100%;
}
@media (max-width: 900px) {
  .four {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 680px) {
  .two,
  .four {
    grid-template-columns: 1fr;
  }
  .pane-actions {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
