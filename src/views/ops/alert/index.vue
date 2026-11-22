<template>
  <div class="ops-alert-page">
    <el-card shadow="never">
      <el-tabs v-model="activeTab">
        <el-tab-pane v-for="tab in incidentTabs" :key="tab.name" :label="tab.label" :name="tab.name">
          <template v-if="activeTab === tab.name">
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
        <el-tab-pane label="证书到期" name="certificate-expiry">
          <RaCertificateExpiryPane v-if="activeTab === 'certificate-expiry'" />
        </el-tab-pane>
        <el-tab-pane label="通知渠道" name="channels">
          <div class="toolbar">
            <el-button type="primary" icon="Plus" @click="openChannelDialog()">新建渠道</el-button>
            <span class="hint">钉钉机器人配置；事件由各服务自定义后上报，OPS 统一投递。</span>
          </div>
          <el-table :data="channels" border v-loading="loading">
            <el-table-column prop="name" label="名称" min-width="140" />
            <el-table-column label="类型" width="110">
              <template #default="{ row }">{{ row.channelType || 'DINGTALK' }}</template>
            </el-table-column>
            <el-table-column label="启用" width="90" align="center">
              <template #default="{ row }">
                <el-switch v-model="row.enabled" @change="persistChannel(row)" />
              </template>
            </el-table-column>
            <el-table-column label="Token" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">{{ row.accessToken || '未配置' }}</template>
            </el-table-column>
            <el-table-column label="备注" prop="remark" min-width="160" />
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openChannelDialog(row)">编辑</el-button>
                <el-button link type="warning" :loading="testingId === row.id" @click="handleTest(row)">测试发送</el-button>
                <el-button link type="danger" @click="handleDeleteChannel(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="邮件渠道" name="mail">
          <MailChannelPane v-if="activeTab === 'mail'" />
        </el-tab-pane>

        <el-tab-pane label="FAW-VW 渠道" name="faw-vw">
          <el-space v-if="activeTab === 'faw-vw'" direction="vertical" alignment="stretch" fill style="width: 100%; max-width: 900px">
            <FawVwChannelPane kind="FAW_VW_DINGTALK" />
            <FawVwChannelPane kind="FAW_VW_EMAIL" />
          </el-space>
        </el-tab-pane>

        <el-tab-pane label="告警规则" name="rules">
          <div class="toolbar">
            <el-button type="primary" icon="Plus" @click="openRuleDialog()">新建规则</el-button>
            <el-select v-model="ruleServiceFilter" clearable placeholder="按服务过滤" style="width: 200px">
              <el-option label="pki-crypto" value="pki-crypto" /><el-option label="pki-kmc" value="pki-kmc" />
              <el-option label="pki-ca" value="pki-ca" /><el-option label="pki-ra" value="pki-ra" /><el-option label="pki-ocsp" value="pki-ocsp" />
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
        </el-tab-pane>

        <el-tab-pane label="事件日志" name="logs">
          <div class="toolbar">
            <el-button icon="Refresh" :loading="loading" @click="loadLogs">刷新</el-button>
            <span class="hint">最近 200 条上报与投递结果（DELIVERED/COOLDOWN/CHANNEL_DISABLED/失败原因）。</span>
          </div>
          <el-table :data="logs" border v-loading="loading" size="small">
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
            <el-table-column prop="channelResult" label="结果" min-width="180" show-overflow-tooltip />
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-drawer v-model="incidentVisible" title="告警详情" size="min(520px, 100vw)">
      <template v-if="incident">
        <h3>{{ incident.title }}</h3>
        <p>{{ incident.objectKey }} · {{ incident.occurrences }} 次异常观测</p>
        <el-timeline>
          <el-timeline-item :timestamp="dateTimeText(incident.openedAt)">首次发生</el-timeline-item>
          <el-timeline-item :timestamp="dateTimeText(incident.lastSeenAt)">最近异常</el-timeline-item>
          <el-timeline-item v-if="incident.acknowledgedAt" :timestamp="dateTimeText(incident.acknowledgedAt)">
            {{ incident.acknowledgedBy }} 已确认
          </el-timeline-item>
          <el-timeline-item v-if="incident.recoveredAt" :timestamp="dateTimeText(incident.recoveredAt)">已恢复</el-timeline-item>
        </el-timeline>
        <el-button v-if="!incident.acknowledgedAt && !incident.recoveredAt" type="primary" :loading="acknowledging" @click="acknowledgeIncident">
          确认告警
        </el-button>
      </template>
    </el-drawer>

    <el-dialog v-model="channelVisible" :title="channelForm.id ? '编辑渠道' : '新建渠道'" width="520px">
      <el-form :model="channelForm" label-width="90px">
        <el-form-item label="名称" required><el-input v-model="channelForm.name" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="channelForm.enabled" /></el-form-item>
        <el-form-item label="Access Token"
          ><el-input v-model="channelForm.accessToken" type="password" autocomplete="new-password" placeholder="编辑时留空保留原值"
        /></el-form-item>
        <el-form-item label="加签 Secret"
          ><el-input v-model="channelForm.secret" type="password" autocomplete="new-password" placeholder="编辑时留空保留原值"
        /></el-form-item>
        <el-form-item label="备注"><el-input v-model="channelForm.remark" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="channelVisible = false">取消</el-button>
        <el-button type="primary" @click="saveChannel">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="ruleVisible" :title="ruleForm.id ? '编辑规则' : '新建规则'" width="520px">
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
import FawVwChannelPane from './FawVwChannelPane.vue';
import RaCertificateExpiryPane from './RaCertificateExpiryPane.vue';
import MailChannelPane from './MailChannelPane.vue';
import type { AlertIncident } from '@/api/ops';
import { dateTimeText } from '@/views/ops/utils';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  acknowledgeAlertIncident,
  getAlertIncident,
  getAlertIncidents,
  createAlertChannel,
  createAlertRule,
  deleteAlertChannel,
  deleteAlertRule,
  getAlertChannels,
  getAlertEventLogs,
  getAlertRules,
  testAlertChannel,
  updateAlertChannel,
  updateAlertRule
} from '@/api/ops';
import type { AlertChannel, AlertChannelSave, AlertDispatchResult, AlertEventLog, AlertRule, AlertRuleSave } from '@/api/ops/types';

