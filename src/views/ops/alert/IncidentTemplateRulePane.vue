<template>
  <section v-loading="loading">
    <div class="rule-toolbar">
      <el-button type="primary" :disabled="loading" @click="open()">新建规则</el-button>
      <el-button v-if="loadFailed" @click="load">重新加载</el-button>
    </div>
    <el-alert v-if="loadFailed" title="告警投递规则加载失败" type="error" :closable="false" />
    <el-table v-else :data="view?.bindings.filter((binding) => binding.enabled !== false) ?? []" empty-text="暂无页面配置的告警投递规则">
      <el-table-column label="告警类型" min-width="145">
        <template #default="{ row }">{{ sourceLabel(row.source) }}</template>
      </el-table-column>
      <el-table-column label="投递渠道" prop="channel" min-width="130" />
      <el-table-column label="触发模板" min-width="125">
        <template #default="{ row }">{{ row.triggerChannel ? channelLabel(row.triggerChannel) : '沿用外部规则' }}</template>
      </el-table-column>
      <el-table-column label="恢复模板" min-width="125">
        <template #default="{ row }">
          {{ row.source === 'RA_CERT_EXPIRY' ? '—' : row.recoveryChannel ? channelLabel(row.recoveryChannel) : '沿用外部规则' }}
        </template>
      </el-table-column>
      <el-table-column v-if="view?.editable" label="操作" width="90">
        <template #default="{ row }"><el-button link type="primary" @click="open(row.source)">编辑</el-button></template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="visible" :title="editing ? '编辑规则' : '新建规则'" width="min(880px, 95vw)" :before-close="close">
      <div v-if="visible" class="rule-editor">
        <div class="rule-toolbar">
          <el-select
            v-model="source"
            aria-label="告警类型"
            placeholder="请选择告警类型"
            :disabled="busy || !view?.sources.length"
            @change="resetDrafts"
          >
            <el-option v-for="item in view?.sources" :key="item.source" :label="sourceLabel(item.source)" :value="item.source" />
          </el-select>
          <el-button v-if="!editing" :disabled="busy" @click="openCustom">自定义服务事件</el-button>
        </div>

        <template v-if="selection">
          <section aria-label="告警条件">
            <div class="section-heading">
              <strong>告警条件</strong>
              <el-button link type="primary" :disabled="busy" @click="openConditions">查看告警条件</el-button>
            </div>
            <p v-if="conditionsLoading">正在读取告警条件</p>
            <p v-else-if="conditionsFailed" role="status">暂时无法读取告警条件。</p>
            <el-table v-else :data="selectedConditions" :empty-text="conditionEmptyText">
              <el-table-column label="监控对象" min-width="130">
                <template #default="{ row }">{{ row.target || '类型默认' }}</template>
              </el-table-column>
              <el-table-column label="触发条件" min-width="190">
                <template #default="{ row }">{{ describeCondition(row, true) }}</template>
              </el-table-column>
              <el-table-column v-if="selection.recovery" label="恢复条件" min-width="165">
                <template #default="{ row }">{{ describeCondition(row, false) }}</template>
              </el-table-column>
            </el-table>
          </section>

          <section aria-label="投递渠道和模板">
            <div class="section-heading"><strong>投递渠道和模板</strong></div>
            <p>{{ source === 'RA_CERT_EXPIRY' ? '收件人使用 RA 上报的证书使用者。' : '收件人沿用所选渠道的配置。' }}</p>
            <el-alert v-if="stale" title="规则已由其他操作更新。重新加载会丢弃本窗口未保存的选择。" type="warning" :closable="false" />
            <el-button v-if="stale" :disabled="busy || loading" @click="reloadRules">重新加载规则</el-button>
            <el-empty v-if="!rows.length" description="暂无可用投递渠道" :image-size="64" />
            <fieldset v-if="rows.length" class="channel-picker" :disabled="busy || stale || !view?.editable">
              <legend>投递渠道（可多选）</legend>
              <label v-for="row in rows" :key="row.channel.name">
                <input type="checkbox" :checked="row.selected" @change="toggleChannel(row)" />
                {{ row.channel.name }} · {{ channelLabel(row.channel.channel) }}
              </label>
            </fieldset>
            <article v-for="row in selectedRows" :key="row.channel.name" class="channel-rule">
              <strong>{{ row.channel.name }} · {{ channelLabel(row.channel.channel) }}</strong>
              <p v-if="row.error" role="alert">{{ row.error }}</p>
              <p v-if="source !== 'RA_CERT_EXPIRY'">{{ recipientText(row) }}</p>
              <div class="template-controls">
                <label v-for="phase in phases" :key="phase">
                  <span>{{ phaseLabels[phase] }}</span>
                  <div class="template-choice">
                    <el-select
                      v-model="row[phase]"
                      :aria-label="`${row.channel.name} ${phaseLabels[phase]}`"
                      :disabled="busy || stale || !view?.editable"
                      @change="previewResult = undefined"
                    >
                      <el-option label="沿用外部规则" value="" />
                      <el-option v-for="kind in row.channel.templateChannels" :key="kind" :label="templateLabel(phase, kind)" :value="kind" />
                    </el-select>
                    <el-button :disabled="busy || !row[phase]" @click="preview(row, phase)">模拟预览</el-button>
                  </div>
                </label>
              </div>
            </article>
            <el-button v-if="view?.editable && rows.length" type="primary" :disabled="busy || stale || !rows.some(changed)" @click="save"
              >保存渠道配置</el-button
            >
            <p v-if="saveError" role="alert">{{ saveError }}</p>
            <div v-if="previewResult" class="rule-preview" aria-label="模拟预览结果" aria-live="polite">
              <strong>{{ previewResult.label }}</strong>
              <p>{{ previewResult.title }}</p>
              <p class="preview-body">{{ previewResult.body }}</p>
            </div>
          </section>
        </template>
      </div>
      <template #footer><el-button :disabled="busy" @click="visible = false">关闭</el-button></template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { getAlertConditions } from '@/api/ops';
