<template>
  <el-dialog v-model="visible" :title="title" width="1080px" append-to-body class="key-recovery-dialog" @close="reset">
    <el-alert title="密钥恢复属于高敏感操作，必须达到司法取证员 m-of-n 门限签名后才允许执行恢复。" type="warning" show-icon :closable="false" />

    <el-steps class="recovery-steps" :active="activeStep" finish-status="success" process-status="process" align-center>
      <el-step title="申请" />
      <el-step title="待签名" />
      <el-step title="门限通过" />
      <el-step title="恢复完成" />
    </el-steps>

    <el-scrollbar max-height="68vh">
      <el-descriptions title="一、密钥信息" :column="3" border>
        <el-descriptions-item label="恢复对象">{{ targetLabel }}</el-descriptions-item>
        <el-descriptions-item label="密钥类型">{{ detail?.keyType || '-' }}</el-descriptions-item>
        <el-descriptions-item label="密钥长度">{{ detail?.keyBits || '-' }}</el-descriptions-item>
        <el-descriptions-item label="序列号">{{ detail?.serialNumber || target?.serialNumber || '-' }}</el-descriptions-item>
        <el-descriptions-item label="主题" :span="2">{{ detail?.subject || target?.subject || '-' }}</el-descriptions-item>
      </el-descriptions>

      <el-form ref="formRef" class="recovery-section" :model="form" :rules="rules" label-width="130px">
        <el-divider content-position="left">二、恢复申请信息</el-divider>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="恢复场景" prop="recoveryScene">
              <el-select v-model="form.recoveryScene" :disabled="submitted" style="width: 100%">
                <el-option label="司法取证" value="司法取证" />
                <el-option label="数据解密" value="数据解密" />
                <el-option label="灾难恢复" value="灾难恢复" />
                <el-option label="安全事件调查" value="安全事件调查" />
                <el-option label="合规审计" value="合规审计" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="案件编号" prop="caseNo">
              <el-input v-model="form.caseNo" :disabled="submitted" maxlength="100" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="申请单位" prop="applicantOrg">
              <el-input v-model="form.applicantOrg" :disabled="submitted" maxlength="200" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系方式">
              <el-input v-model="form.contact" :disabled="submitted" maxlength="100" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="恢复原因" prop="reason">
              <el-input v-model="form.reason" :disabled="submitted" type="textarea" :rows="2" maxlength="500" show-word-limit />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="授权材料" prop="authorizationMaterial">
              <el-input v-model="form.authorizationMaterial" :disabled="submitted" type="textarea" :rows="2" maxlength="1000" show-word-limit />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">三、司法取证员 m-of-n 门限签名</el-divider>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="最少签名人数 m" prop="requiredApprovers">
              <el-input-number v-model="form.requiredApprovers" :disabled="submitted" :min="1" :max="Math.max(1, form.approverIds.length)" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="候选总数 n">
              <el-input :model-value="form.approverIds.length" disabled />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="签名有效期" prop="expiresAt">
              <el-date-picker v-model="form.expiresAt" :disabled="submitted" type="datetime" value-format="YYYY-MM-DDTHH:mm:ssZ" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="司法取证员" prop="approverIds">
              <el-select
                v-model="form.approverIds"
                :disabled="submitted"
                multiple
                filterable
                clearable
                collapse-tags
                collapse-tags-tooltip
                reserve-keyword
                :loading="judgeLoading"
                :no-data-text="judgeEmptyText"
                @visible-change="handleJudgeDropdownVisible"
                style="width: 100%"
                placeholder="选择具备司法取证员角色的用户"
              >
                <el-option v-for="user in judgeUsers" :key="user.id" :label="userDisplayName(user)" :value="user.id">
                  <span>{{ userDisplayName(user) }}</span>
                  <span class="option-extra">{{ user.mobile || user.mail || user.certSn || user.certSn || '' }}</span>
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <template v-if="submitted">
        <el-row class="progress-row" :gutter="12">
          <el-col :span="8">
            <el-statistic title="有效签名" :value="detail?.approvedCount || 0" :suffix="`/ ${detail?.requiredApprovers || form.requiredApprovers}`" />
          </el-col>
          <el-col :span="8">
            <el-statistic title="拒签人数" :value="detail?.rejectedCount || 0" />
          </el-col>
          <el-col :span="8">
            <el-tag :type="statusTagType" size="large">{{ statusLabel }}</el-tag>
          </el-col>
        </el-row>

        <el-table :data="detail?.approvers || []" border>
          <el-table-column label="司法取证员" prop="approverName" min-width="120" />
          <el-table-column label="证件编号" prop="credentialNo" min-width="120" />
          <el-table-column label="签名状态" width="120">
            <template #default="{ row }">
              <el-tag :type="approverTagType(row.status)">{{ approverStatusLabel(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="签名时间" prop="approvalTime" min-width="160" />
          <el-table-column label="确认意见" prop="comment" min-width="180" show-overflow-tooltip />
        </el-table>

        <div class="sign-actions">
          <el-button type="success" icon="Check" :disabled="!canSign" v-hasPermi="['kmc:keyrecovery:sign']" @click="openSign(true)">确认并签名</el-button>
          <el-button type="warning" icon="Close" :disabled="!canSign" v-hasPermi="['kmc:keyrecovery:reject']" @click="openSign(false)">拒绝签名</el-button>
        </div>
      </template>

      <el-form ref="executeFormRef" class="recovery-section" :model="form" :rules="rules" label-width="130px">
        <el-divider content-position="left">四、密钥恢复执行</el-divider>
        <el-alert v-if="submitted && !detail?.canRecover" :title="recoverDisabledText" type="info" show-icon :closable="false" />
        <el-row :gutter="16">
          <el-col :span="24">
            <el-form-item label="恢复介质" prop="mediaType">
              <el-radio-group v-model="form.mediaType" :disabled="!detail?.canRecover">
                <el-radio-button label="FILE">加密PEM文件</el-radio-button>
                <el-radio-button label="USB_KEY">USB KEY</el-radio-button>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <template v-if="form.mediaType === 'FILE'">
            <el-col :span="12">
              <el-form-item label="文件口令" prop="filePassword">
                <el-input v-model="form.filePassword" :disabled="!detail?.canRecover" type="password" show-password autocomplete="new-password" />
              </el-form-item>
            </el-col>
          </template>
          <template v-else>
            <el-col :span="12">
              <el-form-item label="SKF地址" prop="skfEndpoint">
                <el-input v-model="form.skfEndpoint" :disabled="!detail?.canRecover" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="Provider" prop="providerAlias">
                <el-input v-model="form.providerAlias" :disabled="!detail?.canRecover" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="设备名称" prop="deviceName">
                <el-input v-model="form.deviceName" :disabled="!detail?.canRecover" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="应用名称" prop="appName">
                <el-input v-model="form.appName" :disabled="!detail?.canRecover" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="容器名称" prop="containerName">
                <el-input v-model="form.containerName" :disabled="!detail?.canRecover" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="PIN" prop="pin">
                <el-input v-model="form.pin" :disabled="!detail?.canRecover" type="password" show-password autocomplete="new-password" />
              </el-form-item>
            </el-col>
          </template>
        </el-row>
        <el-form-item v-if="resultText" label="恢复结果">
          <el-input :model-value="resultText" type="textarea" :rows="4" readonly />
        </el-form-item>
      </el-form>

      <el-divider content-position="left">五、审计记录</el-divider>
      <el-table :data="detail?.audits || []" border>
        <el-table-column label="时间" prop="time" min-width="160" />
        <el-table-column label="操作人" prop="operator" min-width="120" />
        <el-table-column label="角色" prop="role" width="110" />
        <el-table-column label="操作" prop="action" width="130" />
        <el-table-column label="结果" prop="result" width="90" />
        <el-table-column label="备注" prop="remark" min-width="200" show-overflow-tooltip />
      </el-table>
    </el-scrollbar>

    <template #footer>
      <div class="dialog-footer">
        <el-button v-if="!submitted" type="primary" :loading="submitLoading" v-hasPermi="['kmc:keyrecovery:submit']" @click="submitRequest">提交申请</el-button>
        <el-button v-if="submitted" icon="Refresh" :loading="statusLoading" @click="refreshDetail">刷新状态</el-button>
        <el-button v-if="submitted" type="danger" :loading="recoverLoading" :disabled="!detail?.canRecover" v-hasPermi="['kmc:keyrecovery:recover']" @click="executeRecovery">执行密钥恢复</el-button>
        <el-button @click="visible = false">关闭</el-button>
      </div>
    </template>

    <el-dialog v-model="signOpen" :title="signAgree ? '司法取证员签名确认' : '拒绝签名'" width="560px" append-to-body>
      <el-form :model="signForm" label-width="110px">
        <el-form-item label="司法取证员">
          <el-select v-model="signForm.approverId" filterable style="width: 100%">
            <el-option v-for="item in pendingApprovers" :key="item.approverId" :label="item.approverName" :value="item.approverId" />
          </el-select>
        </el-form-item>
        <template v-if="signAgree">
          <el-checkbox v-model="signForm.caseChecked">我已核验案件编号与授权材料</el-checkbox>
          <el-checkbox v-model="signForm.legalBasisConfirmed">我已确认本次密钥恢复具有合法依据</el-checkbox>
          <el-checkbox v-model="signForm.auditAware">我理解本次签名将写入审计日志</el-checkbox>
        </template>
        <el-form-item :label="signAgree ? '确认意见' : '拒绝原因'" class="sign-comment">
          <el-input v-model="signForm.comment" type="textarea" :rows="3" maxlength="500" show-word-limit />
        </el-form-item>
        <el-form-item label="UKEY SN">
          <el-input v-model="signForm.approverUkeySn" maxlength="100" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="signOpen = false">取消</el-button>
        <el-button :type="signAgree ? 'primary' : 'warning'" :loading="signLoading" @click="submitSign">{{ signAgree ? '确认并签名' : '拒绝签名' }}</el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import {
  approveKeyRecovery,
  getKeyRecoveryDetail,
  recoverKey,
  rejectKeyRecovery,
  submitKeyRecovery,
  type KeyRecoveryDetail,
  type KeyRecoveryMediaType,
  type KeyRecoveryTargetType
} from '@/api/kmc/keyRecovery';
import { unwrapKmcData } from '@/api/kmc/common';
import { listUser } from '@/api/system/user';

interface RecoveryTarget {
  targetType: KeyRecoveryTargetType;
  targetId: string | number;
  serialNumber?: string;
  subject?: string;
}

const visible = ref(false);
const target = ref<RecoveryTarget>();
const detail = ref<KeyRecoveryDetail>();
const formRef = ref<FormInstance>();
const executeFormRef = ref<FormInstance>();
const submitLoading = ref(false);
const statusLoading = ref(false);
const recoverLoading = ref(false);
const signLoading = ref(false);
const judgeLoading = ref(false);
const signOpen = ref(false);
const signAgree = ref(true);
const resultText = ref('');
const judgeUsers = ref<any[]>([]);
const judgeLoaded = ref(false);

const form = reactive({
  judgeId: '',
  reason: '',
  recoveryScene: '司法取证',
  caseNo: '',
  applicantOrg: '',
  contact: '',
  authorizationMaterial: '',
  requiredApprovers: 3,
  approverIds: [] as Array<string | number>,
  expiresAt: '',
  mediaType: 'FILE' as KeyRecoveryMediaType,
  filePassword: '',
  skfEndpoint: 'ws://127.0.0.1:9001',
  providerAlias: 'default',
  deviceName: '',
  appName: '',
  containerName: '',
  pin: ''
});

const signForm = reactive({
  approverId: '' as string | number,
  comment: '',
  approverUkeySn: '',
  caseChecked: true,
  legalBasisConfirmed: true,
  auditAware: true
});

const rules: FormRules = {
  reason: [{ required: true, message: '恢复原因不能为空', trigger: 'blur' }],
  recoveryScene: [{ required: true, message: '恢复场景不能为空', trigger: 'change' }],
  caseNo: [
    {
      validator: (_rule, value, callback) => {
        if (form.recoveryScene === '司法取证' && !value) {
          callback(new Error('司法取证场景必须填写案件编号'));
          return;
        }
        callback();
      },
      trigger: 'blur'
    }
  ],
  applicantOrg: [{ required: true, message: '申请单位不能为空', trigger: 'blur' }],
  authorizationMaterial: [{ required: true, message: '授权材料不能为空', trigger: 'blur' }],
  requiredApprovers: [{ required: true, message: '最少签名人数不能为空', trigger: 'change' }],
  approverIds: [
    {
      validator: (_rule, value, callback) => {
        if (!value?.length) {
          callback(new Error('请选择司法取证员'));
          return;
        }
        if (form.requiredApprovers > value.length) {
          callback(new Error('最少签名人数不能大于候选人数'));
          return;
        }
        callback();
      },
      trigger: 'change'
    }
  ],
  expiresAt: [{ required: true, message: '签名有效期不能为空', trigger: 'change' }],
  mediaType: [{ required: true, message: '恢复介质不能为空', trigger: 'change' }],
  filePassword: [
    {
      validator: (_rule, value, callback) => {
        if (form.mediaType === 'FILE' && detail.value?.canRecover && !value) {
          callback(new Error('文件口令不能为空'));
          return;
        }
        callback();
      },
      trigger: 'blur'
    }
  ],
  skfEndpoint: [{ required: true, message: 'SKF地址不能为空', trigger: 'blur' }],
  providerAlias: [{ required: true, message: 'Provider不能为空', trigger: 'blur' }],
  deviceName: [{ required: true, message: '设备名称不能为空', trigger: 'blur' }],
  appName: [{ required: true, message: '应用名称不能为空', trigger: 'blur' }],
  containerName: [{ required: true, message: '容器名称不能为空', trigger: 'blur' }]
};

const submitted = computed(() => Boolean(form.judgeId));
const title = computed(() => (target.value?.targetType === 'USED_KEY' ? '在用密钥恢复' : '归档密钥恢复'));
const targetLabel = computed(() => {
  if (!target.value) return '';
  return [target.value.targetType, target.value.targetId, target.value.serialNumber, target.value.subject].filter(Boolean).join(' / ');
});
const activeStep = computed(() => {
  if (detail.value?.recovered) return 4;
  if (detail.value?.canRecover) return 3;
  if (submitted.value) return 2;
  return 1;
});
const pendingApprovers = computed(() => (detail.value?.approvers || []).filter((item) => item.status === 'PENDING'));
const canSign = computed(() => pendingApprovers.value.length > 0 && !detail.value?.thresholdPassed && detail.value?.recoveryStatus !== 'REJECTED');
const statusLabel = computed(() => {
  const map: Record<string, string> = {
    PENDING_SIGN: '待签名',
    SIGNING: '签名中',
    READY_TO_RECOVER: '待恢复',
    REJECTED: '签名拒绝',
    TIMEOUT: '签名超时',
    RECOVERED: '已恢复'
  };
  return map[detail.value?.recoveryStatus || ''] || '未提交';
});
const statusTagType = computed(() => {
  if (detail.value?.recovered || detail.value?.canRecover) return 'success';
  if (detail.value?.recoveryStatus === 'REJECTED' || detail.value?.recoveryStatus === 'TIMEOUT') return 'danger';
  return 'warning';
});
const recoverDisabledText = computed(() => {
  if (!submitted.value) return '';
  if (detail.value?.recovered) return '密钥已恢复，不能重复执行。';
  if (detail.value?.recoveryStatus === 'REJECTED') return '签名未通过，无法恢复。';
  if (detail.value?.recoveryStatus === 'TIMEOUT') return '签名已超时，无法恢复。';
  return `等待司法取证员签名 ${detail.value?.approvedCount || 0}/${detail.value?.requiredApprovers || form.requiredApprovers}`;
});
const judgeEmptyText = computed(() => (judgeLoaded.value ? '暂无司法取证员，请先在司法取证员管理中添加' : '展开后加载司法取证员'));

const open = async (nextTarget: RecoveryTarget) => {
  reset();
  target.value = nextTarget;
  visible.value = true;
  await loadJudgeUsers();
};

const reset = () => {
  target.value = undefined;
  detail.value = undefined;
  form.judgeId = '';
  form.reason = '密钥恢复申请';
  form.recoveryScene = '司法取证';
  form.caseNo = '';
  form.applicantOrg = '';
  form.contact = '';
  form.authorizationMaterial = '';
  form.requiredApprovers = 3;
  form.approverIds = [];
  form.expiresAt = defaultExpiresAt();
  form.mediaType = 'FILE';
  form.filePassword = '';
  form.skfEndpoint = 'ws://127.0.0.1:9001';
  form.providerAlias = 'default';
  form.deviceName = '';
  form.appName = '';
  form.containerName = '';
  form.pin = '';
  resultText.value = '';
  formRef.value?.clearValidate();
  executeFormRef.value?.clearValidate();
};

const defaultExpiresAt = () => {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}+08:00`;
};

const requireTarget = () => {
  if (!target.value) throw new Error('未选择恢复对象');
  return target.value;
};

const loadJudgeUsers = async (keyword = '') => {
  judgeLoading.value = true;
  try {
    const res: any = await listUser({ pageNum: 1, pageSize: 50, username: keyword || undefined, roleId: '306' } as any);
    judgeUsers.value = normalizeUserList(unwrapKmcData<any>(res));
    judgeLoaded.value = true;
  } finally {
    judgeLoading.value = false;
  }
};

const handleJudgeDropdownVisible = async (opened: boolean) => {
  if (opened && !judgeLoaded.value) {
    await loadJudgeUsers();
  }
};

const normalizeUserList = (data: any) => {
  const records = data?.records || data?.rows || data?.list || data?.data || data;
  return Array.isArray(records) ? records : [];
};

const userDisplayName = (user: any) => user?.username || user?.userName || user?.nickName || `用户${user?.id || ''}`;

const submitRequest = async () => {
  const current = requireTarget();
  await formRef.value?.validate();
  submitLoading.value = true;
  try {
    const selected = form.approverIds.map((id) => judgeUsers.value.find((user) => String(user.id) === String(id))).filter(Boolean);
    if (selected.length !== form.approverIds.length) {
      ElMessage.warning('司法取证员数据未加载完整，请重新展开下拉选择');
      return;
    }
    const judgeId = unwrapKmcData<string | number>(
      await submitKeyRecovery({
        targetType: current.targetType,
        targetId: current.targetId,
        reason: form.reason,
        recoveryScene: form.recoveryScene,
        caseNo: form.caseNo,
        applicantOrg: form.applicantOrg,
        contact: form.contact,
        authorizationMaterial: form.authorizationMaterial,
        requiredApprovers: form.requiredApprovers,
        expiresAt: form.expiresAt,
        approvers: selected.map((user) => ({
          approverId: user.id,
          approverName: userDisplayName(user),
          credentialNo: user.certSn || user.mobile || user.mail || ''
        }))
      })
    );
    form.judgeId = String(judgeId);
    ElMessage.success('恢复申请已提交');
    await refreshDetail();
  } finally {
    submitLoading.value = false;
  }
};

const refreshDetail = async () => {
  if (!form.judgeId) return;
  statusLoading.value = true;
  try {
    detail.value = unwrapKmcData<KeyRecoveryDetail>(await getKeyRecoveryDetail(form.judgeId));
    if (detail.value?.result) {
      resultText.value = JSON.stringify(detail.value.result, null, 2);
    }
  } finally {
    statusLoading.value = false;
  }
};

const openSign = (agree: boolean) => {
  signAgree.value = agree;
  const first = pendingApprovers.value[0];
  signForm.approverId = first?.approverId || '';
  signForm.comment = agree ? '材料完整，同意恢复' : '';
  signForm.approverUkeySn = '';
  signForm.caseChecked = true;
  signForm.legalBasisConfirmed = true;
  signForm.auditAware = true;
  signOpen.value = true;
};

const submitSign = async () => {
  if (!signForm.approverId) {
    ElMessage.warning('请选择司法取证员');
    return;
  }
  if (!signAgree.value && !signForm.comment) {
    ElMessage.warning('请填写拒绝原因');
    return;
  }
  const approver = pendingApprovers.value.find((item) => item.approverId === signForm.approverId);
  signLoading.value = true;
  try {
    const payload = {
      judgeId: form.judgeId,
      approverId: signForm.approverId,
      approverName: approver?.approverName,
      approverUkeySn: signForm.approverUkeySn,
      comment: signForm.comment,
      caseChecked: signForm.caseChecked,
      legalBasisConfirmed: signForm.legalBasisConfirmed,
      auditAware: signForm.auditAware
    };
    detail.value = unwrapKmcData<KeyRecoveryDetail>(signAgree.value ? await approveKeyRecovery(payload) : await rejectKeyRecovery(payload));
    ElMessage.success(signAgree.value ? '签名成功' : '已拒绝签名');
    signOpen.value = false;
  } finally {
    signLoading.value = false;
  }
};

const executeRecovery = async () => {
  const current = requireTarget();
  await executeFormRef.value?.validate();
  recoverLoading.value = true;
  try {
    const result = unwrapKmcData(
      await recoverKey({
        judgeId: form.judgeId,
        targetType: current.targetType,
        targetId: current.targetId,
        mediaType: form.mediaType,
        filePassword: form.mediaType === 'FILE' ? form.filePassword : undefined,
        skfEndpoint: form.mediaType === 'USB_KEY' ? form.skfEndpoint : undefined,
        providerAlias: form.mediaType === 'USB_KEY' ? form.providerAlias : undefined,
        deviceName: form.mediaType === 'USB_KEY' ? form.deviceName : undefined,
        appName: form.mediaType === 'USB_KEY' ? form.appName : undefined,
        containerName: form.mediaType === 'USB_KEY' ? form.containerName : undefined,
        pin: form.mediaType === 'USB_KEY' ? form.pin : undefined
      })
    );
    resultText.value = JSON.stringify(result, null, 2);
    ElMessage.success('密钥恢复成功');
    await refreshDetail();
  } finally {
    recoverLoading.value = false;
  }
};

const approverStatusLabel = (status?: string) => ({ APPROVED: '已签名', REJECTED: '拒绝签名', PENDING: '待签名' })[status || ''] || status || '-';
const approverTagType = (status?: string) => (status === 'APPROVED' ? 'success' : status === 'REJECTED' ? 'danger' : 'info');

defineExpose({ open });
</script>

<style scoped>
.key-recovery-dialog :deep(.el-dialog__body) {
  padding-top: 12px;
}

.recovery-steps {
  margin: 18px 0;
}

.recovery-section {
  margin-top: 12px;
}

.progress-row {
  align-items: center;
  margin: 12px 0;
}

.sign-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin: 12px 0 4px;
}

.option-extra {
  float: right;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.sign-comment {
  margin-top: 16px;
}
</style>
