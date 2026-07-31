<template>
  <el-dialog v-model="visible" :title="title" width="1080px" append-to-body class="key-recovery-dialog" @close="reset">
    <el-alert
      :title="
        direct
          ? 'CA证书管理可直接恢复KMC在用密钥，无需司法取证员门限签名；恢复操作及介质写入结果将完整记录。'
          : '密钥恢复属于高敏感操作，必须达到司法取证员 m-of-n 门限签名后才允许执行恢复。'
      "
      :type="direct ? 'info' : 'warning'"
      show-icon
      :closable="false"
    />

    <el-steps v-if="!direct" class="recovery-steps" :active="activeStep" finish-status="success" process-status="process" align-center>
      <el-step title="申请" :status="stepStatus(1)" @click="activeStep >= 1 && (activeStep = 1)" />
      <el-step title="待签名" :status="stepStatus(2)" @click="activeStep >= 2 && (activeStep = 2)" />
      <el-step title="门限通过" :status="stepStatus(3)" @click="activeStep >= 3 && (activeStep = 3)" />
      <el-step title="恢复完成" :status="stepStatus(4)" @click="activeStep >= 4 && (activeStep = 4)" />
    </el-steps>

    <el-scrollbar max-height="64vh">
      <!-- 一、密钥信息 -->
	      <el-card shadow="never" class="section-card">
        <template #header>
          <div class="card-title">
            <el-icon><InfoFilled /></el-icon> 一、密钥信息
          </div>
        </template>
        <el-descriptions :column="3" border size="small">
          <el-descriptions-item label="恢复对象">{{ targetLabel }}</el-descriptions-item>
          <el-descriptions-item label="密钥类型">{{ detail?.keyType || target?.keyType || '-' }}</el-descriptions-item>
          <el-descriptions-item label="密钥长度">{{ detail?.keyBits || target?.keyBits || '-' }}</el-descriptions-item>
          <el-descriptions-item label="序列号">{{ detail?.serialNumber || target?.serialNumber || '-' }}</el-descriptions-item>
          <el-descriptions-item label="主题" :span="3">{{ detail?.subject || target?.subject || '-' }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 二、恢复申请信息 -->
      <el-card shadow="never" class="section-card">
        <template #header>
          <div class="card-title">
            <el-icon><EditPen /></el-icon> 二、恢复申请信息
          </div>
        </template>
        <el-form ref="formRef" :model="form" :rules="rules" label-width="130px" :disabled="submitted">
          <el-row :gutter="16">
            <el-col :span="direct ? 24 : 12">
              <el-form-item label="恢复场景" prop="recoveryScene">
                <el-select v-model="form.recoveryScene" style="width: 100%">
                  <el-option label="司法取证" value="司法取证" />
                  <el-option label="数据解密" value="数据解密" />
                  <el-option label="灾难恢复" value="灾难恢复" />
                  <el-option label="安全事件调查" value="安全事件调查" />
                  <el-option label="合规审计" value="合规审计" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col v-if="!direct" :span="12">
              <el-form-item label="案件编号" prop="caseNo">
                <el-input v-model="form.caseNo" maxlength="100" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="申请单位" prop="applicantOrg">
                <el-input v-model="form.applicantOrg" maxlength="200" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="联系方式">
                <el-input v-model="form.contact" maxlength="100" />
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <el-form-item label="恢复原因" prop="reason">
                <el-input v-model="form.reason" type="textarea" :rows="2" maxlength="500" show-word-limit />
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <el-form-item label="授权材料" prop="authorizationMaterial">
                <el-input v-model="form.authorizationMaterial" type="textarea" :rows="2" maxlength="1000" show-word-limit />
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
      </el-card>

      <!-- 三、门限签名 -->
      <el-card v-if="!direct" shadow="never" class="section-card">
        <template #header>
          <div class="card-title">
            <el-icon><Checked /></el-icon> 三、司法取证员 m-of-n 门限签名
          </div>
        </template>
        <el-form :model="form" label-width="130px" :disabled="submitted">
          <el-row :gutter="16">
            <el-col :span="8">
              <el-form-item label="最少签名 m" prop="requiredApprovers">
                <el-input-number v-model="form.requiredApprovers" :min="1" :max="Math.max(1, configTotalApprovers)" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="候选总数 n">
                <el-input :model-value="`${configTotalApprovers} 人`" disabled />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="签名有效期">
                <el-date-picker v-model="form.expiresAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ssZ" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <el-form-item label="司法取证员" prop="approverIds">
                <template #label>
                  <span>司法取证员</span>
                  <el-tag v-if="form.requiredApprovers > configTotalApprovers" type="danger" size="small" class="approver-hint"
                    >m > n 无法达成</el-tag
                  >
                  <el-tag v-else-if="form.approverIds.length >= form.requiredApprovers" type="success" size="small" class="approver-hint"
                    >门限 {{ form.requiredApprovers }}/{{ configTotalApprovers }}</el-tag
                  >
                  <el-tag v-else-if="form.approverIds.length > 0" type="warning" size="small" class="approver-hint"
                    >待选 {{ form.requiredApprovers }}/{{ configTotalApprovers }}</el-tag
                  >
                  <el-tag v-else type="info" size="small" class="approver-hint">上限 {{ configTotalApprovers }} 人</el-tag>
                </template>
                <el-select
                  v-model="form.approverIds"
                  multiple
                  filterable
                  clearable
                  collapse-tags
                  collapse-tags-tooltip
                  :loading="judgeLoading"
                  :no-data-text="judgeEmptyText"
                  @visible-change="handleJudgeDropdownVisible"
                  style="width: 100%"
                  placeholder="请选择司法取证员"
                >
                  <template v-if="judgeLoading" #empty>
                    <div class="skeleton-loading"><el-skeleton :rows="3" animated /></div>
                  </template>
                  <el-option v-for="user in judgeUsers" :key="user.id" :label="userDisplayName(user)" :value="user.id">
                    <el-avatar :size="20" class="option-avatar">{{ avatarAbbr(user) }}</el-avatar>
                    <span>{{ userDisplayName(user) }}</span>
                    <span class="option-extra">{{ user.mobile || user.mail || '' }}</span>
                  </el-option>
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>

        <!-- 签名进度仪表盘 -->
        <template v-if="submitted">
          <el-row :gutter="16" class="progress-dashboard">
            <el-col :span="5">
              <el-progress type="circle" :percentage="signPercent" :color="signPercentColor" :width="100">
                <template #default="{ percentage }">
                  <span class="progress-label">{{ percentage }}%</span>
                </template>
              </el-progress>
            </el-col>
            <el-col :span="19">
              <el-row :gutter="12">
                <el-col :span="8">
                  <div class="stat-card stat-success">
                    <div class="stat-value">{{ detail?.approvedCount || 0 }}</div>
                    <div class="stat-label">已签名</div>
                  </div>
                </el-col>
                <el-col :span="8">
                  <div class="stat-card stat-pending">
                    <div class="stat-value">
                      {{ detail?.pendingCount ?? (detail?.approvers?.length || 0) - (detail?.approvedCount || 0) - (detail?.rejectedCount || 0) }}
                    </div>
                    <div class="stat-label">待签名</div>
                  </div>
                </el-col>
                <el-col :span="8">
                  <div class="stat-card stat-danger">
                    <div class="stat-value">{{ detail?.rejectedCount || 0 }}</div>
                    <div class="stat-label">已拒绝</div>
                  </div>
                </el-col>
              </el-row>
              <div class="stat-summary">
                <el-tag :type="statusTagType" size="large" effect="dark">{{ statusLabel }}</el-tag>
                <span class="stat-threshold">门限 {{ detail?.approvedCount || 0 }}/{{ detail?.requiredApprovers || form.requiredApprovers }}</span>
              </div>
            </el-col>
          </el-row>

          <!-- 签名者列表 -->
          <el-table :data="detail?.approvers || []" border class="signer-table">
            <el-table-column label="司法取证员" min-width="140">
              <template #default="{ row }">
                <div class="signer-cell">
                  <el-avatar :size="28" :style="{ background: approverAvatarColor(row.status) }">
                    {{ (row.approverName || '-').charAt(0).toUpperCase() }}
                  </el-avatar>
                  <span>{{ row.approverName }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="证件编号" prop="credentialNo" min-width="100" />
            <el-table-column label="签名状态" width="110">
              <template #default="{ row }">
                <el-tag :type="approverTagType(row.status)" effect="plain">
                  <el-icon v-if="row.status === 'APPROVED'" class="status-icon"><CircleCheckFilled /></el-icon>
                  <el-icon v-else-if="row.status === 'REJECTED'" class="status-icon"><CircleCloseFilled /></el-icon>
                  <el-icon v-else class="status-icon"><Clock /></el-icon>
                  {{ approverStatusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="签名时间" prop="approvalTime" min-width="160" />
            <el-table-column label="确认意见" prop="comment" min-width="140" show-overflow-tooltip />
          </el-table>

          <div class="sign-actions" v-if="canSign">
            <el-button type="success" icon="Check" v-hasPermi="['kmc:keyrecovery:sign']" @click="openSign(true)">确认并签名</el-button>
            <el-button type="warning" icon="Close" v-hasPermi="['kmc:keyrecovery:reject']" @click="openSign(false)">拒绝签名</el-button>
          </div>
        </template>
      </el-card>

      <!-- 四、密钥恢复执行 -->
      <el-card shadow="never" class="section-card">
        <template #header>
          <div class="card-title">
            <el-icon><Unlock /></el-icon> {{ direct ? '三' : '四' }}、密钥恢复执行
          </div>
        </template>
        <el-alert v-if="!direct && submitted && !detail?.canRecover" :title="recoverDisabledText" type="info" show-icon :closable="false" />
	        <el-form ref="executeFormRef" :model="form" :rules="rules" label-width="130px">
	          <el-alert
	            v-if="isMlKemRecovery"
	            type="info"
	            show-icon
	            :closable="false"
	            title="ML-KEM私钥不导出；恢复仅校验并恢复KMC托管关系和密钥服务能力"
	          />
	          <el-row :gutter="16">
	            <el-col v-if="!isMlKemRecovery" :span="24">
              <el-form-item label="恢复介质" prop="mediaType">
                <el-radio-group v-model="form.mediaType" :disabled="!canRecover">
                  <el-radio-button label="FILE">加密PEM文件</el-radio-button>
                  <el-radio-button label="USB_KEY">USB KEY</el-radio-button>
                </el-radio-group>
              </el-form-item>
            </el-col>
	            <template v-if="!isMlKemRecovery && form.mediaType === 'FILE'">
              <el-col :span="12">
                <el-form-item label="文件口令" prop="filePassword">
                  <el-input v-model="form.filePassword" :disabled="!canRecover" type="password" show-password autocomplete="new-password" />
                </el-form-item>
              </el-col>
            </template>
	            <template v-else-if="!isMlKemRecovery">
              <el-col :span="24">
                <div class="usb-key-header">
                  <div class="usb-key-status">
                    <span>USBKey 写入设置</span>
                    <el-tag v-if="usbProviders.length" type="success" size="small" effect="plain">设备已就绪</el-tag>
                    <el-tag v-else type="warning" size="small" effect="plain">未检测到设备</el-tag>
                  </div>
                  <el-tooltip content="刷新USBKey设备列表" placement="top">
                    <el-button :icon="Refresh" circle size="small" :loading="usbLoading" :disabled="!canRecover" @click="refreshUsbProviders" />
                  </el-tooltip>
                </div>
                <el-alert type="info" show-icon :closable="false" title="请确认 USBKey 已插入电脑、应用已创建且 User PIN 正确" />
              </el-col>
              <el-col :span="12">
                <el-form-item label="设备提供商" prop="providerAlias">
                  <el-select
                    v-model="form.providerAlias"
                    :disabled="!canRecover"
                    :loading="usbLoading"
                    placeholder="请选择厂商"
                    style="width: 100%"
                    @change="onUsbProviderChange"
                  >
                    <el-option v-for="provider in usbProviders" :key="provider" :label="provider" :value="provider" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="设备" prop="deviceName">
                  <el-select
                    v-model="form.deviceName"
                    :disabled="!canRecover || !form.providerAlias"
                    :loading="usbLoading"
                    placeholder="请选择设备"
                    style="width: 100%"
                    @change="onUsbDeviceChange"
                  >
                    <el-option v-for="device in usbDevices" :key="device" :label="device" :value="device" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="应用" prop="appName">
                  <el-select
                    v-model="form.appName"
                    :disabled="!canRecover || !form.deviceName"
                    :loading="usbLoading"
                    placeholder="请选择应用"
                    style="width: 100%"
                    @change="onUsbAppChange"
                  >
                    <el-option v-for="app in usbApps" :key="app" :label="app" :value="app" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="新容器" prop="containerName">
                  <el-input v-model="form.containerName" readonly :disabled="!canRecover" placeholder="选择应用后自动生成">
                    <template #append>
                      <el-tooltip content="重新生成容器名称" placement="top">
                        <el-button :icon="Refresh" :disabled="!canRecover || !form.appName" @click="regenerateUsbContainerName" />
                      </el-tooltip>
                    </template>
                  </el-input>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="User PIN" prop="pin">
                  <el-input
                    v-model="form.pin"
                    :disabled="!canRecover || !form.appName"
                    type="password"
                    show-password
                    autocomplete="new-password"
                    placeholder="请输入 USBKey User PIN"
                  />
                </el-form-item>
              </el-col>
            </template>
          </el-row>
          <el-form-item v-if="resultText && !direct" label="恢复结果">
            <el-input :model-value="resultText" type="textarea" :rows="4" readonly />
          </el-form-item>
        </el-form>
      </el-card>

      <!-- 五、审计记录 -->
      <el-card shadow="never" class="section-card">
        <template #header>
          <div class="card-title">
            <el-icon><Document /></el-icon> {{ direct ? '四' : '五' }}、审计记录
          </div>
        </template>
        <el-table :data="detail?.audits || []" border size="small">
          <el-table-column label="时间" prop="time" min-width="160" />
          <el-table-column label="操作人" prop="operator" min-width="120" />
          <el-table-column label="角色" prop="role" width="110" />
          <el-table-column label="操作" prop="action" width="130" />
          <el-table-column label="结果" prop="result" width="90" />
          <el-table-column label="备注" prop="remark" min-width="200" show-overflow-tooltip />
        </el-table>
      </el-card>
    </el-scrollbar>

    <template #footer>
      <div class="dialog-footer">
        <el-button
          v-if="!direct && !submitted"
          type="primary"
          :loading="submitLoading"
          :disabled="form.approverIds.length < form.requiredApprovers || form.requiredApprovers > configTotalApprovers"
          v-hasPermi="['kmc:keyrecovery:submit', 'ca:cert:recover']"
          @click="submitRequest"
          >提交申请</el-button
        >
        <el-button
          v-if="direct && !detail?.recovered"
          type="danger"
          :loading="recoverLoading"
          v-hasPermi="['ca:cert:recover']"
          @click="handleExecuteRecovery"
          >执行密钥恢复</el-button
        >
        <template v-if="!direct && submitted">
          <el-tag v-if="polling" type="info" size="small" class="polling-tag"
            >每15s自动刷新 <el-icon :class="{ 'polling-icon': true, 'is-spinning': polling }"><Refresh /></el-icon
          ></el-tag>
          <el-button icon="Refresh" :loading="statusLoading" @click="refreshDetail">刷新状态</el-button>
          <el-button
            type="danger"
            :loading="recoverLoading"
            :disabled="!detail?.canRecover"
            v-hasPermi="['kmc:keyrecovery:recover', 'ca:cert:recover']"
            @click="handleExecuteRecovery"
            >执行密钥恢复</el-button
          >
        </template>
        <el-button @click="visible = false">关闭</el-button>
      </div>
    </template>

    <!-- 签名子对话框 -->
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
        <el-button :type="signAgree ? 'primary' : 'warning'" :loading="signLoading" @click="submitSign">{{
          signAgree ? '确认并签名' : '拒绝签名'
        }}</el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Check,
  Close,
  CircleCheckFilled,
  CircleCloseFilled,
  Clock,
  Document,
  EditPen,
  InfoFilled,
  Checked,
  Refresh,
  Unlock
} from '@element-plus/icons-vue';
import type { FormInstance, FormRules } from 'element-plus';
import {
  approveKeyRecovery,
  confirmKeyRecovery,
  getKeyRecoveryDetail,
  recoverKey,
  rejectKeyRecovery,
  submitDirectUsedKeyRecovery,
  submitKeyRecovery,
  type KeyRecoveryDetail,
  type KeyRecoveryMediaType,
  type KeyRecoveryTargetType
} from '@/api/kmc/keyRecovery';
import { unwrapKmcData } from '@/api/kmc/common';
import { getKmcRuntimeConfig } from '@/api/kmc/config';
import { listUser } from '@/api/system/user';
import SKFClient from '@/api/skf/skf_api';

interface RecoveryTarget {
  targetType: KeyRecoveryTargetType;
  targetId: string | number;
  serialNumber?: string;
  subject?: string;
  keyType?: string;
  keyBits?: number;
  certificate?: string;
}

const props = withDefaults(defineProps<{ direct?: boolean }>(), { direct: false });
const direct = computed(() => props.direct);

const emit = defineEmits<{ recovered: [payload: { judgeId: string; targetId: string | number; success: boolean; message?: string }] }>();

let skfClientPromise: Promise<any> | null = null;
const getSkfClient = () => {
  if (skfClientPromise) return skfClientPromise;
  const client = new SKFClient('ws://127.0.0.1:9001');
  skfClientPromise = client
    .connect()
    .then(() => client)
    .catch((error: unknown) => {
      skfClientPromise = null;
      throw error;
    });
  return skfClientPromise;
};

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
const polling = ref(false);
const configTotalApprovers = ref(5);
const configRequiredApprovers = ref(3);
const usbProviders = ref<string[]>([]);
const usbDevices = ref<string[]>([]);
const usbApps = ref<string[]>([]);
const usbLoading = ref(false);
let pollingTimer: ReturnType<typeof setInterval> | null = null;

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
  providerAlias: '',
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
      validator: (_r, v, cb) => {
        if (!direct.value && form.recoveryScene === '司法取证' && !v) cb(new Error('司法取证场景必须填写案件编号'));
        else cb();
      },
      trigger: 'blur'
    }
  ],
  applicantOrg: [{ required: true, message: '申请单位不能为空', trigger: 'blur' }],
  authorizationMaterial: [{ required: true, message: '授权材料不能为空', trigger: 'blur' }],
  requiredApprovers: [{ required: true, message: '最少签名人数不能为空', trigger: 'change' }],
  approverIds: [
    {
      validator: (_r, v, cb) => {
        if (!v?.length) cb(new Error('请选择司法取证员'));
        else if (form.requiredApprovers > v.length) cb(new Error(`最少签名数 m(${form.requiredApprovers}) 不能大于候选数(${v.length})`));
        else cb();
      },
      trigger: 'change'
    }
  ],
  expiresAt: [{ required: true, message: '签名有效期不能为空', trigger: 'change' }],
  mediaType: [{ required: true, message: '恢复介质不能为空', trigger: 'change' }],
  filePassword: [
    {
      validator: (_r, v, cb) => {
        if (form.mediaType === 'FILE' && canRecover.value && !v) cb(new Error('文件口令不能为空'));
        else cb();
      },
      trigger: 'blur'
    }
  ],
  providerAlias: [{ validator: validateUsbField('设备提供商'), trigger: 'change' }],
  deviceName: [{ validator: validateUsbField('设备'), trigger: 'change' }],
  appName: [{ validator: validateUsbField('应用'), trigger: 'change' }],
  containerName: [{ validator: validateUsbField('新容器'), trigger: 'change' }],
  pin: [{ validator: validateUsbField('User PIN'), trigger: 'blur' }]
};

