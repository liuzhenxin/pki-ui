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
            <p>把变量原样放入标题或正文，发送时以当前证书与收件人的信息替换。字段无值时留空。</p>
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item v-for="[key, description] in noticeVariables" :key="key" :label="variable(key)">
                {{ description }}
              </el-descriptions-item>
            </el-descriptions>
            <p class="mt8">示例：<code>{{ variable('recipientName') }}，证书 {{ variable('serialNumber') }} {{ variable('expiryText') }}。</code></p>
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
const certificateLabels: Record<string, string> = {
  certificateName: '证书名称。内网证书使用主题，主题为空时使用序列号。',
  subject: '证书主题', issuer: '颁发者或颁发机构', serialNumber: '证书序列号',
  notBefore: '生效时间', notAfter: '到期时间', profileName: '签发模板名称',
  certTypeName: '证书类型', domainName: '证书关联的域名', vendor: '供应商',
  applicantAccount: '申请人域账号', applicantName: '申请人姓名', departmentName: '证书使用人或维护人的科室',
  systemName: '使用系统。录入证书有多条使用记录时，按顺序用顿号连接。',
  usageScenario: '使用场景。录入证书有多条使用记录时，按顺序用顿号连接。',
  maintainerAccount: '维护人域账号', maintainerName: '维护人姓名'
};
const moduleCertificateFields = {
  root: ['certificateName', 'subject', 'issuer', 'serialNumber', 'notBefore', 'notAfter'],
  intranet: ['certificateName', 'subject', 'issuer', 'serialNumber', 'notBefore', 'notAfter', 'profileName',
    'applicantAccount', 'applicantName', 'departmentName', 'systemName', 'usageScenario'],
  public: ['certTypeName', 'domainName', 'issuer', 'serialNumber', 'vendor', 'notBefore', 'notAfter',
    'maintainerAccount', 'maintainerName', 'departmentName', 'systemName', 'usageScenario']
};
const noticeVariables = computed<[string, string][]>(() => {
  const variables: [string, string][] = [
    ['recipientName', '本条通知的收件人'], ['recipientRole', '收件人的角色，例如证书管理员'],
    ['expiryText', '例如“有效期还有 7 天”或“已过期”'], ['days', '剩余天数，到期日为 0，已过期按自然日计为负数'],
    ['certificateTable', '完整证书信息，录入证书还包括各条使用记录']
  ];
  if (props.module !== 'root') variables.push(['ownerName', '关联的证书使用人或维护人']);
  if (props.module === 'public') {
    variables.push(['submitterName', '录入提交人'], ['approvalResult', '审批结果'], ['approvalColor', '审批结果颜色'],
      ['approvalComment', '审核意见'], ['updateUrl', '录入端访问地址'], ['usageTable', '所有系统的使用明细'],
      ['systemOwner', '使用记录中的系统负责人，按顺序用顿号连接'], ['usageDomain', '使用域名，按顺序用顿号连接']);
  }
  return [...variables, ...moduleCertificateFields[props.module].map((field): [string, string] => [field, certificateLabels[field]])];
});

function variable(key: string) {
  return '${' + props.module + '.' + key + '}';
}
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
