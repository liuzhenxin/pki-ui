<template>
  <div class="app-container employee-cert-issue-page">
    <el-tabs v-model="activeTab" class="employee-cert-tabs" @tab-change="handleTabChange">
      <el-tab-pane label="制作申请" name="create">
        <el-card shadow="never" class="work-card">
          <template #header>
            <div class="card-header">
              <span>员工加密证书制作</span>
              <div class="header-actions">
                <el-button v-hasPermi="['ra:employee-cert:issue']" icon="Setting" @click="openProfilePolicy">模板准入</el-button>
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
                <el-form-item label="签发方式" required>
                  <el-select v-model="form.issuanceMode"
                    :disabled="!supportsRenewal || loadingIssuanceDefault || creating" style="width: 100%"
                    :placeholder="selectedProfile ? '请选择签发方式' : '请先选择签发模板'">
                    <el-option label="新签" value="NEW" />
                    <el-option v-if="supportsRenewal" label="续签" value="RENEW" />
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
              <el-col :xs="24" :sm="12" :lg="8">
                <el-form-item label="生效时间" required>
                  <el-date-picker v-model="form.notBefore" type="datetime" placeholder="请选择生效时间" style="width: 100%" :disabled="creating" />
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12" :lg="8">
                <el-form-item label="有效期" class="issue-validity-field" required :error="validityPreview.error">
                  <div class="issue-validity-input">
                    <el-input-number
                      v-model="form.validityAmount"
                      :min="1"
                      :controls="false"
                      placeholder="请输入有效期"
                      :disabled="!selectedProfile || creating"
                    />
                    <el-select v-model="form.validityUnit" aria-label="有效期单位" :disabled="!selectedProfile || creating">
                      <el-option v-for="unit in employeeValidityUnits" :key="unit.value" :value="unit.value" :label="unit.label" />
                    </el-select>
                  </div>
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
                <CertRowAction :label="form.issuanceMode === 'RENEW' ? '查看公钥与选择原证' : '查看公钥'" icon="Key" :disabled="creating" @click="openKeys(row)" />
                <div v-if="productionChoiceLabel(row)">
                  <el-tag size="small" type="info">{{ productionChoiceLabel(row) }}</el-tag>
                </div>
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
              <el-input v-model="taskQuery.taskNo" clearable placeholder="任务号" style="width: 200px" @keyup.enter="searchTasks" />
            </el-form-item>
            <el-form-item label="签发模板">
              <el-select v-model="taskQuery.profileId" clearable filterable placeholder="全部" style="width: 220px">
                <el-option v-for="profile in taskProfiles" :key="profile.id" :label="profile.name" :value="profile.id" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" icon="Search" @click="searchTasks">搜索</el-button>
              <el-button icon="Refresh" @click="resetTaskQuery">重置</el-button>
            </el-form-item>
          </el-form>
          <el-table v-loading="taskLoading" :data="tasks" border stripe empty-text="暂无制作任务">
            <el-table-column label="任务号" prop="taskNo" min-width="210" show-overflow-tooltip />
            <el-table-column label="签发模板" prop="profileNameSnapshot" min-width="190" show-overflow-tooltip />
            <el-table-column label="证书类型" prop="certTypeName" min-width="130" />
            <el-table-column label="完成/总人数" min-width="120" align="center">
              <template #default="{ row }">{{ row.successCount }}/{{ row.totalCount }}</template>
            </el-table-column>
            <el-table-column label="任务状态" min-width="120" align="center">
              <template #default="{ row }">
                <el-tag v-if="taskIssueStatus(row.taskStatus)" :type="issueStatusType(taskIssueStatus(row.taskStatus))" effect="plain">
                  {{ issueStatusLabel(taskIssueStatus(row.taskStatus)) }}
                </el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column label="创建时间" min-width="166" align="center">
              <template #default="{ row }">{{ formatDate(row.createTime) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="106" align="center" fixed="right">
              <template #default="{ row }">
                <CertRowAction label="详情" icon="View" @click="openTask(row)" />
                <EmployeeCertificateDownloadMenu v-hasPermi="['ra:employee-cert:distribute']"
                  :loading="downloadingTask === row.taskNo" :disabled="row.successCount <= 0 || Boolean(downloadingTask)"
                  @download="downloadTaskPackage(row, $event)" />
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
        <template v-if="taskDetail.requestedValidity">
          <el-descriptions-item label="生效时间">{{ formatCandidateDate(taskDetail.requestedValidity.notBefore) }}</el-descriptions-item>
          <el-descriptions-item label="到期时间">{{ formatCandidateDate(taskDetail.requestedValidity.notAfter) }}</el-descriptions-item>
        </template>
        <el-descriptions-item v-else label="有效期">{{ taskDetail.task?.validityYears ? `${taskDetail.task.validityYears} 年` : '按 CA 模板' }}</el-descriptions-item>
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
        <el-button v-if="manualIssue || taskDetail.certs?.some(canIssueTaskCert)" type="primary" icon="Promotion"
          :disabled="issuingTask || !issueSelection.some(canIssueTaskCert)" :loading="Boolean(manualIssue)" @click="issueSelectedCerts">
          {{ manualIssue ? '签发中' : taskDetail.certs?.some(cert => canIssueTaskCert(cert) && cert.issueStatus !== 'FAILED') ? '签发' : '重签' }}
        </el-button>
      </div>
      <el-table :key="taskDetail.task?.taskNo" ref="issueTable" :data="taskDetail.certs || []" :row-key="(row) => String(row.id)" border stripe
        @selection-change="issueSelection = $event">
        <el-table-column type="selection" width="48" fixed :selectable="canIssueTaskCert" />
        <el-table-column label="姓名" prop="employeeName" width="110" />
        <el-table-column label="域账号" prop="domainAccount" width="120" />
        <el-table-column label="办理类型" width="104">
          <template #default="{ row }">{{ productionTypeLabel(row) }}</template>
        </el-table-column>
        <el-table-column label="序列号" prop="serialNumber" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <el-button v-if="row.serialNumber && row.raCertId" link type="primary" @click="issuedDetail?.open({ id: row.id })">{{ row.serialNumber }}</el-button>
            <span v-else>{{ row.serialNumber || '-' }}</span>
            <div v-for="original in row.originalSerialNumbers" :key="original" class="original-serial">旧证书序列号：{{ original }}</div>
          </template>
        </el-table-column>
        <el-table-column label="签发状态" prop="issueStatus" width="118" align="center" sortable
          :sort-method="compareIssueStatus" :sort-orders="['ascending', 'descending', null]">
          <template #default="{ row }">
            <el-tag :type="issueStatusType(displayIssueStatus(row))" effect="plain">{{ issueStatusLabel(displayIssueStatus(row)) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="签发记录" width="100" fixed="right">
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
      <template v-if="taskDetail.task && taskDetail.certs?.some(cert => cert.issueStatus === 'ISSUED')" #footer>
        <el-button
          v-hasPermi="['ra:employee-cert:distribute']"
          icon="Promotion"
          @click="distributeTask(taskDetail.task)"
        >批量分发</el-button>
        <EmployeeCertificateDownloadMenu v-hasPermi="['ra:employee-cert:distribute']" class="ml10" button="primary"
          :loading="downloadingTask === taskDetail.task.taskNo" :disabled="Boolean(downloadingTask)"
          @download="downloadTaskPackage(taskDetail.task, $event)" />
      </template>
    </el-drawer>

    <RaCertDetailDialog ref="issuedDetail" :load-detail="loadIssuedDetail" />
    <el-dialog v-model="distributionPickerOpen" title="选择分发证书" width="680px" append-to-body>
      <el-table :data="distributableTaskCerts" max-height="360" border empty-text="当前没有可分发的证书"
        @selection-change="distributionSelection = $event">
        <el-table-column type="selection" width="48" />
        <el-table-column label="姓名" prop="employeeName" min-width="110" />
        <el-table-column label="域账号" prop="domainAccount" min-width="140" />
        <el-table-column label="序列号" prop="serialNumber" min-width="180" show-overflow-tooltip />
      </el-table>
      <template #footer>
        <el-button @click="distributionPickerOpen = false">取消</el-button>
        <el-button type="primary" :disabled="!distributionSelection.length" @click="confirmTaskDistribution">继续</el-button>
      </template>
    </el-dialog>

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
      <template #header="{ titleId, titleClass }">
        <div class="profile-policy-heading">
          <span :id="titleId" :class="titleClass">员工加密证书模板准入</span>
          <el-tooltip content="设置制作申请默认选项" placement="top">
            <el-button
              link
              icon="Setting"
              aria-label="设置制作申请默认选项"
              :disabled="creating || loadingIssuanceDefault"
              @click="openIssuanceDefaults"
            />
          </el-tooltip>
        </div>
      </template>
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
            <el-switch
              v-if="canEditProfilePolicy"
              :model-value="row.enabled"
              :disabled="Boolean(row.algorithmRestriction)"
              @change="(value) => saveProfilePolicy(row, Boolean(value))"
            />
            <span v-else>{{ row.enabled ? '已准入' : '未准入' }}</span>
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
      <el-alert v-if="form.issuanceMode === 'RENEW'" class="mb12" type="info" :closable="false"
        title="续签保留原密钥。自动选择时按所选 CA、模板和密钥长度匹配原证。没有匹配原证的员工改为新签。有原证但密钥不可恢复时，该员工签发失败。" />
      <el-radio-group v-if="form.issuanceMode === 'RENEW'" v-model="keyChoice" class="mb12">
        <el-radio-button value="AUTO">自动选择</el-radio-button>
        <el-radio-button value="NEW">新签</el-radio-button>
      </el-radio-group>
      <el-table v-loading="keyLoading" :data="keys" border stripe max-height="400"
        :empty-text="keyLoadFailed ? '证书查询失败' : '没有匹配的历史证书'">
        <el-table-column type="expand">
          <template #default="{ row }"><el-input :model-value="row.publicKey" type="textarea" :rows="5" readonly /></template>
        </el-table-column>
        <el-table-column label="序列号" prop="serialNumber" min-width="135" show-overflow-tooltip>
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="candidateDetail?.open(row)">{{ row.serialNumber }}</el-button>
          </template>
        </el-table-column>
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
        <el-table-column v-if="form.issuanceMode === 'RENEW'" label="使用原证" width="103" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" :disabled="keyChoice === row.id" @click="keyChoice = row.id">
              {{ keyChoice === row.id ? '已选择' : '续签' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="keyOpen = false">取消</el-button>
        <el-button v-if="form.issuanceMode === 'RENEW'" type="primary" :disabled="keyLoading" @click="saveKeyChoice">确定</el-button>
      </template>
    </el-dialog>
    <RaCertDetailDialog v-if="keyOpen" ref="candidateDetail" :load-detail="loadCandidateCertificate" />

    <el-dialog v-model="issuanceDefaultsOpen" title="制作申请默认设置" width="500px" append-to-body>
      <el-form label-width="124px" :disabled="savingIssuanceDefault">
        <el-form-item label="默认颁发 CA">
          <el-select v-model="issuanceDefaultDraft.rootId" filterable placeholder="请选择颁发 CA">
            <el-option v-for="ca in eligibleCas" :key="ca.id" :label="ca.name" :value="ca.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="默认签发模板">
          <el-select v-model="issuanceDefaultDraft.profileId" filterable :disabled="!issuanceDefaultDraft.rootId" placeholder="请选择签发模板">
            <el-option
              v-for="profile in defaultProfilesForCa"
              :key="String(profile.profileId)"
              :label="profile.profileName"
              :value="String(profile.profileId)"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="默认密钥长度">
          <el-select v-model="issuanceDefaultDraft.rsaKeySize" :disabled="!draftProfile" placeholder="请选择密钥长度">
            <el-option v-for="size in draftProfile?.supportedRsaKeySizes ?? []" :key="size" :label="size + ' 位'" :value="size" />
          </el-select>
        </el-form-item>
        <el-form-item label="默认签发方式">
          <el-select v-model="issuanceDefaultDraft.issuanceMode" :disabled="!draftSupportsRenewal">
            <el-option label="新签" value="NEW" />
            <el-option v-if="draftSupportsRenewal" label="续签" value="RENEW" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="savingIssuanceDefault" @click="saveIssuanceDefault(true)">清空默认</el-button>
        <el-button :disabled="savingIssuanceDefault" @click="issuanceDefaultsOpen = false">取消</el-button>
        <el-button type="primary" :loading="savingIssuanceDefault" :disabled="!canSaveIssuanceDefault" @click="saveIssuanceDefault()">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="RaEmployeeCertIssue" lang="ts">
import { formatCertificateSubjectColumn } from '@/utils/raCertificateSubject';
import CertRowAction from '../components/CertRowAction.vue';
import RaCertDetailDialog from '../components/RaCertDetailDialog.vue';
import { useRaListRefreshOnReturn } from '@/hooks/useRaListRefreshOnReturn';
import FileSaver from 'file-saver';
import auth from '@/plugins/auth';
import EmployeeCertificateDownloadMenu from './EmployeeCertificateDownloadMenu.vue';
import type { EmployeeCertDownloadFormat } from '@/api/ra/employeeCert';
import ChannelStatus from './ChannelStatus.vue';
import DistributionDialog from './DistributionDialog.vue';
import { onDeactivated, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { employeeCertLedgerPath } from '@/utils/fawvwEmployeeNavigation';
import type { RaCertFilterOption } from '@/api/ra/cert';
import { getFawvwEmployee } from '@/api/ra/employee';
import { isFawvwEmployeeSourceActive } from '@/utils/fawvwEmployeeStatus';
import { templatePurpose } from '@/utils/raCertificatePurpose';
import { employeeCertificateDownload } from '@/utils/raCertificateDownload';
import { defaultIssueDuration, issueValidityUnits, resolveIssueValidity, type IssueValidityUnit } from '@/utils/raIssueValidity';
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
  type EmployeeCertIssuanceMode,
  type EmployeeCertIssuanceDefault,
  getEmployeeCertIssuanceDefault,
  saveEmployeeCertIssuanceDefault,
  EmployeeCertTask,
  EmployeeCertTaskDetail,
  type EmployeePfxPasswordRule,
  getEmployeePfxPasswordDefault,
  saveEmployeePfxPasswordDefault,
  type EmployeeDistributionSelection,
  type EmployeeMailType,
  getEmployeeCertTask,
  getEmployeeTaskCertificate,
  getEmployeeProductionCandidateAvailability,
  getEmployeeProductionCandidateDetail,
  issueEmployeeCertTask,
  importEmployeeCertAccounts,
  listEmployeeEmailCertProfiles,
  listEmployeeProductionCandidates,
  listEmployeeCertTaskProfiles,
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
  return !rule && passwordDefaultLoadFailed.value ? '默认规则读取失败' : `${rule?.length ?? 16} 位`;
});
const downloadingTask = ref('');
let taskDetailTimer: ReturnType<typeof setTimeout> | undefined;
let taskDetailVersion = 0;
let taskListTimer: ReturnType<typeof setTimeout> | undefined;
let taskPageVisible = true;
const selectionMode = ref<'ACCOUNT' | 'FILE'>('ACCOUNT');
const form = reactive({
  accounts: '',
  rootId: '',
  profileId: '',
  issuanceMode: undefined as EmployeeCertIssuanceMode | undefined,
  rsaKeySize: undefined as number | undefined,
  notBefore: new Date() as Date | null,
  validityAmount: undefined as number | undefined,
  validityUnit: 'year' as IssueValidityUnit,
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
const canEditProfilePolicy = computed(() => auth.hasPermi('ra:employee-cert:template'));
const eligibleProfiles = computed(() => emailProfiles.value.filter((item) => item.enabled && !item.algorithmRestriction));
const eligibleCas = computed(() =>
  Array.from(new Map(eligibleProfiles.value.map((item) => [String(item.rootId), item.rootName] as const)),
    ([id, name]) => ({ id, name }))
);
const profilesForCa = computed(() => eligibleProfiles.value.filter((item) => String(item.rootId) === form.rootId));
const selectedProfile = computed(() => profilesForCa.value.find((item) => String(item.profileId) === form.profileId));
function profileSupportsRenewal(profile?: EmployeeEmailCertProfile) {
  return profile?.profileName.replace(/\s+/g, '').toLowerCase() === '安全internet邮件证书模板';
}

const supportsRenewal = computed(() => profileSupportsRenewal(selectedProfile.value));
const issuanceDefault = ref<EmployeeCertIssuanceDefault>({ issuanceMode: 'NEW' });
const loadingIssuanceDefault = ref(true);
const issuanceDefaultsOpen = ref(false);
const savingIssuanceDefault = ref(false);
const issuanceDefaultDraft = reactive({
  rootId: '',
  profileId: '',
  rsaKeySize: undefined as number | undefined,
  issuanceMode: 'NEW' as EmployeeCertIssuanceMode
});
const defaultProfilesForCa = computed(() => eligibleProfiles.value.filter((profile) => String(profile.rootId) === issuanceDefaultDraft.rootId));
const draftProfile = computed(() => defaultProfilesForCa.value.find((profile) => String(profile.profileId) === issuanceDefaultDraft.profileId));
const draftSupportsRenewal = computed(() => profileSupportsRenewal(draftProfile.value));
const canSaveIssuanceDefault = computed(
  () => issuanceDefaultDraft.rsaKeySize != null && draftProfile.value?.supportedRsaKeySizes?.includes(issuanceDefaultDraft.rsaKeySize)
);

function defaultModeForProfile(profile?: EmployeeEmailCertProfile): EmployeeCertIssuanceMode {
  if (!profileSupportsRenewal(profile) || !profile) return 'NEW';
  const preference = issuanceDefault.value;
  const matches = !preference.profileId || (preference.rootId === String(profile.rootId) && preference.profileId === String(profile.profileId));
  return matches ? preference.issuanceMode : 'NEW';
}

watch(
  () => issuanceDefaultDraft.rootId,
  () => {
    issuanceDefaultDraft.profileId = '';
  },
  { flush: 'sync' }
);
watch(
  draftProfile,
  (profile) => {
    const sizes = profile?.supportedRsaKeySizes ?? [];
    issuanceDefaultDraft.rsaKeySize = sizes.includes(2048) ? 2048 : sizes[0];
    issuanceDefaultDraft.issuanceMode = defaultModeForProfile(profile);
  },
  { flush: 'sync' }
);

function applyDefaultIssuanceMode() {
  form.issuanceMode = selectedProfile.value ? defaultModeForProfile(selectedProfile.value) : undefined;
}

function applySavedIssuanceDefaults() {
  const preference = issuanceDefault.value;
  const profile = eligibleProfiles.value.find((item) => String(item.rootId) === preference.rootId && String(item.profileId) === preference.profileId);
  const size = preference.rsaKeySize;
  if (!profile || size == null || !profile.supportedRsaKeySizes?.includes(size)) return false;
  form.rootId = String(profile.rootId);
  form.profileId = String(profile.profileId);
  form.rsaKeySize = size;
  applyDefaultIssuanceMode();
  return true;
}

function resetIssuanceSelection() {
  if (applySavedIssuanceDefaults()) return;
  form.rootId = '';
  form.profileId = '';
  form.rsaKeySize = undefined;
  form.issuanceMode = undefined;
}

async function loadIssuanceDefault() {
  try {
    issuanceDefault.value = unwrapData<EmployeeCertIssuanceDefault>(await getEmployeeCertIssuanceDefault()) ?? { issuanceMode: 'NEW' };
  } catch {
    // The request interceptor reports the failure and the initial value is 新签.
  } finally {
    loadingIssuanceDefault.value = false;
    if (!form.rootId) applySavedIssuanceDefaults();
    else applyDefaultIssuanceMode();
  }
}

function openIssuanceDefaults() {
  const preference = issuanceDefault.value;
  issuanceDefaultDraft.rootId = eligibleCas.value.some((ca) => ca.id === preference.rootId) ? (preference.rootId ?? '') : '';
  issuanceDefaultDraft.profileId = defaultProfilesForCa.value.some((profile) => String(profile.profileId) === preference.profileId)
    ? (preference.profileId ?? '')
    : '';
  const sizes = draftProfile.value?.supportedRsaKeySizes ?? [];
  const size = preference.rsaKeySize;
  issuanceDefaultDraft.rsaKeySize = size != null && sizes.includes(size) ? size : sizes.includes(2048) ? 2048 : sizes[0];
  issuanceDefaultDraft.issuanceMode = defaultModeForProfile(draftProfile.value);
  issuanceDefaultsOpen.value = true;
}

async function saveIssuanceDefault(clear = false) {
  if (savingIssuanceDefault.value || (!clear && !canSaveIssuanceDefault.value)) return;
  savingIssuanceDefault.value = true;
  try {
    const preference: EmployeeCertIssuanceDefault = clear
      ? { issuanceMode: 'NEW' }
      : {
          ...issuanceDefaultDraft,
          issuanceMode: draftSupportsRenewal.value ? issuanceDefaultDraft.issuanceMode : 'NEW'
        };
    issuanceDefault.value = unwrapData<EmployeeCertIssuanceDefault>(await saveEmployeeCertIssuanceDefault(preference));
    resetIssuanceSelection();
    issuanceDefaultsOpen.value = false;
    ElMessage.success(clear ? '已清空制作申请默认设置' : '制作申请默认设置已保存');
  } finally {
    savingIssuanceDefault.value = false;
  }
}
const rsaKeySizes = [2048, 4096];
const supportedRsaKeySizes = computed(() => selectedProfile.value?.supportedRsaKeySizes ?? []);
watch(supportedRsaKeySizes, sizes => {
  if (!form.rsaKeySize || !sizes.includes(form.rsaKeySize)) {
    form.rsaKeySize = sizes.includes(2048) ? 2048 : undefined;
  }
}, { flush: 'sync' });
const employeeValidityUnits = issueValidityUnits.filter(({ value }) => ['year', 'month', 'day'].includes(value));

function applyDefaultValidity() {
  const profile = selectedProfile.value;
  const duration = form.notBefore && profile && defaultIssueDuration(form.notBefore, [profile.templateValidity]);
  form.validityAmount = undefined;
  form.validityUnit = 'year';
  if (!duration) return;
  if (duration.unit === 'year' || duration.unit === 'day') {
    form.validityAmount = duration.value;
    form.validityUnit = duration.unit;
  } else {
    const days = duration.unit === 'week' ? duration.value * 7 : Math.floor(duration.value / (duration.unit === 'hour' ? 24 : 1440));
    form.validityAmount = days > 0 ? days : undefined;
    form.validityUnit = 'day';
  }
}

function previewValidity() {
  const profile = selectedProfile.value;
  if (!profile) return {};
  if (!form.notBefore) return { error: '请选择生效时间' };
  if (form.validityAmount == null) {
    const limit = defaultIssueDuration(form.notBefore, [profile.templateValidity]);
    if (!limit) return { error: '模板有效期缺失或格式不正确，请重新同步 CA 模板' };
    if ((limit.unit === 'hour' && limit.value < 24) || (limit.unit === 'minute' && limit.value < 1440)) {
      return { error: '模板有效期不足 1 日，请核对 CA 模板' };
    }
    return { error: '请填写有效期' };
  }
  try {
    const start = new Date(Math.floor(form.notBefore.getTime() / 1000) * 1000);
    const { expiry } = resolveIssueValidity(start, form.validityAmount, form.validityUnit, [profile.templateValidity], null);
    if (!expiry || expiry.getTime() <= Date.now()) return { error: '证书到期时间必须晚于当前时间' };
    const issuerExpiry = profile.issuerNotAfter ? Date.parse(profile.issuerNotAfter) : NaN;
    if (!Number.isFinite(issuerExpiry)) return { error: '无法读取上级签发 CA 的有效期，请同步 CA 证书' };
    if (expiry.getTime() > issuerExpiry) return { error: '有效期不能超过上级签发 CA 的到期时间' };
    return { start, expiry };
  } catch (error) {
    return { error: error instanceof Error ? error.message : '有效期无效' };
  }
}

const validityPreview = computed(previewValidity);
watch([() => selectedProfile.value?.profileId, () => selectedProfile.value?.templateValidity], applyDefaultValidity, { flush: 'sync' });

const canCreateTask = computed(
  () => Boolean(selectedProfile.value) && (!supportsRenewal.value || !loadingIssuanceDefault.value)
    && (form.issuanceMode === 'NEW' || (supportsRenewal.value && form.issuanceMode === 'RENEW'))
    && form.rsaKeySize != null && supportedRsaKeySizes.value.includes(form.rsaKeySize)
    && Boolean(validityPreview.value.expiry)
    && !resolving.value && !creating.value && selectedEmployees.value.length > 0
    && !missingAccounts.value.length && !blockedAccounts.value.length
);
watch(() => form.rootId, () => { form.profileId = ''; }, { flush: 'sync' });
watch(activeTab, (tab) => {
  if (tab !== 'create') return;
  form.notBefore = new Date();
  resetIssuanceSelection();
  applyDefaultValidity();
}, { flush: 'sync' });
watch([() => form.profileId, supportsRenewal], applyDefaultIssuanceMode, { flush: 'sync' });
watch([selectionMode, () => form.accounts], clearRoster, { flush: 'sync' });

const taskLoading = ref(false);
const tasks = ref<EmployeeCertTask[]>([]);
const taskTotal = ref(0);
const taskQuery = reactive({ pageNum: 1, pageSize: 10, taskNo: '', profileId: '', certTypeCode: 'EMAIL' });
const taskProfiles = ref<RaCertFilterOption[]>([]);
const taskOpen = ref(false);
const taskDetail = ref<Partial<EmployeeCertTaskDetail>>({ certs: [] });
const manualIssue = ref<{ taskNo: string; rows: Map<string, EmployeeCert> }>();
const detailIssueStatus = computed(() => manualIssue.value ? 'ISSUING' : taskIssueStatus(taskDetail.value.task?.taskStatus));
const issuingTask = ref(false);
const issueSelection = ref<EmployeeCert[]>([]);
const issueTable = ref<{ clearSelection: () => void }>();
const issueHistoryOpen = ref(false);
const historyCert = ref<EmployeeCert>();

const canIssueCert = (cert: EmployeeCert) => !cert.raCertId && !cert.serialNumber
  && ['PENDING', 'READY_FOR_ISSUE', 'PRECHECKED', 'FAILED'].includes(cert.issueStatus || '');
const canIssueTaskCert = (cert: EmployeeCert) => !manualIssue.value && !isIssueActive(taskDetail.value.task?.taskStatus) && canIssueCert(cert);

function displayIssueStatus(cert: EmployeeCert) {
  const current = manualIssue.value;
  if (current?.taskNo !== taskDetail.value.task?.taskNo) return cert.issueStatus;
  const previous = current?.rows.get(String(cert.id));
  if (previous && cert.issueStatus === previous.issueStatus && cert.version === previous.version
      && cert.issueHistory?.length === previous.issueHistory?.length) return 'ISSUING';
  return cert.issueStatus;
}

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
  return rank(displayIssueStatus(left)) - rank(displayIssueStatus(right));
}

function showIssueHistory(cert: EmployeeCert) {
  historyCert.value = cert;
  issueHistoryOpen.value = true;
}

const keyOpen = ref(false);
const candidateDetail = ref<InstanceType<typeof RaCertDetailDialog>>();
const keyLoading = ref(false);
const keyLoadFailed = ref(false);
const currentEmployee = ref<EmployeeCertEmployee>();
const keys = ref<EmployeeProductionCandidate[]>([]);
const issuedDetail = ref<InstanceType<typeof RaCertDetailDialog>>();
function loadIssuedDetail(id: string | number) {
  const taskNo = taskDetail.value.task?.taskNo;
  if (!taskNo) return Promise.reject(new Error('制作任务不存在'));
  return getEmployeeTaskCertificate(taskNo, id);
}

const keyChoice = ref('AUTO');
const productionChoices = ref<Record<string, EmployeeProductionChoice>>({});
let keyRequestId = 0;
const employeesWithCandidates = ref<Set<string>>();
const candidateAvailabilityLoading = ref(false);

watch([selectedEmployees, () => form.rootId, () => form.profileId, () => form.rsaKeySize, () => form.issuanceMode],
  async ([employees, rootId, profileId, rsaKeySize, mode], _, onCleanup) => {
    employeesWithCandidates.value = undefined;
    candidateAvailabilityLoading.value = false;
    if (mode !== 'RENEW' || !rootId || !profileId || !rsaKeySize || !employees.length || employees.length > 1000) return;
    let current = true;
    onCleanup(() => { current = false; });
    candidateAvailabilityLoading.value = true;
    try {
      const ids = unwrapData<string[]>(await getEmployeeProductionCandidateAvailability({
        rootId, profileId, rsaKeySize,
        employeeIds: employees.map(employee => String(employee.id)),
        identityKeys: employees.map(employee => employee.identityKey)
      }));
      if (current) employeesWithCandidates.value = new Set(ids);
    } catch {
      // Keep the automatic decision unknown until a matching history lookup succeeds.
    } finally {
      if (current) candidateAvailabilityLoading.value = false;
    }
  });

function productionChoiceLabel(row: EmployeeCertEmployee) {
  if (!selectedProfile.value) return '';
  const id = String(row.id);
  const choice = productionChoices.value[id];
  if (choice?.mode === 'SELECTED') return '已指定';
  if (choice?.mode === 'NEW' || form.issuanceMode === 'NEW') return '新签';
  if (!employeesWithCandidates.value) return candidateAvailabilityLoading.value ? '查询中' : '待核验';
  return employeesWithCandidates.value.has(id) ? '续签' : '新签';
}

watch([() => form.rootId, () => form.profileId, () => form.rsaKeySize, () => form.issuanceMode], () => {
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
  const issuanceMode = form.issuanceMode;
  const rsaKeySize = form.rsaKeySize;
  if (!profile || !issuanceMode || rsaKeySize == null || !canCreateTask.value) return;
  const { start, expiry, error } = previewValidity();
  if (!start || !expiry) {
    ElMessage.warning(error || '请填写生效时间和有效期');
    return;
  }
  creating.value = true;
  try {
    const detail = unwrapData<EmployeeCertTaskDetail>(
      await createEmployeeCertTask({
        employeeIds: selectedEmployees.value.map((item) => item.id),
        identityKeys: selectedEmployees.value.map((item) => item.identityKey),
        userIds: selectedEmployees.value.map((item) => item.raUserId ?? null),
        rootId: profile.rootId,
        profileId: profile.profileId,
        issuanceMode,
        notBefore: start.toISOString().slice(0, 19),
        notAfter: expiry.toISOString().slice(0, 19),
        rsaKeySize,
        productionChoices: selectedEmployees.value.flatMap(item => {
          const choice = productionChoices.value[String(item.id)];
          return choice ? [choice] : [];
        }),
        pfxPasswordRule: passwordRule.value ?? savedPasswordRule.value,
        remark: form.remark
      })
    );
    ElMessage.success('制作任务已创建，系统将自动签发');
    passwordRule.value = null;
    productionChoices.value = {};
    taskDetail.value = detail;
    taskQuery.taskNo = '';
    taskQuery.profileId = '';
    taskQuery.pageNum = 1;
    activeTab.value = 'tasks';
    await Promise.all([loadTasks(), loadTaskProfiles()]);
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
  if (!loadingIssuanceDefault.value && !form.rootId) applySavedIssuanceDefaults();
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
let appliedTaskQuery = { ...taskQuery };

async function loadTaskProfiles() {
  try {
    taskProfiles.value = unwrapData<RaCertFilterOption[]>(await listEmployeeCertTaskProfiles()) || [];
  } catch {
    // A template refresh failure must not prevent loading the task list.
  }
}

function loadTasks() {
  return fetchTasks(false);
}

let taskListRefreshing = false;

async function fetchTasks(background: boolean) {
  const version = ++taskListVersion;
  if (!background) {
    appliedTaskQuery = { ...taskQuery };
    taskLoading.value = true;
  }
  try {
    const page = unwrapData<any>(await pageEmployeeCertTasks(appliedTaskQuery));
    if (version !== taskListVersion) return;
    tasks.value = page?.rows || page?.records || [];
    taskTotal.value = Number(page?.total || 0);
  } finally {
    if (version === taskListVersion) taskLoading.value = false;
  }
}

function scheduleTaskListRefresh() {
  clearTimeout(taskListTimer);
  if (!taskPageVisible || activeTab.value !== 'tasks' ||
      !tasks.value.some(task => isIssueActive(task.taskStatus) || task.taskNo === manualIssue.value?.taskNo)) return;
  taskListTimer = setTimeout(async () => {
    if (taskLoading.value || taskListRefreshing) {
      scheduleTaskListRefresh();
      return;
    }
    taskListRefreshing = true;
    try {
      await fetchTasks(true);
    } catch {
      // Retry the next refresh while a displayed task is still active.
    } finally {
      taskListRefreshing = false;
      scheduleTaskListRefresh();
    }
  }, 3000);
}
watch([activeTab, tasks, manualIssue], scheduleTaskListRefresh);

async function handleTabChange(tabName: string | number) {
  if (tabName === 'tasks') {
    await Promise.all([loadTasks(), loadTaskProfiles()]);
  }
}

function searchTasks() {
  taskQuery.pageNum = 1;
  return loadTasks();
}

function resetTaskQuery() {
  taskQuery.taskNo = '';
  taskQuery.profileId = '';
  return searchTasks();
}

function taskIssueStatus(status?: string) {
  if (status === 'DISTRIBUTED' || status === 'ISSUED') return 'ISSUED';
  if (status === 'PARTIAL_FAILED' || status === 'FAILED') return 'FAILED';
  if (status === 'ISSUING' || status === 'AUTO_ISSUING') return 'ISSUING';
  return status ? 'READY_FOR_ISSUE' : undefined;
}

function isIssueActive(status?: string) {
  return status === 'AUTO_QUEUED' || status === 'AUTO_ISSUING' || status === 'ISSUING';
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
  distributionPickerOpen.value = false;
  const version = ++taskDetailVersion;
  if (taskDetailTimer) clearTimeout(taskDetailTimer);
  const detail = unwrapData<EmployeeCertTaskDetail>(await getEmployeeCertTask(row.taskNo));
  if (version !== taskDetailVersion || issuingTask.value) return;
  taskDetail.value = detail;
  taskOpen.value = true;
  watchTaskProgress(row.taskNo);
}

function watchTaskProgress(taskNo: string) {
  clearTimeout(taskDetailTimer);
  const manual = manualIssue.value?.taskNo === taskNo;
  if (!taskPageVisible || !taskOpen.value || (!manual && !isIssueActive(taskDetail.value.task?.taskStatus)
      && !(taskDetail.value.certs || []).some((row) => row.distributionStatus === 'SENDING'))) return;
  const version = taskDetailVersion;
  taskDetailTimer = setTimeout(async () => {
    if (version !== taskDetailVersion || !taskOpen.value) return;
    try {
      const latest = unwrapData<EmployeeCertTaskDetail>(await getEmployeeCertTask(taskNo, true));
      if (version !== taskDetailVersion || !taskOpen.value) return;
      taskDetail.value = latest;
      watchTaskProgress(taskNo);
    } catch {
      if (version !== taskDetailVersion || !taskOpen.value) return;
      if (manualIssue.value?.taskNo === taskNo) watchTaskProgress(taskNo);
      else ElMessage.warning('任务进度查询失败，请重新打开任务详情');
    }
  }, manual ? 1000 : 3000);
}

async function downloadTaskPackage(row: EmployeeCertTask, format: EmployeeCertDownloadFormat) {
  if (downloadingTask.value) return;
  downloadingTask.value = row.taskNo;
  let response: Awaited<ReturnType<typeof downloadEmployeeCertTaskPackage>> | undefined;
  try {
    response = await downloadEmployeeCertTaskPackage(row.taskNo, format);
    const baseName = `employee-certs-${row.taskNo.replace(/[^A-Za-z0-9_-]/g, '_')}`;
    const { blob, filename } = await employeeCertificateDownload(response, baseName, format);
    FileSaver.saveAs(blob, filename);
  } catch (error: any) {
    const body = error?.response?.data ?? response?.data;
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

const distributionPickerOpen = ref(false);
const distributionSelection = ref<EmployeeCert[]>([]);
const distributableTaskCerts = computed(() => (taskDetail.value.certs || []).filter(cert => canDistributeEmployeeCert(cert, true)));
let taskLedgerEntry = 0;

function canOpenTaskLedger() {
  return auth.hasPermi('ra:employee-cert') && router.resolve(employeeCertLedgerPath).matched.some(record => record.path === employeeCertLedgerPath);
}

async function distributeTask(row: EmployeeCertTask) {
  if (!auth.hasPermi('ra:employee-cert:distribute') || !row.taskNo) return;
  if (canOpenTaskLedger()) {
    const failure = await router.push({
      path: employeeCertLedgerPath,
      query: { taskNo: row.taskNo, taskEntry: `${Date.now()}-${++taskLedgerEntry}` }
    });
    if (!failure) taskOpen.value = false;
    return;
  }
  distributionSelection.value = [];
  distributionPickerOpen.value = true;
}

function confirmTaskDistribution() {
  const taskNo = taskDetail.value.task?.taskNo;
  if (!auth.hasPermi('ra:employee-cert:distribute') || !taskNo || !distributionPickerOpen.value) return;
  const selectedIds = new Set(distributionSelection.value.map(cert => String(cert.id)));
  const ids = distributableTaskCerts.value.map(cert => String(cert.id)).filter(id => selectedIds.has(id));
  if (!ids.length || ids.length !== selectedIds.size) {
    ElMessage.warning('部分所选证书已不可分发，请重新选择');
    return;
  }
  distributionPickerOpen.value = false;
  distributionDialog.value?.open({ ids, freshBatch: true }, '所选 ' + ids.length + ' 张证书对应的员工', taskNo);
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
  const selected = issueSelection.value.filter(canIssueTaskCert);
  const certIds = selected.map((row) => String(row.id));
  if (!taskNo || !certIds.length || issuingTask.value) return;
  issuingTask.value = true;
  try {
    const confirmed = await ElMessageBox.confirm(`仅执行选中的 ${certIds.length} 条明细，未选中的记录不会签发。确认执行？`, '执行签发', {
      confirmButtonText: '开始签发', cancelButtonText: '取消', type: 'warning'
    }).then(() => true, () => false);
    if (!confirmed) return;
    taskDetailVersion++;
    manualIssue.value = { taskNo, rows: new Map(selected.map(row => [String(row.id), row])) };
    watchTaskProgress(taskNo);
    try {
      const latest = unwrapData<EmployeeCertTaskDetail>(await issueEmployeeCertTask(taskNo, certIds));
      taskDetailVersion++;
      taskDetail.value = latest;
      issueTable.value?.clearSelection();
      issueSelection.value = [];
      ElMessage.info('已执行选中的签发明细，请查看逐人结果');
    } catch (error) {
      const version = ++taskDetailVersion;
      clearTimeout(taskDetailTimer);
      try {
        const latest = unwrapData<EmployeeCertTaskDetail>(await getEmployeeCertTask(taskNo, true));
        if (version === taskDetailVersion && taskDetail.value.task?.taskNo === taskNo) taskDetail.value = latest;
      } catch {
        // A failed refresh does not change the original signing error.
      }
      throw error;
    } finally {
      manualIssue.value = undefined;
      watchTaskProgress(taskNo);
      await loadTasks().catch(() => {
        // The request interceptor reports the list refresh failure.
      });
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

function loadCandidateCertificate(certificateId: number | string) {
  const employee = currentEmployee.value;
  const profile = selectedProfile.value;
  const rsaKeySize = form.rsaKeySize;
  if (!employee || !profile || rsaKeySize == null) {
    return Promise.reject(new Error('员工或证书模板未选择'));
  }
  return getEmployeeProductionCandidateDetail(employee.id, certificateId, {
    rootId: profile.rootId,
    profileId: profile.profileId,
    rsaKeySize
  });
}

function saveKeyChoice() {
  const employeeId = currentEmployee.value?.id;
  if (employeeId == null || keyLoading.value || form.issuanceMode !== 'RENEW') return;
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
  await Promise.all([loadTasks(), loadEmailProfiles(), loadDefaultPasswordRule(), loadIssuanceDefault()]);
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
function stopTaskPolling() {
  taskPageVisible = false;
  taskDetailVersion++;
  clearTimeout(taskDetailTimer);
  clearTimeout(taskListTimer);
}
onDeactivated(stopTaskPolling);
onUnmounted(stopTaskPolling);
useRaListRefreshOnReturn(() => {
  taskPageVisible = true;
  if (activeTab.value === 'create') resetIssuanceSelection();
  form.notBefore = new Date();
  applyDefaultValidity();
  if (taskOpen.value && taskDetail.value.task) watchTaskProgress(taskDetail.value.task.taskNo);
  return Promise.all([loadTasks(), loadEmailProfiles(), activeTab.value === 'tasks' ? loadTaskProfiles() : undefined]);
});
</script>

<style scoped>
.profile-policy-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-inline-end: 24px;
}

.issue-validity-input {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 76px;
  gap: 8px;
  width: 100%;
}

.issue-validity-input :deep(.el-input-number) {
  width: 100%;
}

.issue-validity-field :deep(.el-form-item__error) {
  position: static;
  width: 100%;
  line-height: 1.25;
}

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