const submitted = computed(() => Boolean(form.judgeId));
const canRecover = computed(() => (direct.value ? !detail.value?.recovered : Boolean(detail.value?.canRecover)));
const isMlKemRecovery = computed(() =>
  String(detail.value?.keyType || target.value?.keyType || '')
    .toUpperCase()
    .replace(/_/g, '-')
    .startsWith('ML-KEM')
);
const title = computed(() => (direct.value ? 'CA在用密钥直接恢复' : target.value?.targetType === 'USED_KEY' ? '在用密钥恢复' : '归档密钥恢复'));
const targetLabel = computed(() =>
  target.value ? [target.value.targetType, target.value.targetId, target.value.serialNumber, target.value.subject].filter(Boolean).join(' / ') : ''
);
const activeStep = computed(() => (detail.value?.recovered ? 4 : detail.value?.canRecover ? 3 : submitted.value ? 2 : 1));
const pendingApprovers = computed(() => (detail.value?.approvers || []).filter((item) => item.status === 'PENDING'));
const canSign = computed(() => pendingApprovers.value.length > 0 && !detail.value?.thresholdPassed && detail.value?.recoveryStatus !== 'REJECTED');
const signPercent = computed(() => {
  if (!detail.value) return 0;
  const total = detail.value.requiredApprovers || form.requiredApprovers;
  return total > 0 ? Math.round(((detail.value.approvedCount || 0) / total) * 100) : 0;
});
const signPercentColor = computed(() => (detail.value?.recoveryStatus === 'REJECTED' ? '#F56C6C' : signPercent.value >= 100 ? '#67C23A' : '#E6A23C'));
const statusLabel = computed(
  () =>
    ({ PENDING_SIGN: '待签名', SIGNING: '签名中', READY_TO_RECOVER: '待恢复', REJECTED: '签名拒绝', TIMEOUT: '签名超时', RECOVERED: '已恢复' })[
      detail.value?.recoveryStatus || ''
    ] || '未提交'
);
const statusTagType = computed(() =>
  detail.value?.recovered || detail.value?.canRecover
    ? 'success'
    : detail.value?.recoveryStatus === 'REJECTED' || detail.value?.recoveryStatus === 'TIMEOUT'
      ? 'danger'
      : 'warning'
);
const recoverDisabledText = computed(() => {
  if (!submitted.value) return '';
  if (detail.value?.recovered) return '密钥已恢复，不能重复执行。';
  if (detail.value?.recoveryStatus === 'REJECTED') return '签名未通过，无法恢复。';
  if (detail.value?.recoveryStatus === 'TIMEOUT') return '签名已超时，无法恢复。';
  return `等待司法取证员签名 ${detail.value?.approvedCount || 0}/${detail.value?.requiredApprovers || form.requiredApprovers}`;
});
const judgeEmptyText = computed(() => (judgeLoaded.value ? '暂无司法取证员，请先在司法取证员管理中添加' : '展开后加载司法取证员'));

