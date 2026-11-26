<template>
  <el-dialog v-model="visible" title="证书通知设置" width="min(850px, 96vw)" append-to-body>
    <el-tabs v-model="tab">
      <el-tab-pane label="证书预警" name="settings">
        <el-form :model="form" label-width="140px">
          <el-form-item label="通知开关">
            <div class="notice-switches">
              <el-switch v-model="form.automatic" active-text="自动到期提醒" aria-label="自动到期提醒" />
              <el-switch v-if="module !== 'root'" v-model="form.departure" active-text="离职提醒" aria-label="离职提醒" />
              <el-switch v-if="module === 'public'" v-model="form.approval" active-text="审批提醒" aria-label="审批提醒" />
            </div>
          </el-form-item>
          <el-form-item label="通知渠道"
            ><el-checkbox v-model="form.email">邮件</el-checkbox><el-checkbox v-model="form.dingtalk">钉钉</el-checkbox></el-form-item
          >
          <el-form-item label="通知人员">
            <el-checkbox v-model="form.administrators">证书管理员</el-checkbox>
            <el-checkbox v-if="module !== 'root'" v-model="form.owner">{{ module === 'public' ? '证书维护人' : '证书使用人' }}</el-checkbox>
          </el-form-item>
          <el-form-item label="提前提醒天数"><el-input v-model="form.days" placeholder="例如 3650,30,7,0" /></el-form-item>
          <el-form-item label="每日检查时间"><el-time-picker v-model="form.time" format="HH:mm" value-format="HH:mm" /></el-form-item>
          <el-form-item v-if="module !== 'root'" label="离职提醒周期"
            ><el-input-number v-model="form.departureIntervalDays" :min="1" :precision="0" /><span>天</span></el-form-item
          >
        </el-form>
      </el-tab-pane>
      <el-tab-pane label="模板配置" name="templates">
        <el-collapse>
          <el-collapse-item title="可用模板变量" name="variables">
            <div>收件人：{{ '${' + module + '.recipientName}' }}、{{ '${' + module + '.recipientRole}' }}</div>
            <div>有效期：{{ '${' + module + '.expiryText}' }}、{{ '${' + module + '.days}' }}</div>
            <div v-if="module !== 'root'">离职员工：{{ '${' + module + '.ownerName}' }}</div>
            <div v-if="module === 'public'">
              审批：${public.submitterName}、${public.approvalResult}、${public.approvalColor}、${public.approvalComment}
            </div>
            <div>
              证书信息：<span v-for="key in certificateVariables" :key="key">{{ '${' + module + '.' + key + '}' }}　</span>
            </div>
            <div>
              证书信息表格：{{ '${' + module + '.certificateTable}'
              }}<span v-if="module === 'public'"
                >；多系统信息：{{ '${public.usageTable}' }}、{{ '${public.systemOwner}' }}、{{ '${public.usageDomain}' }}</span
              >
            </div>
          </el-collapse-item>
        </el-collapse>
        <el-collapse>
          <el-collapse-item v-for="category in categories" :key="category.value" :name="category.value" :title="category.label">
            <el-button
              v-for="channel in channels"
              :key="channel.value"
              :disabled="hasTemplate(category.value, channel.value)"
              @click="addTemplate(category.value, channel.value)"
              >添加{{ channel.label }}模板</el-button
            >
            <el-empty v-if="!templatesFor(category.value).length" description="暂无模板" :image-size="52" />
            <el-form v-for="item in templatesFor(category.value)" :key="item.channel" label-width="110px">
              <el-form-item label="通知渠道">{{ item.channel === 'EMAIL' ? '邮件' : '钉钉' }}</el-form-item>
              <el-form-item label="消息类型">
                <el-select v-model="item.messageType">
                  <el-option :label="item.channel === 'EMAIL' ? 'TEXT' : 'text'" value="TEXT" />
                  <el-option v-if="item.channel === 'EMAIL'" label="MIXED" value="MIXED" />
                  <el-option v-else label="markdown" value="MARKDOWN" />
                </el-select>
              </el-form-item>
              <el-form-item label="标题"><el-input v-model="item.title" maxlength="200" /></el-form-item>
              <el-form-item label="内容"
                ><el-input v-model="item.content" type="textarea" :rows="6" maxlength="20000" show-word-limit
              /></el-form-item>
              <el-form-item
                ><el-button type="danger" plain @click="form.templates.splice(form.templates.indexOf(item), 1)">删除模板</el-button></el-form-item
              >
            </el-form>
          </el-collapse-item>
        </el-collapse>
      </el-tab-pane>
    </el-tabs>
    <template #footer
      ><el-button @click="visible = false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template
    >
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import {
  getBusinessNoticeSettings,
  saveBusinessNoticeSettings,
  type BusinessNoticeConfig,
  type NoticeModule,
  type BusinessNoticeTemplate
} from '@/api/ra/businessNoticeSettings';

