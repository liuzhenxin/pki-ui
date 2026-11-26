<template>
  <div v-loading="loading">
    <div class="condition-toolbar">
      <el-button v-if="view?.editable" type="primary" :disabled="stale || saving" @click="openRule()">新增条件</el-button>
      <el-button :disabled="saving" @click="load">刷新</el-button>
      <span>优先使用对象覆盖，其次使用类型默认条件。</span>
    </div>
    <el-alert v-if="failed" title="告警条件加载失败，请刷新重试" type="error" :closable="false" show-icon />
    <el-alert v-if="stale" title="告警条件已更新，请刷新后重新编辑" type="warning" :closable="false" show-icon />
    <el-table v-if="!failed" :data="view?.settings.rules ?? []" empty-text="尚未配置页面条件，沿用部署设置">
      <el-table-column label="类型" min-width="125">
        <template #default="{ row }">{{ labels[row.type as AlertConditionType] }}</template>
      </el-table-column>
      <el-table-column label="监控对象" min-width="155" show-overflow-tooltip>
        <template #default="{ row }">{{ row.target || '类型默认' }}</template>
      </el-table-column>
      <el-table-column label="触发条件" min-width="175">
        <template #default="{ row }">{{ describe(row, true) }}</template>
      </el-table-column>
      <el-table-column label="恢复条件" min-width="175">
        <template #default="{ row }">{{ describe(row, false) }}</template>
      </el-table-column>
      <el-table-column v-if="view?.editable" label="操作" width="130">
        <template #default="{ row, $index }">
          <el-button link type="primary" :disabled="saving || stale" @click="openRule(row, $index)">编辑</el-button>
          <el-button link type="danger" :disabled="saving || stale" @click="removeRule($index)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="visible" :title="editing === undefined ? '新增告警条件' : '编辑告警条件'" width="min(540px, 95vw)">
      <el-form v-if="visible" label-width="132px" :disabled="saving">
        <el-form-item label="监控类型" required>
          <el-select v-model="form.type" :disabled="editing !== undefined" @change="selectType">
            <el-option v-for="(label, key) in labels" :key="key" :label="label" :value="key" />
          </el-select>
        </el-form-item>
        <el-form-item label="生效范围" required>
          <el-radio-group v-model="scope" :disabled="editing !== undefined">
            <el-radio-button value="default">类型默认</el-radio-button>
            <el-radio-button value="target">对象覆盖</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <template v-if="scope === 'target'">
          <el-form-item v-if="isResource" label="服务器" required>
            <el-select v-model="server" filterable :disabled="editing !== undefined">
              <el-option v-for="code in view?.servers" :key="code" :label="code" :value="code" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="form.type === 'SERVER_DISK'" label="挂载点" required>
            <el-input v-model.trim="mount" placeholder="/data" :disabled="editing !== undefined" />
          </el-form-item>
          <el-form-item v-if="isState() || form.type === 'RA_CERT_EXPIRY'" label="告警对象标识" required>
            <el-input
              v-model.trim="form.target"
              :placeholder="form.type.startsWith('RA_') ? 'RA 上报来源 ID' : form.type === 'COMPONENT' ? '组件标识' : '实例ID/连接ID'"
              :disabled="editing !== undefined"
            />
          </el-form-item>
        </template>
        <template v-if="isThreshold()">
          <el-form-item label="触发阈值（%）" required><el-input-number v-model="form.triggerPercent" :min="0" :max="100" /></el-form-item>
          <el-form-item label="持续时间（秒）" required><el-input-number v-model="form.triggerSeconds" :min="0" :max="86400" /></el-form-item>
          <el-form-item label="恢复阈值（%）" required><el-input-number v-model="form.recoveryPercent" :min="0" :max="100" /></el-form-item>
          <el-form-item label="恢复持续（秒）" required><el-input-number v-model="form.recoverySeconds" :min="0" :max="86400" /></el-form-item>
        </template>
        <el-form-item v-else-if="form.type === 'SERVER_AGENT'" label="断报时间（秒）" required>
          <el-input-number v-model="form.timeoutSeconds" :min="1" :max="86400" />
        </el-form-item>
        <el-form-item v-else-if="form.type === 'RA_CERT_EXPIRY'" label="到期节点（天）" required>
          <el-input v-model="expiryDaysText" placeholder="例如 30, 7, 1, 0（0 表示已到期）" />
        </el-form-item>
        <template v-else>
          <template v-if="form.type === 'RA_STANDARD_REVIEW' || form.type === 'RA_PUBLIC_REVIEW'">
            <el-form-item label="待审数量（件）"><el-input-number v-model="form.pendingLimit" :min="1" /></el-form-item>
            <el-form-item label="最长等待（小时）"><el-input-number v-model="form.waitHours" :min="1" :max="87600" /></el-form-item>
          </template>
          <el-form-item label="触发连续次数" required><el-input-number v-model="form.triggerSamples" :min="1" :max="100" /></el-form-item>
          <el-form-item label="恢复连续次数" required><el-input-number v-model="form.recoverySamples" :min="1" :max="100" /></el-form-item>
          <el-form-item label="采样超时（秒）" required><el-input-number v-model="form.timeoutSeconds" :min="1" :max="86400" /></el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button :disabled="saving" @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveRule">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { describeCondition as describe, isStateCondition, isThresholdCondition } from './alertConditionText';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getAlertConditions, saveAlertConditions } from '@/api/ops';