const startPolling = () => {
  polling.value = true;
  pollingTimer = setInterval(refreshDetail, 15000);
};
const stopPolling = () => {
  polling.value = false;
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
};
const stepStatus = (step: number) => (activeStep.value > step ? 'success' : activeStep.value === step ? 'process' : 'wait');

onUnmounted(stopPolling);
watch(detail, (d) => {
  if (d?.recovered || d?.recoveryStatus === 'REJECTED' || d?.recoveryStatus === 'TIMEOUT') stopPolling();
});
watch(
  () => form.mediaType,
  (mediaType) => {
    if (mediaType === 'USB_KEY' && visible.value) void refreshUsbProviders();
  }
);

const avatarAbbr = (user: any) => (user?.username || '?').charAt(0).toUpperCase();
const approverAvatarColor = (status?: string) => (status === 'APPROVED' ? '#67C23A' : status === 'REJECTED' ? '#F56C6C' : '#909399');

const loadRecoveryConfig = async () => {
  try {
    const res: any = await getKmcRuntimeConfig();
    const config = unwrapKmcData<any>(res);
    if (config?.keyRecovery) {
      configTotalApprovers.value = config.keyRecovery.totalApprovers || 5;
      configRequiredApprovers.value = config.keyRecovery.requiredApprovers || 3;
    }
  } catch {
    /* use defaults */
  }
};

