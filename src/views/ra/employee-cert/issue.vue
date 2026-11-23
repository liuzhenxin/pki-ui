<template>
  <div class="app-container employee-cert-issue-page">
    <el-tabs v-model="activeTab" class="employee-cert-tabs" @tab-change="handleTabChange">
      <el-tab-pane label="制作申请" name="create">
        <el-card shadow="never" class="work-card">
          <template #header>
            <div class="card-header">
              <span>员工加密证书制作</span>
              <div class="header-actions">
                <el-button v-hasPermi="['ra:employee-cert:template']" icon="Setting" @click="openProfilePolicy">模板准入</el-button>
              </div>
            </div>
          </template>

          <el-form label-width="88px" class="issue-form">
            <el-row :gutter="20">
              <el-col :xs="24" :sm="12" :lg="8">
                <el-form-item label="颁发 CA" required>
                  <el-select v-model="form.rootId" filterable placeholder="请选择颁发 CA" style="width: 100%">
                    <el-option v-for="ca in eligibleCas" :key="ca.id" :label="ca.name" :value="ca.id" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12" :lg="8">
                <el-form-item label="签发模板" required>
                  <el-select v-model="form.profileId" :disabled="!form.rootId" filterable
                    :placeholder="form.rootId ? '请选择签发模板' : '请先选择颁发 CA'" style="width: 100%">
                    <el-option
                      v-for="item in profilesForCa"
                      :key="String(item.profileId)"
                      :label="item.profileName"
                      :value="String(item.profileId)"
                    />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12" :lg="8">
                <el-form-item label="证书用途">
                  <el-input :model-value="templatePurpose(selectedProfile)" placeholder="-" readonly />
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12" :lg="8">
                <el-form-item label="有效期" required>
                  <el-select v-model="form.validityYears" :disabled="!selectedProfile" style="width: 100%"
                    :placeholder="selectedProfile ? '请选择有效年限' : '请先选择签发模板'">
                    <el-option v-for="years in 10" :key="years" :label="`${years} 年`" :value="years"
                      :disabled="years > maxValidityYears" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12" :lg="8">
                <el-form-item label="密钥长度" required>
                  <el-select v-model="form.rsaKeySize" placeholder="请选择密钥长度" style="width: 100%" :disabled="!selectedProfile || creating">
                    <el-option v-for="size in rsaKeySizes" :key="size" :label="`${size} 位`" :value="size"
                      :disabled="!supportedRsaKeySizes.includes(size)" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12" :lg="8">
                <el-form-item label="PFX 密码">
                  <el-button icon="Setting" :disabled="creating || loadingPasswordDefault" @click="openPasswordRule">密码规则</el-button>
                  <span class="pfx-rule-summary">{{ passwordRuleSummary }}</span>
                </el-form-item>
              </el-col>
              <el-col :xs="24" :lg="8">
                <el-form-item label="制作说明">
                  <el-input v-model="form.remark" clearable placeholder="选填" />
                </el-form-item>
              </el-col>
            </el-row>
          </el-form>

          <el-divider content-position="left">选择员工</el-divider>
          <div class="employee-source-bar">
            <el-radio-group v-model="selectionMode" :disabled="resolving || creating">
              <el-radio-button label="ACCOUNT">输入域账号</el-radio-button>
              <el-radio-button label="FILE">上传名单</el-radio-button>
            </el-radio-group>
            <div class="employee-source-actions">
              <input ref="fileInputRef" class="hidden-file" type="file" accept=".xlsx,.csv,.txt" :disabled="resolving || creating" @change="handleFileChange" />
              <template v-if="selectionMode === 'FILE'">
                <el-button icon="Download" @click="downloadTemplate">下载模板</el-button>
                <el-button icon="Upload" :loading="resolving" :disabled="creating" @click="fileInputRef?.click()">上传名单</el-button>
              </template>
              <el-button v-if="selectionMode === 'ACCOUNT'" type="primary" icon="Search" :loading="resolving" :disabled="creating || !form.accounts.trim()" @click="resolveAccounts">查询确认</el-button>
            </div>
          </div>
          <el-input
            v-if="selectionMode === 'ACCOUNT'"
            v-model="form.accounts"
            :disabled="resolving || creating"
            type="textarea"
            :rows="4"
            placeholder="多个域账号用分号分隔，例如：vw00001;vw00002"
            class="account-input"
          />
          <div v-else-if="rosterName" class="mb12 roster-summary">
            <span>{{ rosterName }}</span>
            <el-tag v-if="duplicateCount" type="info" effect="plain">已去重 {{ duplicateCount }} 条</el-tag>
          </div>
          <el-alert
            v-if="missingAccounts.length > 0"
            type="error"
            show-icon
            :closable="false"
            class="mb12"
            :title="`未找到以下域账号：${missingAccounts.join('；')}`"
          />
          <el-alert
            v-if="blockedAccounts.length > 0"
            type="warning"
            show-icon
            :closable="false"
            class="mb12"
            title="已找到以下员工，但暂不能制作证书"
          >
            <span class="blocked-account-list">
              <span v-for="item in blockedAccounts" :key="item.domainAccount">{{ item.domainAccount }}：{{ item.reason }}</span>
            </span>
          </el-alert>

          <div class="selection-summary">
            <span
              >已确认员工：<strong>{{ selectedEmployees.length }}</strong> 人</span
            >
            <el-button
              type="success"
              icon="Finished"
              :disabled="!canCreateTask || loadingPasswordDefault"
              :loading="creating"
              @click="createTask"
            >
              创建制作任务
            </el-button>
          </div>
          <el-table v-loading="resolving" :data="selectedEmployees" border stripe class="employee-selection-table" empty-text="请先查询并确认员工">
            <el-table-column label="姓名" prop="cnName" min-width="110" />
            <el-table-column label="域账号" prop="domainAccount" min-width="130" />
            <el-table-column label="邮箱" prop="email" min-width="200" show-overflow-tooltip />
            <el-table-column label="科室" prop="departmentName" min-width="160" show-overflow-tooltip />
            <el-table-column label="岗位" prop="jobName" min-width="140" show-overflow-tooltip />
            <el-table-column label="状态" width="90" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.recordSource === 'LOCAL_USER'" type="success" effect="plain">本地用户</el-tag>
                <el-tag v-else :type="isFawvwEmployeeSourceActive(row.sourceStatus) ? 'success' : 'danger'" effect="plain">{{
                  isFawvwEmployeeSourceActive(row.sourceStatus) ? '在职' : '非在职'
                }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="公钥" width="108" align="center" fixed="right">
              <template #default="{ row }">
                <CertRowAction label="查看公钥与选择证书" icon="Key" :disabled="creating" @click="openKeys(row)" />
                <el-tag v-if="productionChoices[String(row.id)]" size="small" type="info">
                  {{ productionChoices[String(row.id)]?.mode === 'NEW' ? '新办' : '已指定' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="制作任务" name="tasks" class="task-list-pane">
        <el-card shadow="never" class="task-list-card">
          <template #header>
            <div class="card-header">
              <span>制作任务</span>
              <el-button icon="Refresh" link @click="loadTasks">刷新</el-button>
            </div>
          </template>
          <el-form :model="taskQuery" inline>
            <el-form-item label="任务号">
              <el-input v-model="taskQuery.taskNo" clearable placeholder="任务号" style="width: 200px" @keyup.enter="loadTasks" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" icon="Search" @click="loadTasks">搜索</el-button>
              <el-button icon="Refresh" @click="resetTaskQuery">重置</el-button>
            </el-form-item>
          </el-form>
          <el-table v-loading="taskLoading" :data="tasks" border stripe empty-text="暂无制作任务">
            <el-table-column label="任务号" prop="taskNo" min-width="210" show-overflow-tooltip />
            <el-table-column label="签发模板" prop="profileNameSnapshot" min-width="190" show-overflow-tooltip />
            <el-table-column label="证书类型" prop="certTypeName" width="130" />
            <el-table-column label="完成/总人数" width="120" align="center">
              <template #default="{ row }">{{ row.successCount }}/{{ row.totalCount }}</template>
            </el-table-column>
            <el-table-column label="任务状态" width="120" align="center">
              <template #default="{ row }">
                <el-tag v-if="taskIssueStatus(row.taskStatus)" :type="issueStatusType(taskIssueStatus(row.taskStatus))" effect="plain">
                  {{ issueStatusLabel(taskIssueStatus(row.taskStatus)) }}
                </el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column label="创建时间" width="166" align="center">
              <template #default="{ row }">{{ formatDate(row.createTime) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="106" align="center" fixed="right">
              <template #default="{ row }">
                <CertRowAction label="详情" icon="View" @click="openTask(row)" />
                <CertRowAction
                  v-hasPermi="['ra:employee-cert:distribute']"
                  label="下载证书 ZIP"
                  icon="Download"
                  :loading="downloadingTask === row.taskNo"
                  :disabled="row.successCount <= 0 || Boolean(downloadingTask)"
                  @click="downloadTaskPackage(row)"
                />
              </template>
            </el-table-column>
          </el-table>
          <pagination
            v-show="taskTotal > 0"
            v-model:page="taskQuery.pageNum"
            v-model:limit="taskQuery.pageSize"
            :total="taskTotal"
            :auto-scroll="false"
            @pagination="loadTasks"
          />
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="passwordRuleOpen" title="PFX 密码规则" width="min(460px, 96vw)" append-to-body>
      <el-form label-width="88px">
        <el-form-item label="密码长度">
          <el-input-number v-model="passwordRuleDraft.length" :min="6" :max="12" :precision="0" />
        </el-form-item>
        <el-form-item label="字符类型">
          <el-checkbox v-model="passwordRuleDraft.uppercase">大写字母</el-checkbox>
          <el-checkbox v-model="passwordRuleDraft.lowercase">小写字母</el-checkbox>
          <el-checkbox v-model="passwordRuleDraft.digits">数字</el-checkbox>
          <el-checkbox v-model="passwordRuleDraft.symbols">特殊字符</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :loading="savingPasswordDefault" :disabled="!validPasswordRule" @click="setDefaultPasswordRule">设为默认</el-button>
        <el-button @click="passwordRuleOpen = false">取消</el-button>
        <el-button type="primary" :disabled="!validPasswordRule || savingPasswordDefault" @click="savePasswordRule">仅本次使用</el-button>
      </template>
    </el-dialog>

    <DistributionDialog ref="distributionDialog" @submitted="onFallbackDistributionSubmitted" />
    <el-drawer v-model="taskOpen" title="制作任务详情" size="min(1060px, 96vw)" append-to-body>
      <el-descriptions :column="2" border class="mb12">
        <el-descriptions-item label="任务号">{{ taskDetail.task?.taskNo || '-' }}</el-descriptions-item>
        <el-descriptions-item label="证书类型">{{ taskDetail.task?.certTypeName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="颁发 CA">{{ taskCaName(taskDetail.task?.rootId) }}</el-descriptions-item>
        <el-descriptions-item label="签发模板">{{ taskDetail.task?.profileNameSnapshot || '-' }}</el-descriptions-item>
        <el-descriptions-item label="有效期">{{ taskDetail.task?.validityYears ? `${taskDetail.task.validityYears} 年` : '按 CA 模板' }}</el-descriptions-item>
        <el-descriptions-item label="PFX 密码规则">{{ describePasswordRule(taskDetail.task?.pfxPasswordRule) }}</el-descriptions-item>
        <el-descriptions-item label="密钥长度">{{ taskDetail.task?.rsaKeySize ? `${taskDetail.task.rsaKeySize} 位` : '原任务规格' }}</el-descriptions-item>
        <el-descriptions-item label="任务状态">
          <el-tag v-if="detailIssueStatus" :type="issueStatusType(detailIssueStatus)" effect="plain">
            {{ issueStatusLabel(detailIssueStatus) }}
          </el-tag>
          <span v-else>-</span>
        </el-descriptions-item>
        <el-descriptions-item label="人数">{{ taskDetail.task?.successCount || 0 }}/{{ taskDetail.task?.totalCount || 0 }}</el-descriptions-item>
      </el-descriptions>
      <div class="selection-summary">
        <span>已选 {{ issueSelection.length }} 条</span>
        <el-button v-if="taskDetail.certs?.some(canIssueCert)" type="primary" icon="Promotion"
          :disabled="!issueSelection.length" :loading="issuingTask" @click="issueSelectedCerts">签发</el-button>
      </div>
      <el-table :key="taskDetail.task?.taskNo" ref="issueTable" :data="taskDetail.certs || []" :row-key="(row) => String(row.id)" border stripe
        @selection-change="issueSelection = $event">
        <el-table-column type="selection" width="48" fixed :selectable="canSelectTaskCert" reserve-selection />
        <el-table-column label="姓名" prop="employeeName" width="110" />
        <el-table-column label="域账号" prop="domainAccount" width="120" />
        <el-table-column label="办理类型" width="104">
          <template #default="{ row }">{{ productionTypeLabel(row) }}</template>
        </el-table-column>
        <el-table-column label="序列号" prop="serialNumber" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <div>{{ row.serialNumber || '-' }}</div>
            <div v-for="original in row.originalSerialNumbers" :key="original" class="original-serial">旧证书序列号：{{ original }}</div>
          </template>
        </el-table-column>
        <el-table-column label="签发状态" prop="issueStatus" width="118" align="center" sortable
          :sort-method="compareIssueStatus" :sort-orders="['ascending', 'descending', null]">
          <template #default="{ row }">
            <el-tag :type="issueStatusType(row.issueStatus)" effect="plain">{{ issueStatusLabel(row.issueStatus) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="签发记录" width="100">
          <template #default="{ row }">
            <el-button link type="primary" @click="showIssueHistory(row)">{{ row.issueHistory?.length || 0 }} 次</el-button>
          </template>
        </el-table-column>
        <el-table-column label="签发说明" prop="issueMessage" min-width="220" show-overflow-tooltip />
        <el-table-column label="邮件" width="96" align="center">
          <template #default="{ row }"><ChannelStatus :status="row.emailStatus" /></template>
        </el-table-column>
        <el-table-column label="钉钉" width="96" align="center">
          <template #default="{ row }"><ChannelStatus :status="row.dingtalkStatus" :blocked="row.emailStatus === 'FAILED'" /></template>
        </el-table-column>
      </el-table>
      <template v-if="taskDetail.task && taskDetail.certs?.some(cert => cert.issueStatus === 'ISSUED' && !cert.superseded)" #footer>
        <el-button
          v-hasPermi="['ra:employee-cert:distribute']"
          icon="Promotion"
          :disabled="!(canOpenTaskLedger() ? (taskDetail.certs || []) : issueSelection).some(cert => canDistributeEmployeeCert(cert))"
          @click="distributeTask(taskDetail.task)"
        >分发所选</el-button>
        <el-button
          v-hasPermi="['ra:employee-cert:distribute']"
          type="primary"
          icon="Download"
          :loading="downloadingTask === taskDetail.task.taskNo"
          :disabled="Boolean(downloadingTask)"
          @click="downloadTaskPackage(taskDetail.task)"
        >下载证书 ZIP</el-button>
      </template>
    </el-drawer>

    <el-dialog v-model="issueHistoryOpen" :title="`签发记录 · ${historyCert?.domainAccount || ''}`" width="min(720px, 96vw)" append-to-body>
      <el-table :data="[...(historyCert?.issueHistory || [])].reverse()" border max-height="460" empty-text="暂无签发历史">
        <el-table-column label="开始时间" width="166">
          <template #default="{ row }">{{ formatDate(row.startedAt) }}</template>
        </el-table-column>
        <el-table-column label="完成时间" width="166">
          <template #default="{ row }">{{ formatDate(row.finishedAt) }}</template>
        </el-table-column>
        <el-table-column label="结果" width="100">
          <template #default="{ row }">
            <el-tag :type="issueStatusType(row.status)" effect="plain">{{ issueStatusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="说明" prop="message" min-width="160" show-overflow-tooltip />
      </el-table>
    </el-dialog>

    <el-dialog v-model="profilePolicyOpen" title="员工加密证书模板准入" width="920px" append-to-body>
      <el-alert
        title="仅启用已核对用途的模板。CA同步后模板取消授权或变更时，创建任务和签发前都会重新校验。"
        type="warning"
        :closable="false"
        class="mb12"
      />
      <el-table :data="emailProfiles" border stripe max-height="440">
        <el-table-column label="颁发 CA" prop="rootName" min-width="170" />
        <el-table-column label="CA模板" prop="profileName" min-width="220" />
        <el-table-column label="模板类型" prop="profileType" width="120" />
        <el-table-column label="证书用途" min-width="145" show-overflow-tooltip>
          <template #default="{ row }">{{ templatePurpose(row) }}</template>
        </el-table-column>
        <el-table-column label="算法校验" min-width="170" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.algorithmRestriction">{{ row.algorithmRestriction }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="允许制作" width="100" align="center">
          <template #default="{ row }">
            <el-switch :model-value="row.enabled" :disabled="Boolean(row.algorithmRestriction)"
              @change="(value) => saveProfilePolicy(row, Boolean(value))" />
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <el-dialog v-model="keyOpen" title="员工公钥与历史证书" width="min(1180px, 96vw)" append-to-body>
      <el-descriptions :column="3" border class="mb12">
        <el-descriptions-item label="姓名">{{ currentEmployee?.cnName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="域账号">{{ currentEmployee?.domainAccount || '-' }}</el-descriptions-item>
        <el-descriptions-item label="科室">{{ currentEmployee?.departmentName || '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-alert class="mb12" type="info" :closable="false"
        title="自动按所选 CA、模板和密钥长度选证，新平台新生成的密钥优先，同类按原签发时间从近到远。原证不足 30 天且允许续签时保留原密钥续签；没有匹配证书时新办。指定原证不可恢复时不会换证。" />
      <el-radio-group v-model="keyChoice" class="mb12">
        <el-radio-button value="AUTO">自动选择</el-radio-button>
        <el-radio-button value="NEW">新办</el-radio-button>
      </el-radio-group>
      <el-table v-loading="keyLoading" :data="keys" border stripe max-height="400"
        :empty-text="keyLoadFailed ? '证书查询失败' : '没有匹配的历史证书，自动选择时将新办'">
        <el-table-column type="expand">
          <template #default="{ row }"><el-input :model-value="row.publicKey" type="textarea" :rows="5" readonly /></template>
        </el-table-column>
        <el-table-column label="序列号" prop="serialNumber" min-width="135" show-overflow-tooltip />
        <el-table-column label="主题" prop="subject" min-width="145" :formatter="formatCertificateSubjectColumn" show-overflow-tooltip />
        <el-table-column label="公钥算法" width="100">
          <template #default="{ row }">RSA {{ row.keySize }}</template>
        </el-table-column>
        <el-table-column label="来源" width="92">
          <template #default="{ row }">{{ row.source === 'NEW' ? '新平台' : '历史证书' }}</template>
        </el-table-column>
        <el-table-column label="原签发时间" width="155">
          <template #default="{ row }">{{ formatCandidateDate(row.issuedAt) }}</template>
        </el-table-column>
        <el-table-column label="有效期" width="155">
          <template #default="{ row }">
            <div>{{ formatCandidateDate(row.notBefore) }}</div>
            <div>{{ formatCandidateDate(row.notAfter) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="使用原证" width="103" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" :disabled="keyChoice === row.id" @click="keyChoice = row.id">
              {{ keyChoice === row.id ? '已选择' : row.renewalRequired ? '续签' : '恢复' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="keyOpen = false">取消</el-button>
        <el-button type="primary" :disabled="keyLoading" @click="saveKeyChoice">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="RaEmployeeCertIssue" lang="ts">
import { formatCertificateSubjectColumn } from '@/utils/raCertificateSubject';
import CertRowAction from '../components/CertRowAction.vue';
import { useRaListRefreshOnReturn } from '@/hooks/useRaListRefreshOnReturn';
import FileSaver from 'file-saver';
import auth from '@/plugins/auth';
import ChannelStatus from './ChannelStatus.vue';
import DistributionDialog from './DistributionDialog.vue';
import { onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { employeeCertLedgerPath } from '@/utils/fawvwEmployeeNavigation';
import { getFawvwEmployee } from '@/api/ra/employee';
import { isFawvwEmployeeSourceActive } from '@/utils/fawvwEmployeeStatus';
import { templatePurpose } from '@/utils/raCertificatePurpose';
import { certificateDownloadBlob } from '@/utils/raCertificateDownload';
import {
  type AccountResolveResult,
  canDistributeEmployeeCert,
  createEmployeeCertTask,
  downloadEmployeeCertAccountTemplate,
  downloadEmployeeCertTaskPackage,
  EmployeeCertEmployee,
  type EmployeeCert,
  EmployeeEmailCertProfile,
  type EmployeeProductionCandidate,
  type EmployeeProductionChoice,
  EmployeeCertTask,
  EmployeeCertTaskDetail,
  type EmployeePfxPasswordRule,
  getEmployeePfxPasswordDefault,
  saveEmployeePfxPasswordDefault,
  type EmployeeDistributionSelection,
  type EmployeeMailType,
  getEmployeeCertTask,
  issueEmployeeCertTask,
  importEmployeeCertAccounts,
  listEmployeeEmailCertProfiles,
  listEmployeeProductionCandidates,
  pageEmployeeCertTasks,
  resolveEmployeeCertAccounts,
  saveEmployeeEmailCertProfilePolicy
} from '@/api/ra/employeeCert';

const activeTab = ref('create');
const defaultPasswordRule: EmployeePfxPasswordRule = { length: 12, uppercase: true, lowercase: true, digits: true, symbols: false };
const passwordRule = ref<EmployeePfxPasswordRule | null>(null);
const savedPasswordRule = ref<EmployeePfxPasswordRule | null>(null);
const loadingPasswordDefault = ref(true);
const passwordDefaultLoadFailed = ref(false);
const savingPasswordDefault = ref(false);
const passwordRuleDraft = reactive({ ...defaultPasswordRule });
const passwordRuleOpen = ref(false);
const validPasswordRule = computed(() => Number.isInteger(passwordRuleDraft.length)
  && passwordRuleDraft.length >= 6 && passwordRuleDraft.length <= 12
  && (passwordRuleDraft.uppercase || passwordRuleDraft.lowercase || passwordRuleDraft.digits || passwordRuleDraft.symbols));

function openPasswordRule() {
  Object.assign(passwordRuleDraft, passwordRule.value ?? savedPasswordRule.value ?? defaultPasswordRule);
  passwordRuleOpen.value = true;
}

function savePasswordRule() {
  if (!validPasswordRule.value) return;
  passwordRule.value = { ...passwordRuleDraft };
  passwordRuleOpen.value = false;
}

async function loadDefaultPasswordRule() {
  try {
    const { data } = await getEmployeePfxPasswordDefault();
    savedPasswordRule.value = data ?? null;
    passwordDefaultLoadFailed.value = false;
  } catch {
    passwordDefaultLoadFailed.value = true;
  } finally {
    loadingPasswordDefault.value = false;
  }
}

async function setDefaultPasswordRule() {
  if (!validPasswordRule.value || savingPasswordDefault.value) return;
  savingPasswordDefault.value = true;
  try {
    const rule = { ...passwordRuleDraft };
    const { data } = await saveEmployeePfxPasswordDefault(rule);
    savedPasswordRule.value = data;
    passwordDefaultLoadFailed.value = false;
    passwordRule.value = null;
    passwordRuleOpen.value = false;
    ElMessage.success('PFX 默认密码规则已保存');
  } finally {
    savingPasswordDefault.value = false;
  }
}

function describePasswordRule(rule?: EmployeePfxPasswordRule | null) {
  if (!rule) return '默认 16 位';
  const types = [rule.uppercase && '大写字母', rule.lowercase && '小写字母', rule.digits && '数字', rule.symbols && '特殊字符'];
  return `${rule.length} 位 · ${types.filter(Boolean).join('、')}`;
}
const passwordRuleSummary = computed(() => {
  if (loadingPasswordDefault.value) return '正在读取默认规则…';
  const rule = passwordRule.value ?? savedPasswordRule.value;
  return !rule && passwordDefaultLoadFailed.value ? '默认规则读取失败' : describePasswordRule(rule);
});
const downloadingTask = ref('');
let distributionTimer: ReturnType<typeof setTimeout> | undefined;
let distributionVersion = 0;
const selectionMode = ref<'ACCOUNT' | 'FILE'>('ACCOUNT');
const form = reactive({
  accounts: '',
  rootId: '',
  profileId: '',
  validityYears: undefined as number | undefined,
  rsaKeySize: 2048 as number | undefined,
  remark: ''
});
const route = useRoute();
const router = useRouter();
const distributionDialog = ref<InstanceType<typeof DistributionDialog>>();
const fileInputRef = ref<HTMLInputElement>();
const resolving = ref(false);
const creating = ref(false);
const selectedEmployees = ref<EmployeeCertEmployee[]>([]);
const missingAccounts = ref<string[]>([]);
const blockedAccounts = ref<NonNullable<AccountResolveResult['blockedAccounts']>>([]);
const rosterName = ref('');
const duplicateCount = ref(0);
const emailProfiles = ref<EmployeeEmailCertProfile[]>([]);
const profilePolicyOpen = ref(false);
const eligibleProfiles = computed(() => emailProfiles.value.filter((item) => item.enabled && !item.algorithmRestriction));
const eligibleCas = computed(() =>
  Array.from(new Map(eligibleProfiles.value.map((item) => [String(item.rootId), item.rootName] as const)),
    ([id, name]) => ({ id, name }))
);
const profilesForCa = computed(() => eligibleProfiles.value.filter((item) => String(item.rootId) === form.rootId));
const selectedProfile = computed(() => profilesForCa.value.find((item) => String(item.profileId) === form.profileId));
const maxValidityYears = computed(() => selectedProfile.value?.maxValidityYears ?? 0);
const rsaKeySizes = [2048, 4096];
const supportedRsaKeySizes = computed(() => selectedProfile.value?.supportedRsaKeySizes ?? []);
watch(supportedRsaKeySizes, sizes => {
  if (!form.rsaKeySize || !sizes.includes(form.rsaKeySize)) {
    form.rsaKeySize = !selectedProfile.value || sizes.includes(2048) ? 2048 : undefined;
  }
}, { flush: 'sync' });
const canCreateTask = computed(
  () => Boolean(selectedProfile.value) && form.validityYears != null && form.validityYears >= 1 && form.validityYears <= maxValidityYears.value
    && form.rsaKeySize != null && supportedRsaKeySizes.value.includes(form.rsaKeySize)
    && !resolving.value && !creating.value && selectedEmployees.value.length > 0
    && !missingAccounts.value.length && !blockedAccounts.value.length
);
watch(() => form.rootId, () => { form.profileId = ''; }, { flush: 'sync' });
watch([() => form.profileId, maxValidityYears], () => { form.validityYears = undefined; }, { flush: 'sync' });
watch([selectionMode, () => form.accounts], clearRoster, { flush: 'sync' });

const taskLoading = ref(false);
const tasks = ref<EmployeeCertTask[]>([]);
const taskTotal = ref(0);
const taskQuery = reactive({ pageNum: 1, pageSize: 10, taskNo: '', certTypeCode: 'EMAIL' });
const taskOpen = ref(false);
const taskDetail = ref<Partial<EmployeeCertTaskDetail>>({ certs: [] });
const detailIssueStatus = computed(() => taskIssueStatus(taskDetail.value.task?.taskStatus));
const issuingTask = ref(false);
const issueSelection = ref<EmployeeCert[]>([]);
const issueTable = ref<{ clearSelection: () => void }>();
const issueHistoryOpen = ref(false);
const historyCert = ref<EmployeeCert>();

const canIssueCert = (cert: EmployeeCert) => !cert.raCertId && !cert.serialNumber
  && ['PENDING', 'READY_FOR_ISSUE', 'PRECHECKED', 'FAILED'].includes(cert.issueStatus || '');
const issueStatusLabel = (status?: string) => ({
  PENDING: '待签发', READY_FOR_ISSUE: '待签发', PRECHECKED: '待签发', ISSUING: '签发中', ISSUED: '签发成功', FAILED: '签发失败'
} as Record<string, string>)[status || ''] || status || '-';

function issueStatusType(status?: string) {
  if (status === 'ISSUED') return 'success';
  if (status === 'FAILED') return 'danger';
  return status === 'ISSUING' ? 'warning' : 'info';
}

function compareIssueStatus(left: EmployeeCert, right: EmployeeCert) {
  const rank = (status?: string) => status === 'FAILED' ? -1 : status === 'ISSUED' ? 1 : 0;
  return rank(left.issueStatus) - rank(right.issueStatus);
}

function showIssueHistory(cert: EmployeeCert) {
  historyCert.value = cert;
  issueHistoryOpen.value = true;
}

const keyOpen = ref(false);
const keyLoading = ref(false);
const keyLoadFailed = ref(false);
const currentEmployee = ref<EmployeeCertEmployee>();
const keys = ref<EmployeeProductionCandidate[]>([]);
const keyChoice = ref('AUTO');
const productionChoices = ref<Record<string, EmployeeProductionChoice>>({});
let keyRequestId = 0;

watch([() => form.rootId, () => form.profileId, () => form.rsaKeySize], () => {
  productionChoices.value = {};
  keyOpen.value = false;
  keyRequestId++;
}, { flush: 'sync' });

function unwrapData<T>(res: any): T {
  const body = res?.data ?? res;
  return (body?.data ?? body) as T;
}

function clearRoster() {
  selectedEmployees.value = [];
  productionChoices.value = {};
  keyOpen.value = false;
  keyRequestId++;
  missingAccounts.value = [];
  blockedAccounts.value = [];
  rosterName.value = '';
  duplicateCount.value = 0;
}

async function resolveAccounts() {
  const accounts = form.accounts;
  if (resolving.value || creating.value || selectionMode.value !== 'ACCOUNT' || !accounts.trim()) return;
  clearRoster();
  resolving.value = true;
  try {
    const data = unwrapData<AccountResolveResult>(await resolveEmployeeCertAccounts(accounts));
    if (selectionMode.value !== 'ACCOUNT' || form.accounts !== accounts) return;
    selectedEmployees.value = data?.employees || [];
    missingAccounts.value = data?.missingAccounts || [];
    blockedAccounts.value = data?.blockedAccounts || [];
  } finally {
    resolving.value = false;
  }
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || resolving.value || creating.value || selectionMode.value !== 'FILE') {
    return;
  }
  clearRoster();
  resolving.value = true;
  try {
    const data = unwrapData<AccountResolveResult>(await importEmployeeCertAccounts(file));
    if (selectionMode.value !== 'FILE') return;
    selectedEmployees.value = data?.employees || [];
    missingAccounts.value = data?.missingAccounts || [];
    blockedAccounts.value = data?.blockedAccounts || [];
    rosterName.value = file.name;
    duplicateCount.value = Number(data?.duplicateCount || 0);
  } finally {
    resolving.value = false;
  }
}

async function downloadTemplate() {
  const response: any = await downloadEmployeeCertAccountTemplate();
  const blob = response?.data instanceof Blob ? response.data : new Blob([response?.data || response]);
  FileSaver.saveAs(blob, 'employee-cert-accounts.csv');
}

async function createTask() {
  const profile = selectedProfile.value;
  const validityYears = form.validityYears;
  const rsaKeySize = form.rsaKeySize;
  if (!profile || validityYears == null || rsaKeySize == null || !canCreateTask.value) return;
  creating.value = true;
  try {
    const detail = unwrapData<EmployeeCertTaskDetail>(
      await createEmployeeCertTask({
        employeeIds: selectedEmployees.value.map((item) => item.id),
        identityKeys: selectedEmployees.value.map((item) => item.identityKey),
        userIds: selectedEmployees.value.map((item) => item.raUserId ?? null),
        rootId: profile.rootId,
        profileId: profile.profileId,
        validityYears,
        rsaKeySize,
        productionChoices: selectedEmployees.value.flatMap(item => {
          const choice = productionChoices.value[String(item.id)];
          return choice ? [choice] : [];
        }),
        pfxPasswordRule: passwordRule.value ?? savedPasswordRule.value,
        remark: form.remark
      })
    );
    ElMessage.success('员工加密证书制作任务已创建');
    passwordRule.value = null;
    productionChoices.value = {};
    taskDetail.value = detail;
    activeTab.value = 'tasks';
    await loadTasks();
  } finally {
    creating.value = false;
  }
}

function taskCaName(rootId?: EmployeeCertTask['rootId']) {
  if (rootId == null) return '-';
  return emailProfiles.value.find((item) => String(item.rootId) === String(rootId))?.rootName || `CA ID: ${rootId}`;
}

function resetUnavailableIssuanceSelection() {
  if (!eligibleCas.value.some((ca) => ca.id === form.rootId)) form.rootId = '';
  if (!selectedProfile.value) form.profileId = '';
}

async function loadEmailProfiles() {
  emailProfiles.value = unwrapData<EmployeeEmailCertProfile[]>(await listEmployeeEmailCertProfiles()) || [];
  resetUnavailableIssuanceSelection();
}

async function openProfilePolicy() {
  await loadEmailProfiles();
  profilePolicyOpen.value = true;
}

async function saveProfilePolicy(row: EmployeeEmailCertProfile, enabled: boolean) {
  await saveEmployeeEmailCertProfilePolicy({ rootId: row.rootId, profileId: row.profileId, enabled });
  row.enabled = enabled;
  resetUnavailableIssuanceSelection();
  ElMessage.success(enabled ? '已纳入员工加密证书模板池' : '已移出员工加密证书模板池');
}

let taskListVersion = 0;

async function loadTasks() {
  const version = ++taskListVersion;
  taskLoading.value = true;
  try {
    const page = unwrapData<any>(await pageEmployeeCertTasks(taskQuery));
    if (version !== taskListVersion) return;
    tasks.value = page?.rows || page?.records || [];
    taskTotal.value = Number(page?.total || 0);
  } finally {
    if (version === taskListVersion) taskLoading.value = false;
  }
}

async function handleTabChange(tabName: string | number) {
  if (tabName === 'tasks') {
    await loadTasks();
  }
}

function resetTaskQuery() {
  taskQuery.pageNum = 1;
  taskQuery.taskNo = '';
  loadTasks();
}

function taskIssueStatus(status?: string) {
  if (status === 'DISTRIBUTED' || status === 'ISSUED') return 'ISSUED';
  if (status === 'PARTIAL_FAILED' || status === 'FAILED') return 'FAILED';
  return undefined;
}

function productionTypeLabel(row: EmployeeCert) {
  switch (row.productionMode) {
    case 'AUTO':
      return row.originalSerialNumbers?.length ? '密钥恢复' : '自动选择';
    case 'SELECTED':
    case 'RECOVER':
    case 'RENEW':
      return '密钥恢复';
    default:
      return '新办';
  }
}

async function openTask(row: Pick<EmployeeCertTask, 'taskNo'>) {
  if (issuingTask.value) return;
  issueTable.value?.clearSelection();
  issueSelection.value = [];
  const version = ++distributionVersion;
  if (distributionTimer) clearTimeout(distributionTimer);
  const detail = unwrapData<EmployeeCertTaskDetail>(await getEmployeeCertTask(row.taskNo));
  if (version !== distributionVersion || issuingTask.value) return;
  taskDetail.value = detail;
  taskOpen.value = true;
  watchTaskDistribution(row.taskNo);
}

function watchTaskDistribution(taskNo: string) {
  if (!(taskDetail.value.certs || []).some((row) => row.distributionStatus === 'SENDING')) return;
  const version = distributionVersion;
  distributionTimer = setTimeout(async () => {
    if (version !== distributionVersion || !taskOpen.value) return;
    try {
      const latest = unwrapData<EmployeeCertTaskDetail>(await getEmployeeCertTask(taskNo));
      if (version !== distributionVersion || !taskOpen.value) return;
      taskDetail.value = latest;
      watchTaskDistribution(taskNo);
    } catch {
      ElMessage.warning('分发进度查询失败，请重新打开任务详情');
    }
  }, 3000);
}

async function downloadTaskPackage(row: EmployeeCertTask) {
  if (downloadingTask.value) return;
  downloadingTask.value = row.taskNo;
  let response: Blob | undefined;
  try {
    response = await downloadEmployeeCertTaskPackage(row.taskNo);
    const blob = await certificateDownloadBlob(response, 'application/zip');
    const prefix = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    if (prefix.join(',') !== '80,75,3,4') throw new Error('服务器未返回有效的 ZIP 文件');
    FileSaver.saveAs(blob, `employee-certs-${row.taskNo.replace(/[^A-Za-z0-9_-]/g, '_')}.zip`);
  } catch (error: any) {
    const body = error?.response?.data ?? response;
    let message = error?.message || '证书压缩包下载失败';
    if (body instanceof Blob && body.size < 64 * 1024) {
      try {
        const data = JSON.parse(await body.text());
        message = data.msg || data.message || message;
      } catch {
        // Keep the download error if the response is not JSON.
      }
    }
    ElMessage.error(message);
  } finally {
    downloadingTask.value = '';
  }
}

function canSelectTaskCert(cert: EmployeeCert) {
  return canIssueCert(cert) || canDistributeEmployeeCert(cert);
}

let taskLedgerEntry = 0;

function canOpenTaskLedger() {
  return auth.hasPermi('ra:employee-cert') && router.resolve(employeeCertLedgerPath).matched.some(record => record.path === employeeCertLedgerPath);
}

async function distributeTask(row: EmployeeCertTask) {
  if (!auth.hasPermi('ra:employee-cert:distribute') || !row.taskNo) return;
  if (canOpenTaskLedger()) {
    if (!taskDetail.value.certs?.some(cert => canDistributeEmployeeCert(cert))) return;
    const failure = await router.push({
      path: employeeCertLedgerPath,
      query: { taskNo: row.taskNo, taskEntry: `${Date.now()}-${++taskLedgerEntry}` }
    });
    if (!failure) taskOpen.value = false;
    return;
  }
  const selected = issueSelection.value.filter(cert => canDistributeEmployeeCert(cert));
  if (!selected.length || selected.length !== issueSelection.value.length) {
    ElMessage.warning('请仅勾选本次要分发的有效证书');
    return;
  }
  distributionDialog.value?.open({ ids: selected.map(cert => String(cert.id)) }, `所选 ${selected.length} 张证书对应的员工`, row.taskNo);
}

async function onFallbackDistributionSubmitted(selection: EmployeeDistributionSelection, messageType: EmployeeMailType) {
  if (messageType === 'TEXT') {
    ElMessage.info('请由有证书台账权限的人员在分发记录中查看纯文本通知结果');
  } else if (selection.taskNo && taskDetail.value.task?.taskNo === selection.taskNo && taskOpen.value) {
    await openTask({ taskNo: selection.taskNo });
  }
}

async function issueSelectedCerts() {
  const taskNo = taskDetail.value.task?.taskNo;
  const certIds = issueSelection.value.filter(canIssueCert).map((row) => String(row.id));
  if (!taskNo || !certIds.length || issuingTask.value) return;
  issuingTask.value = true;
  try {
    const confirmed = await ElMessageBox.confirm(`仅执行选中的 ${certIds.length} 条明细，未选中的记录不会签发。确认执行？`, '执行签发', {
      confirmButtonText: '开始签发', cancelButtonText: '取消', type: 'warning'
    }).then(() => true, () => false);
    if (!confirmed) return;
    distributionVersion++;
    if (distributionTimer) clearTimeout(distributionTimer);
    try {
      taskDetail.value = unwrapData<EmployeeCertTaskDetail>(await issueEmployeeCertTask(taskNo, certIds));
      issueTable.value?.clearSelection();
      issueSelection.value = [];
      ElMessage.info('已执行选中的签发明细，请查看逐人结果');
    } finally {
      await loadTasks();
      watchTaskDistribution(taskNo);
    }
  } finally {
    issuingTask.value = false;
  }
}

async function openKeys(row: EmployeeCertEmployee) {
  const profile = selectedProfile.value;
  const rsaKeySize = form.rsaKeySize;
  if (!profile || rsaKeySize == null || !supportedRsaKeySizes.value.includes(rsaKeySize)) {
    ElMessage.warning('请先选择颁发 CA、模板和密钥长度');
    return;
  }
  const requestId = ++keyRequestId;
  currentEmployee.value = row;
  keys.value = [];
  keyLoadFailed.value = false;
  const saved = productionChoices.value[String(row.id)];
  keyChoice.value = saved?.mode === 'SELECTED' ? saved.certId ?? 'AUTO' : saved?.mode ?? 'AUTO';
  keyOpen.value = true;
  keyLoading.value = true;
  try {
    const data = unwrapData<EmployeeProductionCandidate[]>(await listEmployeeProductionCandidates(row.id, {
      rootId: profile.rootId, profileId: profile.profileId, rsaKeySize
    }));
    if (requestId === keyRequestId && keyOpen.value) {
      keys.value = data || [];
    }
  } catch {
    if (requestId === keyRequestId && keyOpen.value) keyLoadFailed.value = true;
  } finally {
    if (requestId === keyRequestId) keyLoading.value = false;
  }
}

function saveKeyChoice() {
  const employeeId = currentEmployee.value?.id;
  if (employeeId == null || keyLoading.value) return;
  const id = String(employeeId);
  if (keyChoice.value === 'AUTO') delete productionChoices.value[id];
  else if (keyChoice.value === 'NEW') productionChoices.value[id] = { employeeId, mode: 'NEW' };
  else if (keys.value.some(cert => cert.id === keyChoice.value)) {
    productionChoices.value[id] = { employeeId, mode: 'SELECTED', certId: keyChoice.value };
  } else {
    ElMessage.warning('原证书已不在候选列表，请重新选择');
    return;
  }
  keyOpen.value = false;
}

function formatCandidateDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleString('zh-CN', { hour12: false });
}

function formatDate(value?: string) {
  return value ? value.replace('T', ' ').slice(0, 19) : '-';
}

onMounted(async () => {
  await Promise.all([loadTasks(), loadEmailProfiles(), loadDefaultPasswordRule()]);
});
watch(() => route.fullPath, async (entry, _, onCleanup) => {
  if (!/^\/ra-cert-management\/ra-employee-cert-issue\/?$/.test(route.path)) return;
  const { employeeId, identityKey } = route.query;
  if (typeof employeeId !== 'string' || typeof identityKey !== 'string') return;
  let cancelled = false;
  onCleanup(() => {
    cancelled = true;
    resolving.value = false;
  });
  activeTab.value = 'create';
  selectionMode.value = 'ACCOUNT';
  form.accounts = '';
  clearRoster();
  resolving.value = true;
  try {
    const employee = unwrapData<import('@/api/ra/employee').FawvwEmployee>(await getFawvwEmployee(employeeId));
    if (cancelled || route.fullPath !== entry) return;
    if (!employee || employee.identityKey !== identityKey || !employee.localEnabled || employee.identityStatus !== 'VALID'
        || (employee.recordSource === 'API' && !isFawvwEmployeeSourceActive(employee.sourceStatus))) {
      ElMessage.warning('员工身份或状态已变化，请返回员工信息重新确认');
      return;
    }
    form.accounts = employee.domainAccount;
    selectedEmployees.value = [{ ...employee, sourceStatus: employee.recordSource === 'API' ? employee.sourceStatus : 'A' }];
  } finally {
    if (!cancelled) resolving.value = false;
  }
}, { immediate: true });
onUnmounted(() => {
  distributionVersion++;
  if (distributionTimer) clearTimeout(distributionTimer);
});
useRaListRefreshOnReturn(() => Promise.all([loadTasks(), loadEmailProfiles()]));
</script>

<style scoped>
.pfx-rule-summary {
  margin-inline-start: 8px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.blocked-account-list {
  display: block;
  max-height: 160px;
  overflow: auto;
}

.blocked-account-list > span {
  display: block;
  overflow-wrap: anywhere;
}

.roster-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  overflow-wrap: anywhere;
}

.employee-cert-tabs {
  min-height: 0;
}

.employee-cert-tabs :deep(.el-tabs__header) {
  margin-bottom: 16px;
}

.employee-cert-tabs :deep(.el-tabs__content) {
  overflow: visible;
}

.work-card {
  min-height: 620px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-actions,
.employee-source-bar,
.employee-source-actions,
.selection-summary {
  display: flex;
  align-items: center;
}

.employee-source-bar,
.selection-summary {
  justify-content: space-between;
  gap: 12px;
}

.employee-source-bar {
  margin-bottom: 12px;
}

.employee-source-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.account-input {
  margin-bottom: 12px;
}

.selection-summary {
  margin: 16px 0 12px;
}

.selection-summary strong {
  color: var(--el-color-primary);
}

.original-serial {
  color: var(--el-text-color-secondary);
  overflow-wrap: anywhere;
  white-space: normal;
}

.employee-selection-table {
  width: 100%;
}

.task-list-card {
  min-height: 310px;
}

@media (max-height: 760px), (max-width: 1100px) {
  .task-list-card {
    min-height: 0;
  }
}

.hidden-file {
  display: none;
}

.mb12 {
  margin-bottom: 12px;
}

.field-hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 20px;
}

@media (max-width: 768px) {
  .employee-source-bar,
  .selection-summary {
    align-items: flex-start;
    flex-direction: column;
  }

  .employee-source-actions {
    justify-content: flex-start;
  }
}
</style>
