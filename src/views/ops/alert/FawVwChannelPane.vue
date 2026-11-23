<template>
  <el-card shadow="never">
    <template #header>
      <div class="channel-header">
        <strong>{{ isMail ? '企业邮件' : '企业钉钉' }}</strong>
        <el-tag v-if="loaded" :type="savedEnabled ? 'success' : 'info'">{{ savedEnabled ? '已启用' : '未启用' }}</el-tag>
      </div>
    </template>
    <el-alert v-if="loadFailed" title="无法读取渠道配置，请刷新后重试" type="error" :closable="false" show-icon />
    <el-form v-else v-loading="busy" :model="form" label-position="top" :disabled="!loaded || busy || !editable" @submit.prevent="save">
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
        <el-form-item label="正文类型">
          <el-select v-model="form.messageType">
            <template v-if="isMail">
              <el-option label="TEXT（纯文本）" value="TEXT" />
              <el-option label="MIXED（H5）" value="MIXED" />
            </template>
            <template v-else>
              <el-option label="Markdown" value="markdown" />
              <el-option label="text（纯文本）" value="text" />
            </template>
          </el-select>
        </el-form-item>
        <el-form-item label="启用通知">
          <el-switch v-model="form.enabled" :disabled="!gatewayConfigured && !form.enabled" />
          <span v-if="!gatewayConfigured" class="gateway-hint">启用前请保存共享凭据</span>
        </el-form-item>
      </div>
      <el-space v-if="editable" wrap>
        <el-button type="primary" native-type="submit" :loading="saving" :disabled="stale">保存配置</el-button>
        <el-button :disabled="!canTest" :loading="testing === 'test-connection'" @click="testChannel('test-connection')">测试连接</el-button>
        <el-button v-if="isMail" :disabled="!canTest || !gatewayConfigured" :loading="testing === 'test-send'" @click="testChannel('test-send')"
          >试发邮件</el-button
        >
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

const props = defineProps<{ kind: FawVwChannelKind; editable: boolean; gatewayConfigured: boolean }>();
const isMail = computed(() => props.kind === 'FAW_VW_EMAIL');

function emptyConfig(): FawVwChannelConfig {
  return {
    revision: null,
    enabled: false,
    from: null,
    to: '',
    app: isMail.value ? null : 'fawvw',
    dingTalkTarget: isMail.value ? null : 'ACCOUNT',
    smtpServer: null,
    messageType: isMail.value ? 'TEXT' : 'markdown'
  };
}

const form = reactive(emptyConfig());
const savedEnabled = ref(false);
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
  () => props.editable && loaded.value && !busy.value && !stale.value && !!form.revision && JSON.stringify(form) === savedConfig.value
);

function apply(settings: FawVwChannelSettings | null) {
  const data = settings ?? emptyConfig();
  Object.assign(form, {
    revision: data.revision,
    enabled: data.enabled,
    from: data.from,
    to: data.to,
    app: data.app,
    dingTalkTarget: data.dingTalkTarget,
    smtpServer: data.smtpServer,
    messageType: data.messageType ?? emptyConfig().messageType
  });
  savedEnabled.value = data.enabled;
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
  if (!props.editable || !loaded.value || busy.value || stale.value) return;
  if (!form.to || (isMail.value && !form.from)) {
    ElMessage.warning('请填写收件人和必填的邮件参数');
    return;
  }
  if (form.enabled && !props.gatewayConfigured) {
    ElMessage.warning('请先保存企业网关共享凭据');
    return;
  }
  saving.value = true;
  try {
    const result = await saveFawVwChannel(props.kind, {
      ...form,
      smtpServer: form.smtpServer || null
    });
    apply(result.settings);
    ElMessage.success('渠道配置已保存');
  } catch (error) {
    if ((error as { response?: { status?: number } })?.response?.status === 409) stale.value = true;
  } finally {
    saving.value = false;
  }
}

async function testChannel(action: 'test-connection' | 'test-send') {
  if (!canTest.value || !form.revision || (action === 'test-send' && !props.gatewayConfigured)) return;
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

.gateway-hint {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
}

.reload,
.test-result {
  margin-top: 12px;
}
</style>
