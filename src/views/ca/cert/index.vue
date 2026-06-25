<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryForm" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item label="证书主题" prop="subject">
        <el-input v-model="queryParams.subject" placeholder="请输入证书主题" clearable style="width: 240px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="序列号" prop="serialNumber">
        <el-input v-model="queryParams.serialNumber" placeholder="请输入序列号" clearable style="width: 240px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" @click="openIssueDialog" v-hasPermi="['ca:cert:issue']">签发证书</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete" v-hasPermi="['ca:cert:remove']">删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="warning" plain icon="Download" :disabled="multiple" @click="handleExport" v-hasPermi="['ca:cert:export']">导出</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" border :data="certList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="序列号" align="center" prop="serialNumber" width="150" :show-overflow-tooltip="true" resizable />
      <el-table-column label="颁发者" align="center" prop="issuer" min-width="200" :show-overflow-tooltip="true" :resizable="true" />
      <el-table-column label="主题" align="center" prop="subject" min-width="220" :show-overflow-tooltip="true" :resizable="true" />
      <el-table-column label="证书类型" align="center" prop="certType" width="120">
        <template #default="scope">
          <el-tag type="info">{{ getCertTypeLabel(scope.row.certType) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="密钥来源" align="center" prop="keySource" width="110">
        <template #default="scope">
          <el-tag :type="scope.row.keySource === 'KMC' ? 'success' : 'info'">{{ getKeySourceLabel(scope.row.keySource) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="证书用途" align="center" prop="certUsage" width="110">
        <template #default="scope">
          <el-tag v-if="scope.row.certUsage === 'SIGNING'" type="warning" effect="plain">签名证书</el-tag>
          <el-tag v-else-if="scope.row.certUsage === 'ENCRYPTION'" type="success" effect="plain">加密证书</el-tag>
          <el-tag v-else type="info" effect="plain">普通证书</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="有效期结束" align="center" prop="notAfter" width="160" />
      <el-table-column label="状态" align="center" prop="status" width="110">
        <template #default="scope">
          <el-tag :type="getStatusType(scope.row.status)">{{ getStatusLabel(scope.row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" fixed="right" width="200" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-tooltip content="详情" placement="top">
            <el-button link type="primary" icon="View" @click="handleView(scope.row)" v-hasPermi="['ca:cert:detail']"></el-button>
          </el-tooltip>
          <el-dropdown trigger="click" @command="(fmt: string) => handleDownloadFormat(fmt, scope.row)" v-hasPermi="['ca:cert:download']">
            <el-tooltip content="下载" placement="top">
              <el-button link type="primary" icon="Download"></el-button>
            </el-tooltip>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="pem">PEM (.pem)</el-dropdown-item>
                <el-dropdown-item command="crt">CRT (.crt)</el-dropdown-item>
                <el-dropdown-item command="cer">CER (.cer)</el-dropdown-item>
                <el-dropdown-item command="p7b" divided>P7B 证书链 (.p7b)</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-dropdown
            v-if="scope.row.status !== 'REVOKED'"
            trigger="click"
            @command="(command: string) => handleLifecycleCommand(command, scope.row)"
          >
            <el-button link type="primary">
              <el-icon><more-filled /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-if="scope.row.status === 'VALID' || scope.row.status === 'EXPIRED'" v-hasPermi="['ca:cert:renew']" command="renew"
                  >续期</el-dropdown-item
                >
                <el-dropdown-item v-if="scope.row.status === 'VALID'" v-hasPermi="['ca:cert:update']" command="update"
                  >更新(换新密钥)</el-dropdown-item
                >
                <el-dropdown-item v-if="scope.row.status === 'VALID'" v-hasPermi="['ca:cert:reissue']" command="reissue">重签/补办</el-dropdown-item>
                <el-dropdown-item v-if="scope.row.keySource === 'KMC'" v-hasPermi="['ca:cert:recover']" command="recover">密钥恢复</el-dropdown-item>
                <el-dropdown-item v-if="scope.row.status === 'VALID'" v-hasPermi="['ca:cert:suspend']" command="suspend">挂起</el-dropdown-item>
                <el-dropdown-item v-if="scope.row.status === 'HOLD'" v-hasPermi="['ca:cert:suspend']" command="resume">恢复</el-dropdown-item>
                <el-dropdown-item v-if="scope.row.status === 'VALID' || scope.row.status === 'HOLD'" v-hasPermi="['ca:cert:revoke']" command="revoke">
                  吊销
                </el-dropdown-item>
                <!-- 双证书操作（仅签名证书可见） -->
                <template v-if="scope.row.certUsage === 'SIGNING'">
                  <el-dropdown-item
                    divided
                    v-if="scope.row.status === 'VALID' || scope.row.status === 'EXPIRED'"
                    v-hasPermi="['ca:cert:renew']"
                    command="renew-dual"
                    >双证书续期</el-dropdown-item
                  >
                  <el-dropdown-item v-if="scope.row.status === 'VALID'" v-hasPermi="['ca:cert:update']" command="update-dual"
                    >双证书更新(换密钥)</el-dropdown-item
                  >
                  <el-dropdown-item v-if="scope.row.status === 'VALID'" v-hasPermi="['ca:cert:reissue']" command="reissue-dual"
                    >双证书补办</el-dropdown-item
                  >
                  <el-dropdown-item v-if="scope.row.status === 'VALID'" v-hasPermi="['ca:cert:suspend']" command="suspend-dual"
                    >双证书冻结</el-dropdown-item
                  >
                  <el-dropdown-item v-if="scope.row.status === 'HOLD'" v-hasPermi="['ca:cert:suspend']" command="resume-dual"
                    >双证书解冻</el-dropdown-item
                  >
                  <el-dropdown-item
                    v-if="scope.row.status === 'VALID' || scope.row.status === 'HOLD'"
                    v-hasPermi="['ca:cert:revoke']"
                    command="revoke-dual"
                  >
                    双证书吊销
                  </el-dropdown-item>
                </template>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <!-- 安全确认对话框 -->
    <SecurityConfirm
      v-model="securityConfirm.visible"
      :title="securityConfirm.title"
      :action="securityConfirm.action"
      @confirm="securityConfirm.onConfirm"
    />

    <!-- 证书详情弹窗 -->
    <el-dialog v-model="showDetail" title="证书详情" width="60%" append-to-body>
      <X509Cert v-if="showDetail" :certPem="currentCertPem" />
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showDetail = false">关 闭</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 吊销对话框 -->
    <el-dialog v-model="revokeOpen" title="吊销证书" width="400px" append-to-body>
      <el-form :model="revokeForm" label-width="80px">
        <el-form-item label="吊销原因">
          <el-select v-model="revokeForm.reason" placeholder="请选择吊销原因" style="width: 100%">
            <el-option label="未指定" :value="0" />
            <el-option label="密钥泄露" :value="1" />
            <el-option label="CA泄露" :value="2" />
            <el-option label="从属关系变更" :value="3" />
            <el-option label="被取代" :value="4" />
            <el-option label="业务停止" :value="5" />
            <el-option label="证书持有" :value="6" />
          </el-select>
        </el-form-item>
        <el-form-item label="无效时间">
          <el-date-picker v-model="revokeForm.invalidityDate" type="datetime" value-format="YYYYMMDDHHmmss" placeholder="可选" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitRevoke">确 定</el-button>
          <el-button @click="revokeOpen = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 签发证书对话框 -->
    <el-dialog v-model="issueOpen" title="签发证书" width="1400px" append-to-body top="3vh" class="cert-issue-dialog" @close="closeIssueDialog">
      <el-alert v-if="issueStep" class="issue-step-alert" :title="issueStep" type="info" show-icon :closable="false" />
      <el-form ref="issueFormRef" :model="issueForm" :rules="issueRules" label-width="118px" class="issue-form">
        <div class="issue-top-grid">
          <el-form-item label="CSR来源">
            <el-select v-model="issueType" placeholder="请选择CSR来源" @change="handleIssueTypeChange">
              <el-option label="USB Key" value="key" />
              <el-option label="PKCS10 CSR" value="p10" />
            </el-select>
          </el-form-item>
          <el-form-item label="根证书" prop="rootId">
            <el-select v-model="issueForm.rootId" filterable placeholder="请选择根证书" @change="handleRootChange">
              <el-option v-for="item in rootList" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="证书模式">
            <el-radio-group v-model="certMode" @change="handleCertModeChange">
              <el-radio-button value="single">单证书</el-radio-button>
              <el-tooltip
                v-if="proxy?.$auth.hasPermiAnd(['ca:cert:issue-dual'])"
                :content="isSm2Root ? '' : '仅 SM2 根证书支持双证书签发'"
                :disabled="isSm2Root"
                placement="top"
              >
                <el-radio-button value="dual" :disabled="!isSm2Root">双证书</el-radio-button>
              </el-tooltip>
            </el-radio-group>
          </el-form-item>
        </div>
        <el-row :gutter="20" class="issue-content-grid">
          <el-col :span="12">
            <div class="form-section">
              <div class="section-title">证书模板</div>
              <el-form-item v-if="certMode === 'single'" label="证书模板" prop="profileId">
                <el-select v-model="issueForm.profileId" filterable placeholder="请选择模板" style="width: 100%" @change="handleProfileChange">
                  <el-option v-for="item in singleProfileList" :key="item.id" :label="item.name" :value="item.id" />
                </el-select>
              </el-form-item>
              <template v-else>
                <el-form-item label="证书模板" prop="profileId">
                  <el-select
                    v-model="issueForm.profileId"
                    filterable
                    clearable
                    placeholder="请选择双证书模板"
                    style="width: 100%"
                    @change="handleDualProfileChange"
                  >
                    <el-option v-for="item in availableDualEntityProfiles" :key="item.id" :label="item.name" :value="item.id" />
                  </el-select>
                </el-form-item>
                <el-form-item label="签名证书模板">
                  <div class="readonly-field">
                    {{ selectedDualSignProfile?.name || '-' }}
                  </div>
                </el-form-item>
                <el-form-item label="加密证书模板">
                  <div class="readonly-field">
                    {{ selectedDualEncProfile?.name || '-' }}
                  </div>
                </el-form-item>
                <el-form-item label="加密密钥来源">
                  <el-tag type="success" effect="plain">KMC 生成并托管</el-tag>
                </el-form-item>
              </template>
              <el-form-item label="生效时间">
                <el-date-picker
                  v-model="issueForm.notBefore"
                  type="datetime"
                  value-format="YYYYMMDDHHmmss"
                  placeholder="默认当前时间"
                  style="width: 100%"
                />
              </el-form-item>
              <el-form-item label="过期时间">
                <el-date-picker
                  v-model="issueForm.notAfter"
                  type="datetime"
                  value-format="YYYYMMDDHHmmss"
                  placeholder="默认模板有效期"
                  style="width: 100%"
                />
              </el-form-item>
            </div>

            <div class="form-section" v-if="issueType !== 'p10' && issueForm.subjectItems.length > 0">
              <div class="section-title">主体信息 (Subject)</div>
              <div class="subject-scroll-area">
                <CertSubject v-model="issueForm.subjectItems" propPrefix="subjectItems" />
              </div>
            </div>

            <div class="form-section" v-if="issueForm.extensionItems.length > 0">
              <div class="section-title">扩展信息</div>
              <div class="extension-scroll-area">
                <div v-for="(ext, extIndex) in issueForm.extensionItems" :key="ext.key" class="issue-extension-item">
                  <div class="issue-extension-title">
                    <span>{{ ext.label }}</span>
                    <el-tag v-if="ext.required" type="danger" size="small" effect="plain">必填</el-tag>
                    <el-tag v-else type="info" size="small" effect="plain">可选</el-tag>
                  </div>
                  <template v-if="ext.kind === 'subjectAlternativeName'">
                    <div v-for="(name, nameIndex) in ext.names" :key="`${ext.key}-${nameIndex}`" class="san-row">
                      <el-select v-model="name.type" placeholder="类型" style="width: 130px">
                        <el-option v-for="mode in ext.modes" :key="mode" :label="getSanModeLabel(mode)" :value="mode" />
                      </el-select>
                      <el-input v-model="name.value" :placeholder="getSanPlaceholder(name.type)" />
                      <el-button icon="Delete" circle :disabled="ext.names.length <= 1" @click="removeSanName(extIndex, nameIndex)" />
                    </div>
                    <el-button type="primary" link icon="Plus" @click="addSanName(extIndex)">添加备用名称</el-button>
                  </template>
                  <template v-else-if="ext.kind === 'keyUsage'">
                    <el-checkbox-group v-model="ext.usages" class="key-usage-checkbox-group">
                      <el-checkbox v-for="usage in keyUsageOptions" :key="usage.value" :label="usage.value">
                        {{ usage.label }}
                      </el-checkbox>
                    </el-checkbox-group>
                  </template>
                  <template v-else-if="ext.kind === 'extendedKeyUsage'">
                    <el-checkbox-group v-model="ext.usages" class="key-usage-checkbox-group">
                      <el-checkbox v-for="usage in extendedKeyUsageOptions" :key="usage.value" :label="usage.value">
                        {{ usage.label }}
                      </el-checkbox>
                    </el-checkbox-group>
                  </template>
                  <template v-else>
                    <el-input v-model="ext.value" type="textarea" :rows="3" :placeholder="`请输入 ${ext.label} 的 JSON 或文本值`" />
                  </template>
                </div>
              </div>
            </div>
          </el-col>

          <el-col :span="12">
            <div v-if="issueType === 'key'" class="form-section usb-key-section">
              <div class="section-title">
                <span class="usb-title">
                  <svg class="usb-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="4" y="4" width="16" height="16" rx="3" />
                    <path d="M9 9h6M9 13h6M9 17h4" />
                  </svg>
                  USBKey 证书设置
                </span>
                <div v-if="monitoring" class="monitoring-tag">
                  <span class="pulse-dot"></span>
                  设备监控中
                </div>
                <el-tag v-else-if="certProviders.length > 0" type="success" size="small" effect="plain">设备已就绪</el-tag>
                <el-tag v-else type="warning" size="small" effect="plain">未检测到设备</el-tag>
              </div>

              <el-alert class="usb-key-tip" type="info" show-icon :closable="false" title="请确认 USB Key 已插入电脑，应用已创建，User PIN 正确" />

              <div class="device-step-list">
                <!-- 步骤 1: 设备 -->
                <div class="step-header">
                  <span class="step-badge">1</span>
                  <span class="step-title">选择设备</span>
                  <el-button @click="refreshCertProviders" :icon="Refresh" circle size="small" title="刷新设备列表" class="refresh-btn" />
                </div>
                <el-form-item label="设备提供商" prop="provider">
                  <el-select v-model="issueForm.provider" placeholder="选择厂商" @change="onCertProviderChange">
                    <el-option v-for="p in certProviders" :key="p" :label="p" :value="p" />
                  </el-select>
                </el-form-item>
                <el-form-item label="设备列表" prop="device">
                  <el-select v-model="issueForm.device" placeholder="选择设备" @change="onCertDeviceChange">
                    <el-option v-for="d in certDevices" :key="d" :label="d" :value="d" />
                  </el-select>
                </el-form-item>

                <!-- 步骤 2: 应用与容器 -->
                <div class="step-header">
                  <span class="step-badge">2</span>
                  <span class="step-title">应用与容器</span>
                </div>
                <el-form-item label="应用" prop="appName">
                  <el-select v-model="issueForm.appName" placeholder="选择应用">
                    <el-option v-for="a in certApps" :key="a" :label="a" :value="a" />
                  </el-select>
                </el-form-item>
                <el-form-item label="容器名" prop="containerName">
                  <el-input v-model="issueForm.containerName" placeholder="容器名（自动生成）" />
                </el-form-item>

                <!-- 步骤 3: PIN -->
                <div class="step-header">
                  <span class="step-badge step-badge-lock">3</span>
                  <span class="step-title">User PIN</span>
                </div>
                <el-form-item label="User PIN" prop="pin">
                  <el-input v-model="issueForm.pin" type="password" show-password placeholder="请输入 USBKey User PIN">
                    <template #prefix>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" />
                        <path d="M7 11V7a5 5 0 0110 0v4" />
                      </svg>
                    </template>
                  </el-input>
                </el-form-item>
              </div>
            </div>

            <div v-if="issueType === 'p10'" class="form-section">
              <div class="section-title">PKCS10 CSR 内容</div>
              <el-form-item :label="certMode === 'dual' ? '签名CSR PEM' : 'CSR PEM'" prop="csr" label-width="0">
                <el-input v-model="issueForm.csr" type="textarea" :rows="15" placeholder="-----BEGIN CERTIFICATE REQUEST----- ..." />
              </el-form-item>
            </div>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" :loading="issueLoading" @click="submitIssue">{{ issueLoading ? '签发中' : '确认签发' }}</el-button>
          <el-button @click="issueOpen = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 生命周期操作对话框 -->
    <el-dialog v-model="lifecycleOpen" :title="lifecycleTitle" width="900px" append-to-body top="5vh" @close="resetLifecycleForm">
      <!-- 证书信息摘要 -->
      <div class="lifecycle-cert-info">
        <div class="section-title">原证书基本信息</div>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="证书序列号" :span="2">
            {{ lifecycleRow?.serialNumber || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="主题" :span="2">
            {{ lifecycleRow?.subject || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="颁发者" :span="2">
            {{ lifecycleRow?.issuer || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="证书类型">
            <el-tag size="small" type="info">{{ getCertTypeLabel(lifecycleRow?.certType) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag size="small" :type="getStatusType(lifecycleRow?.status)">{{ getStatusLabel(lifecycleRow?.status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item v-if="lifecycleRow?.certUsage" label="证书用途">
            <el-tag v-if="lifecycleRow.certUsage === 'SIGNING'" size="small" type="warning" effect="plain">签名证书</el-tag>
            <el-tag v-else-if="lifecycleRow.certUsage === 'ENCRYPTION'" size="small" type="success" effect="plain">加密证书</el-tag>
          </el-descriptions-item>
          <el-descriptions-item v-if="lifecycleRow?.keySource" label="密钥来源">
            <el-tag size="small" :type="lifecycleRow.keySource === 'KMC' ? 'success' : 'info'">
              {{ lifecycleRow.keySource === 'KMC' ? 'KMC' : lifecycleRow.keySource === 'CLIENT' ? '客户端' : lifecycleRow.keySource }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item v-if="lifecycleCertInfo?.keyType" label="密钥类型">
            <el-tag size="small" type="info">{{ lifecycleCertInfo.keyType }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item v-if="lifecycleCertInfo?.sigAlg" label="签名算法">
            <el-tag size="small" type="info">{{ lifecycleCertInfo.sigAlg }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="原有效期" :span="2">
            {{ lifecycleRow?.notBefore || '-' }} ~ {{ lifecycleRow?.notAfter || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="新有效期" :span="2">
            {{ lifecycleForm.notBefore || '-' }} ~ {{ lifecycleForm.notAfter || '-' }}
          </el-descriptions-item>
          <el-descriptions-item v-if="lifecycleRow?.rootName" label="根证书">
            {{ lifecycleRow.rootName }}
          </el-descriptions-item>
          <el-descriptions-item v-if="lifecycleRow?.profileName" label="证书模板">
            {{ lifecycleRow.profileName }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <el-alert
        v-if="lifecycleModeMeta"
        class="lifecycle-mode-alert"
        :type="lifecycleModeMeta.alertType"
        :title="lifecycleModeMeta.title"
        :description="lifecycleModeMeta.description"
        show-icon
        :closable="false"
      />

      <el-alert
        v-if="lifecycleAction === 'update' || lifecycleAction === 'update-dual'"
        class="lifecycle-mode-alert"
        type="warning"
        :title="lifecycleModeMeta?.warningTitle"
        :description="lifecycleModeMeta?.warningDescription"
        show-icon
        :closable="false"
      />

      <el-form ref="lifecycleFormRef" :model="lifecycleForm" :rules="lifecycleRules" label-width="110px" class="lifecycle-form">
        <!-- 证书存储方式（续期/更新/补办支持） -->
        <template v-if="lifecycleAction !== 'recover'">
          <el-form-item label="证书存储方式">
            <el-select v-model="lifecycleOutputMode" placeholder="请选择证书存储方式" @change="onLifecycleOutputModeChange">
              <el-option label="USBKey" value="usbkey" />
              <el-option label="PEM" value="pem" />
              <el-option label="DER" value="der" />
            </el-select>
          </el-form-item>
          <!-- USB Key 写入设备信息 -->
          <template v-if="lifecycleOutputMode === 'usbkey'">
            <div class="form-section usb-key-section" style="margin-bottom: 12px">
              <div class="section-title">
                <span class="usb-title">
                  <svg class="usb-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="4" y="4" width="16" height="16" rx="3" />
                    <path d="M9 9h6M9 13h6M9 17h4" />
                  </svg>
                  USBKey 写入设置
                </span>
              </div>
              <el-row :gutter="12">
                <el-col :span="12">
                  <el-form-item label="设备提供商" prop="provider">
                    <el-select v-model="lifecycleForm.provider" placeholder="选择厂商" @change="onLifecycleProviderChange">
                      <el-option v-for="p in lifecycleCertProviders" :key="p" :label="p" :value="p" />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="设备列表" prop="device">
                    <el-select v-model="lifecycleForm.device" placeholder="选择设备" @change="onLifecycleDeviceChange">
                      <el-option v-for="d in lifecycleCertDevices" :key="d" :label="d" :value="d" />
                    </el-select>
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="12">
                <el-col :span="12">
                  <el-form-item label="应用" prop="appName">
                    <el-select v-model="lifecycleForm.appName" placeholder="选择应用" @change="onLifecycleAppChange">
                      <el-option v-for="a in lifecycleCertApps" :key="a" :label="a" :value="a" />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="目标容器" prop="containerName">
                    <el-select
                      v-model="lifecycleForm.containerName"
                      filterable
                      placeholder="选择已有容器（写入新证书）"
                      @change="onLifecycleContainerChange"
                    >
                      <el-option v-for="c in lifecycleContainers" :key="c.name" :label="c.label || c.name" :value="c.name" />
                    </el-select>
                  </el-form-item>
                </el-col>
              </el-row>
              <el-form-item label="User PIN" prop="pin">
                <el-input v-model="lifecycleForm.pin" type="password" show-password placeholder="请输入 USBKey User PIN" />
              </el-form-item>
            </div>
          </template>
        </template>

        <template v-if="lifecycleAction === 'renew' || lifecycleAction === 'renew-dual'">
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="生效时间">
                <el-date-picker
                  v-model="lifecycleForm.notBefore"
                  type="datetime"
                  value-format="YYYYMMDDHHmmss"
                  placeholder="默认沿用原证书生效时间"
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="过期时间" prop="notAfter">
                <el-date-picker
                  v-model="lifecycleForm.notAfter"
                  type="datetime"
                  value-format="YYYYMMDDHHmmss"
                  placeholder="请选择新的过期时间"
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
          </el-row>
        </template>
        <template v-if="lifecycleAction === 'update' || lifecycleAction === 'update-dual'">
          <div class="form-section">
            <div class="section-title">证书主题（{{ lifecycleOutputMode === 'usbkey' ? '可编辑（USB Key）' : '固定（PEM/DER）' }}）</div>
            <el-form-item label="原主题">
              <div class="readonly-field">{{ lifecycleRow?.subject || '-' }}</div>
            </el-form-item>
            <template v-if="lifecycleOutputMode === 'usbkey'">
              <el-form-item label="新主题">
                <CertSubject v-model="lifecycleForm.subjectItems" propPrefix="subjectItems" />
              </el-form-item>
            </template>
          </div>
          <el-alert
            class="lifecycle-form-tip"
            type="info"
            show-icon
            :closable="false"
            description="更新会使用新CSR和新公钥重新签发证书，旧证书会被吊销并替换为新证书，请确认已备份原始数据。"
          />
          <template v-if="lifecycleOutputMode === 'usbkey'">
            <el-alert
              class="lifecycle-form-tip"
              type="success"
              show-icon
              :closable="false"
              description="USB Key 模式下，系统会使用编辑后的主题在设备中重新生成 CSR。"
            />
          </template>
          <template v-else>
            <el-form-item label="新CSR" prop="csr">
              <el-input v-model="lifecycleForm.csr" type="textarea" :rows="5" placeholder="-----BEGIN CERTIFICATE REQUEST----- ..." />
            </el-form-item>
          </template>
          <template v-if="lifecycleAction === 'update-dual' && lifecycleOutputMode !== 'usbkey'">
            <el-form-item label="加密CSR">
              <el-input v-model="lifecycleForm.encCsr" type="textarea" :rows="5" placeholder="可选；为空时由 KMC 生成加密密钥对" />
            </el-form-item>
          </template>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="生效时间">
                <el-date-picker
                  v-model="lifecycleForm.notBefore"
                  type="datetime"
                  value-format="YYYYMMDDHHmmss"
                  placeholder="默认当前时间"
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="过期时间">
                <el-date-picker
                  v-model="lifecycleForm.notAfter"
                  type="datetime"
                  value-format="YYYYMMDDHHmmss"
                  placeholder="默认沿用模板策略"
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
          </el-row>
        </template>
        <template v-if="lifecycleAction === 'reissue' || lifecycleAction === 'reissue-dual'">
          <el-form-item label="新CSR">
            <el-input v-model="lifecycleForm.csr" type="textarea" :rows="5" placeholder="可选；不填时由后端按原证书或备份密钥处理" />
          </el-form-item>
          <el-form-item label="补办原因">
            <el-input v-model="lifecycleForm.reason" type="textarea" :rows="3" placeholder="请输入补办原因" />
          </el-form-item>
        </template>
        <template v-if="lifecycleAction === 'recover'">
          <el-form-item label="授权码">
            <el-input v-model="lifecycleForm.authCode" placeholder="可选，按系统配置填写" show-password />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" :loading="lifecycleLoading" @click="submitLifecycle">确 定</el-button>
          <el-button @click="lifecycleOpen = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 生命周期签发结果 -->
    <el-dialog v-model="issueResultOpen" :title="issueResultTitle" width="820px" append-to-body>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="主证书类型">{{ issueResult.primaryCertLabel || '证书' }}</el-descriptions-item>
        <el-descriptions-item v-if="issueResult.certId" label="主证书ID">{{ issueResult.certId }}</el-descriptions-item>
        <el-descriptions-item v-if="issueResult.previousCertId" label="替换旧证书ID">{{ issueResult.previousCertId }}</el-descriptions-item>
        <el-descriptions-item v-if="issueResult.operationHint" label="说明" :span="2">{{ issueResult.operationHint }}</el-descriptions-item>
        <el-descriptions-item label="主证书序列号">{{ issueResult.serialNumber || '-' }}</el-descriptions-item>
        <el-descriptions-item label="主体" :span="2">{{ issueResult.subject || '-' }}</el-descriptions-item>
        <el-descriptions-item label="颁发者" :span="2">{{ issueResult.issuer || '-' }}</el-descriptions-item>
        <el-descriptions-item label="生效时间">{{ issueResult.notBefore || '-' }}</el-descriptions-item>
        <el-descriptions-item label="过期时间">{{ issueResult.notAfter || '-' }}</el-descriptions-item>
        <el-descriptions-item v-if="issueResult.keySource" label="密钥来源">{{ issueResult.keySource }}</el-descriptions-item>
        <el-descriptions-item v-if="issueResult.encryptionPrivateKey" label="加密私钥材料">已返回，可写入 USB Key</el-descriptions-item>
      </el-descriptions>

      <el-descriptions v-if="issueResult.encryptionCert" class="result-section" :column="2" border>
        <el-descriptions-item label="加密证书类型">{{ issueResult.encryptionCertLabel || '加密证书' }}</el-descriptions-item>
        <el-descriptions-item v-if="issueResult.encryptionCertId" label="加密证书ID">{{ issueResult.encryptionCertId }}</el-descriptions-item>
        <el-descriptions-item label="加密证书序列号">{{ issueResult.encryptionSerialNumber || '-' }}</el-descriptions-item>
        <el-descriptions-item label="主体" :span="2">{{ issueResult.encryptionSubject || '-' }}</el-descriptions-item>
        <el-descriptions-item label="颁发者" :span="2">{{ issueResult.encryptionIssuer || '-' }}</el-descriptions-item>
        <el-descriptions-item label="生效时间">{{ issueResult.encryptionNotBefore || '-' }}</el-descriptions-item>
        <el-descriptions-item label="过期时间">{{ issueResult.encryptionNotAfter || '-' }}</el-descriptions-item>
      </el-descriptions>
      <div class="result-actions">
        <template v-if="issueResult.cert">
          <el-button
            type="primary"
            plain
            icon="Download"
            @click="downloadPem(issueResult.cert, (issueResult.serialNumber || 'cert') + '_' + (issueResult.primaryCertLabel || '证书'))"
          >
            PEM 下载{{ issueResult.primaryCertLabel || '证书' }}
          </el-button>
          <el-button
            type="primary"
            plain
            icon="Download"
            @click="downloadDer(issueResult.cert, (issueResult.serialNumber || 'cert') + '_' + (issueResult.primaryCertLabel || '证书'))"
          >
            DER 下载{{ issueResult.primaryCertLabel || '证书' }}
          </el-button>
        </template>
        <template v-if="issueResult.encryptionCert">
          <el-button
            type="success"
            plain
            icon="Download"
            @click="downloadPem(issueResult.encryptionCert, (issueResult.encryptionSerialNumber || 'enc-cert') + '_加密证书')"
          >
            PEM 下载加密证书
          </el-button>
          <el-button
            type="success"
            plain
            icon="Download"
            @click="downloadDer(issueResult.encryptionCert, (issueResult.encryptionSerialNumber || 'enc-cert') + '_加密证书')"
          >
            DER 下载加密证书
          </el-button>
        </template>
        <el-button v-if="issueResult.encryptionPrivateKey" type="warning" plain icon="Download" @click="downloadEncPrivateKey">
          下载加密私钥 (BASE64)
        </el-button>
        <el-button
          v-if="issueResult.cert && issueResult.encryptionCert && issueResult.encryptionPrivateKey"
          type="warning"
          icon="Folder"
          @click="downloadDualCertZip"
        >
          ZIP 打包下载
        </el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup name="CertManagement" lang="ts">
import { ref, reactive, toRefs, getCurrentInstance, ComponentInternalInstance, onMounted, nextTick, computed } from 'vue';
import { ElMessage, ElMessageBox, FormInstance } from 'element-plus';
import { ArrowDown, MoreFilled, Refresh } from '@element-plus/icons-vue';
import X509Cert from '@/components/X509Cert/index.vue';
import SecurityConfirm from '@/components/SecurityConfirm/index.vue';
import CertSubject, { type SubjectItem, typeMapping, sortSubjectItems } from '@/components/CertSubject/index.vue';
import {
  pageCert,
  getCert,
  revokeCert,
  removeCert,
  exportCert,
  issueCert,
  issueDualCert,
  renewCert,
  updateCert,
  reissueCert,
  recoverKey,
  suspendCert,
  resumeCert,
  renewDualCert,
  updateDualCert,
  reissueDualCert,
  suspendDualCert,
  resumeDualCert,
  revokeDualCert
} from '@/api/ca/cert';
import { listRootCa, getRootCa } from '@/api/ca/root';
import { listProfile, getProfile } from '@/api/ca/profile';
import { X509 } from 'jsrsasign';
import request from '@/utils/request';
import { parseJson } from '@/utils/json';
import SKFClient from '@/api/skf/skf_api';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const securityConfirm = reactive({
  visible: false,
  title: '敏感操作安全确认',
  action: '',
  onConfirm: () => {}
});

// SKF 客户端单例管理
let skfClientPromise: Promise<any> | null = null;
const getSkfClient = (): Promise<any> => {
  if (skfClientPromise) return skfClientPromise;
  const skf = new SKFClient('ws://127.0.0.1:9001');
  skfClientPromise = new Promise((resolve, reject) => {
    skf
      .connect()
      .then(() => resolve(skf))
      .catch((err: any) => {
        skfClientPromise = null;
        reject(err || new Error('连接 SKF 服务超时或被拒绝'));
      });
  });
  return skfClientPromise;
};

const loading = ref(false);
const showSearch = ref(true);
const total = ref(0);
const certList = ref([]);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const showDetail = ref(false);
const currentCertPem = ref('');
const revokeOpen = ref(false);
const lifecycleOpen = ref(false);
const lifecycleLoading = ref(false);
const lifecycleTitle = ref('');
const lifecycleAction = ref('');
const lifecycleRow = ref<any>(null);
const lifecycleCertInfo = computed(() => {
  if (lifecycleRow.value?.cert) {
    return parseCertInfo(lifecycleRow.value.cert);
  }
  return null;
});
const lifecycleOutputMode = ref('usbkey');
const lifecycleCertProviders = ref<string[]>([]);
const lifecycleCertDevices = ref<string[]>([]);
const lifecycleCertApps = ref<string[]>([]);
const lifecycleContainers = ref<Array<{ name: string; label: string; hasSignCert?: boolean; hasEncCert?: boolean }>>([]);
const lifecycleFormRef = ref<FormInstance>();
const issueResultOpen = ref(false);
const issueResultTitle = ref('证书操作结果');
const issueResult = ref<any>({});

// 签发相关状态
const issueOpen = ref(false);
const issueLoading = ref(false);
const monitoring = ref(false);
const clearCertsLoading = ref(false);
const issueStep = ref('');
const issueType = ref('key');
const certMode = ref('single');
const rootList = ref([]);
const selectedRootAlgo = ref('');
const isSm2Root = computed(() => (selectedRootAlgo.value || '').toUpperCase().includes('SM2'));
const singleProfileList = ref<any[]>([]);
const allProfileList = ref([]);
const profileLookupList = ref([]);
const authorizedProfileIds = ref<Set<string>>(new Set());
const issueProfileInfo = ref<any>(null);
const certProviders = ref<string[]>([]);
const certDevices = ref<string[]>([]);
const certApps = ref<string[]>([]);
const issueFormRef = ref<FormInstance>();
let deviceMonitorTimer: ReturnType<typeof setInterval> | null = null;
let lastDeviceSnapshot = '';

const availableDualEntityProfiles = computed(() => {
  if (!authorizedProfileIds.value.size) return [];
  return allProfileList.value.filter((profile: any) => {
    if (!authorizedProfileIds.value.has(String(profile.id)) || getProfileCertLevel(profile) !== 'DualEntity') return false;
    const dualCert = parseJson(profile?.conf)?.dualCert || {};
    return (
      dualCert.signProfileId &&
      dualCert.encProfileId &&
      authorizedProfileIds.value.has(String(dualCert.signProfileId)) &&
      authorizedProfileIds.value.has(String(dualCert.encProfileId))
    );
  });
});

const selectedDualSignProfile = computed(() => findProfileById(issueForm.value.signProfileId));
const selectedDualEncProfile = computed(() => findProfileById(issueForm.value.encProfileId));

function getProfileCertLevel(profile: any) {
  return String(profile?.certLevel || profile?.type || parseJson(profile?.conf)?.certLevel || '');
}

function findProfileById(id: any) {
  if (!id) return null;
  return profileLookupList.value.find((profile: any) => String(profile.id) === String(id)) || null;
}

function getDualProfileRole(profile: any) {
  const category = String(profile?.profileCategory || '').toUpperCase();
  if (category === 'DUAL_SIGN') return 'SIGNING';
  if (category === 'DUAL_ENC') return 'ENCRYPTION';
  const conf = parseJson(profile?.conf);
  return String(conf?.dualCert?.role || '').toUpperCase();
}

function isDualMemberProfile(profile: any) {
  const role = getDualProfileRole(profile);
  return role === 'SIGNING' || role === 'ENCRYPTION';
}

const keyUsageOptions = [
  { value: 'digitalSignature', label: '数字签名' },
  { value: 'nonRepudiation', label: '不可否认性' },
  { value: 'contentCommitment', label: '内容承诺' },
  { value: 'keyEncipherment', label: '密钥加密' },
  { value: 'dataEncipherment', label: '数据加密' },
  { value: 'keyAgreement', label: '密钥协商' },
  { value: 'keyCertSign', label: '证书签名' },
  { value: 'cRLSign', label: 'CRL签名' },
  { value: 'encipherOnly', label: '仅加密' },
  { value: 'decipherOnly', label: '仅解密' }
];

const extendedKeyUsageOptions = [
  { value: 'serverAuth', label: '服务器身份验证' },
  { value: 'clientAuth', label: '客户端身份验证' },
  { value: 'codeSigning', label: '代码签名' },
  { value: 'emailProtection', label: '电子邮件保护' },
  { value: 'timeStamping', label: '时间戳' },
  { value: 'OCSPSigning', label: 'OCSP签名' },
  { value: 'ipsecEndSystem', label: 'IPSec终端系统' },
  { value: 'ipsecTunnel', label: 'IPSec隧道' },
  { value: 'ipsecUser', label: 'IPSec用户' },
  { value: 'anyExtendedKeyUsage', label: '任意增强密钥用法' }
];

const data = reactive({
  queryParams: { pageNum: 1, pageSize: 10, subject: undefined, serialNumber: undefined },
  revokeForm: { certId: undefined as string | number | undefined, reason: 0, invalidityDate: undefined as string | undefined },
  issueForm: {
    rootId: undefined as string | number | undefined,
    profileId: undefined as string | number | undefined,
    signProfileId: undefined as string | number | undefined,
    encProfileId: undefined as string | number | undefined,
    name: '',
    subjectItems: [] as any[],
    provider: '',
    device: '',
    appName: '',
    containerName: '',
    pin: '123456',
    dualProfileName: undefined as string | undefined,
    csr: '',
    encCsr: '',
    extensionItems: [] as any[],
    notBefore: undefined as string | undefined,
    notAfter: undefined as string | undefined
  }
});

const { queryParams, revokeForm, issueForm } = toRefs(data);

const issueRules = {
  rootId: [{ required: true, message: '请选择颁发者', trigger: 'change' }],
  profileId: [{ required: true, message: '请选择证书模板', trigger: 'change' }],
  signProfileId: [{ required: true, message: '请选择签名模板', trigger: 'change' }],
  encProfileId: [{ required: true, message: '请选择加密模板', trigger: 'change' }],
  provider: [{ required: true, message: '请选择厂商', trigger: 'change' }],
  device: [{ required: true, message: '请选择设备', trigger: 'change' }],
  appName: [{ required: true, message: '请选择应用', trigger: 'change' }],
  containerName: [{ required: true, message: '请输入容器名称', trigger: 'blur' }],
  pin: [{ required: true, message: '请输入PIN码', trigger: 'blur' }],
  csr: [{ required: true, message: '请输入CSR', trigger: 'blur' }]
};

const lifecycleForm = reactive({
  subjectItems: [] as SubjectItem[],
  csr: '',
  encCsr: '',
  encCertId: undefined as string | number | undefined,
  reason: '',
  authCode: '',
  provider: '',
  device: '',
  appName: '',
  containerName: '',
  pin: '123456',
  notBefore: undefined as string | undefined,
  notAfter: undefined as string | undefined
});

const lifecycleRules = computed(() => {
  const isDual = lifecycleAction.value === 'update-dual' || lifecycleAction.value === 'renew-dual' || lifecycleAction.value === 'reissue-dual';
  const isRenew = lifecycleAction.value === 'renew' || lifecycleAction.value === 'renew-dual';
  const isUpdate = lifecycleAction.value === 'update' || lifecycleAction.value === 'update-dual';
  const isUsbOutput = lifecycleOutputMode.value === 'usbkey';

  return {
    provider: lifecycleAction.value !== 'recover' && isUsbOutput ? [{ required: true, message: '请选择厂商', trigger: 'change' }] : [],
    device: lifecycleAction.value !== 'recover' && isUsbOutput ? [{ required: true, message: '请选择设备', trigger: 'change' }] : [],
    appName: lifecycleAction.value !== 'recover' && isUsbOutput ? [{ required: true, message: '请选择应用', trigger: 'change' }] : [],
    containerName: lifecycleAction.value !== 'recover' && isUsbOutput ? [{ required: true, message: '请输入容器名称', trigger: 'blur' }] : [],
    pin: lifecycleAction.value !== 'recover' && isUsbOutput ? [{ required: true, message: '请输入PIN码', trigger: 'blur' }] : [],
    csr: isUpdate && !isUsbOutput ? [{ required: true, message: '请输入新CSR', trigger: 'blur' }] : [],
    encCsr: isDual && !isUsbOutput ? [{ required: false, message: '可选', trigger: 'blur' }] : [],
    notAfter: [
      {
        validator: (_rule: any, value: string | undefined, callback: (error?: Error) => void) => {
          if (isRenew && !value) {
            callback(new Error('请选择新的过期时间'));
            return;
          }
          callback();
        },
        trigger: 'change'
      }
    ]
  };
});

const lifecycleModeMeta = computed(() => getLifecycleModeMeta(lifecycleAction.value));

function getLifecycleModeMeta(action: string) {
  const base = {
    renew: {
      title: '证书续期',
      description: '续期保留原密钥与主体，仅延长或调整证书有效期。',
      alertType: 'success' as const
    },
    update: {
      title: '证书更新',
      description: '更新会用新公钥重新签发一张证书，并替换旧证书。',
      alertType: 'warning' as const,
      warningTitle: '更新与续期的主要区别',
      warningDescription: '更新会更换密钥对，原证书状态会变更为已吊销；请确认新 CSR 来源可信。'
    },
    reissue: {
      title: '证书重签/补办',
      description: '重签会在原证书上下文下补办新证书，支持恢复丢失或损坏的场景。',
      alertType: 'info' as const
    },
    recover: {
      title: '密钥恢复',
      description: '恢复流程按系统策略回写密钥材料，并同步更新证书状态。',
      alertType: 'info' as const
    },
    'renew-dual': {
      title: '双证书续期',
      description: '双证书续期分别更新签名与加密证书链上对应有效期。',
      alertType: 'success' as const
    },
    'update-dual': {
      title: '双证书更新',
      description: '双证书更新会为签名和加密证书各自使用新密钥重新签发。',
      alertType: 'warning' as const,
      warningTitle: '双证书更新注意',
      warningDescription: '签名与加密证书会同时替换，系统会输出新的签名/加密 PEM/DER 证书。'
    },
    'reissue-dual': {
      title: '双证书补办',
      description: '双证书补办可用于签名加密证书对的重新签发与替换。',
      alertType: 'info' as const
    }
  }[action];

  const safeBase = base || {
    title: '证书生命周期操作',
    description: '请确认操作目标与参数后提交执行。',
    alertType: 'info' as const
  };

  return {
    warningTitle: safeBase.warningTitle || '操作提示',
    warningDescription: safeBase.warningDescription || '请先确认参数正确，操作一经确认即刻生效。',
    ...safeBase
  };
}

async function loadRoots() {
  try {
    const res = await listRootCa({ pageNum: 1, pageSize: 100 });
    rootList.value = res.data.rows || res.data.records || [];
  } catch (e) {}
}
async function loadProfiles() {
  try {
    const res = await listProfile();
    profileLookupList.value = res.data || [];
    allProfileList.value = profileLookupList.value.filter((p: any) => p.type !== 'RootCA');
    singleProfileList.value = [];
  } catch (e) {}
}

async function refreshCertProviders() {
  certProviders.value = [];
  try {
    skfClientPromise = null;
    issueStep.value = '正在连接 SKF 服务并读取 USB Key 设备...';
    const skf = await getSkfClient();
    try {
      await skf.setLanguage('CN');
    } catch (e) {}
    const providers = await withTimeout(skf.enumProvider(), 10000, '获取设备提供商超时');
    certProviders.value = providers;
    if (providers.length > 0) {
      issueForm.value.provider = providers[0];
      await onCertProviderChange();
    }
    if (issueOpen.value && !monitoring.value && issueType.value === 'key') startDeviceMonitoring();
    issueStep.value = '';
  } catch (e: any) {
    const errorMsg = e?.message || (typeof e === 'string' ? e : 'SKF 服务连接异常');
    ElMessage.error('无法连接到 SKF 服务: ' + errorMsg);
    issueStep.value = '';
  }
}

async function startDeviceMonitoring() {
  if (monitoring.value) return;
  monitoring.value = true;
  lastDeviceSnapshot = JSON.stringify({ provider: issueForm.value.provider, devices: certDevices.value, apps: certApps.value });
  if (deviceMonitorTimer) clearInterval(deviceMonitorTimer);
  deviceMonitorTimer = setInterval(async () => {
    if (!monitoring.value || !issueOpen.value || issueType.value !== 'key') {
      stopDeviceMonitoring();
      return;
    }
    try {
      await pollUsbKeyDevices();
    } catch (e) {}
  }, 5000);
}

function stopDeviceMonitoring() {
  if (deviceMonitorTimer) {
    clearInterval(deviceMonitorTimer);
    deviceMonitorTimer = null;
  }
  if (monitoring.value) {
    monitoring.value = false;
  }
}

async function onCertProviderChange() {
  certDevices.value = [];
  if (!issueForm.value.provider) return;
  try {
    const skf = await getSkfClient();
    const devices = await withTimeout(skf.enumDevice(issueForm.value.provider), 10000, '获取设备列表超时');
    certDevices.value = devices;
    if (devices.length > 0) {
      issueForm.value.device = devices[0];
      await onCertDeviceChange();
    } else {
      issueForm.value.device = '';
      issueForm.value.appName = '';
      certApps.value = [];
    }
  } catch (e: any) {
    ElMessage.error('获取设备列表失败');
  }
}

async function onCertDeviceChange() {
  certApps.value = [];
  if (!issueForm.value.provider || !issueForm.value.device) return;
  try {
    const skf = await getSkfClient();
    const apps = await withTimeout(skf.enumApplication(issueForm.value.provider, issueForm.value.device), 10000, '获取应用列表超时');
    certApps.value = apps;
    issueForm.value.appName = apps.length > 0 ? apps[0] : '';
  } catch (e: any) {
    ElMessage.error('获取应用列表失败');
  }
}

async function pollUsbKeyDevices() {
  if (!issueForm.value.provider) return;
  const skf = await getSkfClient();
  const devices = await withTimeout(skf.enumDevice(issueForm.value.provider), 8000, '轮询设备列表超时');
  const apps =
    issueForm.value.device && devices.includes(issueForm.value.device)
      ? await withTimeout(skf.enumApplication(issueForm.value.provider, issueForm.value.device), 8000, '轮询应用列表超时')
      : [];
  const snapshot = JSON.stringify({ provider: issueForm.value.provider, devices, apps });
  if (lastDeviceSnapshot && snapshot !== lastDeviceSnapshot) {
    certDevices.value = devices;
    if (!devices.includes(issueForm.value.device)) {
      issueForm.value.device = devices[0] || '';
      certApps.value = [];
      if (issueForm.value.device) await onCertDeviceChange();
    } else {
      certApps.value = apps;
      if (!apps.includes(issueForm.value.appName)) issueForm.value.appName = apps[0] || '';
    }
    ElMessage.info('USB Key 设备状态已刷新');
  }
  lastDeviceSnapshot = snapshot;
}

async function handleRootChange(val: any) {
  if (!val) {
    singleProfileList.value = [];
    authorizedProfileIds.value = new Set();
    issueForm.value.profileId = undefined;
    issueForm.value.signProfileId = undefined;
    issueForm.value.encProfileId = undefined;
    issueForm.value.dualProfileName = undefined;
    issueForm.value.subjectItems = [];
    issueForm.value.extensionItems = [];
    return;
  }
  try {
    const res = await getRootCa(val);
    const authorizedIds = res.data.profileIds || [];
    authorizedProfileIds.value = new Set(authorizedIds.map((authId: any) => String(authId)));
    const authorizedProfiles = allProfileList.value.filter((p: any) => authorizedProfileIds.value.has(String(p.id)));
    singleProfileList.value = authorizedProfiles.filter((p: any) => getProfileCertLevel(p) !== 'DualEntity' && !isDualMemberProfile(p));
    // 从 signerConf 中提取算法类型
    try {
      const raw = res.data.signerConf || '';
      // signerConf 可能是 JSON 或 key=value 格式
      let algo = '';
      const trimmed = raw.trim();
      if (trimmed.startsWith('{')) {
        const signerConf = parseJson(raw);
        algo = signerConf?.algo || '';
      } else {
        const match = raw.match(/(?:^|,)algo=([^,]+)/);
        algo = match ? match[1] : '';
      }
      selectedRootAlgo.value = algo;
    } catch (e) {
      selectedRootAlgo.value = '';
    }
    // 如果根证书非 SM2，强制切换回单证书模式
    if (!isSm2Root.value && certMode.value === 'dual') {
      certMode.value = 'single';
      ElMessage.warning('当前根证书不是 SM2 算法，双证书功能不可用');
    }
    issueForm.value.profileId = undefined;
    issueForm.value.signProfileId = undefined;
    issueForm.value.encProfileId = undefined;
    issueForm.value.dualProfileName = undefined;
    issueForm.value.subjectItems = [];
    issueForm.value.extensionItems = [];
  } catch (e) {}
}

async function handleProfileChange(val: any) {
  issueForm.value.subjectItems = [];
  issueForm.value.extensionItems = [];
  issueProfileInfo.value = null;
  if (!val) return;
  try {
    const res = await getProfile(val);
    issueProfileInfo.value = res.data || null;
    const conf = parseJson(res.data.conf);
    if (issueType.value !== 'p10' && conf && conf.subject) {
      const items: any[] = [];
      const rdns = conf.subject.rdns || (Array.isArray(conf.subject) ? conf.subject : []);
      rdns.forEach((rdn: any) => {
        const rdnType = (typeof rdn.type === 'object' ? rdn.type.description : rdn.type) || '';
        let compType = rdnType.toLowerCase();
        for (const [type, meta] of Object.entries(typeMapping)) {
          if (meta.key.toLowerCase() === compType || type.toLowerCase() === compType) {
            compType = type;
            break;
          }
        }
        const count = Math.max(1, rdn.minOccurs === undefined ? 1 : rdn.minOccurs);
        for (let i = 0; i < count; i++) {
          items.push({ type: compType, value: '', minOccurs: rdn.minOccurs, maxOccurs: rdn.maxOccurs });
        }
      });
      issueForm.value.subjectItems = sortSubjectItems(items);
    }
    issueForm.value.extensionItems = buildIssueExtensionItems(conf?.extensions || []);
  } catch (e) {}
}

function prepareIssueFormForType(type: string) {
  issueType.value = type;
  stopDeviceMonitoring();
  issueStep.value = '';
  resetIssueForm();
  issueForm.value.containerName = 'cert-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
  if (type === 'key') refreshCertProviders();
}

function openIssueDialog() {
  issueOpen.value = true;
  certMode.value = 'single';
  prepareIssueFormForType('key');
}

async function handleDualProfileChange(profileId: string | number | undefined) {
  issueForm.value.signProfileId = undefined;
  issueForm.value.encProfileId = undefined;
  issueForm.value.subjectItems = [];
  issueForm.value.extensionItems = [];
  issueProfileInfo.value = null;
  if (!profileId) return;
  const profile = availableDualEntityProfiles.value.find((item: any) => String(item.id) === String(profileId));
  const dualCert = parseJson(profile?.conf)?.dualCert || {};
  if (!profile || !dualCert.signProfileId || !dualCert.encProfileId) {
    issueForm.value.profileId = undefined;
    ElMessage.warning('该双证书模板未绑定签名证书模板或加密证书模板');
    return;
  }
  issueForm.value.signProfileId = dualCert.signProfileId;
  issueForm.value.encProfileId = dualCert.encProfileId;
  await handleProfileChange(dualCert.signProfileId);
  issueProfileInfo.value = profile;
  ElMessage.success('已自动绑定签名证书模板和加密证书模板');
}

function handleIssueTypeChange(type: string | number | boolean) {
  prepareIssueFormForType(String(type));
}

function handleCertModeChange(mode: string | number | boolean) {
  if (String(mode) === 'dual' && !isSm2Root.value) {
    ElMessage.warning('仅 SM2 根证书支持双证书签发');
    certMode.value = 'single';
    return;
  }
  certMode.value = String(mode);
  issueForm.value.profileId = undefined;
  issueForm.value.signProfileId = undefined;
  issueForm.value.encProfileId = undefined;
  issueForm.value.dualProfileName = undefined;
  issueForm.value.subjectItems = [];
  issueForm.value.extensionItems = [];
  issueProfileInfo.value = null;
}

function resetIssueForm() {
  singleProfileList.value = [];
  authorizedProfileIds.value = new Set();
  issueForm.value = {
    rootId: undefined,
    profileId: undefined,
    signProfileId: undefined,
    encProfileId: undefined,
    dualProfileName: undefined,
    name: '',
    subjectItems: [],
    provider: '',
    device: '',
    appName: '',
    containerName: '',
    pin: '123456',
    csr: '',
    encCsr: '',
    extensionItems: [],
    notBefore: undefined,
    notAfter: undefined
  };
  issueProfileInfo.value = null;
  if (issueFormRef.value) issueFormRef.value.resetFields();
}

function closeIssueDialog() {
  issueOpen.value = false;
  issueStep.value = '';
  stopDeviceMonitoring();
}

function pemToBase64(pem: string) {
  return (pem || '')
    .replace(/-----BEGIN[^-]+-----/g, '')
    .replace(/-----END[^-]+-----/g, '')
    .replace(/\s+/g, '');
}

function compactLifecyclePayload(payload: Record<string, any>) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then((value) => resolve(value))
      .catch((error) => reject(error))
      .finally(() => window.clearTimeout(timer));
  });
}

function setIssueStep(message: string) {
  issueStep.value = message;
}

async function showIssueValidationFailed() {
  ElMessage.warning('请先完善签发证书表单');
  await nextTick();
  const firstError = document.querySelector('.cert-issue-dialog .is-error');
  firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function getExtensionTypeMeta(ext: any) {
  const type = ext?.type;
  if (typeof type === 'object') {
    return {
      oid: type.oid || '',
      description: type.description || type.name || type.oid || ''
    };
  }
  return {
    oid: '',
    description: String(type || '')
  };
}

function normalizeExtensionKey(description: string) {
  return (description || '').replace(/[-_\s]/g, '').toLowerCase();
}

function getExtensionLabel(ext: any) {
  const meta = getExtensionTypeMeta(ext);
  const key = normalizeExtensionKey(meta.description);
  const labels: Record<string, string> = {
    subjectalternativename: '主体备用名称',
    keyusage: '密钥用法',
    extendedkeyusage: '增强密钥用法',
    basicconstraints: '基本约束',
    certificatepolicies: '证书策略',
    subjectinfoaccess: '主体信息访问'
  };
  return labels[key] || meta.description || meta.oid || '扩展信息';
}

function buildIssueExtensionItems(extensions: any[]) {
  return (extensions || [])
    .filter((ext: any) => ext?.inRequest === 'required' || ext?.inRequest === 'optional' || (ext?.required && ext?.subjectAltName))
    .map((ext: any, index: number) => {
      const meta = getExtensionTypeMeta(ext);
      const key = normalizeExtensionKey(meta.description);
      const modes = ext?.subjectAltName?.modes?.length ? ext.subjectAltName.modes : ['DNSName'];
      if (key === 'subjectalternativename') {
        return {
          key: `${meta.oid || meta.description || 'san'}-${index}`,
          kind: 'subjectAlternativeName',
          label: getExtensionLabel(ext),
          oid: meta.oid,
          description: meta.description,
          critical: !!ext.critical,
          required: ext.inRequest === 'required' || !!ext.required,
          modes,
          names: [{ type: modes[0], value: '' }]
        };
      }
      if (key === 'keyusage') {
        return {
          key: `${meta.oid || meta.description || 'keyUsage'}-${index}`,
          kind: 'keyUsage',
          label: getExtensionLabel(ext),
          oid: meta.oid,
          description: meta.description,
          critical: !!ext.critical,
          required: ext.inRequest === 'required' || !!ext.required,
          usages: normalizeKeyUsageValues(ext?.keyUsage?.usages || ext?.usages || [])
        };
      }
      if (key === 'extendedkeyusage') {
        return {
          key: `${meta.oid || meta.description || 'extendedKeyUsage'}-${index}`,
          kind: 'extendedKeyUsage',
          label: getExtensionLabel(ext),
          oid: meta.oid,
          description: meta.description,
          critical: !!ext.critical,
          required: ext.inRequest === 'required' || !!ext.required,
          usages: normalizeExtendedKeyUsageValues(ext?.extendedKeyUsage?.usages || ext?.usages || [])
        };
      }
      return {
        key: `${meta.oid || meta.description || 'ext'}-${index}`,
        kind: 'generic',
        label: getExtensionLabel(ext),
        oid: meta.oid,
        description: meta.description,
        critical: !!ext.critical,
        required: ext.inRequest === 'required' || !!ext.required,
        value: ''
      };
    });
}

function normalizeKeyUsageValues(usages: any[]) {
  if (!Array.isArray(usages)) return [];
  const validValues = new Set(keyUsageOptions.map((item) => item.value));
  return usages
    .map((usage: any) => (typeof usage === 'object' ? usage.value || usage.oid || usage.description : usage))
    .map((usage: any) => String(usage || '').trim())
    .filter((usage: string) => validValues.has(usage));
}

function normalizeExtendedKeyUsageValues(usages: any[]) {
  if (!Array.isArray(usages)) return [];
  const validValues = new Set(extendedKeyUsageOptions.map((item) => item.value));
  return usages
    .map((usage: any) => (typeof usage === 'object' ? usage.value || usage.oid || usage.description : usage))
    .map((usage: any) => String(usage || '').trim())
    .filter((usage: string) => validValues.has(usage));
}

function getSanModeLabel(mode: string) {
  const labels: Record<string, string> = {
    DNSName: 'DNS名称',
    dNSName: 'DNS名称',
    IPAddress: 'IP地址',
    iPAddress: 'IP地址',
    rfc822Name: '邮箱',
    RFC822Name: '邮箱',
    uniformResourceIdentifier: 'URI',
    directoryName: '目录名',
    registeredID: '注册ID'
  };
  return labels[mode] || mode;
}

function getSanPlaceholder(mode: string) {
  if (mode === 'IPAddress' || mode === 'iPAddress') return '例如：192.168.1.10';
  if (mode === 'rfc822Name' || mode === 'RFC822Name') return '例如：user@example.com';
  if (mode === 'uniformResourceIdentifier') return '例如：https://example.com';
  return '例如：www.example.com';
}

function addSanName(extIndex: number) {
  const ext = issueForm.value.extensionItems[extIndex];
  if (!ext) return;
  ext.names.push({ type: ext.modes?.[0] || 'DNSName', value: '' });
}

function removeSanName(extIndex: number, nameIndex: number) {
  const ext = issueForm.value.extensionItems[extIndex];
  if (!ext || ext.names.length <= 1) return;
  ext.names.splice(nameIndex, 1);
}

function buildIssueExtensionsPayload() {
  const extensionItems = issueForm.value.extensionItems || [];
  const extensions = extensionItems
    .map((ext: any) => {
      if (ext.kind === 'subjectAlternativeName') {
        const names = (ext.names || [])
          .filter((name: any) => name.value && String(name.value).trim())
          .map((name: any) => ({ type: name.type, value: String(name.value).trim() }));
        if (!names.length) return null;
        return {
          type: { oid: ext.oid, description: ext.description },
          critical: ext.critical,
          subjectAltName: { names }
        };
      }
      if (ext.kind === 'keyUsage') {
        const usages = normalizeKeyUsageValues(ext.usages || []);
        if (!usages.length) return null;
        return {
          type: { oid: ext.oid, description: ext.description },
          critical: ext.critical,
          keyUsage: { usages }
        };
      }
      if (ext.kind === 'extendedKeyUsage') {
        const usages = normalizeExtendedKeyUsageValues(ext.usages || []);
        if (!usages.length) return null;
        return {
          type: { oid: ext.oid, description: ext.description },
          critical: ext.critical,
          extendedKeyUsage: { usages }
        };
      }
      if (!ext.value || !String(ext.value).trim()) return null;
      let value: any = String(ext.value).trim();
      try {
        value = JSON.parse(value);
      } catch (e) {}
      return {
        type: { oid: ext.oid, description: ext.description },
        critical: ext.critical,
        value
      };
    })
    .filter(Boolean);
  return extensions.length ? JSON.stringify(extensions) : undefined;
}

function validateIssueExtensions() {
  for (const ext of issueForm.value.extensionItems || []) {
    if (!ext.required) continue;
    if (ext.kind === 'subjectAlternativeName') {
      const hasValue = (ext.names || []).some((name: any) => name.value && String(name.value).trim());
      if (!hasValue) {
        ElMessage.warning(`请输入${ext.label}`);
        return false;
      }
    } else if (ext.kind === 'keyUsage') {
      if (!normalizeKeyUsageValues(ext.usages || []).length) {
        ElMessage.warning(`请选择${ext.label}`);
        return false;
      }
    } else if (ext.kind === 'extendedKeyUsage') {
      if (!normalizeExtendedKeyUsageValues(ext.usages || []).length) {
        ElMessage.warning(`请选择${ext.label}`);
        return false;
      }
    } else if (!ext.value || !String(ext.value).trim()) {
      ElMessage.warning(`请输入${ext.label}`);
      return false;
    }
  }
  return true;
}

function shouldUseKmcSingleEncryption() {
  const profile = issueProfileInfo.value || singleProfileList.value.find((item: any) => String(item.id) === String(issueForm.value.profileId));
  const name = String(profile?.name || profile?.description || '').toLowerCase();
  if (name.includes('加密') || name.includes('enc')) return true;
  const conf = parseJson(profile?.conf);
  const extensions = Array.isArray(conf?.extensions) ? conf.extensions : [];
  return extensions.some((ext: any) => {
    const description = String(ext?.type?.description || ext?.description || '').toLowerCase();
    const usages = ext?.keyUsage?.usages || ext?.usages || [];
    return description.includes('keyusage') && Array.isArray(usages) && usages.includes('keyEncipherment');
  });
}

function resolveKmcKeyRequest() {
  const root = rootList.value.find((item: any) => String(item.id) === String(issueForm.value.rootId));
  const rootText = String(root?.name || root?.algo || root?.keyAlgorithm || '').toUpperCase();
  const algorithm = rootText.includes('RSA') ? 'RSA' : 'SM2';
  const keySizeMatch = rootText.match(/RSA\s*[-_ ]?(\d{4})/);
  return {
    algorithm,
    keySize: algorithm === 'RSA' ? Number(keySizeMatch?.[1] || 2048) : 256
  };
}

function normalizeIssueResult(result: any, options: any = {}) {
  const primaryInfo = parseCertInfo(result.cert);
  const encryptionInfo = parseCertInfo(result.encryptionCert);
  const normalized = {
    ...result,
    ...options,
    subject: formatDn(primaryInfo?.subject || result.subject),
    issuer: formatDn(primaryInfo?.issuer || result.issuer),
    serialNumber: primaryInfo?.serialNumber || formatSerialNumber(result.serialNumber),
    notBefore: primaryInfo?.notBefore || formatResultDate(result.notBefore),
    notAfter: primaryInfo?.notAfter || formatResultDate(result.notAfter),
    keySource: options.keySource || result.keySource || (result.encryptionPrivateKey ? 'KMC' : '')
  };
  if (encryptionInfo) {
    normalized.encryptionSubject = formatDn(encryptionInfo.subject);
    normalized.encryptionIssuer = formatDn(encryptionInfo.issuer);
    normalized.encryptionSerialNumber = encryptionInfo.serialNumber || formatSerialNumber(result.encryptionSerialNumber);
    normalized.encryptionNotBefore = encryptionInfo.notBefore;
    normalized.encryptionNotAfter = encryptionInfo.notAfter;
  } else {
    normalized.encryptionSerialNumber = formatSerialNumber(result.encryptionSerialNumber);
    normalized.encryptionNotBefore = formatResultDate(result.encryptionNotBefore);
    normalized.encryptionNotAfter = formatResultDate(result.encryptionNotAfter);
  }
  return normalized;
}

function formatSerialNumber(serialNumber?: string) {
  if (!serialNumber) return '';
  return String(serialNumber).toUpperCase();
}

function formatResultDate(value?: string) {
  if (!value) return '';
  const text = String(value);
  if (/^\d{12,14}Z?$/.test(text)) {
    return formatX509Date(text.replace(/Z$/, ''));
  }
  const timestamp = Date.parse(text);
  if (!Number.isNaN(timestamp)) {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
  return text;
}

function getLifecycleResultTitle(action: string) {
  const titleMap: Record<string, string> = {
    renew: '证书续期结果',
    update: '证书更新结果',
    reissue: '证书补办结果',
    recover: '密钥恢复结果',
    'renew-dual': '双证书续期结果',
    'update-dual': '双证书更新结果',
    'reissue-dual': '双证书补办结果'
  };
  return titleMap[action] || '证书操作结果';
}

function getLifecyclePrimaryCertLabel(action: string) {
  const labelMap: Record<string, string> = {
    renew: '续期证书',
    update: '更新证书',
    reissue: '补办证书',
    recover: '恢复证书',
    'renew-dual': '签名证书',
    'update-dual': '签名证书',
    'reissue-dual': '签名证书'
  };
  return labelMap[action] || '证书';
}

function showIssueResult(result: any, options: any = {}) {
  if (!result) return;
  issueResultTitle.value = options.title || '证书操作结果';
  issueResult.value = normalizeIssueResult(result, options);
  issueResultOpen.value = true;
}

async function submitIssue() {
  issueFormRef.value?.validate(async (valid) => {
    if (!valid) {
      await showIssueValidationFailed();
      return;
    }
    if (valid) {
      if (certMode.value === 'dual' && (!issueForm.value.signProfileId || !issueForm.value.encProfileId)) {
        ElMessage.warning('请选择已绑定签名证书模板和加密证书模板的双证书模板');
        return;
      }
      if (!validateIssueExtensions()) {
        return;
      }
      issueLoading.value = true;
      let skf: any = null;
      try {
        const appPath = `${issueForm.value.provider}/${issueForm.value.device}/${issueForm.value.appName}`;
        const subject = issueForm.value.subjectItems
          .filter((i: any) => i.value)
          .map((i: any) => {
            const key = typeMapping[i.type as keyof typeof typeMapping]?.key || i.type;
            return `${key}=${i.value}`;
          })
          .join(',');

        if (issueType.value === 'key') {
          skf = await getSkfClient();
          setIssueStep('正在验证 USB Key PIN...');
          await withTimeout(skf.checkPIN(appPath, issueForm.value.pin), 15000, '验证 PIN 超时');
        }

        if (issueType.value === 'key' && certMode.value === 'single') {
          const kmcEncryption = shouldUseKmcSingleEncryption();
          let res: any;
          if (kmcEncryption) {
            const kmcKey = resolveKmcKeyRequest();
            setIssueStep(`正在向 KMC 申请 ${kmcKey.algorithm}${kmcKey.keySize || ''} 加密密钥...`);
            res = await issueCert({
              rootId: issueForm.value.rootId,
              profileId: issueForm.value.profileId,
              subject,
              keyGenStrategy: 'KMC',
              keyAlgorithm: kmcKey.algorithm,
              keySize: kmcKey.keySize,
              notBefore: issueForm.value.notBefore,
              notAfter: issueForm.value.notAfter,
              extensions: buildIssueExtensionsPayload()
            });
          } else {
            setIssueStep('正在 USB Key 中生成密钥并创建 CSR...');
            const p10Res = await withTimeout(
              skf.createPKCS10(
                issueForm.value.provider,
                issueForm.value.device,
                issueForm.value.appName,
                subject,
                'SM2',
                256,
                issueForm.value.containerName
              ),
              30000,
              '生成 CSR 超时'
            );
            setIssueStep('正在提交 CA 签发单证书...');
            res = await issueCert({
              rootId: issueForm.value.rootId,
              profileId: issueForm.value.profileId,
              csrBase64: pemToBase64(p10Res.pem),
              notBefore: issueForm.value.notBefore,
              notAfter: issueForm.value.notAfter,
              extensions: buildIssueExtensionsPayload()
            });
          }
          if (res.data && res.data.cert) {
            setIssueStep(kmcEncryption ? '正在写入 KMC 加密证书到 USB Key...' : '正在写入签名证书到 USB Key...');
            await withTimeout(
              skf.importCertificate(
                issueForm.value.provider,
                issueForm.value.device,
                issueForm.value.appName,
                issueForm.value.containerName,
                !kmcEncryption,
                res.data.cert
              ),
              30000,
              '写入 USB Key 证书超时'
            );
            ElMessage.success(kmcEncryption ? 'KMC加密证书签发成功，证书已写入USB Key' : '签发成功');
            showIssueResult(res.data, {
              primaryCertLabel: kmcEncryption ? 'KMC加密证书' : '签名证书',
              keySource: kmcEncryption ? 'KMC' : 'USB Key'
            });
          } else {
            throw new Error(res.msg || '后端签发结果异常');
          }
        } else if (issueType.value === 'key' && certMode.value === 'dual') {
          setIssueStep('正在 USB Key 中生成签名密钥并创建 CSR...');
          const p10Res = await withTimeout(
            skf.createPKCS10(
              issueForm.value.provider,
              issueForm.value.device,
              issueForm.value.appName,
              subject,
              'SM2',
              256,
              issueForm.value.containerName
            ),
            30000,
            '生成签名 CSR 超时'
          );
          setIssueStep('正在请求双证书签发，KMC 将生成加密密钥...');
          const res = await issueDualCert({
            rootId: issueForm.value.rootId,
            signProfileId: issueForm.value.signProfileId,
            encProfileId: issueForm.value.encProfileId,
            signCsrBase64: pemToBase64(p10Res.pem),
            keyGenStrategy: 'KMC',
            notBefore: issueForm.value.notBefore,
            notAfter: issueForm.value.notAfter,
            extensions: buildIssueExtensionsPayload()
          });

          if (res.data && res.data.cert && res.data.encryptionCert) {
            if (!res.data.encryptionPrivateKey) {
              throw new Error('KMC未返回可写入 USB Key 的加密私钥材料');
            }
            setIssueStep('正在写入签名证书到 USB Key...');
            await withTimeout(
              skf.importCertificate(
                issueForm.value.provider,
                issueForm.value.device,
                issueForm.value.appName,
                issueForm.value.containerName,
                true,
                res.data.cert
              ),
              30000,
              '写入签名证书超时'
            );
            setIssueStep('正在写入 KMC 加密密钥对到 USB Key...');
            await withTimeout(
              skf.importKeyPair(
                issueForm.value.provider,
                issueForm.value.device,
                issueForm.value.appName,
                issueForm.value.containerName,
                'SM2',
                res.data.encryptionPrivateKey,
                res.data.wrapKey || ''
              ),
              30000,
              '写入 KMC 加密密钥对超时'
            );
            setIssueStep('正在写入加密证书到 USB Key...');
            await withTimeout(
              skf.importCertificate(
                issueForm.value.provider,
                issueForm.value.device,
                issueForm.value.appName,
                issueForm.value.containerName,
                false,
                res.data.encryptionCert
              ),
              30000,
              '写入加密证书超时'
            );
            ElMessage.success('双证书签发成功，KMC加密密钥已导入 USB Key');
            showIssueResult(res.data, {
              primaryCertLabel: '签名证书',
              encryptionCertLabel: '加密证书',
              keySource: 'KMC'
            });
          } else {
            throw new Error(res.msg || '后端签发双证书结果不完整');
          }
        } else if (issueType.value === 'p10' && certMode.value === 'dual') {
          // p10 双证书
          const signCsrBase64 = pemToBase64(issueForm.value.csr);
          const payload: any = {
            rootId: issueForm.value.rootId,
            signProfileId: issueForm.value.signProfileId,
            encProfileId: issueForm.value.encProfileId,
            signCsrBase64,
            keyGenStrategy: 'KMC',
            notBefore: issueForm.value.notBefore,
            notAfter: issueForm.value.notAfter,
            extensions: buildIssueExtensionsPayload()
          };
          setIssueStep('正在提交签名 CSR，KMC 将自动生成加密密钥对...');
          const res = await issueDualCert(payload);
          if (res.data && res.data.cert && res.data.encryptionCert) {
            ElMessage.success('双证书签发成功');
            ElMessage.info('请点击"下载 ZIP 包"获取签名证书、加密证书和加密私钥');
            showIssueResult(res.data, {
              primaryCertLabel: '签名证书',
              encryptionCertLabel: '加密证书',
              keySource: 'KMC'
            });
          } else {
            throw new Error(res.msg || '后端签发双证书结果不完整');
          }
        } else {
          // p10 单证书
          setIssueStep('正在提交 PKCS10 CSR 并签发证书...');
          const res = await issueCert({
            rootId: issueForm.value.rootId,
            profileId: issueForm.value.profileId,
            csrBase64: pemToBase64(issueForm.value.csr),
            notBefore: issueForm.value.notBefore,
            notAfter: issueForm.value.notAfter,
            extensions: buildIssueExtensionsPayload()
          });
          if (res.data && res.data.cert) {
            ElMessage.success('签发成功');
            showIssueResult(res.data, {
              primaryCertLabel: '证书'
            });
          } else {
            throw new Error(res.msg || '后端签发结果异常');
          }
        }

        issueOpen.value = false;
        getList();
      } catch (e: any) {
        const errorMsg = e?.message || (typeof e === 'string' ? e : '操作失败');
        ElMessage.error('签发失败: ' + errorMsg);
      } finally {
        issueLoading.value = false;
        issueStep.value = '';
      }
    }
  });
}

function getCertTypeLabel(certType: string) {
  switch (certType) {
    case 'RootCA':
    case 'ROOT_CA':
      return '根CA';
    case 'SubCA':
    case 'IntermediateCA':
    case 'SUB_CA':
      return '子CA';
    case 'EndEntity':
    case 'END_ENTITY':
      return '终端实体';
    default:
      return certType || '-';
  }
}

function getStatusType(status: string) {
  switch (status) {
    case 'VALID':
      return 'success';
    case 'HOLD':
      return 'warning';
    case 'REVOKED':
      return 'danger';
    case 'EXPIRED':
      return 'warning';
    default:
      return 'info';
  }
}
function getStatusLabel(status: string) {
  switch (status) {
    case 'VALID':
      return '有效';
    case 'HOLD':
      return '已冻结';
    case 'REVOKED':
      return '已吊销';
    case 'EXPIRED':
      return '已过期';
    default:
      return status || '未知';
  }
}
function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}
function resetQuery() {
  proxy?.resetForm('queryForm');
  handleQuery();
}
function handleSelectionChange(selection: any[]) {
  ids.value = selection.map((item) => item.id);
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
}
function handleView(row: any) {
  currentCertPem.value = row.cert || row.pem;
  showDetail.value = true;
}
function handleDownloadFormat(format: string, row: any) {
  const pem = row.cert || row.pem;
  if (!pem) {
    ElMessage.error('证书内容为空');
    return;
  }
  const baseName = row.serialNumber || 'cert';
  switch (format) {
    case 'pem':
      downloadAs(pem, `${baseName}.pem`, 'application/x-pem-file');
      break;
    case 'crt':
      downloadAs(pem, `${baseName}.crt`, 'application/x-x509-ca-cert');
      break;
    case 'cer': {
      const der = pemToDer(pem);
      const blob = new Blob([der], { type: 'application/x-x509-ca-cert' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `${baseName}.cer`;
      link.click();
      window.URL.revokeObjectURL(link.href);
      break;
    }
    case 'p7b':
      downloadP7b(row.id, row.serialNumber || 'cert');
      break;
    default:
      ElMessage.error('不支持的下载格式');
  }
}
function downloadAs(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(link.href);
}
async function downloadP7b(certId: number, filename: string) {
  try {
    const response = await request({
      url: `/ca/v1/certs/${certId}/p7b`,
      method: 'get',
      responseType: 'blob'
    }) as any;
    const blob = response instanceof Blob ? response : new Blob([response]);
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `${filename}.p7b`;
    link.click();
    window.URL.revokeObjectURL(link.href);
    ElMessage.success('P7B 证书链下载已开始');
  } catch {
    ElMessage.error('P7B 下载失败，请确认证书链完整');
  }
}

function downloadDer(pem: string, filename: string) {
  const der = pemToDer(pem);
  const blob = new Blob([der], { type: 'application/pkix-cert' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.download = `${filename}.der`;
  link.click();
}

function downloadCertByMode(pem: string, filename: string, mode: string) {
  if (mode === 'der') {
    downloadDer(pem, filename);
  } else {
    downloadPem(pem, filename);
  }
}

function pemToDer(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function downloadEncPrivateKey() {
  const key = issueResult.value.encryptionPrivateKey;
  if (!key) return;
  const blob = new Blob([key], { type: 'application/octet-stream' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.download = `${issueResult.value.encryptionSerialNumber || 'enc'}_enc.key`;
  link.click();
}

function downloadDualCertZip() {
  const cert = issueResult.value.cert;
  const encCert = issueResult.value.encryptionCert;
  const encKey = issueResult.value.encryptionPrivateKey;
  if (!cert || !encCert || !encKey) {
    ElMessage.error('缺少证书或私钥，无法生成 ZIP 包');
    return;
  }
  const subject = (issueResult.value.subject || 'cert').replace(/[\\/:*?"<>|]/g, '_');
  const zipBlob = createZip([
    { name: 'sign.crt', content: cert },
    { name: 'enc.crt', content: encCert },
    { name: 'enc.key', content: encKey }
  ]);
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(zipBlob);
  link.download = `${subject}_dual_certs.zip`;
  link.click();
  ElMessage.success('ZIP 包下载已开始');
}

function createZip(files: { name: string; content: string }[]): Blob {
  const encoder = new TextEncoder();
  const localHeaders: Uint8Array[] = [];
  const centralDir: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const data = encoder.encode(file.content);
    const nameBytes = encoder.encode(file.name);
    const crc = crc32(data);

    // Local file header
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(localHeader.buffer);
    view.setUint32(0, 0x04034b50, true); // signature
    view.setUint16(4, 20, true); // version needed
    view.setUint16(6, 0x0800, true); // general purpose bit flag (UTF-8)
    view.setUint16(8, 0, true); // compression method (store)
    view.setUint16(10, 0, true); // last mod time
    view.setUint16(12, 0, true); // last mod date
    view.setUint32(14, crc, true); // crc-32
    view.setUint32(18, data.length, true); // compressed size
    view.setUint32(22, data.length, true); // uncompressed size
    view.setUint16(26, nameBytes.length, true); // file name length
    view.setUint16(28, 0, true); // extra field length
    localHeader.set(nameBytes, 30);

    localHeaders.push(localHeader);
    localHeaders.push(data);

    // Central directory entry
    const cdEntry = new Uint8Array(46 + nameBytes.length);
    const cdView = new DataView(cdEntry.buffer);
    cdView.setUint32(0, 0x02014b50, true); // signature
    cdView.setUint16(4, 20, true); // version made by
    cdView.setUint16(6, 20, true); // version needed
    cdView.setUint16(8, 0x0800, true); // general purpose bit flag (UTF-8)
    cdView.setUint16(10, 0, true); // compression method
    cdView.setUint16(12, 0, true); // last mod time
    cdView.setUint16(14, 0, true); // last mod date
    cdView.setUint32(16, crc, true); // crc-32
    cdView.setUint32(20, data.length, true); // compressed size
    cdView.setUint32(24, data.length, true); // uncompressed size
    cdView.setUint16(28, nameBytes.length, true); // file name length
    cdView.setUint16(30, 0, true); // extra field length
    cdView.setUint16(32, 0, true); // file comment length
    cdView.setUint16(34, 0, true); // disk number start
    cdView.setUint16(36, 0, true); // internal file attributes
    cdView.setUint32(38, 0, true); // external file attributes
    cdView.setUint32(42, offset, true); // relative offset of local header
    cdEntry.set(nameBytes, 46);

    centralDir.push(cdEntry);
    offset += localHeader.length + data.length;
  }

  // End of central directory record
  const cdSize = centralDir.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true); // signature
  eocdView.setUint16(4, 0, true); // disk number
  eocdView.setUint16(6, 0, true); // disk with central directory
  eocdView.setUint16(8, files.length, true); // entries on this disk
  eocdView.setUint16(10, files.length, true); // total entries
  eocdView.setUint32(12, cdSize, true); // central directory size
  eocdView.setUint32(16, offset, true); // offset of central directory
  eocdView.setUint16(20, 0, true); // comment length

  // Concatenate all parts
  const totalSize = offset + cdSize + eocd.length;
  const zip = new Uint8Array(totalSize);
  let pos = 0;
  for (const part of localHeaders) {
    zip.set(part, pos);
    pos += part.length;
  }
  for (const part of centralDir) {
    zip.set(part, pos);
    pos += part.length;
  }
  zip.set(eocd, pos);

  return new Blob([zip], { type: 'application/zip' });
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xedb88320;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function handleRevoke(row: any) {
  revokeForm.value.certId = row.id;
  revokeForm.value.reason = 0;
  revokeForm.value.invalidityDate = undefined;
  revokeOpen.value = true;
}
async function submitRevoke() {
  const isDual = revokeForm.value.isDual;
  const label = isDual ? '双证书吊销' : '吊销证书';
  securityConfirm.action = `${label} (ID: ${revokeForm.value.certId})`;
  securityConfirm.onConfirm = async () => {
    try {
      if (isDual) {
        await revokeDualCert({
          signCertId: revokeForm.value.certId,
          reason: revokeForm.value.reason,
          invalidityDate: revokeForm.value.invalidityDate
        });
      } else {
        await revokeCert(revokeForm.value as any);
      }
      ElMessage.success(`${label}成功`);
      revokeOpen.value = false;
      revokeForm.value.isDual = false;
      getList();
    } catch (error: any) {
      ElMessage.error(`${label}失败`);
    }
  };
  securityConfirm.visible = true;
}

function resetLifecycleForm() {
  lifecycleOutputMode.value = 'usbkey';
  lifecycleForm.subjectItems = [];
  lifecycleForm.csr = '';
  lifecycleForm.encCsr = '';
  lifecycleForm.encCertId = undefined;
  lifecycleForm.reason = '';
  lifecycleForm.authCode = '';
  lifecycleForm.provider = '';
  lifecycleForm.device = '';
  lifecycleForm.appName = '';
  lifecycleForm.containerName = 'cert-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
  lifecycleForm.pin = '123456';
  lifecycleForm.notBefore = undefined;
  lifecycleForm.notAfter = undefined;
  lifecycleCertProviders.value = [];
  lifecycleCertDevices.value = [];
  lifecycleCertApps.value = [];
  lifecycleContainers.value = [];
  lifecycleFormRef.value?.resetFields();
}

function getDefaultLifecycleOutputMode(action: string) {
  if (action === 'update' || action === 'update-dual' || action === 'reissue' || action === 'reissue-dual') {
    return 'pem';
  }
  return 'usbkey';
}

function getLifecycleEncCertId() {
  const pairId = lifecycleRow.value?.certPairId;
  const parsed = Number(pairId);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseLifecycleSubject(value?: string) {
  if (!value) return [] as SubjectItem[];
  const text = String(value).trim();
  if (!text) return [];
  const normalized = text.startsWith('/') ? text.slice(1).split('/').filter(Boolean).join(',') : text;
  const kvs = normalized
    .split(',')
    .map((it) => it.trim())
    .filter(Boolean)
    .map((it) => {
      const separatorIndex = it.indexOf('=');
      if (separatorIndex <= 0) return null;
      const key = it.substring(0, separatorIndex).trim();
      const valuePart = it.substring(separatorIndex + 1).trim();
      let subjectType = key.toLowerCase();
      for (const [type, meta] of Object.entries(typeMapping)) {
        if (meta.key.toLowerCase() === key.toLowerCase()) {
          subjectType = type;
          break;
        }
      }
      return { type: subjectType, value: valuePart };
    })
    .filter(Boolean) as SubjectItem[];
  return sortSubjectItems(kvs);
}

function buildLifecycleSubject(items: SubjectItem[]) {
  return (items || [])
    .filter((item) => item.value)
    .map((item) => {
      const key = typeMapping[item.type as keyof typeof typeMapping]?.key || item.type;
      return `${key}=${item.value}`;
    })
    .join(',');
}

function initializeLifecycleSubjectForUpdate() {
  if (lifecycleAction.value !== 'update' && lifecycleAction.value !== 'update-dual') return;

  const oldSubjectItems = parseLifecycleSubject(lifecycleRow.value?.subject);
  const profileId = lifecycleRow.value?.profileId;

  // 尝试根据旧证书使用的模板来生成主题输入表单
  if (profileId) {
    const profile = profileLookupList.value.find((p: any) => String(p.id) === String(profileId));
    if (profile?.conf) {
      try {
        const conf = parseJson(profile.conf);
        if (conf?.subject) {
          const rdns = conf.subject.rdns || (Array.isArray(conf.subject) ? conf.subject : []);
          const items: SubjectItem[] = [];

          rdns.forEach((rdn: any) => {
            const rdnType = (typeof rdn.type === 'object' ? rdn.type.description : rdn.type) || '';
            let compType = rdnType.toLowerCase();
            for (const [type, meta] of Object.entries(typeMapping)) {
              if (meta.key.toLowerCase() === compType || type.toLowerCase() === compType) {
                compType = type;
                break;
              }
            }

            const count = Math.max(1, rdn.minOccurs === undefined ? 1 : rdn.minOccurs);
            for (let i = 0; i < count; i++) {
              const oldMatch = oldSubjectItems.find((s: SubjectItem) => s.type === compType);
              items.push({
                type: compType,
                value: oldMatch?.value || '',
                minOccurs: rdn.minOccurs,
                maxOccurs: rdn.maxOccurs,
                regex: rdn.regex
              });
            }
          });

          lifecycleForm.subjectItems = sortSubjectItems(items);
          return;
        }
      } catch (e) {
        // 模板解析失败，回退到默认行为
      }
    }
  }

  // 无法获取模板配置时，仅解析旧主题
  lifecycleForm.subjectItems = oldSubjectItems;
  if (!lifecycleForm.subjectItems.length) {
    lifecycleForm.subjectItems = [];
  }
}

function handleLifecycleCommand(command: string, row: any) {
  // 双证书操作
  if (command.endsWith('-dual')) {
    handleDualLifecycleCommand(command, row);
    return;
  }
  if (command === 'revoke') {
    handleRevoke(row);
    return;
  }
  if (command === 'suspend' || command === 'resume') {
    submitQuickLifecycle(command, row);
    return;
  }
  if (command === 'recover' && row.keySource !== 'KMC') {
    ElMessage.warning('只有密钥来源为 KMC 的证书支持密钥恢复');
    return;
  }
  lifecycleAction.value = command;
  lifecycleRow.value = row;

  if ((command === 'update' || command === 'update-dual' || command === 'reissue' || command === 'reissue-dual') && row?.status !== 'VALID') {
    ElMessage.warning('该证书状态不可执行更新/补办操作');
    return;
  }

  resetLifecycleForm();
  lifecycleOutputMode.value = getDefaultLifecycleOutputMode(command);
  lifecycleTitle.value = command === 'renew' ? '证书续期' : command === 'update' ? '证书更新' : command === 'reissue' ? '证书重签/补办' : '密钥恢复';
  if (command === 'update-dual') {
    lifecycleForm.encCertId = getLifecycleEncCertId();
  }
  initializeLifecycleSubjectForUpdate();
  lifecycleOpen.value = true;
  if (command !== 'recover') refreshLifecycleCertProviders();
}

function handleDualLifecycleCommand(command: string, row: any) {
  const action = command.replace('-dual', '');
  if (action === 'suspend' || action === 'resume') {
    submitDualQuickLifecycle(action, row);
    return;
  }
  if (action === 'revoke') {
    handleDualRevoke(row);
    return;
  }
  // 双证书续期/更新/补办
  lifecycleAction.value = command;
  lifecycleRow.value = row;

  if ((action === 'update' || action === 'reissue') && row?.status !== 'VALID') {
    ElMessage.warning('该证书状态不可执行更新/补办操作');
    return;
  }

  resetLifecycleForm();
  lifecycleOutputMode.value = getDefaultLifecycleOutputMode(command);
  const titleMap: Record<string, string> = {
    renew: '双证书续期',
    update: '双证书更新',
    reissue: '双证书补办'
  };
  lifecycleTitle.value = titleMap[action] || `双证书${action}`;
  lifecycleForm.encCertId = getLifecycleEncCertId();
  initializeLifecycleSubjectForUpdate();
  lifecycleOpen.value = true;
  refreshLifecycleCertProviders();
}

function submitDualQuickLifecycle(action: string, row: any) {
  const isSuspend = action === 'suspend';
  const label = isSuspend ? '冻结' : '解冻';
  securityConfirm.action = `双证书${label} (签名证书: ${row.serialNumber || row.id})`;
  securityConfirm.onConfirm = async () => {
    try {
      const apiFn = isSuspend ? suspendDualCert : resumeDualCert;
      await apiFn({ signCertId: row.id });
      ElMessage.success(`双证书${label}成功`);
      getList();
    } catch (e) {
      ElMessage.error(`双证书${label}失败`);
    }
  };
  securityConfirm.visible = true;
}

function handleDualRevoke(row: any) {
  revokeForm.value.certId = row.id;
  revokeForm.value.isDual = true;
  submitRevoke();
}

function submitQuickLifecycle(command: string, row: any) {
  const isSuspend = command === 'suspend';
  securityConfirm.action = `${isSuspend ? '挂起' : '恢复'}证书 (序列号: ${row.serialNumber || row.id})`;
  securityConfirm.onConfirm = async () => {
    try {
      if (isSuspend) {
        await suspendCert({ certId: row.id });
      } else {
        await resumeCert({ certId: row.id });
      }
      ElMessage.success(isSuspend ? '挂起成功' : '恢复成功');
      getList();
    } catch (e) {
      ElMessage.error(isSuspend ? '挂起失败' : '恢复失败');
    }
  };
  securityConfirm.visible = true;
}

async function refreshLifecycleCertProviders() {
  try {
    const skf = await getSkfClient();
    const providers = await skf.enumProvider();
    lifecycleCertProviders.value = Array.isArray(providers) ? providers : [];
    if (lifecycleCertProviders.value.length > 0 && !lifecycleForm.provider) {
      lifecycleForm.provider = lifecycleCertProviders.value[0];
      await onLifecycleProviderChange();
    }
  } catch (e) {
    lifecycleCertProviders.value = [];
  }
}

function onLifecycleOutputModeChange() {
  if (lifecycleAction.value === 'update' || lifecycleAction.value === 'update-dual') {
    if (lifecycleOutputMode.value === 'usbkey') {
      initializeLifecycleSubjectForUpdate();
    } else {
      lifecycleForm.subjectItems = [];
      lifecycleForm.encCsr = '';
    }
  }
}

async function onLifecycleProviderChange() {
  lifecycleCertDevices.value = [];
  lifecycleCertApps.value = [];
  lifecycleForm.device = '';
  lifecycleForm.appName = '';
  if (!lifecycleForm.provider) return;
  try {
    const skf = await getSkfClient();
    const devices = await skf.enumDevice(lifecycleForm.provider);
    lifecycleCertDevices.value = Array.isArray(devices) ? devices : [];
    if (lifecycleCertDevices.value.length > 0) {
      lifecycleForm.device = lifecycleCertDevices.value[0];
      await onLifecycleDeviceChange();
    }
  } catch (e) {
    lifecycleCertDevices.value = [];
  }
}

async function onLifecycleDeviceChange() {
  lifecycleCertApps.value = [];
  lifecycleContainers.value = [];
  lifecycleForm.appName = '';
  lifecycleForm.containerName = '';
  if (!lifecycleForm.provider || !lifecycleForm.device) return;
  try {
    const skf = await getSkfClient();
    const apps = await skf.enumApplication(lifecycleForm.provider, lifecycleForm.device);
    lifecycleCertApps.value = Array.isArray(apps) ? apps : [];
    if (lifecycleCertApps.value.length > 0) {
      lifecycleForm.appName = lifecycleCertApps.value[0];
      await onLifecycleAppChange();
    }
  } catch (e) {
    lifecycleCertApps.value = [];
  }
}

async function onLifecycleAppChange() {
  lifecycleContainers.value = [];
  lifecycleForm.containerName = '';
  if (!lifecycleForm.provider || !lifecycleForm.device || !lifecycleForm.appName) return;
  try {
    const skf = await getSkfClient();
    const containers = await skf.enumContainer(lifecycleForm.provider, lifecycleForm.device, lifecycleForm.appName);
    const list = Array.isArray(containers) ? containers : [];
    // 查找匹配当前证书序列号的容器
    const certs = await skf.findCertificates('');
    const matchedContainers = list.map((name: string) => {
      const certInfo = Array.isArray(certs) ? certs.find((c: any) => c.key && c.key.includes(name) && c.key.includes(lifecycleForm.appName)) : null;
      const isSign = certInfo?.type === 'Sign';
      const isEnc = certInfo?.type === 'Enc';
      const label = certInfo ? `${name} [${isSign ? '签名' : isEnc ? '加密' : certInfo.type}]` : name;
      return { name, label, hasSignCert: isSign, hasEncCert: isEnc };
    });
    lifecycleContainers.value = matchedContainers;
    // 自动选中匹配证书类型的容器
    const isSigningCert = lifecycleRow.value?.certUsage === 'SIGNING' || lifecycleRow.value?.certUsage !== 'ENCRYPTION';
    const auto = matchedContainers.find((c) => (isSigningCert ? c.hasSignCert : c.hasEncCert));
    if (auto) lifecycleForm.containerName = auto.name;
  } catch (e) {
    lifecycleContainers.value = [];
  }
}

function onLifecycleContainerChange() {
  // 容器选择变化时不需要额外操作
}

async function writeLifecycleCertToUsbKey(certPem: string, isSigning: boolean) {
  const skf = await getSkfClient();
  const { provider, device, appName, containerName, pin } = lifecycleForm;
  const appPath = `${provider}/${device}/${appName}`;
  await skf.checkPIN(appPath, pin);
  // 续期复用原密钥对，新证书公钥与容器内密钥匹配，直接导入覆盖旧证书
  await skf.importCertificate(provider, device, appName, containerName, isSigning, certPem);
}

function submitLifecycle() {
  lifecycleFormRef.value?.validate(async (valid) => {
    if (!valid || !lifecycleRow.value) return;
    securityConfirm.action = `${lifecycleTitle.value} (序列号: ${lifecycleRow.value.serialNumber || lifecycleRow.value.id})`;
    securityConfirm.onConfirm = async () => {
      lifecycleLoading.value = true;
      try {
        const certId = lifecycleRow.value.id;
        const isUpdate = lifecycleAction.value === 'update' || lifecycleAction.value === 'update-dual';
        const isDual = lifecycleAction.value?.endsWith('-dual');
        const useUsbOutput = lifecycleOutputMode.value === 'usbkey';
        const encCertId = getLifecycleEncCertId() || lifecycleForm.encCertId;
        const subject = buildLifecycleSubject(lifecycleForm.subjectItems);

        if (isDual && !encCertId) {
          throw new Error('双证书操作缺少配对加密证书ID，请刷新后重试');
        }

        let signCsrBase64: string | undefined;
        if (isUpdate) {
          if (useUsbOutput) {
            if (!lifecycleForm.provider || !lifecycleForm.device || !lifecycleForm.appName || !lifecycleForm.pin) {
              throw new Error('请先完善 USB Key 信息');
            }
            if (!subject) {
              throw new Error('请先填写新主题');
            }
            const skf = await getSkfClient();
            await skf.checkPIN(`${lifecycleForm.provider}/${lifecycleForm.device}/${lifecycleForm.appName}`, lifecycleForm.pin);
            const p10Res = await withTimeout(
              skf.createPKCS10(lifecycleForm.provider, lifecycleForm.device, lifecycleForm.appName, subject, 'SM2', 256, lifecycleForm.containerName),
              30000,
              '生成更新 CSR 超时'
            );
            signCsrBase64 = pemToBase64(p10Res.pem);
          } else {
            signCsrBase64 = lifecycleForm.csr ? pemToBase64(lifecycleForm.csr) : undefined;
            if (!signCsrBase64) {
              throw new Error('请输入新CSR');
            }
          }
        } else if ((lifecycleAction.value === 'reissue' || lifecycleAction.value === 'reissue-dual') && lifecycleForm.csr) {
          signCsrBase64 = pemToBase64(lifecycleForm.csr);
        }

        let res: any;
        if (lifecycleAction.value === 'renew') {
          res = await renewCert(compactLifecyclePayload({ certId, notBefore: lifecycleForm.notBefore, notAfter: lifecycleForm.notAfter }));
        } else if (lifecycleAction.value === 'update') {
          res = await updateCert(
            compactLifecyclePayload({
              certId,
              subject: subject || undefined,
              csrBase64: signCsrBase64,
              notBefore: lifecycleForm.notBefore,
              notAfter: lifecycleForm.notAfter
            })
          );
        } else if (lifecycleAction.value === 'reissue') {
          res = await reissueCert(compactLifecyclePayload({ certId, csrBase64: pemToBase64(lifecycleForm.csr), reason: lifecycleForm.reason }));
        } else if (lifecycleAction.value === 'renew-dual') {
          res = await renewDualCert(
            compactLifecyclePayload({
              signCertId: certId,
              encCertId,
              notBefore: lifecycleForm.notBefore,
              notAfter: lifecycleForm.notAfter
            })
          );
        } else if (lifecycleAction.value === 'update-dual') {
          res = await updateDualCert(
            compactLifecyclePayload({
              signCertId: certId,
              encCertId,
              subject: subject || undefined,
              signCsrBase64,
              encCsrBase64: lifecycleForm.encCsr ? pemToBase64(lifecycleForm.encCsr) : undefined,
              notBefore: lifecycleForm.notBefore,
              notAfter: lifecycleForm.notAfter
            })
          );
        } else if (lifecycleAction.value === 'reissue-dual') {
          res = await reissueDualCert(
            compactLifecyclePayload({
              signCertId: certId,
              encCertId,
              signCsrBase64,
              encCsrBase64: lifecycleForm.encCsr ? pemToBase64(lifecycleForm.encCsr) : undefined,
              reason: lifecycleForm.reason
            })
          );
        } else {
          res = await recoverKey(compactLifecyclePayload({ certId, authCode: lifecycleForm.authCode }));
        }
        // 根据证书存储方式处理结果
        const data = res?.data;
        if (!data) {
          throw new Error('后端未返回证书数据');
        }
        if (data?.cert) {
          if (lifecycleOutputMode.value === 'usbkey' && lifecycleAction.value !== 'recover') {
            // USB Key 写入
            await refreshLifecycleCertProviders();
            if (lifecycleCertProviders.value.length === 0) {
              throw new Error('未检测到 USB Key 设备，无法写入证书');
            }
            await writeLifecycleCertToUsbKey(data.cert, true);
            if (isDual && data.encryptionCert) {
              await writeLifecycleCertToUsbKey(data.encryptionCert, false);
            }
            ElMessage.success('操作成功，证书已写入 USB Key');
          } else if (lifecycleOutputMode.value !== 'usbkey' && lifecycleAction.value !== 'recover') {
            // 文件下载
            const certFilename = data.serialNumber || 'cert';
            downloadCertByMode(data.cert, certFilename + (isDual ? '_sign' : ''), lifecycleOutputMode.value);
            if (isDual && data.encryptionCert) {
              downloadCertByMode(data.encryptionCert, (data.encryptionSerialNumber || 'enc') + '_enc', lifecycleOutputMode.value);
            }
            ElMessage.success(`操作成功，证书已下载为 ${lifecycleOutputMode.value.toUpperCase()} 文件`);
          } else {
            ElMessage.success('操作成功');
          }
        } else {
          ElMessage.success('操作成功');
        }
        lifecycleOpen.value = false;
        const isUpdateAction = lifecycleAction.value === 'update' || lifecycleAction.value === 'update-dual';
        showIssueResult(data, {
          title: getLifecycleResultTitle(lifecycleAction.value),
          primaryCertLabel: getLifecyclePrimaryCertLabel(lifecycleAction.value),
          previousCertId: isUpdateAction ? lifecycleRow.value?.id : undefined,
          operationHint: isUpdateAction ? lifecycleModeMeta.value?.warningDescription : undefined,
          keySource: lifecycleAction.value === 'recover' ? resolveKeySource(lifecycleRow.value) : undefined
        });
        getList();
      } catch (e: any) {
        ElMessage.error('操作失败: ' + (e?.message || ''));
      } finally {
        lifecycleLoading.value = false;
      }
    };
    securityConfirm.visible = true;
  });
}
function handleDelete(row: any) {
  const certIds = row.id || ids.value;
  ElMessageBox.confirm('确认删除？', '提示', { type: 'warning' }).then(async () => {
    try {
      await removeCert(Array.isArray(certIds) ? certIds : [certIds]);
      ElMessage.success('成功');
      getList();
    } catch (e) {}
  });
}
async function handleExport() {
  try {
    const res = await exportCert(ids.value);
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(new Blob([res]));
    link.download = `certs_${Date.now()}.zip`;
    link.click();
  } catch (e) {}
}

function parseCertInfo(certPem: string) {
  if (!certPem) return null;
  const x509 = new X509();
  try {
    x509.readCertPEM(certPem);
    const issuer = formatDn(x509.getIssuerString());
    const subject = formatDn(x509.getSubjectString());
    const notBefore = x509.getNotBefore();
    const notAfter = x509.getNotAfter();
    const serialNumber = x509.getSerialNumberHex();
    let sigAlg = x509.getSignatureAlgorithmName() || '-';
    let keyType = '-';
    // 提取公钥算法 OID
    try {
      const ASN1HEX = (window as any).ASN1HEX || (x509 as any).constructor?.ASN1HEX;
      let oidHex = '';
      try { oidHex = (x509 as any).hex ? (window as any).ASN1HEX?.getVbyList((x509 as any).hex, 0, [0, 6, 0, 0]) : ''; } catch (e) {}
      if (!oidHex) {
        try { oidHex = (window as any).ASN1HEX?.getVbyList((x509 as any).hex, 0, [0, 5, 0, 0]); } catch (e) {}
      }
      if (oidHex) {
        const oid = (window as any).ASN1HEX?.hextooidstr(oidHex) || '';
        const algMap: Record<string, string> = {
          '1.2.156.10197.1.301': 'SM2',
          '1.2.840.10045.2.1': 'ECC',
          '1.2.840.113549.1.1.1': 'RSA',
          '2.16.840.1.101.3.4.3.17': 'ML-DSA-44',
          '2.16.840.1.101.3.4.3.18': 'ML-DSA-65',
          '2.16.840.1.101.3.4.3.19': 'ML-DSA-87',
          '1.3.101.112': 'Ed25519',
          '1.3.101.113': 'Ed448'
        };
        keyType = algMap[oid] || oid;
      }
    } catch (e) {}
    if (keyType === '-') {
      try {
        const pub = x509.getPublicKey();
        if (pub && (pub as any).type) keyType = (pub as any).type;
      } catch (e) {}
    }
    const sigAlgMap: Record<string, string> = {
      '1.2.156.10197.1.501': 'SM3withSM2',
      '1.2.840.113549.1.1.11': 'SHA256withRSA',
      '1.2.840.113549.1.1.5': 'SHA1withRSA',
      '1.2.840.10045.4.3.2': 'SHA256withECDSA',
      '1.2.840.10045.4.3.3': 'SHA384withECDSA',
      '1.2.840.10045.4.3.4': 'SHA512withECDSA',
      '2.16.840.1.101.3.4.3.17': 'ML-DSA-44',
      '2.16.840.1.101.3.4.3.18': 'ML-DSA-65',
      '2.16.840.1.101.3.4.3.19': 'ML-DSA-87'
    };
    sigAlg = sigAlgMap[sigAlg] || sigAlg.replace(/_/g, '');
    return {
      issuer,
      subject,
      notBefore: formatX509Date(notBefore),
      notAfter: formatX509Date(notAfter),
      serialNumber: serialNumber.toUpperCase(),
      pem: certPem,
      keyType,
      sigAlg
    };
  } catch (e) {
    return null;
  }
}

function formatX509Date(zStr: string): string {
  if (!zStr) return '-';
  try {
    let y, m, d, h, min, s;
    if (zStr.length === 13) {
      y = '20' + zStr.substring(0, 2);
      m = parseInt(zStr.substring(2, 4)) - 1;
      d = zStr.substring(4, 6);
      h = zStr.substring(6, 8);
      min = zStr.substring(8, 10);
      s = zStr.substring(10, 12);
    } else {
      y = zStr.substring(0, 4);
      m = parseInt(zStr.substring(4, 6)) - 1;
      d = zStr.substring(6, 8);
      h = zStr.substring(8, 10);
      min = zStr.substring(10, 12);
      s = zStr.substring(12, 14);
    }
    const date = new Date(Date.UTC(y as any, m, d as any, h as any, min as any, s as any));
    return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch (e) {
    return zStr;
  }
}

function resolveCertStatus(item: any) {
  if (item.certStatus) return item.certStatus;
  if (item.status) return item.status;
  if (item.isRevoked === 1) return 'REVOKED';
  if (item.notAfter && new Date(item.notAfter).getTime() < Date.now()) return 'EXPIRED';
  return 'VALID';
}

function resolveCertType(item: any) {
  const profile = profileLookupList.value.find((p: any) => String(p.id) === String(item.profileId));
  const profileType = (profile as any)?.certLevel || (profile as any)?.type;
  if (profileType) return profileType;
  if (item.certType) return item.certType;
  if (Number(item.isEntity) === 1) return 'SUB_CA';
  return 'END_ENTITY';
}

function resolveKeySource(item: any) {
  if (item.keySource) return item.keySource;
  const profile = profileLookupList.value.find((p: any) => String(p.id) === String(item.profileId));
  const profileName = String((profile as any)?.name || '');
  if (profileName.includes('加密') || profileName.toLowerCase().includes('enc')) return 'KMC';
  return '';
}

function getKeySourceLabel(keySource?: string) {
  if (keySource === 'KMC') return 'KMC';
  if (keySource === 'LOCAL') return '本地';
  if (keySource === 'CLIENT') return '客户端';
  return '-';
}

function formatDn(value?: string) {
  if (!value) return '-';
  const text = String(value).trim();
  if (!text) return '-';
  if (text.startsWith('/')) {
    return text.slice(1).split('/').filter(Boolean).join(',');
  }
  return text.replace(/\s*,\s*/g, ',');
}

async function getList() {
  loading.value = true;
  try {
    const pageNum = Number(queryParams.value.pageNum) || 1;
    const pageSize = Number(queryParams.value.pageSize) || 10;
    const res = await pageCert({
      ...queryParams.value,
      pageNum,
      pageSize,
      pageIndex: (pageNum - 1) * pageSize
    });
    const rawList = res.data?.rows || res.data?.records || [];
    total.value = Number(res.data?.total) || 0;
    certList.value = rawList.map((item: any) => {
      const info = parseCertInfo(item.cert);
      return {
        ...item,
        ...info,
        subject: formatDn(info?.subject || item.subject),
        certType: resolveCertType(item),
        keySource: resolveKeySource(item),
        status: resolveCertStatus(item)
      };
    });
  } catch (error: any) {
    ElMessage.error('获取列表失败');
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadRoots(), loadProfiles()]);
  getList();
});
</script>

<style scoped lang="scss">
/* === 签发对话框全局优化 === */
.cert-issue-dialog {
  :deep(.el-dialog__header) {
    padding: 16px 24px 12px;
    border-bottom: 1px solid var(--el-border-color-lighter);
    margin-bottom: 16px;
  }
  :deep(.el-dialog__body) {
    padding: 0 24px 20px;
  }
  :deep(.el-dialog__footer) {
    padding: 12px 24px 16px;
    border-top: 1px solid var(--el-border-color-lighter);
  }
}

.issue-form {
  :deep(.el-select),
  :deep(.el-date-editor.el-input) {
    width: 100%;
  }
}

/* === 顶部配置行 === */
.issue-top-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px 16px;
  align-items: start;
  padding: 12px 16px;
  background: linear-gradient(135deg, var(--el-fill-color-lighter) 0%, var(--el-fill-color-blank) 100%);
  border-radius: 8px;
  margin-bottom: 16px;
  border: 1px solid var(--el-border-color-lighter);
}

/* === 内容区域 === */
.issue-content-grid {
  margin-top: 0;
}

/* === 卡片区域 === */
.form-section {
  margin-bottom: 14px;
  padding: 16px 18px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
}

/* === 区域标题 === */
.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 24px;
  margin-bottom: 14px;
  padding-bottom: 10px;
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
  border-bottom: 2px solid var(--el-color-primary-light-7);
}

/* === USB Key 区域 === */
.usb-key-section {
  border-left: 3px solid var(--el-color-primary);
  padding-left: 16px;
}

.usb-title {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.usb-icon {
  color: var(--el-color-primary);
  flex-shrink: 0;
}

.usb-key-tip {
  margin-bottom: 14px;
  font-size: 13px;
}

/* === 步骤区域 === */
.device-step-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.step-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  margin-top: 8px;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;

  &:first-child {
    margin-top: 0;
  }
}

.step-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.step-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--el-color-primary);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.step-badge-lock {
  background: #e6a23c;
}

.refresh-btn {
  margin-left: auto;
  flex-shrink: 0;
}

/* === 设备监控 === */
.monitoring-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #67c23a;
  font-weight: 500;
  background: #f0f9eb;
  padding: 3px 12px;
  border-radius: 20px;
  border: 1px solid #e1f3d8;
  line-height: 1.4;
}

.pulse-dot {
  width: 7px;
  height: 7px;
  background-color: #67c23a;
  border-radius: 50%;
  position: relative;
  flex-shrink: 0;

  &::after {
    content: '';
    position: absolute;
    top: -2px;
    left: -2px;
    width: 11px;
    height: 11px;
    background-color: #67c23a;
    border-radius: 50%;
    animation: usbPulse 1.8s infinite;
  }
}

@keyframes usbPulse {
  0% {
    transform: scale(0.8);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.6);
    opacity: 0;
  }
  100% {
    transform: scale(0.8);
    opacity: 0.6;
  }
}

/* === 扩展信息 === */
.subject-scroll-area {
  max-height: 360px;
  overflow-y: auto;
  padding-right: 5px;
}

.extension-scroll-area {
  max-height: 320px;
  overflow-y: auto;
  padding-right: 5px;
}

.issue-extension-item {
  padding: 10px 0 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  &:last-child {
    border-bottom: 0;
  }
}

.issue-extension-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.san-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.key-usage-checkbox-group {
  display: grid;
  grid-template-columns: repeat(2, minmax(130px, 1fr));
  gap: 8px 12px;
  :deep(.el-checkbox) {
    margin-right: 0;
    min-height: 24px;
    height: auto;
    white-space: normal;
  }
}

/* === 通用 === */
.issue-step-alert {
  margin-bottom: 12px;
}
.result-section {
  margin-top: 12px;
}
.lifecycle-cert-info {
  margin-bottom: 18px;
}
.lifecycle-form {
  margin-top: 4px;
}
.lifecycle-mode-alert {
  margin-bottom: 12px;
}
.lifecycle-form-tip {
  margin-bottom: 12px;
}
.readonly-field {
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  padding: 8px 10px;
  color: var(--el-text-color-regular);
  min-height: 34px;
  line-height: 18px;
  white-space: pre-wrap;
  word-break: break-all;
}

.result-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 14px;
}
.result-actions :deep(.el-button) {
  margin-left: 0;
  max-width: 100%;
  white-space: normal;
}

.flex-row {
  display: flex;
  align-items: center;
}
.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  .section-h4 {
    margin-bottom: 0;
  }
}
.ml-2 {
  margin-left: 10px;
}
.issue-device-row {
  gap: 10px;
  width: 100%;
}

@media (max-width: 1400px) {
  .issue-top-grid {
    grid-template-columns: 1fr 1fr;
  }
  .issue-content-grid :deep(.el-col) {
    flex: 0 0 100%;
    max-width: 100%;
  }
}
</style>
