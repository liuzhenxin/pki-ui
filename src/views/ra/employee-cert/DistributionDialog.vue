<template>
  <el-dialog
    v-model="visible"
    :title="noticeMode ? '发送通知' : retryOnly ? '补发钉钉' : messageType === 'TEXT' ? '发送纯文本通知' : '证书分发'"
    width="min(560px, 95vw)"
    append-to-body
    :close-on-click-modal="false"
    :close-on-press-escape="!submitting"
    :show-close="!submitting"
  >
    <el-descriptions v-loading="loading" :column="1" border>
      <el-descriptions-item label="发送对象">{{ target }}</el-descriptions-item>
      <el-descriptions-item v-if="options?.recipients?.length" label="发送用户">
        <ul class="recipient-list">
          <li v-for="(user, index) in options.recipients" :key="index">
            {{ user.name || '-' }}（{{ user.domainAccount || '-' }}）{{ user.email ? ' · ' + user.email : '' }}
          </li>
        </ul>
      </el-descriptions-item>
      <el-descriptions-item v-if="options?.profileName" label="签发模板">{{ options.profileName }}</el-descriptions-item>
      <el-descriptions-item v-if="options?.count" label="证书数量">{{ options.count }}</el-descriptions-item>
      <el-descriptions-item v-if="!noticeMode" label="发送渠道">{{ retryOnly ? '仅钉钉' : messageType === 'MIXED' ? '邮件、钉钉' : messageType === 'TEXT' ? '邮件' : '-' }}</el-descriptions-item>
      <el-descriptions-item v-if="options?.retryDingtalkCount" label="补发钉钉">
        {{ options.retryDingtalkCount }} 条邮件已成功，不再发邮件
      </el-descriptions-item>
    </el-descriptions>
    <el-alert
      v-if="messageType === 'TEXT' && !noticeMode"
      class="mt12"
      title="仅发送纯文本邮件，不发送证书、附件或钉钉密码。结果记录在分发日志。"
      type="info"
      :closable="false"
      show-icon
    />
    <el-form v-if="options" label-width="90px" class="mt12">
      <el-form-item v-if="noticeMode" label="发送渠道" required>
        <el-checkbox-group v-model="noticeChannels" :disabled="submitting">
          <el-checkbox value="EMAIL">邮件</el-checkbox>
          <el-checkbox value="DINGTALK">钉钉</el-checkbox>
        </el-checkbox-group>
      </el-form-item>
      <el-form-item v-if="options.schemes?.length && !chosenScheme?.groups?.length" :label="noticeMode ? '通知模板' : '分发方案'">
        <el-select v-model="schemeId" :disabled="submitting || !!options.retryDingtalkCount" :placeholder="noticeMode ? '请选择通知模板' : '请选择分发方案'" style="width: 100%">
          <el-option v-for="scheme in options.schemes" :key="scheme.id" :value="scheme.id"
            :label="scheme.name + (options.retryDingtalkCount ? '（原方案）' : scheme.id === options.defaultSchemeId ? '（默认）' : '')" />
        </el-select>
      </el-form-item>
      <el-form-item v-if="chosenScheme?.groups?.length" label="自动匹配">
        <ul>
          <li v-for="(group, index) in chosenScheme.groups" :key="index">
            {{ group.name }} · {{ group.count }} 条
            <template v-if="group.retryOnly"> · 仅补发钉钉</template>
            <template v-else> · 附件：{{ group.attachmentNames.join('、') || '无额外附件' }}</template>
          </li>
        </ul>
      </el-form-item>
      <el-form-item v-if="chosenScheme?.groups?.length">
        <span class="el-upload__tip">邮件明确失败可按最新模板重发；邮件成功后，只补发当次钉钉文案。</span>
      </el-form-item>
      <el-form-item v-if="!noticeMode && messageType && !retryOnly && !chosenScheme?.groups?.length" label="邮件附件">
        <div v-if="messageType === 'TEXT'" class="attachment-picker">
          <el-tooltip content="纯文本方案不能上传附件" placement="top">
            <span><el-button icon="Upload" disabled>上传附件</el-button></span>
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
            <el-button icon="Upload" :disabled="submitting">上传附件</el-button>
            <template #tip>
              <div class="el-upload__tip">
                已上传的文件和证书一起打包。ZIP 不超过 {{ options.maxAttachmentBytes / 1024 / 1024 }} MB。
              </div>
            </template>
          </el-upload>
          <div v-if="attachments.length" class="attachment-list">
            <div class="attachment-list-header">
              <span>已添加 {{ attachments.length }} 个附件</span>
            </div>
            <ul>
              <li v-for="item in attachments" :key="item.uid" class="attachment-row">
                <span class="attachment-name" :title="item.name">{{ item.name }}</span>
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
      <el-button type="primary" :disabled="loading || !messageType || (noticeMode && !noticeChannels.length)" :loading="submitting" @click="submit">下一步</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, h, ref } from 'vue';
import { ElMessage, ElMessageBox, type UploadUserFile } from 'element-plus';
import {
  getEmployeeDistributionOptions,
  submitEmployeeDistribution,
  type EmployeeDistributionOptions,
  type EmployeeDistributionSelection,
  type EmployeeMailType,
  type EmployeeNoticeChannel,
  type EmployeeSendPurpose
} from '@/api/ra/employeeCert';