const open = async (nextTarget: RecoveryTarget) => {
  reset();
  target.value = nextTarget;
  if (
    String(nextTarget.keyType || '')
      .toUpperCase()
      .replace(/_/g, '-')
      .startsWith('ML-KEM')
  ) {
    form.mediaType = 'KMC_SERVICE';
  }
  visible.value = true;
  if (!direct.value) await Promise.all([loadRecoveryConfig(), loadJudgeUsers()]);
};

const reset = () => {
  stopPolling();
  target.value = undefined;
  detail.value = undefined;
  form.judgeId = '';
  form.reason = direct.value ? 'CA证书管理密钥恢复' : '密钥恢复申请';
  form.recoveryScene = direct.value ? '数据解密' : '司法取证';
  form.caseNo = '';
  form.applicantOrg = direct.value ? 'CA系统' : '';
  form.contact = '';
  form.authorizationMaterial = direct.value ? 'CA证书管理直接恢复授权' : '';
  form.requiredApprovers = configRequiredApprovers.value;
  form.approverIds = [];
  form.expiresAt = defaultExpiresAt();
  form.mediaType = 'FILE';
  form.filePassword = '';
  form.providerAlias = '';
  form.deviceName = '';
  form.appName = '';
  form.containerName = '';
  form.pin = '';
  usbProviders.value = [];
  usbDevices.value = [];
  usbApps.value = [];
  usbLoading.value = false;
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

function validateUsbField(label: string) {
  return (_rule: unknown, value: string, callback: (error?: Error) => void) => {
    if (form.mediaType === 'USB_KEY' && canRecover.value && !value) callback(new Error(`${label}不能为空`));
    else callback();
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timer));
  });
}

