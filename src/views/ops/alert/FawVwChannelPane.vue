<template>
  <el-card shadow="never">
    <template #header>
      <div class="channel-header">
        <strong>{{ isMail ? '企业邮件' : '企业钉钉' }}</strong>
        <el-tag v-if="loaded" :type="savedEnabled ? 'success' : 'info'">{{ savedEnabled ? '已启用' : '未启用' }}</el-tag>
      </div>
    </template>
    <el-alert v-if="loadFailed" title="无法读取渠道配置，请刷新后重试" type="error" :closable="false" show-icon />
    <el-form v-else v-loading="busy" :model="form" label-position="top" :disabled="!loaded || busy" @submit.prevent="save">
      <el-form-item label="接口 URL" required>
        <el-input v-model.trim="form.endpointUrl" :maxlength="2048" placeholder="输入已获授权的完整网关接口地址" />
      </el-form-item>
      <div class="channel-fields">
        <template v-if="isMail">
          <el-form-item label="发件邮箱" required><el-input v-model.trim="form.from" :maxlength="254" /></el-form-item>
          <el-form-item label="收件邮箱" required>
            <el-input v-model.trim="form.to" :maxlength="254" placeholder="多个地址用英文逗号分隔" />
          </el-form-item>
          <el-form-item label="SMTP 节点">
            <el-select v-model="form.smtpServer" clearable placeholder="使用网关默认节点">
              <el-option label="长春（CC）" value="CC" />
              <el-option label="成都（CD）" value="CD" />
              <el-option label="佛山（FS）" value="FS" />
              <el-option label="天津（TJ）" value="TJ" />
              <el-option label="青岛（QD）" value="QD" />
            </el-select>
          </el-form-item>
          <el-form-item label="targets 编码" required>
            <el-select v-model="form.targetsFormat" placeholder="选择 UAT 确认的编码">
              <el-option label="JSON 数组" value="ARRAY" />
              <el-option label="JSON 数组字符串" value="JSON_ARRAY_STRING" />
              <el-option label="单个地址字符串" value="SINGLE_STRING" />
            </el-select>
          </el-form-item>
        </template>
        <template v-else>
          <el-form-item label="钉钉应用"><el-input v-model.trim="form.app" :maxlength="128" /></el-form-item>
          <el-form-item label="收件人类型">
            <el-select v-model="form.dingTalkTarget">
              <el-option label="域账号" value="ACCOUNT" />
              <el-option label="工号" value="JOB_ID" />
            </el-select>
          </el-form-item>
          <el-form-item label="钉钉收件人" required>
            <el-input v-model.trim="form.to" :maxlength="254" placeholder="多个账号或工号用英文逗号分隔" />
          </el-form-item>
        </template>
        <el-form-item label="Access Key" :required="!credentialsConfigured">
          <el-input
            v-model="accessKey"
            type="password"
            autocomplete="new-password"
            :maxlength="1024"
            :placeholder="credentialsConfigured ? '已配置，留空保留' : '请输入 Access Key'"
          />
        </el-form-item>
        <el-form-item label="Secret Key" :required="!credentialsConfigured">
          <el-input
            v-model="secretKey"
            type="password"
            autocomplete="new-password"
            :maxlength="1024"
            :placeholder="credentialsConfigured ? '已配置，留空保留' : '请输入 Secret Key'"
          />
        </el-form-item>
        <el-form-item label="启用通知"><el-switch v-model="form.enabled" /></el-form-item>
      </div>
      <el-space wrap>
        <el-button type="primary" native-type="submit" :loading="saving" :disabled="stale">保存配置</el-button>
        <el-button :disabled="!canTest" :loading="testing === 'test-connection'" @click="testChannel('test-connection')">测试连接</el-button>
        <el-button v-if="isMail" :disabled="!canTest" :loading="testing === 'test-send'" @click="testChannel('test-send')">试发邮件</el-button>
      </el-space>
      <el-alert v-if="testResult" class="test-result" :title="testResult" type="info" :closable="false" show-icon />
    </el-form>
    <el-button v-if="loadFailed || stale" class="reload" :disabled="busy" @click="load">刷新配置</el-button>
  </el-card>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getFawVwChannel, saveFawVwChannel, testFawVwChannel } from '@/api/ops';
