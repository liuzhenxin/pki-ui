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
            <div>通用：${recipientName}、${recipientRole}、${expiryText}、${approvalResult}、${approvalColor}、${approvalComment}</div>
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
        <el-button :disabled="form.templates.length >= categories.length * 2" @click="addTemplate">添加模板</el-button>
        <el-empty v-if="!form.templates.length" description="暂无通知模板" />
        <el-collapse v-else>
          <el-collapse-item v-for="(item, index) in form.templates" :key="index" :name="index">
            <template #title>{{ categoryLabel(item.category) }} · {{ item.channel === 'EMAIL' ? '邮件' : '钉钉' }}</template>
            <el-form label-width="100px">
              <el-form-item label="分类"
                ><el-select v-model="item.category"
                  ><el-option v-for="option in categories" :key="option.value" :label="option.label" :value="option.value" /></el-select
              ></el-form-item>
              <el-form-item label="渠道"
                ><el-select v-model="item.channel" @change="item.messageType = 'TEXT'"
                  ><el-option label="邮件" value="EMAIL" /><el-option label="钉钉" value="DINGTALK" /></el-select
              ></el-form-item>
              <el-form-item label="消息类型"
                ><el-select v-model="item.messageType"
                  ><el-option label="纯文本" value="TEXT" /><el-option v-if="item.channel === 'EMAIL'" label="MIXED" value="MIXED" /><el-option
                    v-else
                    label="Markdown"
                    value="MARKDOWN" /></el-select
              ></el-form-item>
              <el-form-item label="标题"><el-input v-model="item.title" maxlength="200" /></el-form-item>
              <el-form-item label="内容"
                ><el-input v-model="item.content" type="textarea" :rows="6" maxlength="20000" show-word-limit
              /></el-form-item>
              <el-form-item><el-button type="danger" plain @click="form.templates.splice(index, 1)">删除模板</el-button></el-form-item>
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
import { getBusinessNoticeSettings, saveBusinessNoticeSettings, type BusinessNoticeConfig, type NoticeModule } from '@/api/ra/businessNoticeSettings';

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
const certificateVariables = [
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
];
function categoryLabel(value: string) {
  return categories.value.find((item) => item.value === value)?.label || value;
}
function addTemplate() {
  form.templates.push({ category: 'EXPIRY', channel: 'EMAIL', messageType: 'TEXT', title: '', content: '' });
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