import type { AlertConditionRule } from '@/api/ops/types';
import { getIncidentTemplateRules, saveIncidentChannels, type IncidentTemplateRules } from '@/api/ops/incidentTemplateRules';
import {
  getNotificationTemplate,
  getNotificationTemplateCatalog,
  previewNotificationTemplate,
  type NotificationTemplateCatalog,
  type NotificationTemplateDraft
} from '@/api/ops/notificationTemplates';
import { describeCondition } from './alertConditionText';

type Phase = 'trigger' | 'recovery';
type ChannelRow = {
  channel: IncidentTemplateRules['channels'][number];
  selected: boolean;
  trigger: string;
  recovery: string;
  error?: string;
};
const emit = defineEmits<{ custom: []; conditions: [] }>();
const phaseLabels: Record<Phase, string> = { trigger: '触发模板', recovery: '恢复模板' };
const sourceLabels: Record<string, string> = {
  SERVER_CPU: 'CPU 使用率',
  SERVER_MEMORY: '内存使用率',
  SERVER_DISK: '磁盘使用率',
  SERVER_AGENT: 'Agent 断报',
  COMPONENT: '组件健康',
  CA_HSM: 'CA 密码机',
  KMC_HSM: 'KMC 密码机',
  RA_STANDARD_REVIEW: 'RA 标准版审核积压',
  RA_PUBLIC_REVIEW: 'RA 公网证书审核积压',
  RA_CERT_EXPIRY: 'RA 证书到期'
};
const sourceLabel = (key: string) => sourceLabels[key] || key;

const catalog = ref<NotificationTemplateCatalog>();
const view = ref<IncidentTemplateRules>();
const rows = ref<ChannelRow[]>([]);
const selectedRows = computed(() => rows.value.filter((row) => row.selected));
const saveError = ref('');
const conditions = ref<AlertConditionRule[]>([]);
const source = ref('');
const visible = ref(false);
const editing = ref(false);
const loading = ref(false);
const loadFailed = ref(false);
const conditionsLoading = ref(false);
const conditionsFailed = ref(false);
const busy = ref(false);
const stale = ref(false);
const previewResult = ref<NotificationTemplateDraft & { label: string }>();

const selection = computed(() => view.value?.sources.find((item) => item.source === source.value));
const phases = computed<Phase[]>(() => (selection.value?.recovery ? ['trigger', 'recovery'] : ['trigger']));
const selectedConditions = computed(() => conditions.value.filter((item) => item.type === source.value));
const conditionEmptyText = computed(() =>
  source.value === 'RA_CERT_EXPIRY' ? '尚未配置 RA 到期条件，当前没有预警节点' : '尚未配置页面条件，具体阈值以部署设置为准'
);

const channelLabel = (code: string) => catalog.value?.channels.find((item) => item.value === code)?.label || code;
const bindingFor = (name: string) => view.value?.bindings.find((item) => item.source === source.value && item.channel === name);

function templateLabel(phase: Phase, kind: string) {
  const app = catalog.value?.applications.find((item) => item.value === selection.value?.application);
  const scene = app?.scenes.find((item) => item.value === selection.value?.[phase]);
  return `${scene?.label || selection.value?.[phase]} · ${channelLabel(kind)}`;
}

function changed(row: ChannelRow) {
  const binding = bindingFor(row.channel.name);
  return (
    row.selected !== originallySelected(row.channel) ||
    (row.selected && (row.trigger !== (binding?.triggerChannel ?? '') || row.recovery !== (binding?.recoveryChannel ?? '')))
  );
}

