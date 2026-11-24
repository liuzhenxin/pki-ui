<template>
  <div class="ops-alert-page">
    <header class="workspace-header">
      <h1>告警中心</h1>
      <el-tag :type="notificationStatus === true ? 'success' : 'info'" effect="plain">
        {{ notificationStatus === undefined ? '自动通知状态未知' : notificationStatus ? '自动通知已开启' : '自动通知已关闭' }}
      </el-tag>
    </header>
    <nav class="workspace-shortcuts" aria-label="告警工作区">
      <button v-for="entry in workspaces" :key="entry.key" type="button" @click="openWorkspace(entry.key)">
        <strong>{{ entry.title }}</strong
        ><span>{{ entry.description }}</span>
      </button>
    </nav>
    <el-card shadow="never">
      <el-tabs v-model="group" :before-leave="guardTemplate">
        <el-tab-pane label="告警监控" name="monitor">
          <el-tabs v-model="monitorTab">
            <el-tab-pane label="告警记录" name="records">
              <template v-if="activeTab === 'records'">
                <div class="record-actions">
                  <el-radio-group v-model="incidentScope" aria-label="告警记录范围">
                    <el-radio-button value="current">当前告警</el-radio-button>
                    <el-radio-button value="history">告警历史</el-radio-button>
                  </el-radio-group>
                  <div>
                    <el-button @click="monitorTab = 'resources'">查看告警资源</el-button
                    ><el-button type="primary" plain @click="configure('rules')">管理通知规则</el-button>
                  </div>
                </div>
                <el-alert v-if="!incidentEnabled" title="告警实例功能未启用" type="info" :closable="false" />
                <template v-else>
                  <el-button :loading="loading" @click="loadIncidents">刷新</el-button>
                  <el-table :data="incidents" v-loading="loading">
                    <el-table-column prop="title" label="告警" min-width="180" />
                    <el-table-column prop="objectKey" label="对象" min-width="130" />
                    <el-table-column label="首次发生" min-width="170">
                      <template #default="{ row }">{{ dateTimeText(row.openedAt) }}</template>
                    </el-table-column>
                    <el-table-column label="状态" width="110">
                      <template #default="{ row }">{{ row.recoveredAt ? '已恢复' : row.acknowledgedAt ? '已确认' : '待确认' }}</template>
                    </el-table-column>
                    <el-table-column label="操作" width="90">
                      <template #default="{ row }"><el-button link type="primary" @click="openIncident(row.id)">详情</el-button></template>
                    </el-table-column>
                  </el-table>
                  <el-button :disabled="incidentOffset === 0 || loading" @click="changeIncidentPage(-50)">上一页</el-button>
                  <el-button :disabled="incidents.length < 50 || loading" @click="changeIncidentPage(50)">下一页</el-button>
                </template>
              </template>
            </el-tab-pane>
            <el-tab-pane label="告警资源" name="resources">
              <CpuResourcePane
                :initial-code="resourceCode"
                v-if="activeTab === 'resources'"
                @incident="openIncident"
                @conditions="configure('conditions')"
                @channels="configure('channels')"
                @rules="configureCpuRules"
              />
            </el-tab-pane>
          </el-tabs>
        </el-tab-pane>
        <el-tab-pane label="告警配置" name="config">
          <el-tabs v-model="configTab" :before-leave="guardTemplate">
            <el-tab-pane label="告警条件" name="conditions">
              <AlertConditionPane v-if="activeTab === 'conditions'" />
            </el-tab-pane>
            <el-tab-pane label="通知规则" name="rules">
              <IncidentTemplateRulePane
                v-if="activeTab === 'rules'"
                @custom="openCustomRule"
                :initial-resource="ruleResource"
                @conditions="configure('conditions')"
              />
              <el-collapse v-model="ruleSections">
                <el-collapse-item title="自定义服务事件" name="custom">
                  <div class="toolbar">
                    <el-select v-model="ruleServiceFilter" clearable placeholder="按服务过滤" style="width: 200px">
                      <el-option label="pki-crypto" value="pki-crypto" /><el-option label="pki-kmc" value="pki-kmc" />
                      <el-option label="pki-ca" value="pki-ca" /><el-option label="pki-ra" value="pki-ra" /><el-option
                        label="pki-ocsp"
                        value="pki-ocsp"
                      />
                    </el-select>
                    <el-button icon="Search" @click="loadRules">刷新</el-button>
                    <span class="hint">服务与事件码均可自定义（在各服务内定义并上报）。</span>
                  </div>
                  <el-table :data="rules" border v-loading="loading">
                    <el-table-column prop="serviceCode" label="服务" width="130" />
                    <el-table-column prop="eventCode" label="事件" min-width="150" />
                    <el-table-column prop="level" label="级别" width="90" />
                    <el-table-column prop="cooldownSeconds" label="冷却(秒)" width="110" />
                    <el-table-column label="启用" width="90" align="center">
                      <template #default="{ row }">
                        <el-switch v-model="row.enabled" @change="persistRule(row)" />
                      </template>
                    </el-table-column>
                    <el-table-column label="操作" width="160" fixed="right">
                      <template #default="{ row }">
                        <el-button link type="primary" @click="openRuleDialog(row)">编辑</el-button>
                        <el-button link type="danger" @click="handleDeleteRule(row)">删除</el-button>
                      </template>
                    </el-table-column>
                  </el-table>
                </el-collapse-item>
              </el-collapse>
            </el-tab-pane>

            <el-tab-pane label="通知渠道" name="channels">
              <el-tabs v-if="activeTab === 'channels'" v-model="channelTab">
                <el-tab-pane label="用户钉钉" name="user-dingtalk"><UserDingTalkChannelPane v-if="channelTab === 'user-dingtalk'" /></el-tab-pane>
                <el-tab-pane label="SMTP 邮件" name="mail"><MailChannelPane v-if="channelTab === 'mail'" /></el-tab-pane>
                <el-tab-pane label="企业网关（钉钉 / 邮件）" name="enterprise-gateway"
                  ><FawVwGatewayPane v-if="channelTab === 'enterprise-gateway'"
                /></el-tab-pane>
              </el-tabs>
            </el-tab-pane>
            <el-tab-pane label="通知模板" name="notification-templates"
              ><NotificationTemplatePane ref="templateEditor" v-if="activeTab === 'notification-templates'"
            /></el-tab-pane>
          </el-tabs>
        </el-tab-pane>
        <el-tab-pane label="服务事件日志" name="logs">
          <div class="toolbar">
            <el-button icon="Refresh" :loading="loading" @click="loadLogs">刷新</el-button>
            <el-input v-model.trim="logQuery" clearable aria-label="筛选服务事件" placeholder="筛选服务、事件或渠道 ID" style="max-width: 300px" />
            <span class="hint">最近 200 条服务事件</span>
          </div>
          <el-table :data="visibleLogs" border v-loading="loading" size="small">
            <el-table-column prop="createTime" label="时间" width="170" />
            <el-table-column prop="serviceCode" label="服务" width="120" />
            <el-table-column prop="eventCode" label="事件" width="170" />
            <el-table-column prop="level" label="级别" width="80" />
            <el-table-column prop="summary" label="摘要" min-width="200" show-overflow-tooltip />
            <el-table-column label="投递" width="90" align="center">
              <template #default="{ row }">
                <el-tag :type="row.delivered ? 'success' : 'info'" size="small">{{ row.delivered ? '已投递' : '未投递' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="channelId" label="渠道 ID" width="100" />
            <el-table-column label="投递结果" min-width="180" show-overflow-tooltip
              ><template #default="{ row }">{{ eventResult(row) }}</template></el-table-column
            >
            <el-table-column label="操作" width="120"
              ><template #default="{ row }"
                ><el-button link type="primary" @click="showServiceRules(row.serviceCode)">查看服务规则</el-button></template
              ></el-table-column
            >
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-drawer v-model="incidentVisible" title="告警详情" size="min(520px, 100vw)">
      <template v-if="incident">
        <h3>{{ incident.title }}</h3>
        <el-tag :type="incident.recoveredAt ? 'success' : 'warning'">{{ incident.recoveredAt ? '已恢复' : '告警中' }}</el-tag>
        <el-tag v-if="incident.acknowledgedAt" type="info">管理员已确认</el-tag>
        <p v-if="incident.reviewSample">
          最近队列采样 {{ dateTimeText(incident.reviewSample.sampledAt) }}
          <el-tag v-if="incident.reviewSample.stale" type="warning">采样已过期</el-tag>
        </p>
        <p>{{ incident.objectKey }} · {{ incident.occurrences }} 次异常观测</p>
        <el-button v-if="incident.source === 'SERVER_CPU'" link type="primary" @click="openResource(incident.objectKey)">查看告警资源</el-button>
        <el-button
          v-if="incident.source === 'SERVER_CPU'"
          link
          type="primary"
          @click="
            incidentVisible = false;
            configureCpuRules(incident.objectKey);
          "
          >查看资源通知规则</el-button
        >
        <el-timeline>
          <el-timeline-item :timestamp="dateTimeText(incident.openedAt)">首次发生</el-timeline-item>
          <el-timeline-item :timestamp="dateTimeText(incident.lastSeenAt)">最近异常</el-timeline-item>
          <el-timeline-item v-if="incident.acknowledgedAt" :timestamp="dateTimeText(incident.acknowledgedAt)">
            {{ incident.acknowledgedBy }} 已确认
          </el-timeline-item>
          <el-timeline-item v-if="incident.recoveredAt" :timestamp="dateTimeText(incident.recoveredAt)">已恢复</el-timeline-item>
        </el-timeline>
        <IncidentNotificationResults :results="incident.notificationResults" :recovered="Boolean(incident.recoveredAt)" />
        <el-button v-if="!incident.acknowledgedAt && !incident.recoveredAt" type="primary" :loading="acknowledging" @click="acknowledgeIncident">
          确认告警
        </el-button>
      </template>
    </el-drawer>

    <el-dialog v-model="ruleVisible" :title="ruleForm.id ? '编辑自定义服务事件' : '新建自定义服务事件'" width="520px">
      <el-form :model="ruleForm" label-width="100px">
        <el-form-item label="渠道" required>
          <el-select v-model="ruleForm.channelId" style="width: 100%">
            <el-option v-for="c in channels" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="服务" required><el-input v-model="ruleForm.serviceCode" placeholder="如 pki-crypto（自定义）" /></el-form-item>
        <el-form-item label="事件" required><el-input v-model="ruleForm.eventCode" placeholder="如 HSM_READY_DOWN（自定义）" /></el-form-item>
        <el-form-item label="级别">
          <el-select v-model="ruleForm.level" style="width: 100%">
            <el-option label="CRITICAL" value="CRITICAL" /><el-option label="WARN" value="WARN" /><el-option label="INFO" value="INFO" />
          </el-select>
        </el-form-item>
        <el-form-item label="冷却(秒)"><el-input-number v-model="ruleForm.cooldownSeconds" :min="10" :step="60" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="ruleForm.enabled" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ruleVisible = false">取消</el-button>
        <el-button type="primary" @click="saveRule">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="OpsAlertCenter" lang="ts">
import CpuResourcePane from './CpuResourcePane.vue';
import AlertConditionPane from './AlertConditionPane.vue';
import FawVwGatewayPane from './FawVwGatewayPane.vue';
import MailChannelPane from './MailChannelPane.vue';
import NotificationTemplatePane from './NotificationTemplatePane.vue';
import IncidentTemplateRulePane from './IncidentTemplateRulePane.vue';
import UserDingTalkChannelPane from './UserDingTalkChannelPane.vue';
import IncidentNotificationResults from './IncidentNotificationResults.vue';
import type { AlertIncident } from '@/api/ops';
import { dateTimeText } from '@/views/ops/utils';
import { getIncidentTemplateRules } from '@/api/ops/incidentTemplateRules';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  acknowledgeAlertIncident,
  getAlertIncident,
  getAlertIncidents,
  createAlertRule,
  deleteAlertRule,
  getAlertChannels,
  getAlertEventLogs,
  getAlertRules,
  updateAlertRule
} from '@/api/ops';
import type { AlertChannel, AlertEventLog, AlertRule, AlertRuleSave } from '@/api/ops/types';

const notificationStatus = ref<boolean>();
onMounted(async () => {
  try {
    notificationStatus.value = (await getIncidentTemplateRules()).notificationsEnabled;
  } catch {
    notificationStatus.value = undefined;
  }
});
const workspaces = [
  { key: 'records', title: '告警记录', description: '查看当前告警和恢复历史' },
  { key: 'resources', title: '告警资源', description: '查看主机采样和生效条件' },
  { key: 'rules', title: '通知规则', description: '配置通知渠道、接收人与模板' },
  { key: 'logs', title: '服务事件日志', description: '核对服务上报与投递结果' }
] as const;
const templateEditor = ref<InstanceType<typeof NotificationTemplatePane>>();
function guardTemplate() {
  return templateEditor.value?.allowLeave() ?? true;
}
async function openWorkspace(key: (typeof workspaces)[number]['key']) {
  if (!(await guardTemplate())) return;
  if (key === 'rules') return configure('rules');
  if (key === 'logs') {
    group.value = 'logs';
    return;
  }
  group.value = 'monitor';
  monitorTab.value = key;
}
const group = ref('monitor');
const monitorTab = ref('records');
const incidentScope = ref('current');
const configTab = ref('conditions');
const channelTab = ref('user-dingtalk');
const ruleResource = ref('');
const resourceCode = ref('');
function openResource(code: string) {
  resourceCode.value = code;
  incidentVisible.value = false;
  group.value = 'monitor';
  monitorTab.value = 'resources';
}
const activeTab = computed(() => (group.value === 'monitor' ? monitorTab.value : group.value === 'config' ? configTab.value : 'logs'));
function configure(tab: string) {
  configTab.value = tab;
  group.value = 'config';
}
function configureCpuRules(code: string) {
  ruleResource.value = code;
  configure('rules');
}
const route = useRoute();
const incidents = ref<AlertIncident[]>([]);
const incident = ref<AlertIncident>();
const incidentEnabled = ref(true);
const incidentVisible = ref(false);
const acknowledging = ref(false);
const incidentOffset = ref(0);
let incidentRequest = 0;
const loadIncidents = async () => {
  const request = ++incidentRequest;
  loading.value = true;
  try {
    const page = await getAlertIncidents(incidentScope.value === 'history', incidentOffset.value);
    if (request !== incidentRequest) return;
    incidents.value = page.items;
    incidentEnabled.value = page.enabled;
  } finally {
    if (request === incidentRequest) loading.value = false;
  }
};
const changeIncidentPage = (step: number) => {
  incidentOffset.value += step;
  return loadIncidents();
};
const openIncident = async (id: string) => {
  incident.value = await getAlertIncident(id);
  incidentVisible.value = true;
};
const acknowledgeIncident = async () => {
  if (!incident.value) return;
  acknowledging.value = true;
  try {
    await acknowledgeAlertIncident(incident.value.id);
    await openIncident(incident.value.id);
    await loadIncidents();
  } finally {
    acknowledging.value = false;
  }
};
watch(
  () => route.query.incident,
  (id) => {
    if (typeof id === 'string' && /^\d+$/.test(id)) void openIncident(id);
  },
  { immediate: true }
);
const loading = ref(false);
const channels = ref<AlertChannel[]>([]);
const rules = ref<AlertRule[]>([]);
const logs = ref<AlertEventLog[]>([]);
const logQuery = ref('');
const visibleLogs = computed(() =>
  logs.value.filter((row) =>
    [row.serviceCode, row.eventCode, row.channelId].some((value) =>
      String(value ?? '')
        .toLowerCase()
        .includes(logQuery.value.toLowerCase())
    )
  )
);
const eventReasons: Record<string, string> = {
  DELIVERED: '已投递',
  COOLDOWN: '冷却期内，已跳过',
  CHANNEL_DISABLED: '渠道已关闭',
  NOTIFICATIONS_DISABLED: '自动通知已关闭',
  NO_RULE_OR_DISABLED: '没有匹配的启用规则',
  DINGTALK_REJECTED: '钉钉网关拒绝投递'
};
function eventResult(row: AlertEventLog) {
  return eventReasons[row.channelResult ?? ''] || row.channelResult || '未记录';
}
function showServiceRules(service: string) {
  ruleSections.value = ['custom'];
  ruleServiceFilter.value = service;
  configure('rules');
}
const ruleServiceFilter = ref('');
const ruleVisible = ref(false);
const ruleSections = ref<string[]>([]);
const ruleForm = reactive<AlertRuleSave & { id?: number }>({
  id: undefined,
  channelId: undefined as unknown as number,
  serviceCode: '',
  eventCode: '',
  level: 'WARN',
  enabled: true,
  cooldownSeconds: 900
});

const loadRules = async () => {
  loading.value = true;
  try {
    rules.value = (await getAlertRules(ruleServiceFilter.value || undefined)) || [];
  } finally {
    loading.value = false;
  }
};
const loadLogs = async () => {
  loading.value = true;
  try {
    logs.value = (await getAlertEventLogs(200)) || [];
  } finally {
    loading.value = false;
  }
};

watch([activeTab, incidentScope], ([tab], [previous]) => {
  if (previous === 'resources' && tab !== 'resources') resourceCode.value = '';
  if (previous === 'rules' && tab !== 'rules') ruleResource.value = '';
  if (tab === 'rules') loadRules();
  else if (tab === 'logs') loadLogs();
  else if (tab === 'records') {
    incidentOffset.value = 0;
    loadIncidents();
  }
});
watch(ruleServiceFilter, () => loadRules());

const openRuleDialog = async (row?: AlertRule) => {
  channels.value = (await getAlertChannels()) || [];
  Object.assign(
    ruleForm,
    row
      ? {
          id: row.id,
          channelId: row.channelId,
          serviceCode: row.serviceCode,
          eventCode: row.eventCode,
          level: row.level,
          enabled: row.enabled,
          cooldownSeconds: row.cooldownSeconds
        }
      : { id: undefined, channelId: channels.value[0]?.id, serviceCode: '', eventCode: '', level: 'WARN', enabled: true, cooldownSeconds: 900 }
  );
  ruleVisible.value = true;
};
const openCustomRule = () => {
  ruleSections.value = ['custom'];
  void openRuleDialog();
};
const saveRule = async () => {
  if (!ruleForm.channelId || !ruleForm.serviceCode || !ruleForm.eventCode) return ElMessage.warning('请填写渠道/服务/事件');
  const payload: AlertRuleSave = {
    channelId: ruleForm.channelId,
    serviceCode: ruleForm.serviceCode,
    eventCode: ruleForm.eventCode,
    level: ruleForm.level,
    enabled: ruleForm.enabled,
    cooldownSeconds: ruleForm.cooldownSeconds
  };
  if (ruleForm.id) {
    await updateAlertRule(ruleForm.id, { enabled: payload.enabled, level: payload.level, cooldownSeconds: payload.cooldownSeconds });
  } else {
    await createAlertRule(payload);
  }
  ruleVisible.value = false;
  ElMessage.success('已保存');
  await loadRules();
};
const persistRule = async (row: AlertRule) => {
  if (!row.id) return;
  await updateAlertRule(row.id, { enabled: row.enabled, level: row.level, cooldownSeconds: row.cooldownSeconds });
  ElMessage.success('已更新');
};
const handleDeleteRule = async (row: AlertRule) => {
  await ElMessageBox.confirm(`确认删除规则 ${row.serviceCode}/${row.eventCode}？`, '提示', { type: 'warning' });
  if (row.id) await deleteAlertRule(row.id);
  await loadRules();
};

onMounted(loadIncidents);
</script>

<style scoped lang="scss">
.ops-alert-page {
  padding: 16px;
  background: var(--el-fill-color-light);
}
.workspace-header,
.record-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}
.workspace-header h1 {
  margin: 0;
  font-size: 24px;
  color: var(--el-text-color-primary);
}
.workspace-shortcuts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
  button {
    display: grid;
    gap: 5px;
    padding: 14px 18px;
    text-align: left;
    cursor: pointer;
    color: var(--el-text-color-primary);
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color);
    border-radius: 8px;
    &:hover,
    &:focus-visible {
      border-color: var(--el-color-primary);
    }
    strong {
      font-size: 16px;
    }
    span {
      color: var(--el-text-color-regular);
      font-size: 13px;
    }
  }
}
.channel-sections {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.hint {
  color: #909399;
  font-size: 12px;
}
</style>
