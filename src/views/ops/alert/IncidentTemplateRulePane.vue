<template>
  <section v-loading="busy" class="incident-template-rules">
    <header class="binding-header">
      <h3>告警实例通知模板</h3>
      <el-button link type="primary" :disabled="busy" @click="load">重新加载</el-button>
    </header>
    <el-alert v-if="stale" title="规则已更新，请重新加载后再保存" type="warning" :closable="false" show-icon />
    <el-empty v-if="view && !view.channels.length" description="暂无已登记的告警实例投递渠道" :image-size="76" />
    <el-form v-if="view?.channels.length" label-position="top" @submit.prevent="save">
      <div class="binding-selectors">
        <el-form-item label="告警类型">
          <el-select v-model="source" :disabled="busy" @change="selectSource">
            <el-option v-for="item in view.sources" :key="item.source" :label="sourceLabels[item.source] || item.source" :value="item.source" />
          </el-select>
        </el-form-item>
        <el-form-item label="投递渠道">
          <el-select v-model="channel" :disabled="busy" @change="applyBinding">
            <el-option
              v-for="item in selectableChannels"
              :key="item.name"
              :label="`${item.name} · ${channelLabel(item.channel)}`"
              :value="item.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="触发模板">
          <el-select v-model="trigger" placeholder="沿用外部规则" :disabled="busy || !view.editable">
            <el-option label="沿用外部规则" value="" />
            <el-option v-for="kind in templateChoices" :key="kind" :label="templateLabel('trigger', kind)" :value="kind" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="selection?.recovery" label="恢复模板">
          <el-select v-model="recovery" placeholder="沿用外部规则" :disabled="busy || !view.editable">
            <el-option label="沿用外部规则" value="" />
            <el-option v-for="kind in templateChoices" :key="kind" :label="templateLabel('recovery', kind)" :value="kind" />
          </el-select>
        </el-form-item>
      </div>
      <el-button v-if="view.editable" type="primary" native-type="submit" :disabled="busy || stale || !changed">保存模板绑定</el-button>
    </el-form>
  </section>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { getIncidentTemplateRules, saveIncidentTemplateBinding, type IncidentTemplateRules } from '@/api/ops/incidentTemplateRules';
import { getNotificationTemplateCatalog, type NotificationTemplateCatalog } from '@/api/ops/notificationTemplates';

const sourceLabels: Record<string, string> = {
  SERVER_CPU: 'CPU 使用率',
  SERVER_MEMORY: '内存使用率',
  SERVER_DISK: '磁盘使用率',
  SERVER_AGENT: 'Agent 断报',
  COMPONENT: '组件健康',
  CA_HSM: 'CA 密码机',
  KMC_HSM: 'KMC 密码机',
  RA_CERT_EXPIRY: 'RA 证书有效期'
};

const catalog = ref<NotificationTemplateCatalog>();
const view = ref<IncidentTemplateRules>();
const source = ref('');
const channel = ref('');
const trigger = ref('');
const recovery = ref('');
const busy = ref(false);
const stale = ref(false);

const selection = computed(() => view.value?.sources.find((item) => item.source === source.value));
const selectableChannels = computed(() =>
  (view.value?.channels ?? []).filter((item) => source.value !== 'RA_CERT_EXPIRY' || item.channel !== 'DINGTALK')
);
const templateChoices = computed(() => selectableChannels.value.find((item) => item.name === channel.value)?.templateChannels || []);
const binding = computed(() => view.value?.bindings.find((item) => item.source === source.value && item.channel === channel.value));
const changed = computed(() => trigger.value !== (binding.value?.triggerChannel || '') || recovery.value !== (binding.value?.recoveryChannel || ''));

function channelLabel(code: string) {
  return catalog.value?.channels.find((item) => item.value === code)?.label || code;
}

function templateLabel(phase: 'trigger' | 'recovery', kind: string) {
  const app = catalog.value?.applications.find((item) => item.value === selection.value?.application);
  const scene = app?.scenes.find((item) => item.value === selection.value?.[phase]);
  return `${scene?.label || selection.value?.[phase]} · ${channelLabel(kind)}`;
}

function applyBinding() {
  stale.value = false;
  trigger.value = binding.value?.triggerChannel || '';
  recovery.value = binding.value?.recoveryChannel || '';
}

function selectSource() {
  if (!selectableChannels.value.some((item) => item.name === channel.value)) channel.value = selectableChannels.value[0]?.name || '';
  applyBinding();
}

async function load() {
  busy.value = true;
  try {
    const [rules, metadata] = await Promise.all([getIncidentTemplateRules(), getNotificationTemplateCatalog()]);
    view.value = rules;
    catalog.value = metadata;
    if (!rules.sources.some((item) => item.source === source.value)) source.value = rules.sources[0]?.source || '';
    selectSource();
  } catch {
    view.value = undefined;
  } finally {
    busy.value = false;
  }
}

async function save() {
  if (!view.value?.editable || busy.value || stale.value || !source.value || !channel.value || !changed.value) return;
  busy.value = true;
  try {
    const saved = await saveIncidentTemplateBinding(source.value, channel.value, {
      triggerChannel: trigger.value || null,
      recoveryChannel: recovery.value || null,
      revision: binding.value?.revision ?? null
    });
    const position = view.value.bindings.findIndex((item) => item.source === saved.source && item.channel === saved.channel);
    if (position < 0) view.value.bindings.push(saved);
    else view.value.bindings.splice(position, 1, saved);
    applyBinding();
    ElMessage.success('通知模板绑定已保存');
  } catch (error) {
    stale.value = (error as { response?: { status?: number } })?.response?.status === 409;
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.incident-template-rules {
  margin: 8px 0 20px;
  padding: 16px 0;
  border-bottom: 1px solid var(--el-border-color-light);
}

.binding-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.binding-header h3 {
  margin: 0;
}

.binding-selectors {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: 0 16px;
}
</style>
