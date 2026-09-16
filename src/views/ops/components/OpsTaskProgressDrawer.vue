<template>
  <el-drawer v-model="visible" :size="drawerSize" destroy-on-close :close-on-click-modal="!isRunning">
    <template #header>
      <div class="progress-title">
        <div>
          <span class="title-main">操作进度</span>
          <small>{{ operationTitle }}</small>
        </div>
        <el-tag :type="statusMeta.type" effect="light">{{ statusMeta.text }}</el-tag>
      </div>
    </template>

    <el-empty v-if="!operation" description="暂无操作任务" />
    <div v-else class="progress-drawer">
      <div class="status-card" :class="operation.status.toLowerCase()">
        <div class="status-head">
          <div>
            <div class="status-text">{{ statusMeta.summary }}</div>
            <div class="status-sub">当前步骤：{{ stepText(operation.currentStep) }}</div>
          </div>
          <el-progress type="dashboard" :percentage="progressPercent" :status="progressStatus" :width="86" />
        </div>
        <div class="meta-grid">
          <div>
            <span>操作编号</span>
            <b class="mono" :title="operation.operationNo">{{ operation.operationNo }}</b>
          </div>
          <div>
            <span>目标容器</span>
            <b>{{ operation.containerName || '-' }}</b>
          </div>
          <div>
            <span>服务器</span>
            <b>{{ operation.serverCode || '-' }}</b>
          </div>
          <div>
            <span>耗时</span>
            <b>{{ elapsedText }}</b>
          </div>
        </div>
      </div>

      <el-alert v-if="operation.errorMessage" class="error-alert" type="error" show-icon :closable="false">
        <template #title>操作失败：{{ stepText(operation.currentStep) }}</template>
        <div class="error-body">{{ operation.errorMessage }}</div>
      </el-alert>

      <div class="section-head">
        <span>步骤进度</span>
        <em>{{ completedCount }} / {{ normalizedSteps.length }}</em>
      </div>
      <el-timeline class="step-timeline">
        <el-timeline-item
          v-for="(step, index) in normalizedSteps"
          :key="`${step}-${index}`"
          :type="timelineType(index)"
          :hollow="index > activeIndex"
        >
          <div class="step-row">
            <b>{{ stepText(step) }}</b>
            <el-tag size="small" :type="stepStatus(index).type" effect="plain">{{ stepStatus(index).text }}</el-tag>
          </div>
        </el-timeline-item>
      </el-timeline>

      <div class="section-head">
        <span>处理建议</span>
      </div>
      <div class="tips">
        <template v-if="operation.status === 'FAILED'">
          <p>失败步骤：{{ stepText(operation.currentStep) }}</p>
          <p>建议查看容器日志、确认配置和镜像版本后重试。</p>
          <div class="quick-actions">
            <el-button v-if="canRetry" type="primary" plain @click="$emit('retry')">重试当前操作</el-button>
            <el-button v-if="canViewLogs" @click="$emit('open-logs')">查看完整日志</el-button>
            <el-button v-if="canViewDetail" @click="$emit('open-detail')">打开容器详情</el-button>
          </div>
        </template>
        <template v-else-if="isRunning">
          <p>任务正在后台执行，关闭抽屉不会中断操作。</p>
          <div class="quick-actions">
            <el-button v-if="canViewLogs" @click="$emit('open-logs')">查看完整日志</el-button>
            <el-button v-if="canViewDetail" @click="$emit('open-detail')">打开容器详情</el-button>
          </div>
        </template>
        <template v-else>
          <p>任务已结束，可关闭抽屉或刷新容器列表确认最新状态。</p>
          <div class="quick-actions">
            <el-button v-if="canViewLogs" @click="$emit('open-logs')">查看完整日志</el-button>
            <el-button v-if="canViewDetail" @click="$emit('open-detail')">打开容器详情</el-button>
          </div>
        </template>
      </div>

      <el-collapse v-model="activePanels">
        <el-collapse-item name="logs">
          <template #title>
            <div class="logs-title">
              <span>执行日志</span>
              <em>最近 {{ logs?.tail || 200 }} 行 · {{ dateTimeText(logs?.collectedAt) }}</em>
            </div>
          </template>
          <div class="logs-toolbar">
            <el-button v-if="canViewLogs" size="small" :loading="logsLoading" @click.stop="$emit('refresh-logs')">刷新日志</el-button>
            <el-button v-if="canViewLogs" size="small" :disabled="!logText" @click.stop="copyText(logText, '日志已复制')">复制日志</el-button>
          </div>
          <pre v-loading="logsLoading" class="logs-content">{{ logText || '暂无日志' }}</pre>
        </el-collapse-item>
      </el-collapse>
    </div>

    <template #footer>
      <div class="drawer-footer">
        <el-button v-if="operation?.operationNo" @click="copyText(operation.operationNo, '操作编号已复制')">复制编号</el-button>
        <el-button v-if="operation?.errorMessage" type="danger" plain @click="copyText(operation.errorMessage, '错误信息已复制')">复制错误</el-button>
        <el-button v-if="isRunning" type="primary" plain @click="$emit('refresh')">刷新进度</el-button>
        <el-button :disabled="isRunning" type="primary" @click="visible = false">关闭</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import type { OpsContainerLogs, OpsOperation } from '@/api/ops/types';