const generateUsbContainerName = () => `key-recovery-${Math.random().toString(36).substring(2, 10)}-${Date.now().toString(36)}`;

const uniqueUsbContainerName = (existingNames: string[]) => {
  const existing = new Set(existingNames);
  let name = generateUsbContainerName();
  while (existing.has(name)) name = generateUsbContainerName();
  return name;
};

const loadUsbApps = async (skf: any) => {
  usbApps.value = [];
  form.appName = '';
  form.containerName = '';
  if (!form.providerAlias || !form.deviceName) return;
  const apps = await withTimeout(skf.enumApplication(form.providerAlias, form.deviceName), 10000, '获取USBKey应用列表超时');
  usbApps.value = Array.isArray(apps) ? apps : [];
  form.appName = usbApps.value[0] || '';
  if (form.appName) await loadUsbContainers(skf);
};

const loadUsbDevices = async (skf: any) => {
  usbDevices.value = [];
  usbApps.value = [];
  form.deviceName = '';
  form.appName = '';
  form.containerName = '';
  if (!form.providerAlias) return;
  const devices = await withTimeout(skf.enumDevice(form.providerAlias), 10000, '获取USBKey设备列表超时');
  usbDevices.value = Array.isArray(devices) ? devices : [];
  form.deviceName = usbDevices.value[0] || '';
  if (form.deviceName) await loadUsbApps(skf);
};