const incidentTabs = [
  { label: '当前告警', name: 'current' },
  { label: '告警历史', name: 'history' }
];
const activeTab = ref('current');
const route = useRoute();
const incidents = ref<AlertIncident[]>([]);
const incident = ref<AlertIncident>();
const incidentEnabled = ref(true);
const incidentVisible = ref(false);
const acknowledging = ref(false);
const incidentOffset = ref(0);
const loadIncidents = async () => {
  loading.value = true;
  try {
    const page = await getAlertIncidents(activeTab.value === 'history', incidentOffset.value);
    incidents.value = page.items;
    incidentEnabled.value = page.enabled;
  } finally {
    loading.value = false;
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
const ruleServiceFilter = ref('');
const testingId = ref<number>();
const channelVisible = ref(false);
const ruleVisible = ref(false);
const channelForm = reactive<AlertChannelSave & { id?: number }>({ id: undefined, name: '', enabled: true, accessToken: '', secret: '', remark: '' });
const ruleForm = reactive<AlertRuleSave & { id?: number }>({
  id: undefined,
  channelId: undefined as unknown as number,
  serviceCode: '',
  eventCode: '',
  level: 'WARN',
  enabled: true,
  cooldownSeconds: 900
});

const loadChannels = async () => {
  loading.value = true;
  try {
    channels.value = (await getAlertChannels()) || [];
  } finally {
    loading.value = false;
  }
};
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

watch(activeTab, (tab) => {
  if (tab === 'channels') loadChannels();
  else if (tab === 'rules') loadRules();
  else if (tab === 'logs') loadLogs();
  else if (tab === 'current' || tab === 'history') {
    incidentOffset.value = 0;
    loadIncidents();
  }
});
watch(ruleServiceFilter, () => loadRules());

const openChannelDialog = (row?: AlertChannel) => {
  Object.assign(
    channelForm,
    row
      ? { id: row.id, name: row.name, enabled: row.enabled, accessToken: '', secret: '', remark: row.remark || '' }
      : { id: undefined, name: '', enabled: true, accessToken: '', secret: '', remark: '' }
  );
  channelVisible.value = true;
};
const saveChannel = async () => {
  if (!channelForm.name) return ElMessage.warning('请填写名称');
  const payload: AlertChannelSave = {
    name: channelForm.name,
    enabled: channelForm.enabled,
    accessToken: channelForm.accessToken,
    secret: channelForm.secret,
    remark: channelForm.remark
  };
  if (channelForm.id) await updateAlertChannel(channelForm.id, payload);
  else await createAlertChannel(payload);
  channelVisible.value = false;
  ElMessage.success('已保存');
  await loadChannels();
};
const persistChannel = async (row: AlertChannel) => {
  if (!row.id) return;
  await updateAlertChannel(row.id, {
    name: row.name,
    enabled: row.enabled,
    remark: row.remark || ''
  });
  ElMessage.success('已更新');
};
const handleTest = async (row: AlertChannel) => {
  if (!row.id) return;
  testingId.value = row.id;
  try {
    const result: AlertDispatchResult = await testAlertChannel(row.id);
    result.delivered ? ElMessage.success(`测试发送成功：${result.channelResult}`) : ElMessage.error(`测试发送失败：${result.channelResult}`);
  } finally {
    testingId.value = undefined;
  }
};
const handleDeleteChannel = async (row: AlertChannel) => {
  await ElMessageBox.confirm(`确认删除渠道 ${row.name}？`, '提示', { type: 'warning' });
  if (row.id) await deleteAlertChannel(row.id);
  await loadChannels();
};

const openRuleDialog = (row?: AlertRule) => {
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
  padding: 12px;
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