import { dateTimeText } from '@/views/ops/utils';

const props = defineProps<{
  modelValue: boolean;
  operation?: OpsOperation;
  steps?: string[];
  activeStep?: number;
  logs?: OpsContainerLogs;
  logsLoading?: boolean;
  canRetry?: boolean;
  canViewLogs?: boolean;
  canViewDetail?: boolean;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'refresh'): void;
  (e: 'refresh-logs'): void;
  (e: 'retry'): void;
  (e: 'open-logs'): void;
  (e: 'open-detail'): void;
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
});

const drawerSize = computed(() => (window.innerWidth < 768 ? '92%' : '560px'));
const normalizedSteps = computed(() => (props.steps?.length ? props.steps : ['排队', '预检', '执行', '健康验证', '完成']));
const isRunning = computed(() => ['PENDING', 'RUNNING'].includes(props.operation?.status || ''));
const activeIndex = computed(() => Math.max(0, Math.min((props.activeStep || 1) - 1, normalizedSteps.value.length - 1)));
const completedCount = computed(() => (props.operation?.status === 'SUCCESS' ? normalizedSteps.value.length : activeIndex.value));
const progressPercent = computed(() => Math.round((completedCount.value / Math.max(1, normalizedSteps.value.length)) * 100));
const progressStatus = computed(() =>
  props.operation?.status === 'SUCCESS' ? 'success' : props.operation?.status === 'FAILED' ? 'exception' : undefined
);
const activePanels = ref<string[]>([]);
const logText = computed(() => props.logs?.lines?.join('\n') || '');
const operationTitle = computed(() => {
  const operation = props.operation;
  return operation ? `${actionText(operation.operationType)} · ${operation.containerName}` : '等待任务';
});
const elapsedText = computed(() => {
  const operation = props.operation;
  if (!operation?.createdAt) return '-';
  const end = operation.finishedAt ? new Date(operation.finishedAt).getTime() : Date.now();
  const seconds = Math.max(0, Math.floor((end - new Date(operation.createdAt).getTime()) / 1000));
  const min = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const sec = (seconds % 60).toString().padStart(2, '0');
  return `${min}:${sec}`;
});
const statusMeta = computed(() => {
  switch (props.operation?.status) {
    case 'SUCCESS':
      return { text: '成功', summary: '操作已完成', type: 'success' as const };
    case 'FAILED':
      return { text: '失败', summary: '操作执行失败', type: 'danger' as const };
    case 'PENDING':
      return { text: '排队中', summary: '任务等待执行', type: 'warning' as const };
    case 'RUNNING':
      return { text: '执行中', summary: '任务正在执行', type: 'primary' as const };
    default:
      return { text: '未知', summary: '等待任务状态', type: 'info' as const };
  }
});

