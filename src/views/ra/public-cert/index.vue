<template>
  <div class="app-container public-cert-page">
    <BusinessNoticeSettingsDialog ref="businessNoticeSettings" module="public" />
    <el-tabs v-model="managementTab" @tab-change="handleTabChange">
      <el-tab-pane label="证书台账" name="records" />
      <el-tab-pane v-if="auth.hasPermi('ra:public-cert:audit')" label="审核中心" name="audit" />
      <el-tab-pane label="已办记录" name="handled" />
    </el-tabs>
    <el-card shadow="never" class="query-card">
      <el-form :model="queryParams" label-width="100px" class="public-cert-query">
        <el-form-item label="域名">
          <el-input v-model="queryParams.domainName" clearable placeholder="域名" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="序列号">
          <el-input v-model="queryParams.serialNumber" clearable placeholder="序列号" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="系统">
          <el-input v-model="queryParams.systemName" clearable placeholder="使用系统" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="证书维护人">
          <el-input v-model="queryParams.ownerKeyword" clearable placeholder="姓名/账号" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item v-if="managementTab === 'handled'" label="审核状态">
          <el-select v-model="queryParams.approvalStatus" clearable placeholder="全部">
            <el-option label="已通过" value="APPROVED" />
            <el-option label="已驳回" value="REJECTED" />
          </el-select>
        </el-form-item>
        <el-form-item label="证书状态">
          <el-select v-model="queryParams.certStatus" clearable placeholder="全部">
            <el-option label="正常" value="NORMAL" />
            <el-option label="30天内过期" value="EXPIRING" />
            <el-option label="已过期" value="EXPIRED" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="managementTab === 'records'" label="人员状态">
          <el-select v-model="queryParams.employeeStatus" clearable><el-option label="在职" value="ACTIVE" /><el-option label="离职" value="LEFT" /></el-select>
        </el-form-item>
        <el-form-item v-if="managementTab === 'records'" label="提醒状态">
          <el-select v-model="queryParams.reminderEnabled" clearable :value-on-clear="null">
            <el-option label="开启" :value="true" /><el-option label="关闭" :value="false" />
          </el-select>
        </el-form-item>
        <el-form-item label="到期时间">
          <el-date-picker
            v-model="notAfterRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
          />
        </el-form-item>
        <el-form-item class="query-actions">
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card">
      <el-row :gutter="10" class="mb8 toolbar-row">
        <el-col v-if="managementTab === 'audit'" :span="1.5"><el-button type="success" icon="Check" :disabled="loading || auditing || !selectedRows.length" @click="batchAudit(true)">通过选中</el-button></el-col>
        <el-col v-if="managementTab === 'audit'" :span="1.5"><el-button type="warning" icon="Close" :disabled="loading || auditing || !selectedRows.length" @click="batchAudit(false)">驳回选中</el-button></el-col>
        <el-col v-if="managementTab === 'records'" :span="1.5">
          <el-button v-hasPermi="['ra:public-cert:add']" type="primary" plain icon="Plus" @click="openCreate">新增</el-button>
        </el-col>
        <el-col :span="1.5">
          <el-dropdown v-if="managementTab === 'records'" trigger="click" :disabled="!selectedRows.length" @command="batchLedgerAction">
            <el-button plain :disabled="!selectedRows.length">操作</el-button>
            <template #dropdown><el-dropdown-menu>
              <el-dropdown-item v-hasPermi="['ra:public-cert:edit']" command="enable">开启提醒</el-dropdown-item>
              <el-dropdown-item v-hasPermi="['ra:public-cert:edit']" command="disable">关闭提醒</el-dropdown-item>
              <el-dropdown-item v-hasPermi="['ra:public-cert:remove']" command="delete">批量删除</el-dropdown-item>
            </el-dropdown-menu></template>
          </el-dropdown>
          <el-button v-hasPermi="['ra:public-cert:export']" type="success" plain icon="Download" @click="handleExport">导出</el-button>
        </el-col>
        <el-col v-if="managementTab === 'records'" :span="1.5"><el-button v-hasPermi="['ra:public-cert:edit']" plain icon="RefreshRight" @click="refreshPersonnel">刷新状态</el-button></el-col>
        <el-col v-if="managementTab === 'records'" :span="1.5">
          <el-button v-hasPermi="['ra:public-cert:type']" plain icon="Collection" @click="openTypes">证书类型</el-button>
        </el-col>
        <el-col v-if="managementTab === 'records'" :span="1.5">
          <el-button v-hasPermi="['ra:public-cert:grant']" plain icon="UserFilled" @click="openGrants">录入授权</el-button>
        </el-col>
        <el-col v-if="managementTab === 'records'" :span="1.5"><el-button v-hasPermi="['ra:public-cert:type']" icon="Bell" @click="businessNoticeSettings?.open()">通知设置</el-button></el-col>
        <right-toolbar v-model:showSearch="showSearch" @queryTable="loadList" />
        <el-col v-if="managementTab === 'records'" :span="1.5"><el-button plain icon="Document" @click="deliveryLogsOpen = true">通知记录</el-button></el-col>
      </el-row>

      <el-table v-loading="loading" :data="rows" border stripe
        :empty-text="managementTab === 'audit' ? '暂无待审核证书' : managementTab === 'handled' ? '暂无办理记录' : '暂无已通过证书'"
        @selection-change="selectedRows = $event">
        <el-table-column v-if="managementTab !== 'handled'" type="selection" width="48" :selectable="(row) => managementTab === 'records' || row.approvalStatus === 'PENDING'" />
        <el-table-column label="域名" prop="domainName" min-width="190" fixed show-overflow-tooltip />
        <el-table-column label="证书类型" prop="certTypeName" width="110" />
        <el-table-column label="序列号" prop="serialNumber" min-width="150" show-overflow-tooltip />
        <el-table-column label="证书维护人" prop="businessOwnerName" width="120" show-overflow-tooltip />
        <el-table-column label="科室" prop="departmentName" min-width="140" show-overflow-tooltip />
        <el-table-column label="到期时间" prop="notAfter" width="166" align="center">
          <template #default="{ row }">{{ formatDateTime(row.notAfter) }}</template>
        </el-table-column>
        <el-table-column label="证书状态" width="146" align="center">
          <template #default="{ row }">
            <el-tag :type="businessCertificateValidity(row.notAfter, 365).type" effect="light">{{ businessCertificateValidity(row.notAfter, 365).text }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="审核状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="approvalType(row.approvalStatus)" effect="plain">{{ row.approvalStatusName || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="人员状态" width="100" align="center">
          <template #default="{ row }"><el-tag :type="row.employeeStatus === 'ACTIVE' ? 'success' : 'danger'">{{ row.employeeStatus === 'ACTIVE' ? '在职' : '离职' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="210" align="center">
          <template #default="{ row }">
            <span v-if="managementTab === 'records'" :title="businessCertificateNoticeBlocked(row.notAfter) ? '证书过期已超过一个月，不可发送通知' : '到期提醒'">
              <el-switch size="small" :model-value="!!row.reminderEnabled" :loading="reminderSaving.has(row.id)"
                :disabled="!auth.hasPermi('ra:public-cert:edit') || businessCertificateNoticeBlocked(row.notAfter)" @change="(value) => setReminder(row, !!value)" />
            </span>
            <CertRowAction label="查看详情" icon="View" @click="openDetail(row)" />
            <template v-if="managementTab !== 'audit'">
              <CertRowAction v-if="row.approvalStatus !== 'PENDING' && row.ledgerStatus !== 'SUPERSEDED'" v-hasPermi="['ra:public-cert:edit']" label="修改" icon="Edit" @click="openEdit(row)" />
              <CertRowAction v-if="managementTab === 'records' && row.approvalStatus === 'APPROVED'" v-hasPermi="['ra:public-cert:edit', 'ra:public-cert:audit']" :label="businessCertificateNoticeBlocked(row.notAfter) ? '证书过期已超过一个月，不可发送通知' : '发送通知'" icon="Message" :disabled="sendingNotice || businessCertificateNoticeBlocked(row.notAfter)" @click="sendNotice(row)" />
              <CertRowAction v-hasPermi="['ra:public-cert:remove']" label="删除" icon="Delete" type="danger" @click="handleRemove(row)" />
            </template>
          </template>
        </el-table-column>
      </el-table>

      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" :auto-scroll="false" @pagination="loadList" />
    </el-card>

    <el-dialog v-model="deliveryLogsOpen" title="通知记录" width="min(1120px, 96vw)" append-to-body>
      <BusinessDeliveryLogs v-if="deliveryLogsOpen" module="public" @certificate="(id) => { deliveryLogsOpen = false; openDetail({ id }); }" />
    </el-dialog>

    <el-drawer v-model="formOpen" :title="form.id ? '修改录入证书' : '新增录入证书'" size="min(1040px, 100vw)" :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving" append-to-body>
      <el-form ref="formRef" :model="form" :rules="rules" :disabled="saving" label-width="116px">
        <el-divider content-position="left">证书信息</el-divider>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="证书类型" prop="certTypeId">
              <el-select v-model="form.certTypeId" filterable placeholder="请选择" style="width: 100%" @change="onTypeChange">
                <el-option v-for="item in types" :key="String(item.id)" :label="item.typeName" :value="item.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="域名" prop="domainName" :required="domainRequired">
              <el-input v-model="form.domainName" type="textarea" :rows="3" maxlength="500" placeholder="多个域名按行填写" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="证书序列号">
              <el-input v-model="form.serialNumber" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="颁发机构">
              <el-input v-model="form.issuer" clearable />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="供应商">
              <el-input v-model="form.vendor" clearable />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="生效时间" prop="notBefore">
              <el-date-picker v-model="form.notBefore" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="到期时间" prop="notAfter">
              <el-date-picker v-model="form.notAfter" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">负责人</el-divider>
        <el-form-item label="证书维护人" prop="businessOwnerEmployeeId">
          <div class="inline-picker">
            <el-input v-model="form.businessOwnerName" readonly placeholder="请选择证书维护人" />
            <el-button icon="User" @click="openEmployeePicker('owner')">选择</el-button>
          </div>
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="维护人账号">
              <el-input v-model="form.businessOwnerAccount" readonly />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="维护人邮箱">
              <el-input v-model="form.businessOwnerEmail" readonly />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="科室">
          <el-input v-model="form.departmentName" readonly />
        </el-form-item>

        <el-divider content-position="left">使用信息</el-divider>
        <el-form-item prop="usages" label-width="0"><UsageTable v-model="form.usages" :lookup="lookupEmployees" /></el-form-item>
        <el-divider content-position="left">附件</el-divider>
        <el-form-item label="压缩包">
          <el-upload v-model:file-list="pendingAttachments" :auto-upload="false" accept=".zip,.rar" multiple
            :on-change="(file) => { if (file.raw && !beforeUpload(file.raw)) pendingAttachments = pendingAttachments.filter((item) => item.uid !== file.uid); }">
            <el-button icon="Upload">上传证书</el-button>
            <template #tip><div class="el-upload__tip">请将证书打包为 ZIP 或 RAR 压缩包上传，文件大小不得超过 20 MB。</div></template>
          </el-upload>
        </el-form-item>
        <el-form-item v-if="formAttachments.length" label="已有附件"><span>{{ formAttachments.map((item) => item.originalName).join('；') }}</span></el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="saving" @click="formOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">提交</el-button>
      </template>
    </el-drawer>

    <el-drawer v-model="detailOpen" title="录入证书详情" size="680px" append-to-body>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="域名"><span style="white-space: pre-line">{{ detail.cert?.domainName || '-' }}</span></el-descriptions-item>
        <el-descriptions-item label="证书类型">{{ detail.cert?.certTypeName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="序列号">{{ detail.cert?.serialNumber || '-' }}</el-descriptions-item>
        <el-descriptions-item label="颁发机构">{{ detail.cert?.issuer || '-' }}</el-descriptions-item>
        <el-descriptions-item label="供应商">{{ detail.cert?.vendor || '-' }}</el-descriptions-item>
        <el-descriptions-item label="维护人账号">{{ detail.cert?.businessOwnerAccount || '-' }}</el-descriptions-item>
        <el-descriptions-item label="维护人邮箱">{{ detail.cert?.businessOwnerEmail || '-' }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{ detail.cert?.remark || '-' }}</el-descriptions-item>
        <el-descriptions-item label="有效期"
          >{{ formatDateTime(detail.cert?.notBefore) }} 至 {{ formatDateTime(detail.cert?.notAfter) }}</el-descriptions-item
        >
        <el-descriptions-item label="审核状态">{{ detail.cert?.approvalStatusName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="证书状态">{{ businessCertificateValidity(detail.cert?.notAfter, 365).text }}</el-descriptions-item>
        <el-descriptions-item label="证书维护人">{{ detail.cert?.businessOwnerName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="科室">{{ detail.cert?.departmentName || '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-divider content-position="left">使用详情</el-divider>
      <el-table :data="detail.usages || []" border size="small">
        <el-table-column label="系统" prop="systemName" min-width="130" />
        <el-table-column label="系统负责人" prop="businessOwnerName" min-width="120" />
        <el-table-column label="域名" prop="usageDomain" min-width="150"><template #default="{ row }"><span style="white-space: pre-line">{{ row.usageDomain || '-' }}</span></template></el-table-column>
        <el-table-column label="场景" prop="usageScene" min-width="160" />
      </el-table>
      <el-divider content-position="left">附件</el-divider>
      <el-table :data="detail.attachments || []" border size="small" class="mt12">
        <el-table-column label="文件名" prop="originalName" min-width="220">
          <template #default="{ row }"><el-button link type="primary" @click="downloadAttachment(row)">{{ row.originalName }}</el-button></template>
        </el-table-column>
        <el-table-column label="大小" width="100">
          <template #default="{ row }">{{ fileSize(row.fileSize) }}</template>
        </el-table-column>
      </el-table>
      <el-divider content-position="left">审核记录</el-divider>
      <el-timeline>
        <el-timeline-item v-for="entry in detailTimeline" :key="entry.key" :timestamp="formatDateTime(entry.time)" :type="entry.color">
          {{ entry.text }}
        </el-timeline-item>
      </el-timeline>
      <el-divider content-position="left">通知记录</el-divider>
      <BusinessDeliveryLogs v-if="detailOpen && detail.cert?.id != null" module="public" :certificate-id="detail.cert.id" @loaded="detailDeliveryLogs = $event" />
    </el-drawer>

    <el-dialog v-model="employeeOpen" title="选择员工" width="min(940px, 96vw)" append-to-body
      :close-on-click-modal="false" :close-on-press-escape="!employeeSelecting" :show-close="!employeeSelecting">
      <el-form :model="employeeQuery" inline @submit.prevent="searchEmployees">
        <el-form-item label="关键词">
          <el-input v-model="employeeQuery.keyword" clearable placeholder="姓名/域账号/工号" style="width: 220px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" native-type="submit">搜索</el-button>
        </el-form-item>
      </el-form>
      <el-table v-loading="employeeLoading" :data="employees" border stripe height="420" @row-dblclick="selectEmployee">
        <el-table-column label="姓名" prop="cnName" min-width="110" />
        <el-table-column label="域账号" prop="domainAccount" min-width="120" />
        <el-table-column label="工号" prop="employeeNo" min-width="110" />
        <el-table-column label="邮箱" prop="email" min-width="180" show-overflow-tooltip />
        <el-table-column label="科室" prop="departmentName" min-width="160" show-overflow-tooltip />
        <el-table-column label="操作" width="90" align="center">
          <template #default="{ row }">
            <el-button link type="primary" :disabled="employeeSelecting" @click="selectEmployee(row)">选择</el-button>
          </template>
        </el-table-column>
      </el-table>
      <pagination
        v-show="employeeTotal > 0"
        v-model:page="employeeQuery.pageNum"
        v-model:limit="employeeQuery.pageSize"
        :total="employeeTotal"
        @pagination="loadEmployees"
      />
    </el-dialog>

    <el-dialog v-model="typeOpen" title="证书类型维护" width="min(940px, 96vw)" append-to-body>
      <el-form :model="typeDraft" inline class="mb12">
        <el-form-item label="编码">
          <el-input v-model="typeDraft.typeCode" clearable placeholder="如 SERVER_CERT" style="width: 180px" />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="typeDraft.typeName" clearable placeholder="类型名称" style="width: 160px" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="typeDraft.sort" :min="1" :max="999" controls-position="right" style="width: 110px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Plus" @click="createType">新增</el-button>
        </el-form-item>
      </el-form>
      <el-table :data="types" border stripe>
        <el-table-column label="编码" min-width="160">
          <template #default="{ row }">
            <el-input v-model="row.typeCode" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="名称" min-width="130">
          <template #default="{ row }">
            <el-input v-model="row.typeName" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="排序" width="120">
          <template #default="{ row }">
            <el-input-number v-model="row.sort" :min="1" :max="999" size="small" controls-position="right" style="width: 100%" />
          </template>
        </el-table-column>
        <el-table-column label="域名必填" width="110">
          <template #default="{ row }"><el-switch v-model="row.domainRequired" @change="() => saveType(row)" /></template>
        </el-table-column>
        <el-table-column label="启用" width="90">
          <template #default="{ row }">
            <el-switch v-model="row.enabled" @change="() => saveType(row)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90" align="center">
          <template #default="{ row }">
            <CertRowAction label="保存证书类型" icon="Check" @click="saveType(row)" />
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <el-dialog v-model="grantOpen" title="证书录入授权" width="min(940px, 96vw)" append-to-body>
      <section class="portal-login-policy" aria-label="自助登录策略">
        <el-form label-position="top" class="portal-login-policy-form">
          <el-form-item label="登录空闲超时">
            <div class="portal-policy-controls">
              <el-input-number v-model="sessionIdleMinutes" aria-label="登录空闲超时（分钟）" :min="5" :max="1440" :precision="0" controls-position="right" />
              <span>分钟</span>
              <el-button icon="Check" :loading="sessionSaving" @click="saveSessionTimeout">保存时限</el-button>
            </div>
          </el-form-item>
        </el-form>
      </section>
      <el-card class="portal-config-card" shadow="never">
        <template #header>
          <div class="portal-config-header">
            <span>录入端配置</span>
            <el-tag :type="portalConfig.clientSecretConfigured ? 'success' : 'info'" effect="plain">
              {{ portalConfig.clientSecretConfigured ? '密钥已配置' : '密钥未配置' }}
            </el-tag>
          </div>
        </template>
        <el-form :model="portalConfig" label-position="top" class="portal-config-form">
          <el-row :gutter="16">
            <el-col :xs="12" :sm="8">
              <el-form-item label="IAM 服务">
                <el-switch v-model="portalConfig.iamEnabled" active-text="开启" inactive-text="关闭" />
              </el-form-item>
            </el-col>
            <el-col :xs="12" :sm="8">
              <el-form-item label="AD SSO">
                <el-switch v-model="portalConfig.isAdSso" active-text="开启" inactive-text="关闭" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="8">
              <el-form-item label="接口超时秒数">
                <el-input-number v-model="portalConfig.timeoutSeconds" :min="1" :max="120" controls-position="right" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="IAM地址">
                <el-input v-model="portalConfig.iamBaseUrl" placeholder="https://iam.faw-vw.com" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="回调地址">
                <el-input v-model="portalConfig.callbackUrl" placeholder="http://10.10.10.128:9085/ra-public-cert" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="Client ID">
                <el-input v-model="portalConfig.clientId" placeholder="IAM分配的client_id" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="Client Secret">
                <el-input v-model="portalConfig.clientSecret" show-password placeholder="留空则保持原密钥不变" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="8">
              <el-form-item label="授权地址">
                <el-input v-model="portalConfig.authorizePath" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="8">
              <el-form-item label="Token地址">
                <el-input v-model="portalConfig.tokenPath" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="8">
              <el-form-item label="Profile地址">
                <el-input v-model="portalConfig.profilePath" />
              </el-form-item>
            </el-col>
            <el-col :xs="12" :sm="8">
              <el-form-item label="Token方式">
                <el-select v-model="portalConfig.tokenRequestMode">
                  <el-option label="FORM" value="FORM" />
                  <el-option label="BASIC_FORM" value="BASIC_FORM" />
                  <el-option label="QUERY" value="QUERY" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :xs="12" :sm="8">
              <el-form-item label="Profile Token">
                <el-select v-model="portalConfig.profileTokenMode">
                  <el-option label="BEARER" value="BEARER" />
                  <el-option label="QUERY" value="QUERY" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="8">
              <el-form-item label="账号字段">
                <el-input
                  v-model="portalConfig.accountFieldPaths"
                  placeholder="attributes.account_no,attributes.sAMAccountName,attributes.employeeID,id"
                />
              </el-form-item>
            </el-col>
          </el-row>
          <el-alert v-if="portalConfig.iamEnabled === false" type="warning" :closable="false" show-icon
            title="仅用于内网联调：关闭 IAM 服务后，已获录入授权的员工可仅凭域账号登录。" />
          <div class="portal-config-actions">
            <el-button type="primary" icon="Check" :loading="portalConfigSaving" @click="savePortalConfig">保存录入端配置</el-button>
          </div>
        </el-form>
      </el-card>
      <el-form :model="grantQuery" inline @submit.prevent="searchGrants">
        <el-form-item label="关键词">
          <el-input v-model="grantQuery.keyword" clearable placeholder="姓名/域账号" style="width: 220px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" native-type="submit">搜索</el-button>
          <el-button icon="User" :disabled="grantUpdating" @click="openEmployeePicker('grant')">新增授权</el-button>
        </el-form-item>
      </el-form>
      <el-table v-loading="grantLoading" :data="grants" border stripe>
        <el-table-column label="姓名" prop="employeeName" min-width="120" />
        <el-table-column label="域账号" prop="domainAccount" min-width="120" />
        <el-table-column label="邮箱" prop="employeeEmail" min-width="180" />
        <el-table-column label="科室" prop="departmentName" min-width="160" />
        <el-table-column label="启用" width="90">
          <template #default="{ row }">
            <el-switch :model-value="!!row.enabled" :disabled="grantUpdating" @change="(enabled) => saveGrant(row, !!enabled)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="84" align="center" fixed="right">
          <template #default="{ row }">
            <CertRowAction label="移除授权" icon="Delete" type="danger" :disabled="grantUpdating" @click="removeGrant(row)" />
          </template>
        </el-table-column>
      </el-table>
      <pagination
        v-show="grantTotal > 0"
        v-model:page="grantQuery.pageNum"
        v-model:limit="grantQuery.pageSize"
        :total="grantTotal"
        @pagination="loadGrants"
      />
    </el-dialog>
  </div>
</template>

<script setup name="RaPublicCert" lang="ts">
import CertRowAction from '../components/CertRowAction.vue';
import { type BusinessDeliveryLog, notifyBusinessCertificates, setBusinessCertificateReminder } from '@/api/ra/businessNoticeSettings';
import { businessCertificateValidity, confirmManualBusinessNotice, businessCertificateExpired, businessCertificateNoticeBlocked, confirmExpiredCertificateNotice } from '@/utils/businessCertificateNotice';
import BusinessDeliveryLogs from '../components/BusinessDeliveryLogs.vue';
import BusinessNoticeSettingsDialog from '../components/BusinessNoticeSettingsDialog.vue';
import { useRaListRefreshOnReturn } from '@/hooks/useRaListRefreshOnReturn';
import FileSaver from 'file-saver';
import auth from '@/plugins/auth';
import { isFawvwEmployeeSourceActive } from '@/utils/fawvwEmployeeStatus';
import { ElMessage, ElMessageBox, FormInstance, FormRules, type UploadUserFile } from 'element-plus';
import UsageTable from './UsageTable.vue';
import { publicCertDomainRequired, publicCertUsageError, publicCertEditValues, selectCertificateMaintainer, publicNoticeStatus } from '@/utils/publicCertForm';
import {
  auditPublicCerts,
  createPublicCertLedger,
  downloadPublicCertAttachment,
  exportPublicCerts,
  getPublicCert,
  getPublicCertPortalConfig,
  getPublicPortalSessionPolicy,
  grantPublicCertPermission,
  listPublicCertTypes,
  pagePublicCertPermissions,
  pagePublicCerts,
  PublicCert,
  PublicCertDetail,
  PublicCertAttachment,
  PublicCertEmployee,
  PublicCertPermission,
  PublicCertPortalConfig,
  PublicCertQuery,
  PublicCertType,
  refreshPublicCertPersonnel,
  removePublicCert,
  revokePublicCertPermission,
  savePublicCertPortalConfig,
  savePublicCertType,
  savePublicPortalSessionPolicy,
  updatePublicCertLedger,
} from '@/api/ra/publicCert';
import { FawvwEmployee, pageFawvwEmployees } from '@/api/ra/employee';

type PickerTarget = 'owner' | 'grant';

const detailDeliveryLogs = ref<BusinessDeliveryLog[]>([]);
const detailTimeline = computed(() => [
  ...(detail.value.auditLogs || []).map((log) => ({
    key: `audit-${log.id}`, time: log.createTime, color: 'info' as const,
    text: `${log.operatorName || '-'} ${actionName(log.action)}：${log.comment || '-'}`
  })),
  ...detailDeliveryLogs.value.map((log) => ({
    key: `notice-${log.id}`, time: log.time, color: log.status === 1 ? 'success' as const : log.status === 2 ? 'danger' as const : 'info' as const,
    text: `${log.trigger} · ${log.channel === 'email' ? '邮件' : log.channel === 'dingtalk' ? '钉钉' : '提醒'} · ${log.title} · ${publicNoticeStatus(log.status)}`
  }))
].sort((left, right) => (right.time || '').localeCompare(left.time || '')));
const deliveryLogsOpen = ref(false);
const businessNoticeSettings = ref<InstanceType<typeof BusinessNoticeSettingsDialog>>();
const rows = ref<PublicCert[]>([]);
const managementTab = ref<'records' | 'audit' | 'handled'>('records');
const selectedRows = ref<PublicCert[]>([]);
const sendingNotice = ref(false);
const reminderSaving = reactive(new Set<PublicCert['id']>());
const sessionIdleMinutes = ref(30);
const sessionSaving = ref(false);
const portalConfigSaving = ref(false);
const total = ref(0);
const loading = ref(false);
let listVersion = 0;
const showSearch = ref(true);
const formOpen = ref(false);
const detailOpen = ref(false);
const auditing = ref(false);
const employeeOpen = ref(false);
const typeOpen = ref(false);
const grantOpen = ref(false);
const saving = ref(false);
const formRef = ref<FormInstance>();
const pickerTarget = ref<PickerTarget>('owner');

const queryParams = reactive<PublicCertQuery>({
  pageNum: 1,
  pageSize: 10,
  domainName: '',
  serialNumber: '',
  certTypeName: '',
  systemName: '',
  ownerKeyword: '',
  approvalStatus: '',
  certStatus: '',
  ownerChangeRequired: null,
  employeeStatus: '',
  reminderEnabled: null,
  notAfterStart: '',
  notAfterEnd: ''
});
const notAfterRange = ref<string[]>([]);

const emptyForm = (): PublicCert => ({
  domainName: '',
  certTypeId: '',
  certTypeName: '',
  serialNumber: '',
  issuer: '',
  vendor: '',
  notBefore: '',
  notAfter: '',
  businessOwnerName: '',
  businessOwnerAccount: '',
  businessOwnerEmail: '',
  departmentName: '',
  remark: '',
  usages: [{ systemName: '', usageDomain: '', usageScene: '' }]
});

const form = reactive<PublicCert>(emptyForm());
const pendingAttachments = ref<UploadUserFile[]>([]);
const formAttachments = ref<PublicCertAttachment[]>([]);
const rules: FormRules = {
  notBefore: [{ required: true, message: '请选择生效时间', trigger: 'change' }],
  certTypeId: [{ required: true, message: '请选择证书类型', trigger: 'change' }],
  domainName: [{ validator: (_rule, value, done) => {
    const type = types.value.find((item) => String(item.id) === String(form.certTypeId));
    done((type?.domainRequired ?? publicCertDomainRequired(type?.typeCode)) && !value?.trim() ? new Error('该证书类型必须填写域名') : undefined);
  }, trigger: 'blur' }],
  businessOwnerEmployeeId: [{ required: true, message: '请选择证书维护人', trigger: 'change' }],
  usages: [{ validator: (_rule, value, done) => { const error = publicCertUsageError(value); done(error ? new Error(error) : undefined); }, trigger: 'change' }],
  notAfter: [{ required: true, message: '请选择到期时间', trigger: 'change' }]
};

const detail = ref<Partial<PublicCertDetail>>({ usages: [], attachments: [], auditLogs: [] });
const types = ref<PublicCertType[]>([]);
const domainRequired = computed(() => (types.value.find((item) => String(item.id) === String(form.certTypeId))?.domainRequired ?? publicCertDomainRequired(types.value.find((item) => String(item.id) === String(form.certTypeId))?.typeCode)));
const typeDraft = reactive<PublicCertType>({
  typeCode: '',
  typeName: '',
  sort: 100,
  enabled: true
});
const grants = ref<PublicCertPermission[]>([]);
const grantTotal = ref(0);
const grantLoading = ref(false);
const grantUpdating = ref(false);
let grantLoadVersion = 0;
const grantQuery = reactive({ pageNum: 1, pageSize: 10, keyword: '', enabled: null as boolean | null });
const portalConfig = reactive<PublicCertPortalConfig>({
  iamEnabled: false,
  iamBaseUrl: 'https://iam.faw-vw.com',
  authorizePath: '/esc-sso/oauth2.0/authorize',
  tokenPath: '/esc-sso/oauth2.0/accessToken',
  profilePath: '/esc-sso/oauth2.0/profile',
  clientId: '',
  clientSecret: '',
  isAdSso: true,
  stateTtlSeconds: 300,
  timeoutSeconds: 15,
  callbackUrl: 'http://10.10.10.128:9085/ra-public-cert',
  tokenRequestMode: 'FORM',
  profileTokenMode: 'BEARER',
  accountFieldPaths: 'attributes.account_no,attributes.sAMAccountName,attributes.employeeID,id',
  clientSecretConfigured: false
});
const employees = ref<FawvwEmployee[]>([]);
const employeeTotal = ref(0);
const employeeLoading = ref(false);
const employeeSelecting = ref(false);
let employeeLoadVersion = 0;
const employeeQuery = reactive({ pageNum: 1, pageSize: 10, keyword: '', status: 'A' });

function unwrap<T>(res: any): T {
  const body = res?.data ?? res;
  return (body?.data ?? body) as T;
}

function queryPayload(): PublicCertQuery {
  const approvalStatus = managementTab.value === 'records' ? 'APPROVED'
    : managementTab.value === 'audit' ? 'PENDING' : queryParams.approvalStatus || 'HANDLED';
  return { ...queryParams, approvalStatus, history: managementTab.value === 'handled',
    notAfterStart: notAfterRange.value?.[0] || '', notAfterEnd: notAfterRange.value?.[1] || '' };
}

async function loadList(): Promise<void> {
  const version = ++listVersion;
  loading.value = true;
  try {
    const query = queryPayload();
    const page = unwrap<any>(await pagePublicCerts(query));
    if (version !== listVersion) return;
    const nextTotal = Number(page.total || 0);
    const lastPage = Math.max(1, Math.ceil(nextTotal / query.pageSize));
    if (query.pageNum > lastPage) {
      queryParams.pageNum = lastPage;
      if (nextTotal > 0) {
        await loadList();
        return;
      }
    }
    rows.value = page.records || page.rows || [];
    selectedRows.value = [];
    total.value = nextTotal;
  } finally {
    if (version === listVersion) loading.value = false;
  }
}

async function loadTypes(onlyEnabled = true) {
  types.value = unwrap<PublicCertType[]>(await listPublicCertTypes(onlyEnabled)) || [];
}

function handleQuery() {
  queryParams.pageNum = 1;
  loadList();
}

function handleTabChange() {
  queryParams.approvalStatus = '';
  rows.value = [];
  total.value = 0;
  selectedRows.value = [];
  handleQuery();
}

function resetQuery() {
  Object.assign(queryParams, {
    pageNum: 1,
    pageSize: queryParams.pageSize,
    domainName: '',
    serialNumber: '',
    certTypeName: '',
    systemName: '',
    ownerKeyword: '',
    approvalStatus: '',
    certStatus: '',
    ownerChangeRequired: null,
  employeeStatus: '',
  reminderEnabled: null,
    notAfterStart: '',
    notAfterEnd: ''
  });
  notAfterRange.value = [];
  loadList();
}

function resetForm() {
  Object.keys(form).forEach((key) => Reflect.deleteProperty(form, key));
  Object.assign(form, emptyForm());
  form.businessOwnerEmployeeId = undefined;
  form.businessOwnerIdentityKey = undefined;
  pendingAttachments.value = [];
  formAttachments.value = [];
  formRef.value?.clearValidate();
}

async function openCreate() {
  await loadTypes(true);
  resetForm();
  formOpen.value = true;
}

async function openEdit(row: PublicCert) {
  await loadTypes(true);
  const data = unwrap<PublicCertDetail>(await getPublicCert(row.id!));
  resetForm();
  Object.assign(form, publicCertEditValues(data));
  formAttachments.value = data.attachments || [];
  formOpen.value = true;
}

async function openDetail(row: Pick<PublicCert, 'id'>) {
  const data = unwrap<PublicCertDetail>(await getPublicCert(row.id!));
  detailDeliveryLogs.value = [];
  detail.value = data;
  detailOpen.value = true;
}

async function submitForm() {
  if (!(await formRef.value?.validate().catch(() => false))) return;
  if (saving.value || pendingAttachments.value.some((file) => !file.raw || !beforeUpload(file.raw))) return;
  const creating = form.id == null;
  saving.value = true;
  try {
    if (creating) {
      const confirmed = await ElMessageBox.confirm('是否直接写入证书台账？', '写入证书台账', {
        type: 'warning', confirmButtonText: '确认写入', cancelButtonText: '取消', closeOnClickModal: false
      }).then(() => true, () => false);
      if (!confirmed) return;
    }
    const attachments = pendingAttachments.value.map((file) => file.raw!);
    const saved = unwrap<PublicCertDetail>(creating
      ? await createPublicCertLedger(form, attachments)
      : await updatePublicCertLedger(form, attachments));
    if (creating && businessCertificateExpired(saved.cert.notAfter)) {
      await ElMessageBox.alert('证书已过期，自动通知已关闭。如需提醒，可在台账中手动开启。', '证书已过期', { type: 'warning' }).catch(() => undefined);
    } else {
      ElMessage.success(creating ? '已写入证书台账' : saved.cert.approvalStatus === 'PENDING' ? '已提交审核' : '证书信息已更新');
    }
    formOpen.value = false;
    loadList();
  } finally {
    saving.value = false;
  }
}

async function handleRemove(row: PublicCert) {
  await ElMessageBox.confirm(`确认删除录入证书 ${row.domainName || row.serialNumber || row.certTypeName}？`, '提示', { type: 'warning' });
  await removePublicCert(row.id!);
  ElMessage.success('已删除');
  loadList();
}

async function refreshPersonnel() {
  await refreshPublicCertPersonnel();
  await loadList();
  ElMessage.success('人员状态已刷新');
}

async function batchLedgerAction(command: 'enable' | 'disable' | 'delete') {
  const selected = [...selectedRows.value];
  if (!selected.length) return;
  const label = { enable: '开启提醒', disable: '关闭提醒', delete: '删除' }[command];
  if (!(await ElMessageBox.confirm(`确认${label}所选 ${selected.length} 条证书？`, '确认操作', { type: 'warning' }).then(() => true, () => false))) return;
  let completed = 0;
  for (const row of selected) {
    try {
      if (command === 'delete') await removePublicCert(row.id!);
      else if (command === 'disable' || !businessCertificateNoticeBlocked(row.notAfter)) {
        const expired = command === 'enable' && businessCertificateExpired(row.notAfter);
        const send = expired ? await confirmExpiredCertificateNotice() : undefined;
        if (expired && send === undefined) continue;
        await setBusinessCertificateReminder('public', row.id!, command === 'enable', send);
      } else continue;
      completed++;
    } catch { /* The request layer reports failures for individual certificates. */ }
  }
  ElMessage.info(`已完成 ${completed} 条，其余 ${selected.length - completed} 条未变更`);
  await loadList();
}

async function handleExport() {
  const res: any = await exportPublicCerts(queryPayload());
  const blob = res?.data instanceof Blob ? res.data : new Blob([res?.data || res]);
  FileSaver.saveAs(blob, 'fawvw-public-certs.csv');
}

function onTypeChange(value: string | number) {
  const type = types.value.find((item) => String(item.id) === String(value));
  form.certTypeName = type?.typeName || '';
  formRef.value?.clearValidate('domainName');
}

async function lookupEmployees(keyword: string): Promise<PublicCertEmployee[]> {
  const page = unwrap<any>(await pageFawvwEmployees({ pageNum: 1, pageSize: 20, keyword, status: 'A' }));
  return page.records || page.rows || [];
}

function openEmployeePicker(target: PickerTarget) {
  pickerTarget.value = target;
  employees.value = [];
  employeeTotal.value = 0;
  employeeOpen.value = true;
  searchEmployees();
}

function searchEmployees() {
  employeeQuery.pageNum = 1;
  return loadEmployees();
}

async function loadEmployees() {
  const version = ++employeeLoadVersion;
  employeeLoading.value = true;
  try {
    const page = unwrap<any>(await pageFawvwEmployees({ ...employeeQuery }));
    if (version !== employeeLoadVersion || !employeeOpen.value) return;
    employees.value = page.records || page.rows || [];
    employeeTotal.value = Number(page.total || 0);
  } finally {
    if (version === employeeLoadVersion) employeeLoading.value = false;
  }
}

async function selectEmployee(row: FawvwEmployee) {
  if (!employeeOpen.value || employeeSelecting.value) return;
  if (pickerTarget.value === 'owner') {
    if (!isFawvwEmployeeSourceActive(row.sourceStatus)) { ElMessage.warning('请选择在职员工'); return; }
    selectCertificateMaintainer(form, row);
  } else {
    employeeSelecting.value = true;
    try {
      await grantPublicCertPermission({
        employeeId: row.id,
        employeeIdentityKey: row.identityKey,
        domainAccount: row.domainAccount,
        employeeName: row.cnName,
        employeeEmail: row.email,
        departmentName: row.departmentName,
        enabled: true
      });
      ElMessage.success('授权已保存');
      loadGrants();
    } finally {
      employeeSelecting.value = false;
    }
  }
  employeeOpen.value = false;
}

function openTypes() {
  typeOpen.value = true;
  loadTypes(false);
}

async function saveType(row: PublicCertType) {
  await savePublicCertType(row);
  ElMessage.success('证书类型已保存');
  loadTypes(false);
}

async function createType() {
  if (!typeDraft.typeCode?.trim() || !typeDraft.typeName?.trim()) {
    ElMessage.warning('请填写类型编码和名称');
    return;
  }
  await savePublicCertType(typeDraft);
  Object.assign(typeDraft, { typeCode: '', typeName: '', sort: 100, enabled: true });
  ElMessage.success('证书类型已新增');
  loadTypes(false);
}

function openGrants() {
  grantOpen.value = true;
  loadPortalConfig();
  loadGrants();
  getPublicPortalSessionPolicy().then((result) => { sessionIdleMinutes.value = unwrap<{ idleMinutes: number }>(result).idleMinutes; });
}

async function saveSessionTimeout() {
  sessionSaving.value = true;
  try { sessionIdleMinutes.value = unwrap<{ idleMinutes: number }>(await savePublicPortalSessionPolicy(sessionIdleMinutes.value)).idleMinutes; ElMessage.success('登录时限已保存'); }
  finally { sessionSaving.value = false; }
}

async function batchAudit(approve: boolean) {
  if (managementTab.value !== 'audit' || auditing.value || loading.value) return;
  const ids = selectedRows.value.filter((row) => row.approvalStatus === 'PENDING').map((row) => row.id!);
  if (!ids.length) return;
  auditing.value = true;
  try {
    const result = await ElMessageBox.prompt(`确认${approve ? '通过' : '驳回'}所选 ${ids.length} 条记录？`, '批量审核', {
      inputPlaceholder: approve ? '审核意见（选填）' : '驳回原因（必填）',
      inputValidator: (value) => approve || !!value?.trim() || '请输入驳回原因'
    }).catch(() => undefined);
    if (!result || managementTab.value !== 'audit') return;
    await auditPublicCerts(ids, approve, result.value || '审核通过');
    ElMessage.success('审核完成');
    await loadList();
  } finally {
    auditing.value = false;
  }
}

async function sendNotice(row: PublicCert) {
  if (sendingNotice.value || row.id == null || businessCertificateNoticeBlocked(row.notAfter)) return;
  sendingNotice.value = true;
  try {
    const confirmed = await confirmManualBusinessNotice('public', row.notAfter);
    if (!confirmed) return;
    const count = unwrap<number>(await notifyBusinessCertificates('public', [row.id]));
    ElMessage.info(count ? '通知已入队，发送结果请查看通知状态' : '没有新通知入队，请检查渠道和收件范围');
    loadList();
  } finally {
    sendingNotice.value = false;
  }
}

async function setReminder(row: PublicCert, enabled: boolean) {
  const id = row.id;
  if (id == null || reminderSaving.has(id) || businessCertificateNoticeBlocked(row.notAfter)) return;
  reminderSaving.add(id);
  try {
    const expired = enabled && businessCertificateExpired(row.notAfter);
    const send = expired ? await confirmExpiredCertificateNotice() : undefined;
    if (expired && send === undefined) return;
    await setBusinessCertificateReminder('public', id, enabled, send);
    row.reminderEnabled = enabled;
    if (send) void loadList();
  } finally {
    reminderSaving.delete(id);
  }
}

async function loadPortalConfig() {
  const config = unwrap<PublicCertPortalConfig>(await getPublicCertPortalConfig());
  Object.assign(portalConfig, {
    iamEnabled: false,
    iamBaseUrl: 'https://iam.faw-vw.com',
    authorizePath: '/esc-sso/oauth2.0/authorize',
    tokenPath: '/esc-sso/oauth2.0/accessToken',
    profilePath: '/esc-sso/oauth2.0/profile',
    clientId: '',
    clientSecret: '',
    isAdSso: true,
    stateTtlSeconds: 300,
    timeoutSeconds: 15,
    callbackUrl: 'http://10.10.10.128:9085/ra-public-cert',
    tokenRequestMode: 'FORM',
    profileTokenMode: 'BEARER',
    accountFieldPaths: 'attributes.account_no,attributes.sAMAccountName,attributes.employeeID,id',
    clientSecretConfigured: false,
    ...config
  });
  portalConfig.clientSecret = '';
}

async function savePortalConfig() {
  if (portalConfigSaving.value) return;
  portalConfigSaving.value = true;
  try {
    if (portalConfig.iamEnabled === false) {
      const confirmed = await ElMessageBox.confirm(
        '关闭后，任何知道已授权域账号的人都可用该账号进入证书统一管理。请仅在受控的内网联调环境使用。是否继续？',
        '确认免 IAM 登录', { type: 'warning', confirmButtonText: '确认关闭', cancelButtonText: '取消' }
      ).then(() => true, () => false);
      if (!confirmed) return;
    }
    const saved = unwrap<PublicCertPortalConfig>(await savePublicCertPortalConfig(portalConfig));
    Object.assign(portalConfig, saved, { clientSecret: '' });
    ElMessage.success('录入端配置已保存');
  } finally {
    portalConfigSaving.value = false;
  }
}

function searchGrants() {
  grantQuery.pageNum = 1;
  return loadGrants();
}

async function loadGrants(): Promise<void> {
  const version = ++grantLoadVersion;
  const query = { ...grantQuery };
  grantLoading.value = true;
  try {
    const page = unwrap<any>(await pagePublicCertPermissions(query));
    if (version !== grantLoadVersion || !grantOpen.value) return;
    const total = Number(page.total || 0);
    const lastPage = Math.max(1, Math.ceil(total / query.pageSize));
    if (query.pageNum > lastPage) {
      grantQuery.pageNum = lastPage;
      if (total > 0) {
        await loadGrants();
        return;
      }
    }
    grants.value = page.records || page.rows || [];
    grantTotal.value = total;
  } finally {
    if (version === grantLoadVersion) grantLoading.value = false;
  }
}

async function saveGrant(row: PublicCertPermission, enabled: boolean) {
  if (grantUpdating.value) return;
  grantUpdating.value = true;
  try {
    await grantPublicCertPermission({ ...row, enabled });
    row.enabled = enabled;
    ElMessage.success('授权已保存');
    await loadGrants();
  } finally {
    grantUpdating.value = false;
  }
}

async function removeGrant(row: PublicCertPermission) {
  if (row.id == null || grantUpdating.value) return;
  grantUpdating.value = true;
  try {
    const confirmed = await ElMessageBox.confirm(
      `确认移除「${row.employeeName || row.domainAccount || row.id}」的录入授权？不会删除员工或证书。`,
      '移除录入授权', { type: 'warning' }
    ).then(() => true).catch(() => false);
    if (!confirmed) return;
    await revokePublicCertPermission(row.id);
    ElMessage.success('录入授权已移除');
    await loadGrants();
  } finally {
    grantUpdating.value = false;
  }
}

function beforeUpload(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!['zip', 'rar'].includes(ext || '')) {
    ElMessage.warning('附件仅支持 zip 或 rar');
    return false;
  }
  if (!file.size || file.size > 20 * 1024 * 1024) {
    ElMessage.warning('附件不能为空，且不能超过 20MB');
    return false;
  }
  return true;
}

async function downloadAttachment(attachment: PublicCertAttachment) {
  if (detail.value.cert?.id == null) return;
  const response: any = await downloadPublicCertAttachment(detail.value.cert.id, attachment.id);
  const blob = response instanceof Blob ? response : response?.data;
  if (blob instanceof Blob) FileSaver.saveAs(blob, attachment.originalName);
}

function approvalType(status?: string) {
  if (status === 'APPROVED') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'REJECTED') return 'danger';
  return 'info';
}

function actionName(action?: string) {
  return (
    (
      {
        CREATE: '创建',
        UPDATE: '修改',
        SUBMIT: '提交',
        APPROVE: '通过',
        REJECT: '驳回',
        ATTACHMENT: '附件',
        ARCHIVE: '归档'
      } as Record<string, string>
    )[action || ''] || action
  );
}

function formatDateTime(value?: string) {
  return value ? value.replace('T', ' ') : '-';
}

function fileSize(value?: number) {
  if (!value) return '0B';
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)}KB`;
  return `${(value / 1024 / 1024).toFixed(1)}MB`;
}

onMounted(() => {
  loadTypes(true);
  loadList();
});
useRaListRefreshOnReturn(loadList);
</script>

<style scoped lang="scss">
.public-cert-page {
  .query-card {
    margin-bottom: 12px;
  }

  .public-cert-query {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 310px), 1fr));
    gap: 12px 16px;

    :deep(.el-form-item) {
      min-width: 0;
      margin: 0;
    }

    :deep(.el-form-item__content) {
      min-width: 0;
    }

    :deep(.el-input),
    :deep(.el-select),
    :deep(.el-date-editor) {
      width: 100%;
      min-width: 0;
    }

    .query-actions {
      grid-column: 1 / -1;
    }

    .query-actions :deep(.el-form-item__content) {
      justify-content: flex-end;
    }

    @media (max-width: 560px) {
      :deep(.el-form-item:not(.query-actions)) {
        display: block;
      }
      :deep(.el-form-item__label) {
        justify-content: flex-start;
      }
      :deep(.el-form-item__content) {
        margin-left: 0 !important;
      }
    }
  }

  .table-card {
  }

  .toolbar-row {
    align-items: center;
  }

  .inline-picker {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
    width: 100%;
  }

  .mt12 {
    margin-top: 12px;
  }
}

.portal-config-card {
  margin-bottom: 14px;

  :deep(.el-card__header) {
    padding: 10px 14px;
  }

  :deep(.el-card__body) {
    padding: 14px 14px 10px;
  }
}

.portal-config-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-weight: 600;
}

.portal-config-form {
  :deep(.el-form-item) {
    margin-bottom: 12px;
  }

  :deep(.el-input-number) {
    max-width: 100%;
  }
}

.portal-config-actions {
  display: flex;
  justify-content: flex-end;
}

.portal-login-policy {
  margin-bottom: 14px;
  padding: 0 0 12px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.portal-login-policy-form,
.portal-policy-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}

.portal-login-policy-form {
  gap: 12px 24px;
}

.portal-login-policy-form :deep(.el-form-item) {
  margin-bottom: 4px;
  min-width: 0;
}

.portal-policy-controls {
  gap: 8px;
}

.portal-policy-controls :deep(.el-input-number) {
  width: 108px;
}

.portal-login-policy :deep(.el-alert) {
  margin-top: 8px;
}
</style>