function originallySelected(channel: ChannelRow['channel']) {
  const binding = bindingFor(channel.name);
  if (binding) return binding.enabled !== false;
  return (
    channel.deployedSources?.includes(source.value) ??
    (source.value === 'SERVER_CPU' && Boolean(view.value?.cpuRoutes?.some((route) => route.channel === channel.name && route.deploymentTemplate)))
  );
}
function toggleChannel(row: ChannelRow) {
  row.selected = !row.selected;
  previewResult.value = undefined;
  if (row.selected && !originallySelected(row.channel) && !row.trigger && !row.recovery) {
    row.trigger = row.channel.channel;
    row.recovery = selection.value?.recovery ? row.channel.channel : '';
  }
}
function recipientText(row: ChannelRow) {
  if (row.channel.recipient) return `收件人：${row.channel.recipient}`;
  return row.channel.channel === 'DINGTALK' ? '收件群由机器人配置决定。' : '渠道未提供收件人，请核对渠道配置。';
}

function resetDrafts() {
  stale.value = false;
  saveError.value = '';
  previewResult.value = undefined;
  rows.value = (view.value?.channels ?? [])
    .filter((channel) => source.value !== 'RA_CERT_EXPIRY' || channel.channel !== 'DINGTALK')
    .map((channel) => {
      const binding = bindingFor(channel.name);
      return {
        channel,
        selected: originallySelected(channel),
        trigger: binding?.triggerChannel ?? '',
        recovery: selection.value?.recovery ? (binding?.recoveryChannel ?? '') : ''
      };
    });
}

async function load() {
  loading.value = true;
  loadFailed.value = false;
  try {
    const [rules, metadata] = await Promise.all([getIncidentTemplateRules(), getNotificationTemplateCatalog()]);
    if (!Array.isArray(rules.sources) || !Array.isArray(rules.bindings) || !Array.isArray(rules.channels)) throw new Error();
    view.value = rules;
    catalog.value = metadata;
    return true;
  } catch {
    loadFailed.value = true;
    return false;
  } finally {
    loading.value = false;
  }
}

async function reloadRules() {
  if (await load()) resetDrafts();
}

async function open(initialSource?: string) {
  editing.value = Boolean(initialSource);
  source.value = initialSource ?? view.value?.sources.find((item) => item.source === 'SERVER_CPU')?.source ?? view.value?.sources[0]?.source ?? '';
  resetDrafts();
  visible.value = true;
  if (!source.value) return;
  conditionsLoading.value = true;
  conditionsFailed.value = false;
  try {
    conditions.value = (await getAlertConditions()).settings.rules;
  } catch {
    conditions.value = [];
    conditionsFailed.value = true;
  } finally {
    conditionsLoading.value = false;
  }
}

function close(done: () => void) {
  if (!busy.value) done();
}

function openCustom() {
  visible.value = false;
  emit('custom');
}

function openConditions() {
  visible.value = false;
  emit('conditions');
}

async function save() {
  const current = view.value;
  const edits = rows.value.filter(changed);
  if (!current?.editable || busy.value || stale.value || !source.value || !edits.length) return;
  busy.value = true;
  saveError.value = '';
  try {
    const changes = Object.fromEntries(
      edits.map((row) => [
        row.channel.name,
        {
          enabled: row.selected,
          triggerChannel: row.trigger || null,
          recoveryChannel: row.recovery || null,
          revision: bindingFor(row.channel.name)?.revision ?? null
        }
      ])
    );
    const saved = await saveIncidentChannels(source.value, changes);
    const updated = new Set(saved.map((item) => item.channel));
    current.bindings = current.bindings.filter((item) => item.source !== source.value || !updated.has(item.channel)).concat(saved);
    resetDrafts();
    ElMessage.success('投递规则已保存');
  } catch (error) {
    stale.value = (error as { response?: { status?: number } })?.response?.status === 409;
    if (!stale.value) saveError.value = '保存失败，请重试。';
  } finally {
    busy.value = false;
  }
}

async function preview(row: ChannelRow, phase: Phase) {
  const current = selection.value;
  const scene = current?.[phase];
  if (!current || !scene || !row[phase] || busy.value) return;
  busy.value = true;
  previewResult.value = undefined;
  row.error = undefined;
  const key = { application: current.application, scene, channel: row[phase] };
  try {
    const { title, body } = await getNotificationTemplate(key);
    const rendered = await previewNotificationTemplate(key, { title, body });
    previewResult.value = { ...rendered, label: `${row.channel.name} · ${phaseLabels[phase]}` };
  } catch {
    row.error = '模拟预览失败，请重试。';
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.rule-toolbar,
.section-heading,
.template-choice {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rule-toolbar {
  margin-bottom: 12px;
}

.rule-editor,
.template-controls {
  display: grid;
  gap: 16px;
}

.template-controls {
  grid-template-columns: repeat(auto-fit, minmax(min(270px, 100%), 1fr));
  margin: 12px 0;
}

.template-choice {
  margin-top: 5px;
}

.channel-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  border: 0;
  padding: 8px 0;
  margin: 0;
}
.channel-rule,
.rule-preview {
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  margin: 12px 0;
  padding: 12px;
}

.preview-body {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