const loadUsbContainers = async (skf: any) => {
  form.containerName = '';
  if (!form.providerAlias || !form.deviceName || !form.appName) return;
  const containers = await withTimeout(skf.enumContainer(form.providerAlias, form.deviceName, form.appName), 10000, '获取USBKey容器列表超时');
  form.containerName = uniqueUsbContainerName(Array.isArray(containers) ? containers : []);
};

const refreshUsbProviders = async () => {
  usbLoading.value = true;
  try {
    const skf = await getSkfClient();
    try {
      await skf.setLanguage('CN');
    } catch {
      /* SKF 服务可能不支持语言切换，不影响设备枚举。 */
    }
    const providers = await withTimeout(skf.enumProvider(), 10000, '获取USBKey设备提供商超时');
    usbProviders.value = Array.isArray(providers) ? providers : [];
    form.providerAlias = usbProviders.value.includes(form.providerAlias) ? form.providerAlias : usbProviders.value[0] || '';
    await loadUsbDevices(skf);
  } catch (error: any) {
    usbProviders.value = [];
    usbDevices.value = [];
    usbApps.value = [];
    form.providerAlias = '';
    form.deviceName = '';
    form.appName = '';
    form.containerName = '';
    ElMessage.error(`无法连接到 SKF 服务: ${error?.message || '请确认制证服务已启动'}`);
  } finally {
    usbLoading.value = false;
  }
};

const onUsbProviderChange = async () => {
  usbLoading.value = true;
  try {
    await loadUsbDevices(await getSkfClient());
  } catch (error: any) {
    ElMessage.error(error?.message || '获取USBKey设备列表失败');
  } finally {
    usbLoading.value = false;
  }
};

const onUsbDeviceChange = async () => {
  usbLoading.value = true;
  try {
    await loadUsbApps(await getSkfClient());
  } catch (error: any) {
    ElMessage.error(error?.message || '获取USBKey应用列表失败');
  } finally {
    usbLoading.value = false;
  }
};

const onUsbAppChange = async () => {
  usbLoading.value = true;
  try {
    await loadUsbContainers(await getSkfClient());
  } catch (error: any) {
    ElMessage.error(error?.message || '获取USBKey容器列表失败');
  } finally {
    usbLoading.value = false;
  }
};

const regenerateUsbContainerName = async () => {
  await onUsbAppChange();
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
  if (opened && !judgeLoaded.value) await loadJudgeUsers();
};
const normalizeUserList = (data: any) => {
  const r = data?.records || data?.rows || data?.list || data?.data || data;
  return Array.isArray(r) ? r : [];
};
const userDisplayName = (user: any) => user?.username || user?.userName || user?.nickName || `用户${user?.id || ''}`;