import type { AlertConditionRule, AlertConditionType, AlertConditionView } from '@/api/ops/types';

const labels: Record<AlertConditionType, string> = {
  SERVER_CPU: 'CPU',
  SERVER_MEMORY: '内存',
  SERVER_DISK: '磁盘',
  SERVER_AGENT: 'Agent 断报',
  COMPONENT: '服务或容器',
  KMC_HSM: 'KMC 密码机',
  CA_HSM: 'CA 密码机',
  RA_STANDARD_REVIEW: 'RA 标准版审核积压',
  RA_PUBLIC_REVIEW: 'RA 公网证书审核积压',
  RA_CERT_EXPIRY: 'RA 证书有效期'
};

const presets: Record<AlertConditionType, Omit<AlertConditionRule, 'type' | 'target'>> = {
  SERVER_CPU: { triggerPercent: 85, recoveryPercent: 70, triggerSeconds: 300, recoverySeconds: 300 },
  SERVER_MEMORY: { triggerPercent: 90, recoveryPercent: 80, triggerSeconds: 300, recoverySeconds: 300 },
  SERVER_DISK: { triggerPercent: 85, recoveryPercent: 80, triggerSeconds: 300, recoverySeconds: 300 },
  SERVER_AGENT: { timeoutSeconds: 30 },
  COMPONENT: { triggerSamples: 2, recoverySamples: 2, timeoutSeconds: 90 },
  KMC_HSM: { triggerSamples: 2, recoverySamples: 2, timeoutSeconds: 90 },
  CA_HSM: { triggerSamples: 2, recoverySamples: 2, timeoutSeconds: 90 },
  RA_STANDARD_REVIEW: { pendingLimit: 10, waitHours: 24, triggerSamples: 2, recoverySamples: 2, timeoutSeconds: 600 },
  RA_PUBLIC_REVIEW: { pendingLimit: 10, waitHours: 24, triggerSamples: 2, recoverySamples: 2, timeoutSeconds: 600 },
  RA_CERT_EXPIRY: { expiryDays: [30, 7, 1, 0] }
};

const view = ref<AlertConditionView>();
const loading = ref(false);
const saving = ref(false);
const failed = ref(false);
const stale = ref(false);
const visible = ref(false);
const editing = ref<number>();
const server = ref('');
const mount = ref('');
const expiryDaysText = ref('');
const scope = ref<'default' | 'target'>('default');
const form = ref<AlertConditionRule>({ type: 'SERVER_CPU', target: '', ...presets.SERVER_CPU });

