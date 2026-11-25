<template>
  <div class="app-container employee-cert-page">
    <div class="management-header">
      <el-tabs :model-value="managementTab" class="management-tabs" @update:model-value="switchManagementTab">
        <el-tab-pane label="证书台账" name="ledger" />
        <el-tab-pane label="发送记录" name="distribution" />
        <el-tab-pane v-if="canManageLegacy" label="存量导入" name="legacy" />
      </el-tabs>
      <div v-if="managementTab !== 'legacy'" class="management-actions">
        <CertRowAction v-hasPermi="['ra:employee-cert:template']" label="分发模板" icon="Message" @click="openTemplates" />
        <CertRowAction v-hasPermi="['ra:employee-cert:distribute']" label="分发配置" icon="Setting" @click="openDistributionConfig" />
      </div>
    </div>

    <LegacyCertificates v-if="managementTab === 'legacy' && canManageLegacy" />

    <el-card v-show="managementTab === 'ledger' && showSearch" shadow="never" class="query-card">
      <el-form :model="queryParams" class="query-form" label-width="76px">
        <el-form-item label="任务号">
          <el-input v-model="queryParams.taskNo" clearable maxlength="40" placeholder="请输入完整任务号" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="序列号">
          <el-input v-model="queryParams.serialNumber" clearable placeholder="证书序列号" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="域账号">
          <el-input v-model="queryParams.domainAccount" clearable placeholder="域账号" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="queryParams.employeeName" clearable placeholder="员工姓名" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="签发模板">
          <el-select v-model="queryParams.profileId" :loading="ledgerProfilesLoading" clearable filterable placeholder="全部">
            <el-option v-for="profile in ledgerProfiles" :key="profile.id" :label="profile.name" :value="profile.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="证书状态">
          <el-select v-model="queryParams.certStatus" clearable placeholder="全部">
            <el-option v-for="option in certificateStatuses" :key="option.value" :value="option.value" :label="option.label" />
          </el-select>
        </el-form-item>
        <el-form-item label="分发状态">
          <el-select v-model="queryParams.distributionStatus" clearable placeholder="全部">
            <el-option label="待分发" value="PENDING" />
            <el-option label="已分发" value="SENT" />
            <el-option label="发送失败" value="FAILED" />
            <el-option label="发送中" value="SENDING" />
          </el-select>
        </el-form-item>
        <div class="query-actions">
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery()">重置</el-button>
        </div>
      </el-form>
    </el-card>

    <el-card v-show="managementTab === 'ledger'" shadow="never" class="table-card">
      <el-row :gutter="10" class="mb8">
        <el-col v-if="canDistribute" :span="1.5">
          <el-button type="primary" plain icon="Promotion" :disabled="loading || selectedRows.length === 0" @click="distributeSelected"
            >批量分发（{{ selectedRows.length }}）</el-button
          >
        </el-col>
        <el-col v-if="canDistribute" :span="1.5">
          <el-button type="primary" plain icon="Download" :disabled="loading || !selectedRows.length" @click="openBatchDownload">
            批量下载（{{ selectedRows.length }}）
          </el-button>
        </el-col>
        <el-col v-if="canDistribute" :span="1.5">
          <el-tooltip :content="adUploadSelectionReady ? 'AD 发布接口尚未接入' : '请选择符合 AD 上传条件的证书'">
            <span>
              <el-button plain icon="Upload" :disabled="loading || !adUploadSelectionReady" @click="previewAdUpload">
                一键上传 AD（{{ selectedRows.length }}）
              </el-button>
            </span>
          </el-tooltip>
        </el-col>
        <el-col v-if="canDistribute" :span="1.5">
          <el-button type="danger" plain icon="Delete" :loading="deletingLedger" :disabled="!selectedRows.length || loading" @click="removeLedger">批量删除</el-button>
        </el-col>
        <el-col v-if="canDistribute" :span="1.5">
          <el-button type="success" plain icon="Download" :loading="exportingLedger" @click="handleExport">导出台账</el-button>
        </el-col>
        <right-toolbar v-model:showSearch="showSearch" @queryTable="loadList" />
      </el-row>

      <el-table v-loading="loading" :data="rows" row-key="id" border stripe empty-text="暂无员工证书台账" @selection-change="selectedRows = $event">
        <el-table-column v-if="canDistribute" type="selection" width="48" fixed :selectable="canDownloadCert" />
        <el-table-column label="序列号" prop="serialNumber" min-width="170" fixed show-overflow-tooltip>
          <template #default="{ row }">
            <el-button v-if="row.serialNumber && row.raCertId != null" link type="primary"
              @click="openLedgerCertificate(row)">{{ row.serialNumber }}</el-button>
            <span v-else>{{ row.serialNumber || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="主题" prop="subject" min-width="260" :formatter="formatCertificateSubjectColumn" show-overflow-tooltip />
        <el-table-column label="姓名" prop="employeeName" width="110" />
        <el-table-column label="域账号" prop="domainAccount" width="120" />
        <el-table-column label="密码" min-width="150">
          <template #header>
            <span>密码</span>
            <el-tooltip v-if="canDistribute" :content="passwordToggleLabel" placement="top">
              <el-button
                class="password-toggle"
                link
                type="primary"
                :icon="ledgerPasswordsVisible ? 'Hide' : 'View'"
                :aria-label="passwordToggleLabel"
                :aria-pressed="ledgerPasswordsVisible"
                :loading="ledgerPasswordsLoading"
                :disabled="!ledgerPasswordsVisible && (loading || !rows.some((row) => row.certPassword))"
                @click="toggleLedgerPasswords"
              />
            </el-tooltip>
          </template>
          <template #default="{ row }">
            <span class="ledger-password">{{ ledgerPasswords?.[String(row.id)] ?? row.certPassword ?? '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="科室" prop="departmentName" min-width="150" show-overflow-tooltip />
        <el-table-column label="职位" prop="jobName" min-width="130" show-overflow-tooltip />
        <el-table-column label="证书类型" prop="certTypeName" width="130" />
        <el-table-column label="签发模板" prop="profileNameSnapshot" min-width="150" show-overflow-tooltip />
        <el-table-column label="任务号" prop="taskNo" min-width="210" show-overflow-tooltip />
        <el-table-column label="到期时间" prop="notAfter" width="180" align="center">
          <template #default="{ row }">
            <div>{{ formatDate(row.notAfter) }}</div>
            <el-tag :type="certificateStatusTag(row)" effect="plain">{{ certificateStatusLabel(row) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="分发状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="distributionTag(row.distributionStatus)" effect="plain">{{ row.distributionStatusName || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="邮件" width="96" align="center">
          <template #default="{ row }"><ChannelStatus :status="row.distributionStatus === 'SENDING' && row.emailStatus === 'UNKNOWN' ? 'SENDING' : row.emailStatus" /></template>
        </el-table-column>
        <el-table-column label="钉钉" width="96" align="center">
          <template #default="{ row }"><ChannelStatus :status="row.dingtalkStatus" :blocked="row.emailStatus === 'FAILED'" /></template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="124" align="center">
          <template #default="{ row }">
            <CertRowAction label="查看详情" icon="View" @click="openDetail(row)" />
            <CertRowAction
              v-if="row.issueStatus === 'ISSUED' && row.distributionStatus !== 'ARCHIVED'"
              v-hasPermi="['ra:employee-cert:distribute']"
              type="success"
              :label="row.distributionStatus === 'SENT' ? '重新分发' : '分发证书'"
              icon="Promotion"
              :disabled="!canDistributeEmployeeCert(row, true)"
              @command="distribute(row, $event)"
            >
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="BOTH">邮件＋钉钉</el-dropdown-item>
                  <el-dropdown-item command="EMAIL">仅邮件</el-dropdown-item>
                  <el-dropdown-item command="DINGTALK">仅钉钉</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </CertRowAction>
            <CertRowAction
              v-if="row.issueStatus === 'ISSUED' && row.raCertId != null"
              v-hasPermi="['ra:employee-cert:distribute']"
              label="下载证书 ZIP"
              icon="Download"
              :loading="downloadingCert === row.id"
              :disabled="downloadingCert != null"
              @click="downloadPackage(row)"
            />
          </template>
        </el-table-column>
      </el-table>

      <pagination
        v-show="total > 0"
        v-model:page="queryParams.pageNum"
        v-model:limit="queryParams.pageSize"
        :total="total"
        :auto-scroll="false"
        @pagination="loadList"
      />
    </el-card>

    <template v-if="managementTab === 'distribution'">
      <el-card shadow="never" class="query-card">
        <el-form inline class="distribution-query" @submit.prevent="searchDistributionRecords()">
          <el-form-item label="任务号">
            <el-input v-model="distributionTaskNo" clearable maxlength="40" placeholder="请输入完整任务号" />
          </el-form-item>
          <el-form-item label="任务类型">
            <el-select v-model="distributionBatchType" clearable placeholder="全部" style="width: 150px">
              <el-option label="证书分发" value="DISTRIBUTION" />
              <el-option label="证书上传" value="UPLOAD" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" native-type="submit" icon="Search">搜索</el-button>
            <el-button icon="Refresh" @click="resetDistributionQuery">重置</el-button>
          </el-form-item>
        </el-form>
      </el-card>
      <el-alert
        v-if="distributionReadFailures"
        class="mb12"
        type="warning"
        :closable="false"
        show-icon
        :title="distributionReadFailures <= distributionReadRetryLimit ? '发送记录暂时无法读取，正在重试' : '发送记录读取失败，请点击刷新核实结果'"
      />
      <el-card shadow="never" class="query-card">
        <template #header>
          <div class="distribution-heading">
            <strong>分发批次</strong>
            <el-button icon="Refresh" :loading="distributionRecordsLoading" @click="loadDistributionRecords()">刷新</el-button>
          </div>
        </template>
        <el-table
          v-loading="distributionRecordsLoading"
          :data="distributionBatches"
          row-key="batchNo"
          :current-row-key="activeDistributionBatchNo"
          highlight-current-row
          border
          stripe
          :empty-text="appliedDistributionBatchType === 'UPLOAD' ? '暂无证书上传记录，AD 发布接口尚未接入' : '暂无分发批次'"
        >
          <el-table-column label="发送时间" width="170"
            ><template #default="{ row }">{{ formatDate(row.createTime) }}</template></el-table-column
          >
          <el-table-column label="任务类型" width="108"
            ><template #default="{ row }">{{ batchTypeLabel(row) }}</template></el-table-column
          >
          <el-table-column label="批次号" prop="batchNo" min-width="250" show-overflow-tooltip />
          <el-table-column label="记录数" prop="totalCount" width="80" />
          <el-table-column label="成功" prop="successCount" width="70" />
          <el-table-column label="失败" prop="failedCount" width="70" />
          <el-table-column label="处理中" width="90"
            ><template #default="{ row }">{{ row.totalCount - row.successCount - row.failedCount }}</template></el-table-column
          >
          <el-table-column label="操作" width="90" align="center" fixed="right">
            <template #default="{ row }"><CertRowAction label="查看分发明细" icon="View" @click="selectDistributionBatch(row.batchNo)" /></template>
          </el-table-column>
        </el-table>
        <pagination
          v-model:page="distributionPage.pageNum"
          v-model:limit="distributionPage.pageSize"
          :total="distributionTotal"
          :auto-scroll="false"
          @pagination="loadDistributionRecords()"
        />
      </el-card>
      <el-alert
        v-if="requestedDistributionBatchNo && !activeDistributionBatch && !distributionRecordsLoading && !distributionReadFailures"
        class="mb12"
        type="info"
        :closable="false"
        show-icon
        :title="`未找到分发批次 ${requestedDistributionBatchNo} 的记录`"
      />
      <el-drawer
        v-model="distributionDetailsOpen"
        :title="activeDistributionBatch?.taskType === 'UPLOAD' ? '上传明细' : activeDistributionBatch?.notice ? '通知明细' : '分发明细'"
        direction="rtl"
        size="min(1200px, 100vw)"
        append-to-body
      >
        <div v-loading="distributionRecordsLoading" style="min-height: 120px">
          <template v-if="activeDistributionBatch">
            <el-alert
              v-if="distributionReadFailures"
              class="mb12"
              type="warning"
              :closable="false"
              title="明细刷新失败，当前显示上次读取的结果"
            >
              <el-button link type="primary" @click="loadDistributionRecords()">重试</el-button>
            </el-alert>
            <el-descriptions :column="2" border class="mb12">
              <el-descriptions-item label="分发批次">{{ activeDistributionBatch.batchNo }}</el-descriptions-item>
              <template v-if="distributionTaskDetail">
                <el-descriptions-item label="证书类型">{{ distributionTaskDetail.certTypeName || '-' }}</el-descriptions-item>
                <el-descriptions-item label="颁发 CA">{{ distributionTaskDetail.rootName || '-' }}</el-descriptions-item>
                <el-descriptions-item label="签发模板">{{ distributionTaskDetail.profileNameSnapshot || '-' }}</el-descriptions-item>
                <el-descriptions-item v-if="activeDistributionBatch.taskType !== 'UPLOAD'" label="分发方案">
                  <span :title="distributionTaskDetail.schemeRevision || undefined">{{ distributionTaskDetail.schemeName || '-' }}</span>
                </el-descriptions-item>
              </template>
              <el-descriptions-item label="任务类型">{{ batchTypeLabel(activeDistributionBatch) }}</el-descriptions-item>
              <el-descriptions-item label="分发时间">{{ formatDate(activeDistributionBatch.createTime) }}</el-descriptions-item>
              <el-descriptions-item :label="activeDistributionBatch.taskType === 'UPLOAD' ? '上传结果' : '分发结果'">
                共 {{ activeDistributionBatch.totalCount }} 人，成功 {{ activeDistributionBatch.successCount }}，失败
                {{ activeDistributionBatch.failedCount }}，处理中
                {{ activeDistributionBatch.totalCount - activeDistributionBatch.successCount - activeDistributionBatch.failedCount }}
              </el-descriptions-item>
            </el-descriptions>
            <el-table :data="distributionRecords" row-key="certId" border stripe empty-text="暂无本批明细">
              <el-table-column label="姓名" prop="employeeName" min-width="100" />
              <el-table-column label="域账号" prop="domainAccount" min-width="110" show-overflow-tooltip />
              <el-table-column label="序列号" prop="serialNumber" min-width="170" show-overflow-tooltip />
              <el-table-column label="邮箱" prop="recipientEmail" min-width="180" show-overflow-tooltip />
              <el-table-column :label="activeDistributionBatch.taskType === 'UPLOAD' ? '上传结果' : '分发结果'" width="100" align="center" sortable :sort-method="(a, b) => a.sendStatus - b.sendStatus" :sort-orders="['descending', 'ascending', null]">
                <template #default="{ row }"
                  ><el-tag :type="row.sendStatus === 1 ? 'success' : row.sendStatus === 2 ? 'danger' : 'warning'" effect="plain">{{
                    row.sendStatus === 1 ? '成功' : row.sendStatus === 2 ? '失败' : '处理中'
                  }}</el-tag></template
                >
              </el-table-column>
              <el-table-column v-if="activeDistributionBatch.taskType !== 'UPLOAD'" label="邮件状态" width="100" align="center">
                <template #default="{ row }">
                  <ChannelStatus :status="distributionChannelStatus(row, 'emailStatus')" />
                </template>
              </el-table-column>
              <el-table-column v-if="activeDistributionBatch.taskType !== 'UPLOAD'" label="钉钉状态" width="100" align="center">
                <template #default="{ row }">
                  <ChannelStatus :status="distributionChannelStatus(row, 'dingtalkStatus')" :blocked="row.messageType === 'TEXT'" />
                </template>
              </el-table-column>
              <el-table-column v-if="activeDistributionBatch.taskType === 'UPLOAD'" label="AD 公钥发布" min-width="110">未接入</el-table-column>
              <el-table-column label="失败原因" prop="errorMessage" min-width="190" show-overflow-tooltip />
              <el-table-column label="日志" width="80" align="center"
                ><template #default="{ row }"><CertRowAction label="查看分发日志" icon="View" @click="openDetail({ id: row.certId })" /></template
              ></el-table-column>
            </el-table>
          </template>
          <el-empty v-else-if="!distributionRecordsLoading" :description="distributionReadFailures ? '明细读取失败' : '未找到本批明细'">
            <el-button v-if="distributionReadFailures" icon="Refresh" @click="loadDistributionRecords()">重试</el-button>
          </el-empty>
        </div>
      </el-drawer>
    </template>

    <RaCertDetailDialog ref="ledgerCertificateDetail" :load-detail="getEmployeeLedgerCertificate" />
    <DistributionDialog ref="distributionDialog" @submitted="onDistributionSubmitted" />
    <el-dialog
      v-model="batchDownloadOpen"
      title="批量下载证书"
      width="min(440px, 96vw)"
      append-to-body
      :close-on-click-modal="false"
      :close-on-press-escape="!batchDownloading"
      :show-close="!batchDownloading"
    >
      <el-form label-width="76px">
        <el-form-item label="下载数量">{{ batchDownloadIds.length }} 张</el-form-item>
        <el-form-item label="证书格式">
          <el-select v-model="batchDownloadFormat" :disabled="batchDownloading" style="width: 100%">
            <el-option label="CER 证书" value="cer" />
            <el-option label="PEM 证书" value="pem" />
            <el-option label="CRT 证书" value="crt" />
            <el-option label="P7B 证书包" value="p7b" />
            <el-option label="PFX 证书（含私钥）" value="pfx" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="batchDownloading" @click="batchDownloadOpen = false">取消</el-button>
        <el-button type="primary" icon="Download" :loading="batchDownloading" @click="downloadSelected">下载 ZIP</el-button>
      </template>
    </el-dialog>
    <el-drawer v-model="detailOpen" title="员工证书详情" size="min(940px, 100vw)" append-to-body>
      <el-descriptions :column="1" border class="mb12">
        <el-descriptions-item label="序列号">{{ detail.cert?.serialNumber || '-' }}</el-descriptions-item>
        <el-descriptions-item label="证书主题">{{ formatCertificateSubject(detail.cert?.subject) }}</el-descriptions-item>
        <el-descriptions-item label="员工">{{ detail.cert?.employeeName || '-' }} / {{ detail.cert?.domainAccount || '-' }}</el-descriptions-item>
        <el-descriptions-item label="科室职位"
          >{{ detail.cert?.departmentPath || detail.cert?.departmentName || '-' }} / {{ detail.cert?.jobName || '-' }}</el-descriptions-item
        >
        <el-descriptions-item label="证书类型">{{ detail.cert?.certTypeName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="签发模板">{{ detail.cert?.profileNameSnapshot || '-' }}</el-descriptions-item>
        <el-descriptions-item label="签发时间">{{ detail.cert?.issueTime ? formatDate(detail.cert.issueTime) : '-' }}</el-descriptions-item>
        <el-descriptions-item label="证书密码">
          <span class="whitespace-pre-wrap">{{ detail.cert?.certPassword || '-' }}</span>
          <el-button
            v-if="detail.cert && canDistribute && canDownloadCert(detail.cert)"
            link
            type="primary"
            class="ml8"
            :disabled="detail.cert.distributionStatus === 'SENDING'"
            @click="openPasswordEditor"
            >修改密码</el-button
          >
        </el-descriptions-item>
        <el-descriptions-item label="有效期"
          >{{ formatDate(detail.cert?.notBefore) }} 至 {{ formatDate(detail.cert?.notAfter) }}</el-descriptions-item
        >
        <el-descriptions-item label="分发状态">{{ detail.cert?.distributionStatusName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="邮件"><ChannelStatus :status="detail.cert?.emailStatus" success-label="成功" /></el-descriptions-item>
        <el-descriptions-item label="钉钉">
          <ChannelStatus :status="detail.cert?.dingtalkStatus" :blocked="detail.cert?.emailStatus === 'FAILED'" success-label="成功" />
        </el-descriptions-item>
        <el-descriptions-item label="分发说明">{{ detail.cert?.distributionMessage || '-' }}</el-descriptions-item>
      </el-descriptions>

      <el-table :data="detail.logs || []" border stripe empty-text="暂无分发日志">
        <el-table-column label="渠道" width="120">
          <template #default="{ row }">{{
            channelName(row.channel)
          }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100"><template #default="{ row }"><ChannelStatus :status="row.status" success-label="成功" /></template></el-table-column>
        <el-table-column label="日志编号" prop="id" min-width="130" show-overflow-tooltip />
        <el-table-column label="网关追踪 ID" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ row.gatewayTraceId || '-' }}</template>
        </el-table-column>
        <el-table-column label="接收人" prop="recipient" min-width="180" show-overflow-tooltip />
        <el-table-column label="说明" prop="message" min-width="220" show-overflow-tooltip />
        <el-table-column label="时间" width="166">
          <template #default="{ row }">{{ formatDate(row.createTime) }}</template>
        </el-table-column>
      </el-table>
    </el-drawer>

    <el-dialog
      v-model="passwordOpen"
      title="修改证书密码"
      width="min(440px, 96vw)"
      append-to-body
      :close-on-click-modal="!passwordSaving"
      :close-on-press-escape="!passwordSaving"
      :show-close="!passwordSaving"
      @closed="passwordDraft = ''"
    >
      <el-form @submit.prevent="saveCertificatePassword">
        <el-form-item label="证书密码">
          <el-input
            v-model="passwordDraft"
            type="password"
            show-password
            clearable
            autocomplete="off"
            placeholder="留空则设置为空密码"
            :disabled="passwordSaving"
          />
        </el-form-item>
        <el-button native-type="submit" type="primary" :loading="passwordSaving">保存</el-button>
        <el-button :disabled="passwordSaving" @click="passwordOpen = false">取消</el-button>
      </el-form>
    </el-dialog>

    <el-dialog v-model="templateOpen" title="员工证书分发模板" width="940px" append-to-body>
      <el-button icon="Plus" type="primary" class="mb12" @click="editScheme()">新增模板</el-button>
      <el-table :data="templateRows" v-loading="templateLoading" border stripe>
        <el-table-column label="名称" prop="name" min-width="160" />
        <el-table-column label="邮件模板" min-width="155" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.emailTitle }}
          </template>
        </el-table-column>
        <el-table-column label="钉钉模板" min-width="155" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.dingTitle }}
          </template>
        </el-table-column>
        <el-table-column label="绑定的证书模板" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ distributionProfiles.find(profile => profile.id === row.scheme?.profileId)?.name || '未绑定' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '已启用' : '已停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="94" align="center">
          <template #default="{ row }">
            <CertRowAction label="编辑模板" icon="Edit" :disabled="Boolean(deletingSchemeId)" @click="row.builtin ? bindGeneralScheme() : editScheme(row.scheme)" />
            <CertRowAction v-if="row.scheme?.id" label="删除模板" icon="Delete" type="danger"
              :loading="deletingSchemeId === row.scheme.id" :disabled="Boolean(deletingSchemeId)" @click="removeScheme(row.scheme)" />
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <el-dialog v-model="schemeOpen" :title="schemeForm.id ? '编辑方案' : '新增方案'" width="min(740px, 96vw)" append-to-body>
      <el-form :model="schemeForm" label-width="90px">
        <el-form-item label="模板名称" required><el-input v-model.trim="schemeForm.name" maxlength="100" /></el-form-item>
        <el-form-item label="证书模板" :required="mixedScheme">
          <el-select v-model="schemeForm.profileId" filterable :clearable="!mixedScheme"
            :placeholder="mixedScheme ? '请选择未绑定的证书模板' : '可选，留空适用于所有证书模板'" style="width: 100%">
            <el-option v-for="profile in availableDistributionProfiles" :key="profile.id" :value="String(profile.id)" :label="profile.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="启用"><el-switch v-model="schemeForm.enabled" /></el-form-item>
        <el-divider content-position="left">邮件模板</el-divider>
        <el-form-item label="消息类型">
          <el-select v-model="schemeForm.email.type" style="width: 215px">
            <el-option label="MIXED（HTML 和附件）" value="MIXED" />
            <el-option label="TEXT（纯文本）" value="TEXT" />
          </el-select>
        </el-form-item>
        <el-form-item label="邮件标题" required><el-input v-model="schemeForm.email.title" /></el-form-item>
        <el-form-item label="邮件正文" required><el-input v-model="schemeForm.email.body" type="textarea" :rows="5" /></el-form-item>
        <el-form-item v-if="mixedScheme" label="邮件附件">
          <div class="el-upload__tip">证书包会自动随邮件发送，这里只配置可选的附加文件。</div>
          <el-upload v-model:file-list="schemeNewFiles" :auto-upload="false" multiple accept=".pdf,.docx,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.zip,.rar">
            <el-button icon="Upload">上传附件</el-button>
          </el-upload>
          <ul v-if="schemeForm.attachmentNames?.length">
            <li v-for="name in schemeForm.attachmentNames" :key="name">
              {{ name }} <el-button link type="danger" icon="Delete" :aria-label="'删除 ' + name"
                @click="schemeForm.attachmentNames = schemeForm.attachmentNames?.filter(item => item !== name)" />
            </li>
          </ul>
        </el-form-item>
        <div class="template-help">
          <p class="template-help-title">邮件正文可用变量</p>
          <p>
            <code>${employeeName}</code> 姓名 · <code>${domainAccount}</code> 域账号 · <code>${email}</code> 员工邮箱 ·
            <code>${serialNumber}</code> 证书序列号 · <code>${departmentName}</code> 部门 · <code>${jobName}</code> 岗位 ·
            <code>${certTypeName}</code> 证书类型 · <code>${notBefore}</code> 生效时间 · <code>${notAfter}</code> 到期时间
          </p>
          <p v-if="mixedScheme" class="template-help-example">
            示例：<code
              >&lt;p&gt;您好，${employeeName}：&lt;br&gt;您的${certTypeName}已签发，序列号 ${serialNumber}，有效期至 ${notAfter}。&lt;/p&gt;</code
            >
          </p>
          <p v-if="mixedScheme" class="template-help-note">邮件正文按 HTML 发送，换行可用 &lt;br&gt;。邮件正文禁止使用 ${password}，证书密码通过钉钉发送。</p>
          <p v-else class="template-help-note">纯文本模板用于通知，按原文换行。证书包和模板附件仅随 MIXED 邮件发送。</p>
        </div>
        <template v-if="mixedScheme">
          <el-divider content-position="left">钉钉模板</el-divider>
          <el-form-item label="消息类型">
            <el-select v-model="schemeForm.dingtalk.type" style="width: 215px">
              <el-option label="Markdown" value="markdown" />
              <el-option label="纯文本" value="text" />
            </el-select>
          </el-form-item>
          <el-form-item label="钉钉标题" required><el-input v-model="schemeForm.dingtalk.title" /></el-form-item>
          <el-form-item label="钉钉正文" required><el-input v-model="schemeForm.dingtalk.body" type="textarea" :rows="5" /></el-form-item>
          <div class="template-help">
            <p class="template-help-title">钉钉正文可用变量</p>
            <p>与邮件相同，另可用 <code>${password}</code> 证书密码。</p>
            <p class="template-help-example">
              示例：<code>${employeeName} 的${certTypeName}已签发。序列号：${serialNumber}；到期：${notAfter}；证书密码：${password}</code>
            </p>
            <p class="template-help-note">
              自定义方案不强制包含 ${password}；如需随钉钉下发证书密码，请在正文中加入 ${password}。纯文本消息渲染后不能超过 500 字符。旧模板兼容
              {domain_account}、{redomain_account}、{remail}、{password} 写法。
            </p>
          </div>
        </template>
      </el-form>
      <template #footer>
        <el-button :disabled="schemeSaving" @click="schemeOpen = false">取消</el-button>
        <el-button type="primary" :loading="schemeSaving" @click="saveScheme">保存方案</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="distributionConfigOpen" title="员工证书分发配置" width="720px" append-to-body>
      <el-alert class="mb12" type="warning" :closable="false" show-icon title="Secret Key 仅允许写入，不会回显；留空保存将保留已有 Secret。" />
      <el-form :model="distributionConfig" label-width="150px">
        <el-form-item label="邮件服务地址">
          <el-input v-model="distributionConfig.emailServerUrl" placeholder="https://api.example.com/cmp/mail/v2/send" />
        </el-form-item>
        <el-form-item label="钉钉服务地址">
          <el-input v-model="distributionConfig.dingtalkServerUrl" placeholder="https://api.example.com/cmp/dingtalk/v1/sendMessage" />
        </el-form-item>
        <el-form-item label="App Key">
          <el-input v-model="distributionConfig.appKey" autocomplete="off" />
        </el-form-item>
        <el-form-item label="Secret Key">
          <el-input
            v-model="distributionConfig.secretKey"
            type="password"
            show-password
            autocomplete="new-password"
            :placeholder="distributionConfig.secretKeyConfigured ? '已配置，留空保持不变' : '请输入 Secret Key'"
          />
        </el-form-item>
        <el-form-item label="发件邮箱">
          <el-input :model-value="distributionConfig.emailAccount" disabled />
        </el-form-item>
        <el-form-item label="邮件服务器标识">
          <el-input :model-value="distributionConfig.smtpServer" disabled />
        </el-form-item>
        <el-form-item label="钉钉应用标识">
          <el-input :model-value="distributionConfig.dingtalkApp" disabled />
        </el-form-item>
        <el-form-item label="附件最大大小">
          <el-input-number v-model="distributionConfig.attachmentMaxSizeMb" :min="1" :max="100" />
          <span class="unit-label">MB</span>
        </el-form-item>
        <el-form-item label="邮件测试">
          <div class="distribution-test-row">
            <el-input v-model="distributionTestEmail" placeholder="测试收件邮箱" :disabled="distributionTesting" />
            <el-button :disabled="distributionTesting || !distributionTestEmail.trim()" @click="testDistributionConfig('EMAIL')">
              测试并发送
            </el-button>
          </div>
        </el-form-item>
        <el-form-item label="钉钉测试">
          <div class="distribution-test-row">
            <el-input v-model="distributionTestDing" placeholder="测试接收人的域账号" :disabled="distributionTesting" />
            <el-button :disabled="distributionTesting || !distributionTestDing.trim()" @click="testDistributionConfig('DINGTALK')">
              测试并发送
            </el-button>
          </div>
        </el-form-item>
        <el-form-item v-if="distributionTesting || distributionTestResult" label="测试结果">
          <span>{{ distributionTestResult }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="distributionConfigOpen = false">取消</el-button>
        <el-button type="primary" :loading="distributionConfigSaving" :disabled="distributionTesting" @click="saveDistributionConfig">保存配置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="RaEmployeeCert" lang="ts">
import { formatCertificateSubject, formatCertificateSubjectColumn } from '@/utils/raCertificateSubject';
import CertRowAction from '../components/CertRowAction.vue';
import RaCertDetailDialog from '../components/RaCertDetailDialog.vue';
import { computed, ref, reactive, watch, onActivated, onDeactivated, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { employeeCertLedgerPath } from '@/utils/fawvwEmployeeNavigation';
import FileSaver from 'file-saver';
import { certificateDownloadBlob } from '@/utils/raCertificateDownload';
import auth from '@/plugins/auth';
import { useUserStore } from '@/store/modules/user';
import type { RaCertFilterOption } from '@/api/ra/cert';
import ChannelStatus from './ChannelStatus.vue';
import DistributionDialog from './DistributionDialog.vue';
import LegacyCertificates from './LegacyCertificates.vue';
import {
  canDistributeEmployeeCert,
  DistributionLog,
  EmployeeCert,
  type EmployeeCertDetail,
  type EmployeeCertStatus,
  EmployeeDistributionBatch,
  type EmployeeDistributionBatchType,
  EmployeeDistributionBatchItem,
  type EmployeeDistributionSelection,
  type EmployeeMailType,
  EmployeeCertDistributionConfig,
  EmployeeCertTemplate,
  type EmployeeDistributionScheme,
  listEmployeeDistributionSchemes,
  saveEmployeeDistributionScheme,
  deleteEmployeeDistributionScheme,
  downloadEmployeeCertPackage,
  downloadSelectedEmployeeCerts,
  type EmployeeCertDownloadFormat,
  getEmployeeCertDistributionConfig,
  getEmployeeCert,
  exportEmployeeCertLedger,
  getEmployeeLedgerCertificate,
  getEmployeeDistributionBatch,
  pageEmployeeDistributionBatches,
  listEmployeeCertTemplates,
  listEmployeeCertLedgerProfiles,
  getEmployeeCertPasswords,
  removeEmployeeCertLedgerEntries,
  pageEmployeeCerts,
  saveEmployeeCertDistributionConfig,
  testEmployeeCertDistributionConfig,
  updateEmployeeCertPassword
} from '@/api/ra/employeeCert';

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const exportingLedger = ref(false);
const deletingLedger = ref(false);
const ledgerCertificateDetail = ref<InstanceType<typeof RaCertDetailDialog>>();
const managementTab = ref<'ledger' | 'distribution' | 'legacy'>('ledger');
const canManageLegacy = computed(() => auth.hasPermi('ra:employee-cert') && auth.hasPermiOr(['ra:admin', 'ra:employee-cert:issue']));
const showSearch = ref(true);
const rows = ref<EmployeeCert[]>([]);
const selectedRows = ref<EmployeeCert[]>([]);
const adUploadSelectionReady = computed(() => selectedRows.value.length > 0 && selectedRows.value.every((row) => row.adUploadEligible === true));
const distributableRows = computed(() => selectedRows.value.filter((row) => canDistributeEmployeeCert(row, true)));
const canDistribute = computed(() => auth.hasPermi('ra:employee-cert:distribute'));
const ledgerPasswords = ref<Record<string, string>>();
const ledgerPasswordsLoading = ref(false);
const ledgerPasswordsVisible = ref(false);
const passwordToggleLabel = computed(() => (ledgerPasswordsVisible.value ? '隐藏当前页密码' : '显示当前页密码'));
const userStore = useUserStore();
const passwordPreferenceKey = computed(() => {
  const userId = String(userStore.userId ?? '');
  return userId ? `ra.employee-cert.show-passwords.${userStore.tenantId}.${userId}` : '';
});
let ledgerPasswordRequest = 0;
const total = ref(0);
const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  taskNo: '',
  serialNumber: '',
  domainAccount: '',
  employeeName: '',
  profileId: '',
  certStatus: '' as EmployeeCertStatus | '',
  distributionStatus: ''
});
const ledgerProfiles = ref<RaCertFilterOption[]>([]);
const ledgerProfilesLoading = ref(false);
const appliedFilters = ref(certFilters());
const certificateStatuses = [
  { value: 'VALID', label: '有效' },
  { value: 'EXPIRED', label: '已过期' },
  { value: 'EXPIRING', label: '即将过期' },
  { value: 'REVOKED', label: '已注销' },
  { value: 'ARCHIVED', label: '已归档' }
] as const;

function certificateStatusLabel(row: EmployeeCert) {
  if (row.certStatus === 'EXPIRING' && row.remainingDays != null) return `剩余 ${row.remainingDays} 天`;
  return (
    certificateStatuses.find((option) => option.value === row.certStatus)?.label || (row.certStatus === 'NOT_YET_VALID' ? '尚未生效' : '状态待核验')
  );
}

function certificateStatusTag(row: EmployeeCert) {
  if (row.certStatus === 'VALID') return 'success';
  if (row.certStatus === 'EXPIRING') return 'warning';
  if (row.certStatus === 'EXPIRED' || row.certStatus === 'REVOKED') return 'danger';
  return 'info';
}

const detailOpen = ref(false);
const detail = ref<{ cert?: EmployeeCert; logs?: DistributionLog[] }>({});
const passwordOpen = ref(false);
const passwordSaving = ref(false);
const passwordDraft = ref('');
const templateOpen = ref(false);
const schemeOpen = ref(false);
const schemeSaving = ref(false);
const deletingSchemeId = ref('');
const distributionSchemes = ref<EmployeeDistributionScheme[]>([]);
const distributionProfiles = ref<RaCertFilterOption[]>([]);
const schemeNewFiles = ref<import('element-plus').UploadUserFile[]>([]);
const blankScheme = (): EmployeeDistributionScheme => ({
  name: '',
  profileId: '',
  enabled: true,
  isDefault: false,
  email: { type: 'MIXED', title: '', body: '' },
  dingtalk: { type: 'markdown', title: '', body: '' }
});
const schemeForm = ref<EmployeeDistributionScheme>(blankScheme());
const mixedScheme = computed(() => schemeForm.value.email.type === 'MIXED');
const availableDistributionProfiles = computed(() => distributionProfiles.value.filter(profile =>
  !mixedScheme.value || !distributionSchemes.value.some(scheme =>
    scheme.id !== schemeForm.value.id && scheme.email.type === 'MIXED' && scheme.profileId === String(profile.id))
));
const templateLoading = ref(false);
const templates = ref<EmployeeCertTemplate[]>([]);
const generalEmail = computed(() => templates.value.find((row) => row.templateCode === 'EMP_CERT_EMAIL'));
const generalDing = computed(() => templates.value.find((row) => row.templateCode === 'EMP_CERT_DINGTALK'));
const templateRows = computed(() => {
  const custom = distributionSchemes.value;
  const generalEnabled = !!generalEmail.value?.enabled && generalEmail.value.messageType !== 'TEXT' && !!generalDing.value?.enabled;
  return [
    ...(!custom.some(scheme => scheme.id === 'GENERAL') ? [{
      builtin: true,
      name: '通用模板',
      emailTitle: generalEmail.value?.title || '未配置',
      dingTitle: generalDing.value?.title || '未配置',
      enabled: generalEnabled,
      scheme: undefined
    }] : []),
    ...custom.map((scheme) => ({
      builtin: false,
      name: scheme.name,
      emailTitle: scheme.email.title,
      dingTitle: scheme.dingtalk?.title,
      enabled: scheme.enabled,
      scheme
    }))
  ];
});
const distributionConfigOpen = ref(false);
const distributionConfigSaving = ref(false);
const distributionTestEmail = ref('');
const distributionTestDing = ref('');
const distributionTesting = ref(false);
const distributionTestResult = ref('');
const notificationSender = { emailAccount: 'cybersec@faw-vw.com', smtpServer: 'CC', dingtalkApp: 'fawvw' };
const distributionConfig = reactive<EmployeeCertDistributionConfig>({
  emailServerUrl: '',
  dingtalkServerUrl: '',
  appKey: '',
  secretKey: '',
  emailAccount: '',
  dingtalkApp: '',
  attachmentMaxSizeMb: 10,
  secretKeyConfigured: false
});
const distributionDialog = ref<InstanceType<typeof DistributionDialog>>();
const distributionRecordsLoading = ref(false);
const distributionRecords = ref<EmployeeDistributionBatchItem[]>([]);
const distributionBatches = ref<EmployeeDistributionBatch[]>([]);
const distributionTotal = ref(0);
const distributionPage = reactive({ pageNum: 1, pageSize: 10 });
const distributionDetailsOpen = ref(false);
const distributionTaskNo = ref('');
const distributionBatchType = ref<EmployeeDistributionBatchType | ''>('');
const appliedDistributionBatchType = ref<EmployeeDistributionBatchType | ''>('');
const appliedDistributionTaskNo = ref('');
const requestedDistributionBatchNo = ref('');
const distributionReadFailures = ref(0);
const distributionReadRetryLimit = 3;
const activeDistributionBatch = ref<EmployeeDistributionBatch>();
const activeDistributionBatchNo = computed(() => activeDistributionBatch.value?.batchNo || requestedDistributionBatchNo.value);
const distributionTaskDetail = computed(() => (activeDistributionBatch.value?.taskNo ? distributionRecords.value[0] : undefined));
const downloadingCert = ref<EmployeeCert['id']>();
const batchDownloadOpen = ref(false);
const batchDownloading = ref(false);
const batchDownloadIds = ref<EmployeeCert['id'][]>([]);
const batchDownloadFormat = ref<EmployeeCertDownloadFormat>('cer');
let distributionTimer: ReturnType<typeof setTimeout> | undefined;
let pageActive = false;
let pageDisposed = false;
let previousRouteTaskNo = '';
let previousRouteTaskEntry = '';
let listRequest = 0;
let detailRequest = 0;
let distributionRecordsRequest = 0;

function watchDistribution() {
  if (distributionTimer || !pageActive || pageDisposed) return;
  distributionTimer = setTimeout(async () => {
    distributionTimer = undefined;
    try {
      if (managementTab.value === 'distribution') {
        await loadDistributionRecords(true);
      } else {
        const page = unwrapData<any>(await pageEmployeeCerts({ pageNum: 1, pageSize: 1, distributionStatus: 'SENDING' }));
        if (!pageActive || managementTab.value !== 'ledger') return;
        await loadList();
        if (Number(page?.total || 0) > 0) watchDistribution();
      }
      if (pageActive && detailOpen.value && detail.value.cert?.id) await refreshOpenDetail(detail.value.cert.id);
    } catch {
      if (pageActive) ElMessage.warning('分发进度查询失败，请刷新查看渠道结果');
    }
  }, 3000);
}

function stopDistributionPolling() {
  if (distributionTimer) clearTimeout(distributionTimer);
  distributionTimer = undefined;
}

function unwrapData<T>(res: any): T {
  const body = res?.data ?? res;
  return (body?.data ?? body) as T;
}

async function loadLedgerProfiles() {
  ledgerProfilesLoading.value = true;
  try {
    const profiles = unwrapData<RaCertFilterOption[]>(await listEmployeeCertLedgerProfiles());
    if (!pageDisposed) ledgerProfiles.value = profiles || [];
  } catch {
    // The ledger can still be searched when the template options fail to load.
  } finally {
    ledgerProfilesLoading.value = false;
  }
}

async function loadList() {
  const request = ++listRequest;
  loading.value = true;
  try {
    const page = unwrapData<any>(
      await pageEmployeeCerts({
        ...appliedFilters.value,
        pageNum: queryParams.pageNum,
        pageSize: queryParams.pageSize
      })
    );
    if (request !== listRequest || pageDisposed) return;
    clearLedgerPasswords();
    rows.value = page?.rows || page?.records || [];
    total.value = Number(page?.total || 0);
    await revealLedgerPasswords();
    if (rows.value.some((row) => row.distributionStatus === 'SENDING')) watchDistribution();
  } finally {
    if (request === listRequest) loading.value = false;
  }
}

function certFilters() {
  return {
    taskNo: queryParams.taskNo.trim(),
    serialNumber: queryParams.serialNumber.trim(),
    domainAccount: queryParams.domainAccount.trim(),
    employeeName: queryParams.employeeName.trim(),
    profileId: queryParams.profileId,
    certStatus: queryParams.certStatus,
    distributionStatus: queryParams.distributionStatus
  };
}

function handleQuery() {
  clearLedgerPasswords();
  appliedFilters.value = certFilters();
  total.value = 0;
  rows.value = [];
  selectedRows.value = [];
  queryParams.pageNum = 1;
  return loadList();
}

function clearLedgerPasswords() {
  ledgerPasswordRequest++;
  ledgerPasswords.value = undefined;
  ledgerPasswordsLoading.value = false;
}

async function toggleLedgerPasswords() {
  if (!canDistribute.value) return;
  ledgerPasswordsVisible.value = !ledgerPasswordsVisible.value;
  try {
    const key = passwordPreferenceKey.value;
    if (key) {
      if (ledgerPasswordsVisible.value) sessionStorage.setItem(key, '1');
      else sessionStorage.removeItem(key);
    }
  } catch {
    // The current page can still toggle disclosure when browser storage is unavailable.
  }
  if (!ledgerPasswordsVisible.value) clearLedgerPasswords();
  else await revealLedgerPasswords();
}

async function revealLedgerPasswords() {
  if (!canDistribute.value || !ledgerPasswordsVisible.value || ledgerPasswordsLoading.value
    || managementTab.value !== 'ledger' || !pageActive || pageDisposed) return;
  const ids = rows.value.filter((row) => row.certPassword).map((row) => row.id);
  if (!ids.length) return;
  const request = ++ledgerPasswordRequest;
  ledgerPasswordsLoading.value = true;
  try {
    const passwords = unwrapData<Record<string, string>>(await getEmployeeCertPasswords(ids));
    if (request === ledgerPasswordRequest && !pageDisposed) ledgerPasswords.value = passwords;
  } catch {
    // Request handling already reports the failure without logging credentials.
  } finally {
    if (request === ledgerPasswordRequest) ledgerPasswordsLoading.value = false;
  }
}

function resetQuery(taskNo = '') {
  queryParams.taskNo = taskNo;
  queryParams.serialNumber = '';
  queryParams.domainAccount = '';
  queryParams.employeeName = '';
  queryParams.profileId = '';
  queryParams.certStatus = '';
  queryParams.distributionStatus = '';
  return handleQuery();
}

async function openDetail(row: Pick<EmployeeCert, 'id'>) {
  if (await loadDetail(row.id)) detailOpen.value = true;
}

async function loadDetail(id: EmployeeCert['id']) {
  const request = ++detailRequest;
  const result = unwrapData<EmployeeCertDetail>(await getEmployeeCert(id));
  if (pageDisposed || request !== detailRequest) return false;
  detail.value = result;
  return true;
}

async function refreshOpenDetail(id: EmployeeCert['id']) {
  const request = detailRequest;
  const result = unwrapData<EmployeeCertDetail>(await getEmployeeCert(id));
  if (!pageDisposed && request === detailRequest && detailOpen.value && detail.value.cert?.id === id) {
    detail.value = result;
  }
}

function openPasswordEditor() {
  const cert = detail.value.cert;
  if (!cert || !canDistribute.value || !canDownloadCert(cert) || cert.distributionStatus === 'SENDING') return;
  passwordDraft.value = cert.certPassword ?? '';
  passwordOpen.value = true;
}

async function saveCertificatePassword() {
  const cert = detail.value.cert;
  if (passwordSaving.value || !passwordOpen.value || !canDistribute.value || !cert) return;
  passwordSaving.value = true;
  try {
    const password = passwordDraft.value;
    await updateEmployeeCertPassword(cert.id, password);
    if (pageDisposed) return;
    clearLedgerPasswords();
    if (detail.value.cert?.id === cert.id) detail.value.cert.certPassword = password;
    passwordOpen.value = false;
    ElMessage.success('证书密码已更新');
    await Promise.all([loadDetail(cert.id), refreshCurrentTab()]);
  } finally {
    passwordSaving.value = false;
  }
}

function canDownloadCert(row: EmployeeCert) {
  return row.issueStatus === 'ISSUED' && row.raCertId != null;
}

function previewAdUpload() {
  if (!canDistribute.value || loading.value || !adUploadSelectionReady.value) return;
  ElMessage.info(`已选中 ${selectedRows.value.length} 张符合条件的证书，AD 发布接口尚未接入，本次未上传。`);
}

function distributeSelected() {
  const targets = distributableRows.value;
  if (targets.length !== selectedRows.value.length) {
    ElMessage.warning('所选记录含不可分发的证书，请取消勾选这些记录后重试');
    return;
  }
  if (!targets.length) return;
  const ids = targets.map((row) => row.id);
  const taskNo = targets[0].taskNo;
  const commonTaskNo = targets.every((row) => row.taskNo === taskNo) ? taskNo : undefined;
  distributionDialog.value?.open({ ids, freshBatch: true }, `所选 ${ids.length} 张证书对应的员工`, commonTaskNo);
}

function distribute(row: EmployeeCert, channel: string) {
  if (!canDistribute.value || !canDistributeEmployeeCert(row, true)) return;
  const ids = [row.id];
  const target = `${row.employeeName}（${row.domainAccount}）`;
  if (channel === 'BOTH') distributionDialog.value?.open({ ids, freshBatch: true }, target, row.taskNo);
  else if (channel === 'EMAIL' || channel === 'DINGTALK') {
    distributionDialog.value?.open({ ids, certificateChannel: channel }, target, row.taskNo);
  }
}

async function downloadPackage(row: EmployeeCert) {
  if (downloadingCert.value != null) return;
  downloadingCert.value = row.id;
  try {
    const blob = await certificateDownloadBlob(await downloadEmployeeCertPackage(row.id), 'application/zip', 'RA_EMPLOYEE_CERT_');
    FileSaver.saveAs(blob, `employee-cert-${row.id}.zip`);
  } catch (error: any) {
    ElMessage.error(error?.message || '证书压缩包下载失败');
  } finally {
    downloadingCert.value = undefined;
  }
}

function openBatchDownload() {
  const ids = selectedRows.value.filter(canDownloadCert).map((row) => row.id);
  if (!ids.length || batchDownloading.value) return;
  batchDownloadIds.value = ids;
  batchDownloadFormat.value = 'cer';
  batchDownloadOpen.value = true;
}

async function downloadSelected() {
  if (batchDownloading.value || !batchDownloadIds.value.length) return;
  batchDownloading.value = true;
  try {
    const format = batchDownloadFormat.value;
    const blob = await certificateDownloadBlob(
      await downloadSelectedEmployeeCerts(batchDownloadIds.value, format),
      'application/zip',
      'RA_EMPLOYEE_CERT_'
    );
    FileSaver.saveAs(blob, `employee-certs-${format}.zip`);
    batchDownloadOpen.value = false;
  } catch (error: any) {
    const body = error?.response?.data;
    const result =
      body instanceof Blob
        ? await body
            .text()
            .then(JSON.parse)
            .catch(() => null)
        : body;
    ElMessage.error(result?.msg || error?.message || '批量下载失败');
  } finally {
    batchDownloading.value = false;
  }
}

function distributionChannelStatus(row: EmployeeDistributionBatchItem, channel: 'emailStatus' | 'dingtalkStatus') {
  if (channel === 'dingtalkStatus' && row.messageType === 'TEXT') return 'NOT_APPLICABLE';
  const status = row[channel];
  if (status === 'NOT_APPLICABLE' || status === 'NOT_SENT') return status;
  if (row.sendStatus === 0 && row.messageType === 'MIXED' && !status) return 'SENDING';
  if (row.messageType === 'NOTICE' && row.sendStatus !== 0 && status === 'PENDING') return 'NOT_SENT';
  if (row.sendStatus !== 0 && status !== 'SENT' && status !== 'FAILED') return 'UNKNOWN';
  return status;
}

function batchTypeLabel(batch: EmployeeDistributionBatch) {
  return batch.taskType === 'UPLOAD' ? '证书上传' : batch.notice ? '业务通知' : '证书分发';
}

function summarizeDistributionBatch(batchNo: string, records: EmployeeDistributionBatchItem[]): EmployeeDistributionBatch | undefined {
  if (!records.length) return;
  const taskCount = new Set(records.map((row) => row.taskNo || '')).size;
  return {
    batchNo,
    notice: records[0].messageType === 'NOTICE',
    taskNo: taskCount === 1 ? records[0].taskNo : undefined,
    taskCount,
    createTime: records[0].createTime,
    totalCount: records.length,
    successCount: records.filter((row) => row.sendStatus === 1).length,
    failedCount: records.filter((row) => row.sendStatus === 2).length
  };
}

async function loadDistributionRecords(retry = false) {
  const request = ++distributionRecordsRequest;
  const taskNo = appliedDistributionTaskNo.value;
  const requestedBatchNo = requestedDistributionBatchNo.value;
  const batchType = appliedDistributionBatchType.value;
  if (!retry) distributionReadFailures.value = 0;
  distributionRecordsLoading.value = true;
  try {
    const [response, requestedDetails] = await Promise.all([
      pageEmployeeDistributionBatches({ ...distributionPage, taskNo: taskNo || undefined, batchType: batchType || undefined }),
      requestedBatchNo ? getEmployeeDistributionBatch(requestedBatchNo) : undefined
    ]);
    if (request !== distributionRecordsRequest || pageDisposed) return;
    const page = unwrapData<{ records: EmployeeDistributionBatch[]; total: number }>(response);
    const batches = page?.records || [];
    distributionBatches.value = batches;
    distributionTotal.value = Number(page?.total || 0);
    const batch = requestedBatchNo ? undefined : batches.find((row) => row.batchNo === activeDistributionBatchNo.value) || batches[0];
    const details = batch ? await getEmployeeDistributionBatch(batch.batchNo) : requestedDetails;
    if (request !== distributionRecordsRequest || pageDisposed) return;
    const loaded = details ? unwrapData<EmployeeDistributionBatchItem[]>(details) || [] : [];
    const records = batchType === 'UPLOAD' || (batchType === 'DISTRIBUTION' && loaded[0]?.messageType === 'NOTICE') ? [] : loaded;
    distributionRecords.value = taskNo ? records.filter((row) => row.taskNo?.toLowerCase() === taskNo.toLowerCase()) : records;
    activeDistributionBatch.value = requestedBatchNo ? summarizeDistributionBatch(requestedBatchNo, distributionRecords.value) : batch;
    distributionReadFailures.value = 0;
    const activeBatch = activeDistributionBatch.value;
    if (managementTab.value === 'distribution' && activeBatch && activeBatch.totalCount > activeBatch.successCount + activeBatch.failedCount) {
      watchDistribution();
    }
  } catch {
    if (request !== distributionRecordsRequest || pageDisposed) return;
    distributionReadFailures.value++;
    if (managementTab.value === 'distribution' && distributionReadFailures.value <= distributionReadRetryLimit) watchDistribution();
  } finally {
    if (request === distributionRecordsRequest) distributionRecordsLoading.value = false;
  }
}

function updateManagementRoute(tab: 'ledger' | 'distribution', taskNo: string, batchNo = '') {
  if (route.path.replace(/\/$/, '') !== employeeCertLedgerPath) return;
  return router.replace({
    path: route.path,
    query: { ...route.query, tab: tab === 'distribution' ? tab : undefined, taskNo: taskNo || undefined, batchNo: batchNo || undefined,
      batchType: tab === 'distribution' ? appliedDistributionBatchType.value || undefined : undefined }
  });
}

async function selectDistributionBatch(batchNo: string) {
  requestedDistributionBatchNo.value = batchNo;
  activeDistributionBatch.value = undefined;
  distributionRecords.value = [];
  distributionDetailsOpen.value = true;
  await Promise.all([updateManagementRoute('distribution', appliedDistributionTaskNo.value, batchNo), loadDistributionRecords()]);
}

function searchDistributionRecords(batchNo = '', updateRoute = true) {
  distributionDetailsOpen.value = false;
  appliedDistributionTaskNo.value = distributionTaskNo.value.trim();
  appliedDistributionBatchType.value = distributionBatchType.value;
  distributionPage.pageNum = 1;
  requestedDistributionBatchNo.value = batchNo;
  activeDistributionBatch.value = undefined;
  distributionBatches.value = [];
  distributionRecords.value = [];
  distributionTotal.value = 0;
  const navigation = updateRoute ? updateManagementRoute('distribution', appliedDistributionTaskNo.value, batchNo) : undefined;
  return Promise.all([navigation, loadDistributionRecords()]);
}

function resetDistributionQuery() {
  distributionTaskNo.value = '';
  distributionBatchType.value = '';
  return searchDistributionRecords();
}

function onDistributionSubmitted(
  selection: EmployeeDistributionSelection,
  _messageType: EmployeeMailType,
  batchNo?: string,
  taskNo = selection.taskNo
) {
  distributionTaskNo.value = taskNo || '';
  distributionBatchType.value = '';
  managementTab.value = 'distribution';
  return searchDistributionRecords(batchNo);
}

function switchManagementTab(tab: string | number) {
  if (managementTab.value === tab) return;
  distributionDetailsOpen.value = false;
  if (tab === 'legacy' && canManageLegacy.value) {
    stopDistributionPolling();
    managementTab.value = tab;
    return;
  }
  if (tab !== 'ledger' && tab !== 'distribution') return;
  stopDistributionPolling();
  managementTab.value = tab;
  if (tab === 'distribution') {
    const batchNo = requestedDistributionBatchNo.value;
    return Promise.all([updateManagementRoute(tab, appliedDistributionTaskNo.value, batchNo), loadDistributionRecords()]);
  }
  previousRouteTaskNo = appliedFilters.value.taskNo;
  return Promise.all([updateManagementRoute(tab, previousRouteTaskNo), loadList()]);
}

function applyManagementRoute() {
  if (route.path.replace(/\/$/, '') !== employeeCertLedgerPath) return false;
  const task = typeof route.query.taskNo === 'string' ? route.query.taskNo.trim() : '';
  const taskNo = task.length <= 40 ? task : '';
  if (route.query.tab === 'distribution') {
    const batch = route.query.batchNo;
    const batchNo = typeof batch === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(batch) ? batch.toLowerCase() : '';
    const type = route.query.batchType;
    const batchType = type === 'DISTRIBUTION' || type === 'UPLOAD' ? type : '';
    if (managementTab.value === 'distribution' && appliedDistributionTaskNo.value === taskNo
      && requestedDistributionBatchNo.value === batchNo && appliedDistributionBatchType.value === batchType) return false;
    stopDistributionPolling();
    managementTab.value = 'distribution';
    detailOpen.value = false;
    distributionTaskNo.value = taskNo;
    distributionBatchType.value = batchType;
    void searchDistributionRecords(batchNo, false);
    return true;
  }
  const taskEntry = typeof route.query.taskEntry === 'string' ? route.query.taskEntry : '';
  const explicitTaskEntry = taskNo && taskEntry && taskEntry !== previousRouteTaskEntry;
  if (managementTab.value === 'ledger' && taskNo === previousRouteTaskNo && !explicitTaskEntry) return false;
  stopDistributionPolling();
  previousRouteTaskNo = taskNo;
  distributionDetailsOpen.value = false;
  if (explicitTaskEntry) previousRouteTaskEntry = taskEntry;
  managementTab.value = 'ledger';
  showSearch.value = true;
  detailOpen.value = false;
  void resetQuery(taskNo);
  return true;
}

function refreshCurrentTab() {
  if (managementTab.value === 'distribution') return loadDistributionRecords();
  if (managementTab.value === 'ledger') return loadList();
}

async function removeLedger() {
  if (!canDistribute.value || deletingLedger.value || !selectedRows.value.length) return;
  const ids = selectedRows.value.map(row => row.id);
  deletingLedger.value = true;
  try {
    const confirmed = await ElMessageBox.confirm(`确认删除选中的 ${ids.length} 条台账记录？`, '批量删除', {
      type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消'
    }).then(() => true, () => false);
    if (!confirmed) return;
    await removeEmployeeCertLedgerEntries(ids);
    selectedRows.value = [];
    ElMessage.success('台账记录已删除');
    await loadList();
  } finally {
    deletingLedger.value = false;
  }
}

function openLedgerCertificate(row: EmployeeCert) {
  ledgerCertificateDetail.value?.open({ id: row.id, serialNumber: row.serialNumber, subject: row.subject });
}

async function handleExport() {
  if (!canDistribute.value || exportingLedger.value) return;
  exportingLedger.value = true;
  try {
    const blob = await certificateDownloadBlob(
      await exportEmployeeCertLedger({ ...appliedFilters.value }),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'RA_EMPLOYEE_CERT_'
    );
    FileSaver.saveAs(blob, `fawvw_employee_certs_${Date.now()}.xlsx`);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导出台账失败');
  } finally {
    exportingLedger.value = false;
  }
}

async function openTemplates() {
  templateOpen.value = true;
  templateLoading.value = true;
  try {
    const [general, config] = await Promise.all([listEmployeeCertTemplates(), listEmployeeDistributionSchemes()]);
    templates.value = unwrapData<EmployeeCertTemplate[]>(general) || [];
    const data = unwrapData<{ schemes: EmployeeDistributionScheme[]; profiles: RaCertFilterOption[] }>(config);
    distributionSchemes.value = data?.schemes || [];
    distributionProfiles.value = data?.profiles || [];
  } finally {
    templateLoading.value = false;
  }
}

function editScheme(row?: EmployeeDistributionScheme) {
  const initial = blankScheme();
  schemeForm.value = row
    ? {
        ...row,
        profileId: row.profileId === '0' ? '' : row.profileId,
        isDefault: false,
        attachmentNames: [...(row.attachmentNames || [])],
        email: { ...row.email },
        dingtalk: { ...row.dingtalk, type: row.dingtalk?.type || initial.dingtalk.type }
      }
    : initial;
  schemeNewFiles.value = [];
  schemeOpen.value = true;
}

function bindGeneralScheme() {
  const initial = blankScheme();
  editScheme({
    ...initial, id: 'GENERAL', name: '证书分发模板',
    email: { ...initial.email, type: generalEmail.value?.messageType === 'TEXT' ? 'TEXT' : 'MIXED',
      title: generalEmail.value?.title || '', body: generalEmail.value?.content || '' },
    dingtalk: { ...initial.dingtalk, title: generalDing.value?.title || '', body: generalDing.value?.content || '' }
  });
}

async function saveScheme() {
  if (schemeSaving.value) return;
  schemeSaving.value = true;
  try {
    if (mixedScheme.value && !schemeForm.value.profileId) {
      ElMessage.warning('请选择要绑定的证书模板');
      return;
    }
    const files = mixedScheme.value ? schemeNewFiles.value.flatMap(file => file.raw ? [file.raw] : []) : [];
    await saveEmployeeDistributionScheme(schemeForm.value, files);
    schemeOpen.value = false;
    ElMessage.success('分发方案已保存');
    await openTemplates();
  } finally {
    schemeSaving.value = false;
  }
}


async function removeScheme(scheme: EmployeeDistributionScheme) {
  const id = scheme.id;
  if (!id || deletingSchemeId.value) return;
  deletingSchemeId.value = id;
  try {
    const warning = scheme.email.type === 'MIXED' && scheme.profileId && scheme.profileId !== '0'
      ? ' 删除后，对应证书模板需重新绑定分发模板才能发送证书。' : '';
    const confirmed = await ElMessageBox.confirm(`确定删除分发模板「${scheme.name}」？${warning}`, '删除分发模板',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }).then(() => true, () => false);
    if (!confirmed) return;
    await deleteEmployeeDistributionScheme(id, scheme.revision);
    ElMessage.success('分发模板已删除');
    await openTemplates();
  } finally {
    deletingSchemeId.value = '';
  }
}

async function openDistributionConfig() {
  const config = unwrapData<EmployeeCertDistributionConfig>(await getEmployeeCertDistributionConfig());
  Object.assign(distributionConfig, {
    emailServerUrl: '',
    dingtalkServerUrl: '',
    appKey: '',
    emailAccount: '',
    dingtalkApp: '',
    attachmentMaxSizeMb: 10,
    secretKeyConfigured: false,
    ...config,
    ...notificationSender,
    secretKey: ''
  });
  distributionTestEmail.value = '';
  distributionTestDing.value = '';
  distributionTestResult.value = '';
  distributionConfigOpen.value = true;
}

async function testDistributionConfig(channel: 'EMAIL' | 'DINGTALK') {
  if (distributionTesting.value) return;
  const label = channel === 'EMAIL' ? '邮件' : '钉钉';
  const recipient = (channel === 'EMAIL' ? distributionTestEmail.value : distributionTestDing.value).trim();
  if (!recipient) return;
  const config = { ...distributionConfig, ...notificationSender };
  distributionTesting.value = true;
  distributionTestResult.value = `${label}：正在检测网关连通性…`;
  let networkReachable = false;
  try {
    const { emailServerUrl, dingtalkServerUrl } = config;
    const connectivity = unwrapData<string>(
      await testEmployeeCertDistributionConfig({ channel, send: false, config: { emailServerUrl, dingtalkServerUrl } })
    );
    networkReachable = true;
    distributionTestResult.value = `${label}：${connectivity}`;
    if (!distributionConfigOpen.value) return;
    const confirmed = await ElMessageBox.confirm(
      `网络已连通。${connectivity}。仅向 ${recipient} 发送一条${label}测试消息，确认发送？`,
      '试发确认',
      { type: 'warning', confirmButtonText: '确认发送', cancelButtonText: '取消', closeOnClickModal: false, autofocus: false }
    ).then(() => true).catch(() => false);
    if (!confirmed || !distributionConfigOpen.value) {
      distributionTestResult.value = `${label}：网络已连通，未发送测试消息`;
      return;
    }
    distributionTestResult.value = `${label}：正在发送测试消息…`;
    const result = unwrapData<string>(await testEmployeeCertDistributionConfig({ channel, send: true, recipient, config }));
    distributionTestResult.value = `${label}：${result}`;
  } catch {
    distributionTestResult.value = networkReachable
      ? `${label}：网关可达，测试消息发送失败`
      : `${label}：网关连通性检测失败，未发送测试消息`;
  } finally {
    distributionTesting.value = false;
  }
}

async function saveDistributionConfig() {
  distributionConfigSaving.value = true;
  try {
    const saved = unwrapData<EmployeeCertDistributionConfig>(
      await saveEmployeeCertDistributionConfig({
        emailServerUrl: distributionConfig.emailServerUrl,
        dingtalkServerUrl: distributionConfig.dingtalkServerUrl,
        appKey: distributionConfig.appKey,
        secretKey: distributionConfig.secretKey,
        ...notificationSender,
        attachmentMaxSizeMb: distributionConfig.attachmentMaxSizeMb,
      })
    );
    Object.assign(distributionConfig, saved, { secretKey: '' });
    ElMessage.success('分发配置已保存');
    distributionConfigOpen.value = false;
  } finally {
    distributionConfigSaving.value = false;
  }
}

function channelName(channel?: string) {
  const value = (channel || '').toUpperCase();
  if (value.startsWith('EMAIL')) return '邮件';
  if (value.startsWith('DINGTALK')) return '钉钉';
  return channel || '-';
}

function distributionTag(status?: string) {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    SENT: 'success',
    PENDING: 'warning',
    SENDING: 'info',
    FAILED: 'danger'
  };
  return map[status || ''] || 'info';
}

function formatDate(value?: string) {
  return value ? value.replace('T', ' ').slice(0, 19) : '-';
}

onMounted(() => {
  pageActive = true;
  if (!applyManagementRoute()) void loadList();
  void loadLedgerProfiles();
});
watch([() => route.path, () => route.query.taskNo, () => route.query.taskEntry, () => route.query.tab, () => route.query.batchNo, () => route.query.batchType], () => {
  if (pageActive) applyManagementRoute();
});
watch([managementTab, () => queryParams.pageNum, () => queryParams.pageSize], clearLedgerPasswords, { flush: 'sync' });
watch([passwordPreferenceKey, canDistribute], ([key, allowed]) => {
  clearLedgerPasswords();
  ledgerPasswordsVisible.value = false;
  try {
    ledgerPasswordsVisible.value = Boolean(key && allowed && sessionStorage.getItem(key) === '1');
  } catch {
    // Browser storage can be unavailable.
  }
}, { immediate: true, flush: 'sync' });
onActivated(() => {
  if (pageActive) return;
  pageActive = true;
  if (!applyManagementRoute()) return refreshCurrentTab();
});
onDeactivated(() => {
  pageActive = false;
  distributionDetailsOpen.value = false;
  stopDistributionPolling();
  clearLedgerPasswords();
});
onUnmounted(() => {
  clearLedgerPasswords();
  pageDisposed = true;
  stopDistributionPolling();
});
</script>

<style scoped>
.management-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 15px;
}