const actionText = (action?: string) => ({ START: '启动', STOP: '停止', RESTART: '重启', UPGRADE: '升级' })[action || ''] || action || '操作';
const stepText = (step?: string) =>
  ({ queued: '排队', precheck: '预检', executing: '执行中', completed: '完成', failed: '失败', 'executor-failed': '执行器失败' })[step || ''] ||
  step ||
  '-';
const timelineType = (index: number) => {
  if (props.operation?.status === 'FAILED' && index === activeIndex.value) return 'danger';
  if (index < activeIndex.value || props.operation?.status === 'SUCCESS') return 'success';
  if (index === activeIndex.value && isRunning.value) return 'primary';
  return 'info';
};
const stepStatus = (index: number) => {
  if (props.operation?.status === 'FAILED' && index === activeIndex.value) return { text: '失败', type: 'danger' as const };
  if (index < activeIndex.value || props.operation?.status === 'SUCCESS') return { text: '完成', type: 'success' as const };
  if (index === activeIndex.value && isRunning.value) return { text: '执行中', type: 'primary' as const };
  return { text: '等待', type: 'info' as const };
};
const copyText = async (text: string, message: string) => {
  await navigator.clipboard.writeText(text);
  ElMessage.success(message);
};

watch(
  () => props.operation?.status,
  (status) => {
    if (status === 'FAILED' && !activePanels.value.includes('logs')) {
      activePanels.value.push('logs');
    }
  },
  { immediate: true }
);
</script>

<style scoped lang="scss">
.progress-title,
.status-head,
.step-row,
.section-head,
.drawer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.progress-title {
  width: 100%;
  .title-main {
    display: block;
    color: #1d3557;
    font-weight: 700;
  }
  small {
    color: #7a8794;
  }
}
.progress-drawer {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.status-card {
  padding: 16px;
  border: 1px solid #e5eaf3;
  border-radius: 14px;
  background: linear-gradient(135deg, #f7fbff, #fff);
}
.status-text {
  color: #1d3557;
  font-size: 20px;
  font-weight: 800;
}
.status-sub {
  margin-top: 6px;
  color: #5f6d7a;
}
.meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
  div {
    padding: 10px;
    border-radius: 10px;
    background: rgb(69 123 157 / 7%);
  }
  span,
  b {
    display: block;
  }
  span {
    color: #7a8794;
    font-size: 12px;
  }
  b {
    overflow: hidden;
    margin-top: 4px;
    color: #1d3557;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.error-alert {
  :deep(.el-alert__description) {
    margin-top: 6px;
  }
}
.section-head {
  color: #1d3557;
  font-weight: 700;
  em {
    color: #7a8794;
    font-style: normal;
    font-weight: 400;
  }
}
.step-timeline {
  padding-left: 4px;
}
.step-row b {
  color: #1d3557;
}
.tips {
  padding: 12px;
  border-radius: 10px;
  background: #f7f9fc;
  color: #5f6d7a;
  p {
    margin: 4px 0;
  }
}
.quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
.logs-title {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-right: 12px;
  color: #1d3557;
  font-weight: 700;

  em {
    color: #7a8794;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
  }
}
.logs-toolbar {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 8px;
}
.logs-content {
  min-height: 180px;
  max-height: 320px;
  overflow: auto;
  margin: 0;
  padding: 12px;
  border-radius: 10px;
  background: #0f172a;
  color: #dbeafe;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
}
.drawer-footer {
  justify-content: flex-end;
}
@media (max-width: 768px) {
  .meta-grid {
    grid-template-columns: 1fr;
  }
}
</style>