const isThreshold = (type = form.value.type) => isThresholdCondition(type);
const isState = (type = form.value.type) => isStateCondition(type);
const isResource = computed(() => !isState() && form.value.type !== 'RA_CERT_EXPIRY');

const load = async () => {
  loading.value = true;
  failed.value = false;
  try {
    view.value = await getAlertConditions();
    stale.value = false;
  } catch {
    failed.value = true;
    view.value = undefined;
  } finally {
    loading.value = false;
  }
};

const selectType = (type: AlertConditionType) => {
  form.value = { type, target: '', ...presets[type] };
  server.value = '';
  mount.value = '';
  expiryDaysText.value = form.value.expiryDays?.join(', ') ?? '';
};

const openRule = (rule?: AlertConditionRule, index?: number) => {
  editing.value = index;
  scope.value = rule?.target ? 'target' : 'default';
  selectType(rule?.type ?? 'SERVER_CPU');
  if (rule) {
    form.value = { ...rule };
    expiryDaysText.value = rule.expiryDays?.join(', ') ?? '';
    if (isResource.value) {
      const colon = rule.target.indexOf(':');
      server.value = colon < 0 ? rule.target : rule.target.slice(0, colon);
      mount.value = colon < 0 ? '' : rule.target.slice(colon + 1);
    }
  }
  visible.value = true;
};

const persist = async (rules: AlertConditionRule[]) => {
  if (!view.value?.editable || stale.value || loading.value || saving.value) return false;
  saving.value = true;
  try {
    view.value.settings = await saveAlertConditions({ revision: view.value.settings.revision, rules });
    ElMessage.success('告警条件已保存');
    return true;
  } catch (error) {
    if ((error as { response?: { status?: number } })?.response?.status === 409) {
      stale.value = true;
      visible.value = false;
    }
    return false;
  } finally {
    saving.value = false;
  }
};

const saveRule = async () => {
  if (!view.value) return;
  const rule = { ...form.value };
  if (scope.value === 'default') {
    rule.target = '';
  } else if (isResource.value) {
    if (!server.value || (rule.type === 'SERVER_DISK' && !mount.value.startsWith('/'))) {
      ElMessage.warning('请选择服务器并填写适用的挂载点');
      return;
    }
    rule.target = rule.type === 'SERVER_DISK' ? `${server.value}:${mount.value}` : server.value;
  } else if (!rule.target) {
    ElMessage.warning('请输入告警对象标识');
    return;
  }
  if (isThreshold() && (rule.recoveryPercent ?? 100) >= (rule.triggerPercent ?? 0)) {
    ElMessage.warning('恢复阈值应低于触发阈值');
    return;
  }
  if (rule.type === 'RA_CERT_EXPIRY') {
    const parts = expiryDaysText.value.split(/[,，]/).map((value) => value.trim());
    const days = parts.map(Number);
    if (parts.some((value) => !/^\d+$/.test(value)) || days.length > 16 || days.some((day) => day > 3650) || new Set(days).size !== days.length) {
      ElMessage.warning('请输入 0 至 3650 天的不同节点，最多 16 个');
      return;
    }
    rule.expiryDays = days;
  }
  const rules = [...view.value.settings.rules];
  if (rules.some((existing, index) => index !== editing.value && existing.type === rule.type && existing.target === rule.target)) {
    ElMessage.warning('该类型和监控对象已有条件');
    return;
  }
  if (editing.value === undefined) {
    rules.push(rule);
  } else {
    rules[editing.value] = rule;
  }
  if (await persist(rules)) visible.value = false;
};

const removeRule = async (index: number) => {
  const snapshot = view.value?.settings;
  if (!snapshot) return;
  try {
    await ElMessageBox.confirm('删除该条件后将沿用下一层适用条件。', '删除告警条件', { type: 'warning' });
  } catch {
    return;
  }
  if (view.value?.settings === snapshot) await persist(snapshot.rules.filter((_, position) => position !== index));
};

onMounted(load);
</script>

<style scoped>
.condition-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
</style>