const submitRequest = async () => {
  const current = requireTarget();
  await formRef.value?.validate();
  submitLoading.value = true;
  try {
    const selected = form.approverIds.map((id) => judgeUsers.value.find((user) => String(user.id) === String(id))).filter(Boolean);
    if (selected.length !== form.approverIds.length) {
      ElMessage.warning('司法取证员数据未加载完整');
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
    ElMessage.success('恢复申请已提交，等待司法取证员签名');
    await refreshDetail();
    startPolling();
  } finally {
    submitLoading.value = false;
  }
};

const refreshDetail = async () => {
  if (!form.judgeId) return;
  statusLoading.value = true;
  try {
    detail.value = unwrapKmcData<KeyRecoveryDetail>(await getKeyRecoveryDetail(form.judgeId));
    if (detail.value?.result) resultText.value = JSON.stringify(detail.value.result, null, 2);
    if (detail.value?.canRecover && polling) ElMessage.success('门限签名已达成，可以执行密钥恢复');
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
    detail.value = unwrapKmcData<KeyRecoveryDetail>(
      signAgree.value
        ? await approveKeyRecovery({
            judgeId: form.judgeId,
            approverId: signForm.approverId,
            approverName: approver?.approverName,
            approverUkeySn: signForm.approverUkeySn,
            comment: signForm.comment,
            caseChecked: signForm.caseChecked,
            legalBasisConfirmed: signForm.legalBasisConfirmed,
            auditAware: signForm.auditAware
          })
        : await rejectKeyRecovery({
            judgeId: form.judgeId,
            approverId: signForm.approverId,
            approverName: approver?.approverName,
            approverUkeySn: signForm.approverUkeySn,
            comment: signForm.comment,
            caseChecked: signForm.caseChecked,
            legalBasisConfirmed: signForm.legalBasisConfirmed,
            auditAware: signForm.auditAware
          })
    );
    ElMessage.success(signAgree.value ? '签名成功' : '已拒绝签名');
    signOpen.value = false;
  } finally {
    signLoading.value = false;
  }
};

const handleExecuteRecovery = async () => {
  try {
    await ElMessageBox.confirm(
      direct.value
        ? '确认直接恢复该证书对应的KMC在用密钥？恢复结果将写入审计记录。'
        : `门限签名已完成 (${detail.value?.approvedCount || 0}/${detail.value?.requiredApprovers || form.requiredApprovers})，确认执行密钥恢复？`,
      '确认执行恢复',
      { confirmButtonText: '确认执行', cancelButtonText: '取消', type: 'warning' }
    );
  } catch {
    return;
  }
  const current = requireTarget();
  let skf: any;
  let usbContainerCreated = false;
  recoverLoading.value = true;
  try {
    await formRef.value?.validate();
    await executeFormRef.value?.validate();
    if (isMlKemRecovery.value) {
      form.mediaType = 'KMC_SERVICE';
    }
    if (form.mediaType === 'USB_KEY' && (!form.providerAlias || !form.deviceName || !form.appName || !form.containerName || !form.pin)) {
      throw new Error('请完整填写USBKey设备、应用、新容器和PIN');
    }
    if (direct.value && !form.judgeId) {
      const judgeId = unwrapKmcData<string | number>(
        await submitDirectUsedKeyRecovery({
          targetType: current.targetType,
          targetId: current.targetId,
          reason: form.reason,
          recoveryScene: form.recoveryScene,
          caseNo: direct.value ? undefined : form.caseNo,
          applicantOrg: form.applicantOrg,
          contact: form.contact,
          authorizationMaterial: form.authorizationMaterial
        })
      );
      form.judgeId = String(judgeId);
      await refreshDetail();
    }
    let wrappingCsrBase64: string | undefined;
    const recoveryKeyType = String(current.keyType || '').toUpperCase();
    const recoveryKeyBits = Number(current.keyBits || (recoveryKeyType === 'RSA' ? 2048 : 256));
    if (form.mediaType === 'USB_KEY' && !['SM2', 'RSA'].includes(recoveryKeyType)) {
      throw new Error(`USBKey恢复不支持密钥类型：${recoveryKeyType || '未知'}`);
    }
    if (form.mediaType === 'USB_KEY' && recoveryKeyType === 'RSA' && ![2048, 4096].includes(recoveryKeyBits)) {
      throw new Error(`RSA USBKey恢复仅支持2048或4096位，当前为${recoveryKeyBits}位`);
    }
    if (form.mediaType === 'USB_KEY') {
      skf = await getSkfClient();
      const appPath = `${form.providerAlias}/${form.deviceName}/${form.appName}`;
      await withTimeout(skf.checkPIN(appPath, form.pin), 15000, '验证 USBKey PIN 超时');
      const containers = await withTimeout(skf.enumContainer(form.providerAlias, form.deviceName, form.appName), 10000, '获取USBKey容器列表超时');
      if (Array.isArray(containers) && containers.includes(form.containerName)) {
        form.containerName = uniqueUsbContainerName(containers);
      }
      const csr = await withTimeout(
        skf.createPKCS10(
          form.providerAlias,
          form.deviceName,
          form.appName,
          current.subject || 'CN=KMC Key Recovery',
          recoveryKeyType,
          recoveryKeyBits,
          form.containerName
        ),
        30000,
        '生成USBKey封装CSR超时'
      );
      usbContainerCreated = true;
      wrappingCsrBase64 = String(csr.pem || '')
        .replace(/-----BEGIN[^-]+-----/g, '')
        .replace(/-----END[^-]+-----/g, '')
        .replace(/\s+/g, '');
    }
    const result = unwrapKmcData(
      await recoverKey({
        judgeId: form.judgeId,
        targetType: current.targetType,
        targetId: current.targetId,
        mediaType: form.mediaType,
        filePassword: form.mediaType === 'FILE' ? form.filePassword : undefined,
        usbWrappingCsrBase64: wrappingCsrBase64
      })
    ) as any;
    if (form.mediaType === 'USB_KEY') {
      if (!result?.encryptedPrivateKey) throw new Error('KMC未返回USBKey数字信封');
      await withTimeout(
        skf.importKeyPair(
          form.providerAlias,
          form.deviceName,
          form.appName,
          form.containerName,
          recoveryKeyType,
          result.encryptedPrivateKey,
          result.wrapKey || '',
          result.symmetricMode || 'ECB'
        ),
        30000,
        '写入KMC恢复密钥对超时'
      );
      if (!current.certificate) throw new Error('恢复目标缺少原加密证书');
      await withTimeout(
        skf.importCertificate(form.providerAlias, form.deviceName, form.appName, form.containerName, false, current.certificate),
        30000,
        '写入原加密证书超时'
      );
      const expected = current.certificate
        .replace(/-----BEGIN[^-]+-----/g, '')
        .replace(/-----END[^-]+-----/g, '')
        .replace(/\s+/g, '');
      const certs = await withTimeout(skf.findCertificates('Enc'), 15000, '校验USBKey加密证书超时');
      const installed =
        Array.isArray(certs) &&
        certs.some(
          (item: any) =>
            String(item?.key || '').includes(`/${form.appName}/${form.containerName}/`) &&
            String(item?.cert || '')
              .replace(/-----BEGIN[^-]+-----/g, '')
              .replace(/-----END[^-]+-----/g, '')
              .replace(/\s+/g, '') === expected
        );
      if (!installed) throw new Error('USBKey写入校验失败，未在新容器中找到原加密证书');
      await confirmKeyRecovery({ judgeId: form.judgeId, success: true, message: 'USBKey私钥和原加密证书写入并校验成功' });
      usbContainerCreated = false;
    } else if (result?.fileContent) {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([result.fileContent], { type: 'application/x-pem-file' }));
      link.download = result.fileName || `kmc-key-recovery-${current.targetId}.pem`;
      link.click();
      URL.revokeObjectURL(link.href);
    }
    resultText.value = JSON.stringify(result, null, 2);
    ElMessage.success('密钥恢复成功');
    await refreshDetail();
    emit('recovered', { judgeId: form.judgeId, targetId: current.targetId, success: true, message: '恢复介质写入并校验成功' });
  } catch (error: any) {
    if (usbContainerCreated && skf) {
      try {
        await withTimeout(
          skf.deleteContainer(form.providerAlias, form.deviceName, form.appName, form.containerName),
          10000,
          '清理USBKey临时容器超时'
        );
      } catch {
        /* 清理失败不覆盖原始恢复错误。 */
      }
    }
    if (form.mediaType === 'USB_KEY' && form.judgeId) {
      try {
        await confirmKeyRecovery({ judgeId: form.judgeId, success: false, message: error?.message || 'USBKey写入或校验失败' });
      } catch {
        /* 保留原始恢复错误，确认失败由服务端日志记录。 */
      }
    }
    emit('recovered', { judgeId: form.judgeId, targetId: current.targetId, success: false, message: error?.message || '密钥恢复失败' });
    throw error;
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
  margin: 18px 0 20px;
}
.recovery-steps :deep(.el-step__title) {
  cursor: pointer;
}

.section-card {
  margin-bottom: 12px;
}
.section-card :deep(.el-card__header) {
  padding: 10px 16px;
  background: var(--el-fill-color-lighter);
}
.card-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.usb-key-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  font-weight: 600;
}
.usb-key-status {
  display: flex;
  align-items: center;
  gap: 8px;
}
.usb-key-header + :deep(.el-alert) {
  margin-bottom: 16px;
}