const emit = defineEmits<{ submitted: [selection: EmployeeDistributionSelection, type: EmployeeMailType, batchNo?: string, taskNo?: string] }>();
const visible = ref(false);
const loading = ref(false);
const submitting = ref(false);
const target = ref('');
const options = ref<EmployeeDistributionOptions>();
const schemeId = ref('');
const noticeMode = ref(false);
const noticeChannels = ref<EmployeeNoticeChannel[]>([]);
const chosenScheme = computed(() => options.value?.schemes?.find(scheme => scheme.id === schemeId.value));
const messageType = computed(() => options.value?.schemes?.length ? chosenScheme.value?.messageType : options.value?.messageType);
const retryOnly = computed(() => !!options.value?.retryDingtalkCount && options.value.retryDingtalkCount === options.value.count);
const attachments = ref<UploadUserFile[]>([]);
let selected: EmployeeDistributionSelection;
let targetTaskNo: string | undefined;

function removeAttachment(uid: UploadUserFile['uid']) {
  attachments.value = attachments.value.filter((item) => item.uid !== uid);
}

function resetAttachments() {
  attachments.value = [];
}

async function open(selection: EmployeeDistributionSelection, description: string, taskNo = selection.taskNo,
  purpose: EmployeeSendPurpose = 'CERTIFICATE') {
  if (loading.value || submitting.value || visible.value) return;
  selected = { ...selection, ids: selection.ids ? [...selection.ids] : undefined };
  targetTaskNo = taskNo;
  target.value = description;
  options.value = undefined;
  schemeId.value = '';
  noticeMode.value = purpose === 'NOTICE';
  noticeChannels.value = [];
  resetAttachments();
  visible.value = true;
  loading.value = true;
  try {
    options.value = (await getEmployeeDistributionOptions(selected, purpose)).data;
    schemeId.value = options.value?.defaultSchemeId ?? '';
  } catch {
    visible.value = false;
  } finally {
    loading.value = false;
  }
}

async function submit() {
  const type = messageType.value;
  const scheme = chosenScheme.value;
  if (!options.value || !type || submitting.value) return;
  const recipients = options.value.recipients;
  if (!selected.ids?.length || !scheme?.confirmation || recipients?.length !== selected.ids.length) {
    ElMessage.warning('发送对象无法核对，请重新勾选证书');
    return;
  }
  const channels = noticeMode.value ? [...noticeChannels.value] : undefined;
  if (channels && !channels.length) return;
  const { maxAttachmentBytes } = options.value;
  const files = type === 'MIXED' && !retryOnly.value && !noticeMode.value && !scheme.groups?.length
    ? attachments.value.flatMap((item) => item.raw ? [item.raw] : []) : [];
  if (files.some((file) => !file.size || !/\.(pdf|docx|xlsx|txt|png|jpg|jpeg|zip|rar)$/i.test(file.name))) {
    ElMessage.warning('附件包含空文件或不支持的格式');
    return;
  }
  if (files.reduce((total, file) => total + file.size, 0) >= maxAttachmentBytes) {
    ElMessage.warning('附加文件总大小超限，需为证书 ZIP 预留空间');
    return;
  }
  submitting.value = true;
  try {
    const action = channels ? `通过${channels.map(channel => channel === 'EMAIL' ? '邮件' : '钉钉').join('、')}发送通知`
      : retryOnly.value ? '按原方案补发钉钉，不重复发邮件'
      : type === 'TEXT' ? '发送纯文本邮件'
        : `分发证书邮件和钉钉消息${scheme.groups?.length ? '' : `（ZIP 内含证书及 ${files.length} 个附件）`}${options.value.retryDingtalkCount ? '，邮件已成功的只补发钉钉' : ''}`;
    const confirmed = await ElMessageBox.confirm(
      h('div', [
        h('p', `${action} · ${scheme.name} · 共 ${recipients.length} 条。请核对收件人：`),
        ...(scheme.groups?.length ? [h('ul', scheme.groups.map(group => h('li',
          `${group.name} · ${group.count} 条 · ${group.retryOnly ? '仅补发钉钉' : group.attachmentNames.join('、') || '无额外附件'}`)))] : []),
        h('ul', { style: { maxHeight: '160px', overflow: 'auto', overflowWrap: 'anywhere', paddingLeft: '20px' } },
          recipients.map(user => h('li', `${user.name || '-'}（${user.domainAccount || '-'}）${user.email ? ' · ' + user.email : ''}`)))
      ]),
      '发送确认', { type: 'warning', confirmButtonText: '确认发送', cancelButtonText: '取消', closeOnClickModal: false, autofocus: false }
    ).then(() => true).catch(() => false);
    if (!confirmed) return;
    const response = channels ? await submitEmployeeDistribution(selected, type, files, scheme, channels)
      : await submitEmployeeDistribution(selected, type, files, scheme);
    ElMessage.info(type === 'TEXT' ? '通知已提交，结果见发送记录' : '证书分发已提交');
    visible.value = false;
    resetAttachments();
    emit('submitted', selected, type, response.data?.batchNo, targetTaskNo);
  } catch {
    // The request interceptor displays the server error; keep files for correction.
  } finally {
    submitting.value = false;
  }
}

defineExpose({ open });
</script>

<style scoped>
.recipient-list {
  max-height: 144px;
  overflow: auto;
  overflow-wrap: anywhere;
  list-style: none;
  margin: 0;
  padding: 0;
}

.attachment-picker {
  width: 100%;
  min-width: 0;
}

.attachment-list {
  margin-top: 8px;
  line-height: 22px;
}

.attachment-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 24px;
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