const props = defineProps<{ module: NoticeModule }>();
const visible = ref(false);
const saving = ref(false);
const tab = ref('settings');
const form = reactive<BusinessNoticeConfig>({
  automatic: false,
  departure: false,
  approval: false,
  email: false,
  dingtalk: false,
  administrators: true,
  owner: false,
  days: '30,7,0',
  time: '09:00',
  departureIntervalDays: 30,
  templates: []
});
const categories = computed(() => [
  { label: '证书状态提醒', value: 'EXPIRY' },
  ...(props.module === 'root' ? [] : [{ label: '员工离职提醒', value: 'DEPARTURE' }]),
  ...(props.module === 'public'
    ? [
        { label: '审批结果提醒', value: 'APPROVAL_RESULT' },
        { label: '待审批通知', value: 'APPROVAL_PENDING' }
      ]
    : [])
]);
const certificateVariables = computed(() =>
  [
    'certificateName',
    'subject',
    'issuer',
    'serialNumber',
    'notBefore',
    'notAfter',
    'certTypeName',
    'domainName',
    'vendor',
    'applicantAccount',
    'applicantName',
    'departmentName',
    'systemName',
    'usageScenario',
    'maintainerAccount',
    'maintainerName'
  ].filter((key) => moduleCertificateFields[props.module].includes(key))
);
const moduleCertificateFields = {
  root: ['certificateName', 'subject', 'issuer', 'serialNumber', 'notBefore', 'notAfter'],
  intranet: [
    'certificateName',
    'subject',
    'issuer',
    'serialNumber',
    'notBefore',
    'notAfter',
    'applicantAccount',
    'applicantName',
    'departmentName',
    'systemName',
    'usageScenario'
  ],
  public: [
    'certTypeName',
    'domainName',
    'issuer',
    'serialNumber',
    'vendor',
    'notBefore',
    'notAfter',
    'maintainerAccount',
    'maintainerName',
    'departmentName',
    'systemName',
    'usageScenario'
  ]
};
const channels = [
  { value: 'EMAIL', label: '邮件' },
  { value: 'DINGTALK', label: '钉钉' }
] as const;
function templatesFor(category: string) {
  return form.templates.filter((item) => item.category.toUpperCase() === category);
}
function hasTemplate(category: string, channel: BusinessNoticeTemplate['channel']) {
  return templatesFor(category).some((item) => item.channel === channel);
}
function addTemplate(category = 'EXPIRY', channel: BusinessNoticeTemplate['channel'] = 'EMAIL') {
  if (hasTemplate(category, channel)) return;
  form.templates.push({ category, channel, messageType: 'TEXT', title: '', content: '' });
}
function unwrap<T>(response: any): T {
  const body = response?.data ?? response;
  return (body?.data ?? body) as T;
}
async function open() {
  Object.assign(form, unwrap<BusinessNoticeConfig>(await getBusinessNoticeSettings(props.module)));
  tab.value = 'settings';
  visible.value = true;
}
async function save() {
  saving.value = true;
  try {
    Object.assign(form, unwrap<BusinessNoticeConfig>(await saveBusinessNoticeSettings(props.module, form)));
    visible.value = false;
    ElMessage.success('通知设置已保存');
  } finally {
    saving.value = false;
  }
}
defineExpose({ open });
</script>

<style scoped>
.notice-switches {
  display: flex;
  flex-wrap: wrap;
  gap: 0 16px;
}
</style>