.skeleton-loading {
  padding: 16px 20px;
}

.progress-dashboard {
  align-items: center;
  margin: 16px 0;
  padding: 16px;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
}
.progress-label {
  font-size: 20px;
  font-weight: 600;
}

.stat-card {
  text-align: center;
  padding: 10px 4px;
  border-radius: 6px;
}
.stat-card.stat-success {
  background: #f0f9eb;
  border: 1px solid #e1f3d8;
}
.stat-card.stat-pending {
  background: #fdf6ec;
  border: 1px solid #faecd8;
}
.stat-card.stat-danger {
  background: #fef0f0;
  border: 1px solid #fde2e2;
}
.stat-value {
  font-size: 28px;
  font-weight: 700;
}
.stat-success .stat-value {
  color: #67c23a;
}
.stat-pending .stat-value {
  color: #e6a23c;
}
.stat-danger .stat-value {
  color: #f56c6c;
}
.stat-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}

.stat-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}
.stat-threshold {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.signer-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
.status-icon {
  margin-right: 2px;
  vertical-align: middle;
}

.signer-table {
  margin-top: 12px;
}

.sign-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.option-avatar {
  margin-right: 6px;
  vertical-align: middle;
}
.option-extra {
  float: right;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.polling-tag {
  margin-right: 8px;
}
.approver-hint {
  margin-left: 6px;
  vertical-align: middle;
}
.polling-icon {
  margin-left: 4px;
  vertical-align: middle;
}
.is-spinning {
  animation: spin 1.5s linear infinite;
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.sign-comment {
  margin-top: 16px;
}
.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}
</style>
