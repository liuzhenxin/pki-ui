<template>
  <el-dialog
    v-model="visible"
    :title="options?.messageType === 'TEXT' ? '发送纯文本通知' : '证书分发'"
    width="min(560px, 95vw)"
    append-to-body
    :close-on-click-modal="false"
    :close-on-press-escape="!submitting"
    :show-close="!submitting"
  >
    <el-descriptions v-loading="loading" :column="1" border>
      <el-descriptions-item label="发送对象">{{ target }}</el-descriptions-item>
      <el-descriptions-item label="邮件类型">{{ options?.messageType || '-' }}</el-descriptions-item>
    </el-descriptions>
    <el-alert
      v-if="options?.messageType === 'TEXT'"
      class="mt12"
      title="仅发送纯文本邮件，不发送证书、附件或钉钉密码。结果记录在分发日志。"
      type="info"
      :closable="false"
      show-icon
    />
    <el-form v-if="options" label-width="90px" class="mt12">
      <el-form-item label="邮件附件">
        <div v-if="options.messageType === 'TEXT'" class="attachment-picker">
          <el-tooltip content="请在分发模板中把邮件类型改为 HTML及附件（MIXED），保存后重新打开分发窗口。" placement="top">
            <span><el-button icon="Upload" disabled>选择附件</el-button></span>
          </el-tooltip>
          <div class="el-upload__tip">当前为纯文本模板，不能随邮件发送附件。</div>
        </div>
        <div v-else class="attachment-picker">
          <el-upload
            v-model:file-list="attachments"
            multiple
            :limit="19"
            :auto-upload="false"
            :show-file-list="false"
            :disabled="submitting"
            accept=".pdf,.docx,.xlsx,.txt,.png,.jpg,.jpeg,.zip,.rar"
            :on-exceed="() => ElMessage.warning('最多可选19个附加文件')"
          >
            <el-button icon="Upload" :disabled="submitting">选择附件</el-button>
            <template #tip>
              <div class="el-upload__tip">可选。含证书 ZIP 合计不超过 {{ options.maxAttachmentBytes / 1024 / 1024 }} MB；邮件失败重试时需重新选择。</div>
            </template>
          </el-upload>
          <div v-if="attachments.length" class="attachment-list">
            <div class="attachment-list-header">
              <span>已选择 {{ selectedAttachments.length }} / {{ attachments.length }} 个</span>
              <span>随邮件发送</span>
            </div>
            <ul>
              <li v-for="item in attachments" :key="item.uid" class="attachment-row">
                <span class="attachment-name" :title="item.name">{{ item.name }}</span>
                <el-switch
                  :model-value="!excludedAttachmentIds.has(item.uid)"
                  :aria-label="`发送附件 ${item.name}`"
                  :disabled="submitting"
                  @change="setAttachmentIncluded(item.uid, $event === true)"
                />
                <el-tooltip content="移除附件" placement="top">
                  <el-button link icon="Close" :aria-label="`移除附件 ${item.name}`" :disabled="submitting" @click="removeAttachment(item.uid)" />
                </el-tooltip>
              </li>
            </ul>
          </div>
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button :disabled="submitting" @click="visible = false">取消</el-button>
      <el-button type="primary" :disabled="loading || !options" :loading="submitting" @click="submit">下一步</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElMessage, ElMessageBox, type UploadUserFile } from 'element-plus';
import {
  getEmployeeDistributionOptions,
  submitEmployeeDistribution,
  type EmployeeDistributionOptions,
  type EmployeeDistributionSelection,
  type EmployeeMailType
} from '@/api/ra/employeeCert';

const emit = defineEmits<{ submitted: [selection: EmployeeDistributionSelection, type: EmployeeMailType, batchNo?: string] }>();
const visible = ref(false);
const loading = ref(false);
const submitting = ref(false);
const target = ref('');
const options = ref<EmployeeDistributionOptions>();
const attachments = ref<UploadUserFile[]>([]);
const excludedAttachmentIds = ref(new Set<UploadUserFile['uid']>());
const selectedAttachments = computed(() =>
  attachments.value.flatMap((item) => item.raw && !excludedAttachmentIds.value.has(item.uid) ? [item.raw] : [])
);
let selected: EmployeeDistributionSelection;

function setAttachmentIncluded(uid: UploadUserFile['uid'], included: boolean) {
  if (included) excludedAttachmentIds.value.delete(uid);
  else excludedAttachmentIds.value.add(uid);
}

function removeAttachment(uid: UploadUserFile['uid']) {
  attachments.value = attachments.value.filter((item) => item.uid !== uid);
  excludedAttachmentIds.value.delete(uid);
}

function resetAttachments() {
  attachments.value = [];
  excludedAttachmentIds.value.clear();
}

async function open(selection: EmployeeDistributionSelection, description: string) {
  if (loading.value || submitting.value || visible.value) return;
  selected = selection;
  target.value = description;
  options.value = undefined;
  resetAttachments();
  visible.value = true;
  loading.value = true;
  try {
    options.value = (await getEmployeeDistributionOptions()).data;
  } catch {
    visible.value = false;
  } finally {
    loading.value = false;
  }
}

async function submit() {
  if (!options.value || submitting.value) return;
  const { messageType, maxAttachmentBytes } = options.value;
  const files = messageType === 'MIXED' ? selectedAttachments.value : [];
  if (files.some((file) => !file.size || !/\.(pdf|docx|xlsx|txt|png|jpg|jpeg|zip|rar)$/i.test(file.name))) {
    ElMessage.warning('选中的附件包含空文件或不支持的格式');
    return;
  }
  if (files.reduce((total, file) => total + file.size, 0) >= maxAttachmentBytes) {
    ElMessage.warning('附加文件总大小超限，需为证书 ZIP 预留空间');
    return;
  }
  submitting.value = true;
  try {
    const confirmed = await ElMessageBox.confirm(
      `确认向 ${target.value} ${messageType === 'TEXT' ? '发送纯文本邮件' : `分发证书邮件和钉钉消息（另附 ${files.length} 个文件）`}？`,
      '发送确认', { type: 'warning', confirmButtonText: '确认发送', cancelButtonText: '取消', closeOnClickModal: false, autofocus: false }
    ).then(() => true).catch(() => false);
    if (!confirmed) return;
    const response = await submitEmployeeDistribution(selected, messageType, files);
    ElMessage.info(messageType === 'TEXT' ? '纯文本通知已提交，结果见分发日志' : '证书分发已提交');
    visible.value = false;
    resetAttachments();
    emit('submitted', selected, messageType, (response?.data as any)?.batchNo);
  } catch {
    // The request interceptor displays the server error; keep files for correction.
  } finally {
    submitting.value = false;
  }
}

defineExpose({ open });
</script>

<style scoped>
.attachment-picker {
  width: 100%;
  min-width: 0;
}

.attachment-list {
  margin-top: 8px;
  line-height: 22px;
}

.attachment-list-header,
.attachment-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 68px 24px;
  gap: 8px;
  align-items: center;
}

.attachment-list-header {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.attachment-list ul {
  margin: 0;
  padding: 0;
  max-height: 200px;
  overflow: auto;
  scrollbar-gutter: stable;
}

.attachment-row {
  padding: 4px 0;
  border-top: 1px solid var(--el-border-color-lighter);
}

.attachment-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