.management-tabs {
  flex: 1;
  min-width: 0;
}

.management-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
}

.management-actions {
  display: flex;
  flex-shrink: 0;
}

.management-actions:empty {
  display: none;
}

.distribution-test-row {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}

.password-toggle {
  margin-left: 4px;
}

.ledger-password {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.query-card {
  margin-bottom: 12px;
}

.distribution-query {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.distribution-query :deep(.el-form-item) {
  margin: 0;
}

.distribution-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.distribution-heading strong {
  overflow-wrap: anywhere;
}

.query-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  align-items: center;
  gap: 12px 16px;
}

.query-form :deep(.el-form-item) {
  min-width: 0;
  margin: 0;
}

.query-form :deep(.el-form-item__label) {
  white-space: nowrap;
}

.query-form :deep(.el-form-item__content) {
  min-width: 0;
}

.query-form :deep(.el-input),
.query-form :deep(.el-select) {
  width: 100%;
}

.query-actions {
  display: flex;
  justify-content: flex-end;
  grid-column-end: -1;
}

.mb8 {
  margin-bottom: 8px;
}

.mb12 {
  margin-bottom: 12px;
}

.ml4 {
  margin-left: 4px;
}

.unit-label {
  margin-left: 8px;
  color: var(--el-text-color-regular);
}

.template-form {
  margin-top: 16px;
}

.template-help {
  margin: -4px 0 16px 90px;
  padding: 10px 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.7;
}

.template-help p {
  margin: 0;
}

.template-help code {
  color: var(--el-color-primary);
  font-family: Consolas, Monaco, monospace;
}

.template-help-example {
  color: var(--el-text-color-regular);
}

.template-help-note {
  color: var(--el-color-warning);
}

.hidden-file {
  display: none;
}
</style>