import type { FawVwChannelConfig, FawVwChannelKind, FawVwChannelSettings } from '@/api/ops/types';

const props = defineProps<{ kind: FawVwChannelKind }>();
const isMail = computed(() => props.kind === 'FAW_VW_EMAIL');

function emptyConfig(): FawVwChannelConfig {
  return {
    revision: null,
    enabled: false,
    endpointUrl: '',
    from: null,
    to: '',
    app: isMail.value ? null : 'fawvw',
    dingTalkTarget: isMail.value ? null : 'ACCOUNT',
    smtpServer: null,
    targetsFormat: null
  };
}

const form = reactive(emptyConfig());
const accessKey = ref('');
const secretKey = ref('');
const savedEnabled = ref(false);
const credentialsConfigured = ref(false);
const loaded = ref(false);
const loading = ref(false);
const saving = ref(false);
const testing = ref<'test-connection' | 'test-send'>();
const testResult = ref('');
const savedConfig = ref('');
const loadFailed = ref(false);
const stale = ref(false);
const busy = computed(() => loading.value || saving.value || !!testing.value);
const canTest = computed(
  () =>
    loaded.value &&
    !busy.value &&
    !stale.value &&
    credentialsConfigured.value &&
    !!form.revision &&
    !accessKey.value &&
    !secretKey.value &&
    JSON.stringify(form) === savedConfig.value
);

function apply(settings: FawVwChannelSettings | null) {
  const { credentialsConfigured: configured, ...data } = settings ?? { ...emptyConfig(), credentialsConfigured: false };
  Object.assign(form, data);
  savedEnabled.value = data.enabled;
  credentialsConfigured.value = configured;
  accessKey.value = '';
  secretKey.value = '';
  stale.value = false;
  savedConfig.value = JSON.stringify(form);
  testResult.value = '';
}

async function load() {
  loading.value = true;
  loadFailed.value = false;
  try {
    const result = await getFawVwChannel(props.kind);
    apply(result.settings);
    loaded.value = true;
  } catch {
    loaded.value = false;
    loadFailed.value = true;
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!loaded.value || busy.value || stale.value) return;
  if (!form.endpointUrl || !form.to || (isMail.value && (!form.from || !form.targetsFormat))) {
    ElMessage.warning('请填写接口 URL、收件人和必填的邮件参数');
    return;
  }
  if (!credentialsConfigured.value && (!accessKey.value || !secretKey.value)) {
    ElMessage.warning('请填写 Access Key 和 Secret Key');
    return;
  }
  saving.value = true;
  try {
    const result = await saveFawVwChannel(props.kind, {
      settings: { ...form, smtpServer: form.smtpServer || null },
      accessKey: accessKey.value || undefined,
      secretKey: secretKey.value || undefined
    });
    apply(result.settings);
    ElMessage.success('渠道配置已保存');
  } catch (error) {
    // The shared request interceptor reports the backend message without logging the credentials.
    if ((error as { response?: { status?: number } })?.response?.status === 409) stale.value = true;
  } finally {
    saving.value = false;
  }
}

async function testChannel(action: 'test-connection' | 'test-send') {
  if (!canTest.value || !form.revision) return;
  const revision = form.revision;
  testing.value = action;
  testResult.value = '';
  try {
    if (action === 'test-send') {
      await ElMessageBox.confirm(`试发邮件将发送到 ${form.to}。`, '试发企业邮件', { type: 'warning', confirmButtonText: '发送' });
    }
    testResult.value = (await testFawVwChannel(props.kind, action, revision)).message;
  } catch (error) {
    if ((error as { response?: { status?: number } })?.response?.status === 409) stale.value = true;
  } finally {
    testing.value = undefined;
  }
}

onMounted(load);
</script>

<style scoped>
.channel-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.channel-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
  column-gap: 20px;
}

.reload,
.test-result {
  margin-top: 12px;
}
</style>
