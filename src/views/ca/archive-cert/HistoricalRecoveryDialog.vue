<template>
  <el-dialog
    v-model="visible"
    title="归档证书密钥恢复"
    width="min(640px, 95vw)"
    append-to-body
    :show-close="!busy"
    :close-on-click-modal="false"
    :close-on-press-escape="!busy"
  >
    <el-descriptions :column="1" border size="small" class="recovery-summary">
      <el-descriptions-item label="证书">{{ certificate.subject || certificate.serialNumber || certificate.id }}</el-descriptions-item>
      <template v-if="task">
        <el-descriptions-item label="状态">{{ statusLabels[task.status] || task.status }}</el-descriptions-item>
        <el-descriptions-item label="任务编号"
          ><code>{{ task.recoveryId }}</code></el-descriptions-item
        >
        <el-descriptions-item v-if="task.confirmBy && pendingConfirmation" label="确认截止">
          {{ formatDeadline(task.confirmBy) }}
        </el-descriptions-item>
        <el-descriptions-item v-if="task.reasonCode" label="结果说明">{{ reasonLabel(task.reasonCode) }}</el-descriptions-item>
      </template>
    </el-descriptions>

    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="recovery-notice" />
    <el-alert
      v-if="task?.deviceStateUncertain"
      title="设备导入状态待核实，请先检查目标设备再发起新的申请"
      type="warning"
      :closable="false"
      show-icon
      class="recovery-notice"
    />

    <el-form v-if="!task" label-position="top" :disabled="busy || !!attempt" @submit.prevent="submit">
      <el-form-item label="授权依据" required>
        <el-input v-model.trim="authorizationRef" aria-label="授权依据" :maxlength="128" />
      </el-form-item>
      <el-form-item label="恢复原因" required>
        <el-input v-model.trim="reason" aria-label="恢复原因" type="textarea" :maxlength="512" />
      </el-form-item>
      <el-form-item label="设备绑定文件" required>
        <input accept=".json,application/json" aria-label="设备绑定文件" type="file" :disabled="busy || !!attempt" @change="loadDeviceFile" />
        <small class="recovery-hint">选择设备客户端导出的 JSON，包含 wrappingCsrBase64 和 deviceBinding。</small>
      </el-form-item>
      <el-descriptions v-if="deviceFile" :column="1" border size="small">
        <el-descriptions-item label="工单号">{{ deviceFile.deviceBinding.payload.ticketNo }}</el-descriptions-item>
        <el-descriptions-item label="接收方">{{ deviceFile.deviceBinding.payload.recipientId }}</el-descriptions-item>
        <el-descriptions-item label="目标设备">{{ deviceFile.deviceBinding.payload.deviceId }}</el-descriptions-item>
      </el-descriptions>
    </el-form>

    <template v-if="pendingConfirmation">
      <p>在目标设备客户端使用任务编号领取并导入，完成后上传设备签名回执。</p>
      <input accept=".json,application/json" aria-label="设备签名回执" type="file" :disabled="busy" @change="loadReceipt" />
      <p v-if="receipt" role="status">已读取设备回执，等待确认。</p>
    </template>

    <template #footer>
      <el-button :disabled="busy" @click="visible = false">关闭</el-button>
      <el-button v-if="!task" type="primary" :disabled="!canSubmit" :loading="busy" @click="submit">
        {{ attempt ? '重试申请' : '提交申请' }}
      </el-button>
      <el-button v-else :disabled="busy" @click="refresh">刷新状态</el-button>
      <el-button v-if="pendingConfirmation" type="primary" :disabled="!receipt || busy" @click="confirm">确认导入</el-button>
      <el-button v-if="terminal && !task?.deviceStateUncertain" :disabled="busy" @click="reset">新建申请</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';
import { isAxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import {
  confirmHistoricalRecovery,
  getHistoricalRecovery,
  submitArchiveRecovery,
  type ArchiveRecoveryRequest,
  type HistoricalRecoveryTask,
  type RecoveryConfirmation,
  type RecoveryDeviceFile
} from '@/api/ca/historicalRecovery';

const visible = defineModel<boolean>({ required: true });
const props = defineProps<{ certificate: { id: string; serialNumber?: string; subject?: string } }>();

const statusLabels: Record<HistoricalRecoveryTask['status'], string> = {
  QUEUED: '排队中',
  EXECUTING: '处理中',
  PENDING_CONFIRMATION: '等待设备导入',
  SUCCEEDED: '恢复成功',
  FAILED: '恢复失败',
  EXPIRED: '任务已过期',
  CANCELLED: '任务已取消'
};
const reasonLabels: Record<string, string> = {
  RECOVERY_INVALID_REQUEST: '恢复申请格式无效',
  RECOVERY_INVALID_CSR: '设备封装 CSR 无效',
  RECOVERY_AUTHENTICATION_FAILED: '登录状态或设备身份校验失败',
  RECOVERY_PERMISSION_DENIED: '没有历史密钥恢复权限',
  RECOVERY_NOT_ACCESSIBLE: '证书或恢复任务不可访问',
  RECOVERY_ALGORITHM_NOT_SUPPORTED: '历史恢复仅支持 RSA-2048 或 RSA-4096',
  RECOVERY_KEY_INELIGIBLE: '该证书或密钥不符合历史恢复条件',
  RECOVERY_DEVICE_BINDING_MISMATCH: '设备绑定证明与申请不匹配',
  RECOVERY_RECEIPT_INVALID: '设备回执校验失败',
  RECOVERY_IDEMPOTENCY_CONFLICT: '申请编号已对应另一份申请，请核对任务',
  RECOVERY_TEMPORARILY_UNAVAILABLE: '历史密钥恢复服务暂不可用',
  SKF_IMPORT_FAILED: '设备导入失败',
  CERT_PAIR_MISMATCH: '设备中的密钥与原证书不匹配',
  CHALLENGE_FAILED: '设备挑战校验失败'
};

const authorizationRef = ref('');
const reason = ref('');
const deviceFile = shallowRef<RecoveryDeviceFile>();
const receipt = shallowRef<RecoveryConfirmation>();
const attempt = shallowRef<ArchiveRecoveryRequest>();
const targetDeviceId = ref('');
const task = shallowRef<HistoricalRecoveryTask>();
const busy = ref(false);
const error = ref('');
const pendingConfirmation = computed(() => task.value?.status === 'PENDING_CONFIRMATION');
const terminal = computed(() => task.value && ['SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED'].includes(task.value.status));
const canSubmit = computed(() => !busy.value && !!(attempt.value || (deviceFile.value && authorizationRef.value && reason.value)));

function reasonLabel(code: string) {
  return reasonLabels[code] || code;
}

function formatDeadline(value: string) {
  return new Date(value).toLocaleString('zh-CN');
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasFields(value: unknown, fields: readonly string[]): value is Record<string, unknown> {
  return object(value) && Object.keys(value).length === fields.length && fields.every((field) => Object.hasOwn(value, field));
}

function base64(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength && value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function signedPayload(value: unknown, fields: readonly string[]) {
  if (!hasFields(value, ['payload', 'signatureBase64']) || !base64(value.signatureBase64, 1368) || !hasFields(value.payload, fields)) {
    return false;
  }
  return Object.values(value.payload).every((field) => typeof field === 'string' && field.trim().length > 0);
}

const bindingFields = ['bindingId', 'issuedAt', 'clientCertSha256', 'deviceId', 'recipientId', 'ticketNo', 'wrappingSpkiSha256'];
const receiptFields = [
  'recoveryId',
  'deviceId',
  'clientCertSha256',
  'wrappingSpkiSha256',
  'originalSpkiSha256',
  'envelopeSha256',
  'challengeId',
  'completedAt',
  'result'
];

async function readFile(event: Event, clear: () => void, apply: (value: unknown) => void, failure: string) {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || busy.value) return;
  busy.value = true;
  error.value = '';
  clear();
  try {
    if (file.size > 32 * 1024) throw new Error(failure);
    apply(JSON.parse(await file.text()));
  } catch {
    error.value = failure;
  } finally {
    busy.value = false;
  }
}

function loadDeviceFile(event: Event) {
  if (attempt.value) return;
  return readFile(
    event,
    () => (deviceFile.value = undefined),
    (value) => {
      if (
        !hasFields(value, ['wrappingCsrBase64', 'deviceBinding']) ||
        !base64(value.wrappingCsrBase64, 10924) ||
        !signedPayload(value.deviceBinding, bindingFields)
      ) {
        throw new Error('invalid device file');
      }
      deviceFile.value = value as unknown as RecoveryDeviceFile;
    },
    '无法读取设备绑定文件，请选择设备客户端导出的 JSON'
  );
}

function loadReceipt(event: Event) {
  const recoveryId = task.value?.recoveryId;
  if (!recoveryId || !pendingConfirmation.value) return;
  return readFile(
    event,
    () => (receipt.value = undefined),
    (value) => {
      if (!hasFields(value, ['recoveryId', 'deliveryReceipt']) || value.recoveryId !== recoveryId || !object(value.deliveryReceipt)) {
        throw new Error('invalid receipt');
      }
      const payload = value.deliveryReceipt.payload;
      const resultField = object(payload) && payload.result === 'IMPORTED' ? 'challengeSha256' : 'failureCode';
      if (
        !object(payload) ||
        !['IMPORTED', 'IMPORT_FAILED'].includes(String(payload.result)) ||
        payload.recoveryId !== recoveryId ||
        payload.deviceId !== targetDeviceId.value ||
        !signedPayload(value.deliveryReceipt, [...receiptFields, resultField])
      ) {
        throw new Error('invalid receipt');
      }
      receipt.value = value as unknown as RecoveryConfirmation;
    },
    '回执文件无效，或与当前恢复任务及目标设备不匹配'
  );
}

function updateTask(value: HistoricalRecoveryTask | undefined, expectedId?: string) {
  if (!value?.recoveryId || (expectedId && value.recoveryId !== expectedId)) throw new Error('invalid task');
  task.value = value;
  if (value.status !== 'PENDING_CONFIRMATION') receipt.value = undefined;
}

function errorCode(cause: unknown) {
  const code: unknown = isAxiosError(cause) ? cause.response?.data?.code : undefined;
  return typeof code === 'string' ? code : undefined;
}

async function run(action: () => Promise<void>, failure: string) {
  if (busy.value) return;
  error.value = '';
  busy.value = true;
  try {
    await action();
  } catch (cause) {
    const code = errorCode(cause);
    error.value = (code && reasonLabels[code]) || failure;
  } finally {
    busy.value = false;
  }
}

function submit() {
  if (!canSubmit.value) return;
  return run(async () => {
    if (!attempt.value && deviceFile.value) {
      const proof = deviceFile.value;
      const { deviceId, recipientId, ticketNo } = proof.deviceBinding.payload;
      attempt.value = {
        ...proof,
        clientRequestNo: uuidv4(),
        certificateRef: { source: 'ARCHIVE', id: props.certificate.id },
        ticketNo,
        reason: reason.value,
        authorizationRef: authorizationRef.value,
        mode: 'DEVICE_DELIVERY',
        recipientId,
        deviceId
      };
    }
    if (!attempt.value) return;
    try {
      const response = await submitArchiveRecovery(attempt.value);
      updateTask(response.data);
      targetDeviceId.value = attempt.value.deviceId;
      attempt.value = undefined;
      deviceFile.value = undefined;
      authorizationRef.value = '';
      reason.value = '';
    } catch (cause) {
      const code = errorCode(cause);
      if (code && ['RECOVERY_INVALID_REQUEST', 'RECOVERY_INVALID_CSR', 'RECOVERY_DEVICE_BINDING_MISMATCH'].includes(code)) {
        attempt.value = undefined;
      }
      throw cause;
    }
  }, '未能确认申请结果，请使用原申请重试');
}

function refresh() {
  const id = task.value?.recoveryId;
  if (!id) return;
  return run(async () => updateTask((await getHistoricalRecovery(id)).data, id), '无法刷新恢复状态，请稍后重试');
}

function confirm() {
  const data = receipt.value;
  if (!pendingConfirmation.value || !data) return;
  return run(async () => updateTask((await confirmHistoricalRecovery(data)).data, data.recoveryId), '未能确认导入结果，请刷新状态或重试确认');
}

function reset() {
  attempt.value = undefined;
  task.value = undefined;
  receipt.value = undefined;
  deviceFile.value = undefined;
  targetDeviceId.value = '';
  authorizationRef.value = '';
  reason.value = '';
  error.value = '';
}
</script>

<style scoped>
.recovery-summary,
.recovery-notice {
  margin-bottom: 16px;
}

.recovery-hint {
  flex-basis: 100%;
  color: var(--el-text-color-secondary);
}
</style>
