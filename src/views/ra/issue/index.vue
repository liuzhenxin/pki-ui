<template>
  <div class="app-container ra-cert-issue-page">
    <div v-show="showSearch" class="query-panel">
      <el-form ref="queryFormRef" :model="queryParams" :inline="true" label-width="72px" class="query-form">
        <el-form-item label="业务类型" prop="businessType">
          <el-select v-model="queryParams.businessType" clearable placeholder="全部业务类型" class="business-type-select">
            <el-option v-for="item in businessTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键字" prop="keyword">
          <el-input v-model="queryParams.keyword" clearable placeholder="用户、部门、序列号或主题" class="keyword-input" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item class="query-actions">
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="RefreshLeft" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="list-toolbar">
      <div class="list-heading">
        <span class="list-title">待签发申请</span>
        <el-tag type="info" effect="plain" round>{{ total }}</el-tag>
      </div>
      <div class="toolbar-actions">
        <right-toolbar v-model:showSearch="showSearch" @queryTable="getList" />
      </div>
    </div>

    <el-table v-loading="loading" :data="rows" border stripe class="issue-table" empty-text="暂无待签发申请">
      <el-table-column label="业务编号" prop="businessId" width="120" align="center" />
      <el-table-column label="业务类型" prop="businessTypeName" width="160" align="center">
        <template #default="{ row }">
          <div class="business-type-cell">
            <span>{{ row.businessTypeName }}</span>
            <el-tag v-if="row.businessType === 'cert_update'" size="small" type="warning" effect="plain">换密钥</el-tag>
            <el-tag v-if="updateKindTag(row)" size="small" effect="plain">{{ updateKindTag(row) }}</el-tag>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="申请用户" prop="userName" min-width="140" show-overflow-tooltip />
      <el-table-column label="所属部门" prop="deptName" min-width="140" show-overflow-tooltip />
      <el-table-column label="原证书序列号" prop="serialNumber" min-width="170" show-overflow-tooltip />
      <el-table-column label="证书主题" prop="subject" min-width="220" show-overflow-tooltip />
      <el-table-column label="证书模板" prop="profileName" min-width="150" show-overflow-tooltip />
      <el-table-column label="申请原因" prop="reason" min-width="160" show-overflow-tooltip />
      <el-table-column label="审核完成时间" prop="submitTime" width="170" align="center">
        <template #default="{ row }">
          <span>{{ parseTime(row.submitTime) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag type="warning">{{ row.issueStatusName || (isExecuteType(row.businessType) ? '待执行' : '待签发') }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="130" fixed="right">
        <template #default="{ row }">
          <el-tooltip :content="isExecuteType(row.businessType) ? '执行' : '签发'" placement="top">
            <el-button link type="primary" :icon="isExecuteType(row.businessType) ? 'VideoPlay' : 'Stamp'" @click="handleIssue(row)" />
          </el-tooltip>
          <el-tooltip content="详情" placement="top">
            <el-button link type="primary" icon="View" @click="handleDetail(row)" />
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <el-dialog v-model="issueOpen" :title="isCertUpdate ? '执行证书更新（换密钥）' : '证书签发'" width="1180px" append-to-body top="3vh" class="cert-issue-dialog" @close="closeIssueDialog">
      <el-alert v-if="isCertUpdate" class="issue-step-alert" title="换密钥：使用新 CSR/公钥签发新序列号证书，旧证书将按 superseded 吊销。" type="warning" show-icon :closable="false" />
      <el-alert v-if="issueStep" class="issue-step-alert" :title="issueStep" type="info" show-icon :closable="false" />
      <el-form ref="issueFormRef" :model="issueForm" :rules="rules" label-width="108px" class="issue-form">
        <div class="issue-top-grid">
          <el-form-item class="issue-type-item" :label="isRsaKmcEncryption ? '分发方式' : 'CSR来源'" prop="issueType">
            <el-segmented v-model="issueForm.issueType" :options="issueTypeOptions" @change="handleIssueTypeChange" />
          </el-form-item>
          <el-form-item label="根证书">
            <el-input :model-value="current.rootName || current.rootId || '-'" disabled />
          </el-form-item>
          <el-form-item label="证书模板">
            <el-input :model-value="current.profileName || '-'" disabled />
          </el-form-item>
        </div>

        <div class="issue-content-grid">
          <aside class="issue-summary-pane">
            <div class="form-section summary-section">
              <div class="section-title">
                <span>申请摘要</span>
                <el-tag type="warning" effect="plain">{{ current.issueStatusName || '待签发' }}</el-tag>
              </div>
              <el-descriptions :column="1" border size="small" class="issue-descriptions">
                <el-descriptions-item label="申请用户">{{ current.userName || '-' }}</el-descriptions-item>
                <el-descriptions-item label="所属部门">{{ current.deptName || '-' }}</el-descriptions-item>
                <el-descriptions-item label="业务类型">{{ current.businessTypeName || '-' }}</el-descriptions-item>
                <el-descriptions-item label="业务编号">{{ current.businessId || '-' }}</el-descriptions-item>
                <el-descriptions-item label="原证书序列号">{{ current.serialNumber || '-' }}</el-descriptions-item>
                <el-descriptions-item label="申请原因">{{ current.reason || '-' }}</el-descriptions-item>
              </el-descriptions>
            </div>
          </aside>

          <div class="issue-params-pane">
            <div class="form-section params-section">
              <div class="section-title">签发参数</div>
              <el-alert v-if="dualCertInfo?.certMode === 'dual' && isPostQuantumDual" class="dual-cert-alert" type="info" :closable="false" show-icon>
                <template #title>
                  抗量子双证书{{ isCertUpdate ? '更新' : '签发' }}：ML-DSA 签名密钥由客户端生成并提交 CSR；ML-KEM 加密私钥由 KMC 永久托管，不支持 USBKey
                </template>
              </el-alert>
              <el-alert v-else-if="dualCertInfo?.certMode === 'dual' && supportsDualRoot" class="dual-cert-alert" type="success" :closable="false" show-icon>
                <template #title>
                  双证书{{ isCertUpdate ? '更新（换密钥）' : '签发' }}：签名模板「{{ dualCertInfo.signProfileName }}」+ 加密模板「{{ dualCertInfo.encryptProfileName }}」 — 签名侧提交新 CSR，加密侧默认 KMC 换钥
                </template>
              </el-alert>
              <el-alert v-if="dualCertInfo?.certMode === 'dual' && !supportsDualRoot" class="dual-cert-alert" type="error" :closable="false" show-icon>
                <template #title>双证书{{ isCertUpdate ? '更新' : '签发' }}异常：当前根证书算法不支持双证书。</template>
              </el-alert>
              <el-alert v-else-if="isRsaKmcEncryption" class="dual-cert-alert" type="success" :closable="false" show-icon>
                <template #title>{{ isCertUpdate ? 'RSA 加密证书由 KMC 换钥，无需提交 CSR。新证书可写入 USB Key 或导出到文件。' : 'RSA 加密单证：密钥由 KMC 生成，无需提交 CSR。证书可写入 USB Key 或导出到文件。' }}</template>
              </el-alert>
              <el-form-item v-if="issueForm.issueType === 'csr'" label="CSR" prop="csr" class="csr-form-item">
                <el-input v-model="issueForm.csr" type="textarea" :rows="8" placeholder="请输入证书请求CSR" />
              </el-form-item>
              <template v-if="issueForm.issueType === 'usb_key'">
                <el-alert class="usb-key-tip" type="info" show-icon :closable="false" title="请确认 USB Key 已插入，应用已创建，User PIN 正确。" />
                <div class="issue-info-grid">
                  <el-form-item label="设备提供商" prop="provider">
                    <div class="issue-device-row">
                      <el-select v-model="issueForm.provider" placeholder="请选择或刷新" style="flex: 1" @change="onCertProviderChange">
                        <el-option v-for="item in certProviders" :key="item" :label="item" :value="item" />
                      </el-select>
                      <el-button icon="Refresh" circle @click="refreshCertProviders" />
                    </div>
                  </el-form-item>
                  <el-form-item label="设备列表" prop="device">
                    <el-select v-model="issueForm.device" placeholder="请选择设备" @change="onCertDeviceChange">
                      <el-option v-for="item in certDevices" :key="item" :label="item" :value="item" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="应用" prop="appName">
                    <el-select v-model="issueForm.appName" placeholder="请选择应用">
                      <el-option v-for="item in certApps" :key="item" :label="item" :value="item" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="容器名" prop="containerName">
                    <el-input v-model="issueForm.containerName" :placeholder="isCertUpdate ? '请输入新容器名，禁止使用原容器' : '请输入或使用自动生成的容器名'" />
                  </el-form-item>
                  <el-form-item label="User PIN" prop="pin">
                    <el-input v-model="issueForm.pin" type="password" show-password placeholder="请输入 USBKey User PIN" />
                  </el-form-item>
                </div>
              </template>
              <template v-else-if="issueForm.issueType === 'file'">
                <div class="issue-info-grid compact">
                  <el-form-item label="文件格式" prop="fileFormat">
                    <el-radio-group v-model="issueForm.fileFormat">
                      <el-radio-button value="PKCS12">PKCS12</el-radio-button>
                    </el-radio-group>
                  </el-form-item>
                  <el-form-item label="文件密码" prop="filePassword">
                    <el-input v-model="issueForm.filePassword" type="password" show-password placeholder="请输入 P12 文件密码" />
                  </el-form-item>
                </div>
              </template>

              <div v-if="!isCertUpdate" class="issue-extension-section">
                <div class="section-subtitle">证书主题</div>
                <template v-if="issueForm.issueType !== 'csr'">
                  <div v-if="issueForm.subjectItems.length > 0" class="subject-scroll-area">
                    <CertSubject v-model="issueForm.subjectItems" propPrefix="subjectItems" />
                  </div>
                  <el-form-item v-else label="证书主题" prop="subject">
                    <el-input v-model="issueForm.subject" clearable placeholder="请输入证书主题，例如：CN=user,O=org,C=CN" />
                  </el-form-item>
                </template>
                <el-descriptions v-else :column="1" border size="small" class="issue-descriptions">
                  <el-descriptions-item label="证书主题">{{ current.subject || '-' }}</el-descriptions-item>
                </el-descriptions>
              </div>

              <div v-if="!isCertUpdate" class="issue-extension-section">
                <div class="section-subtitle">扩展信息</div>
                <div v-if="issueForm.extensionItems.length > 0" class="extension-scroll-area">
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
                        <el-checkbox v-for="usage in keyUsageOptions" :key="usage.value" :value="usage.value">
                          {{ usage.label }}
                        </el-checkbox>
                      </el-checkbox-group>
                    </template>
                    <template v-else-if="ext.kind === 'extendedKeyUsage'">
                      <el-checkbox-group v-model="ext.usages" class="key-usage-checkbox-group">
                        <el-checkbox v-for="usage in extendedKeyUsageOptions" :key="usage.value" :value="usage.value">
                          {{ usage.label }}
                        </el-checkbox>
                      </el-checkbox-group>
                    </template>
                    <template v-else>
                      <el-input v-model="ext.value" type="textarea" :rows="3" :placeholder="`请输入 ${ext.label} 的 JSON 或文本值`" />
                    </template>
                  </div>
                </div>
                <el-empty v-else description="无扩展信息" :image-size="64" />
              </div>
            </div>
          </div>
        </div>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="issueOpen = false">取消</el-button>
          <el-button type="primary" icon="Stamp" :loading="submitLoading" @click="submitIssue">{{ isCertUpdate ? '确认更新' : '确认签发' }}</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="renewalOpen" title="执行证书续期" width="860px" append-to-body class="renewal-dialog">
      <el-alert title="续期保留原密钥、公钥、主体、扩展和序列号，仅更新有效期。" type="info" show-icon :closable="false" />
      <el-descriptions :column="2" border class="mt-4">
        <el-descriptions-item label="原证书序列号">{{ current.serialNumber || '-' }}</el-descriptions-item>
        <el-descriptions-item label="证书类型">{{ renewalTargets.length > 1 ? '双证书' : '单证书' }}</el-descriptions-item>
        <el-descriptions-item label="新生效时间">{{ renewalConf.notBefore || '保持原生效时间' }}</el-descriptions-item>
        <el-descriptions-item label="新失效时间">{{ renewalConf.notAfter || '-' }}</el-descriptions-item>
      </el-descriptions>

      <div class="renewal-storage-heading">
        <span>原存储方式</span>
        <el-button v-if="hasRenewalUsbTarget" icon="Refresh" :loading="renewalCheckLoading" @click="checkRenewalStorage(false)">
          检测原存储介质
        </el-button>
      </div>
      <div class="renewal-target-list">
        <div v-for="(target, index) in renewalTargets" :key="target.certId || target.serialNumber || index" class="renewal-target">
          <div class="renewal-target-title">
            <span>{{ target.role === 'PAIRED' ? '配对证书' : '主证书' }} · {{ target.serialNumber || '-' }}</span>
            <el-tag :type="renewalTargetReady(target) ? 'success' : 'danger'" effect="plain">
              {{ renewalTargetReady(target) ? '条件满足' : '条件不满足' }}
            </el-tag>
          </div>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="存储方式">{{ storageTypeName(target.storageType) }}</el-descriptions-item>
            <el-descriptions-item label="密钥来源">{{ keySourceName(target.keySource) }}</el-descriptions-item>
            <el-descriptions-item v-if="target.storageType === 'USB_KEY'" label="设备提供商">
              {{ target.storageInfo?.provider || '-' }}
            </el-descriptions-item>
            <el-descriptions-item v-if="target.storageType === 'USB_KEY'" label="设备">
              {{ target.storageInfo?.device || '-' }}
            </el-descriptions-item>
            <el-descriptions-item v-if="target.storageType === 'USB_KEY'" label="应用">
              {{ target.storageInfo?.application || '-' }}
            </el-descriptions-item>
            <el-descriptions-item v-if="target.storageType === 'USB_KEY'" label="原容器">
              {{ target.storageInfo?.container || '-' }}
            </el-descriptions-item>
            <el-descriptions-item v-if="target.storageType === 'RA'" label="托管私钥">
              {{ target.hasManagedPrivateKey ? '已保存' : '缺失' }}
            </el-descriptions-item>
            <el-descriptions-item label="校验说明" :span="2">
              {{ renewalTargetMessage(target) }}
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </div>

      <template v-if="hasRenewalUsbTarget">
        <div class="renewal-storage-heading">
          <span>续期证书签发与写入位置</span>
          <el-tag type="primary" effect="plain">USBKey</el-tag>
        </div>
        <div class="renewal-target-list">
          <div
            v-for="(target, index) in renewalUsbTargets"
            :key="`renewed-${target.certId || target.serialNumber || index}`"
            class="renewal-target renewal-write-target"
          >
            <div class="renewal-target-title">
              <span>{{ renewalTargetName(target) }}</span>
              <el-tag type="info" effect="plain">写回原容器</el-tag>
            </div>
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="续期证书存储">USBKey</el-descriptions-item>
              <el-descriptions-item label="密钥处理">保留原容器私钥</el-descriptions-item>
              <el-descriptions-item label="设备提供商">{{ target.storageInfo?.provider || '-' }}</el-descriptions-item>
              <el-descriptions-item label="设备">{{ target.storageInfo?.device || '-' }}</el-descriptions-item>
              <el-descriptions-item label="应用">{{ target.storageInfo?.application || '-' }}</el-descriptions-item>
              <el-descriptions-item label="目标容器">{{ target.storageInfo?.container || '-' }}</el-descriptions-item>
              <el-descriptions-item label="写入规则" :span="2">CA 签发成功后，将续期证书写入该原容器，不生成新密钥。</el-descriptions-item>
            </el-descriptions>
          </div>
        </div>
      </template>

      <template v-if="hasRenewalRaTarget">
        <div class="renewal-storage-heading">
          <span>续期证书托管与下载</span>
          <el-tag type="success" effect="plain">RA 私钥托管</el-tag>
        </div>
        <div class="renewal-target-list">
          <div
            v-for="(target, index) in renewalRaTargets"
            :key="`renewed-ra-${target.certId || target.serialNumber || index}`"
            class="renewal-target renewal-ra-target"
          >
            <div class="renewal-target-title">
              <span>{{ renewalTargetName(target) }}</span>
              <el-tag type="info" effect="plain">下载 PKCS#12</el-tag>
            </div>
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="续期证书存储">RA 托管</el-descriptions-item>
              <el-descriptions-item label="密钥处理">保留原托管私钥</el-descriptions-item>
              <el-descriptions-item label="托管状态">{{ target.hasManagedPrivateKey ? '私钥可用' : '私钥缺失' }}</el-descriptions-item>
              <el-descriptions-item label="下载格式">PKCS#12（.p12）</el-descriptions-item>
            </el-descriptions>
          </div>
        </div>
      </template>

      <el-alert
        class="mt-4"
        :title="renewalReadyMessage"
        :type="renewalCanSubmit ? 'success' : renewalStaticReady ? 'warning' : 'error'"
        show-icon
        :closable="false"
      />
      <el-alert v-if="renewalStep" class="mt-4" :title="renewalStep" type="info" show-icon :closable="false" />
      <el-form v-if="hasRenewalUsbTarget" label-width="100px" class="mt-4">
        <el-form-item label="User PIN" required>
          <el-input v-model="renewalPin" type="password" show-password placeholder="请输入原 USBKey User PIN" />
        </el-form-item>
      </el-form>
      <el-form v-if="hasRenewalRaTarget" label-width="112px" class="mt-4">
        <el-form-item label="导出口令" required :error="renewalPkcs12PasswordError">
          <el-input
            v-model="renewalPkcs12Password"
            type="password"
            show-password
            autocomplete="new-password"
            placeholder="请设置至少 8 个字符的 PKCS#12 导出口令"
          />
        </el-form-item>
        <el-form-item label="确认口令" required :error="renewalPkcs12ConfirmError">
          <el-input
            v-model="renewalPkcs12ConfirmPassword"
            type="password"
            show-password
            autocomplete="new-password"
            placeholder="请再次输入导出口令"
          />
        </el-form-item>
      </el-form>
      <el-checkbox v-if="hasRenewalClientTarget" v-model="renewalClientConfirmed" class="renewal-client-confirm">
        已确认原客户端私钥仍然存在且可用
      </el-checkbox>
      <template #footer>
        <el-button @click="renewalOpen = false">取消</el-button>
        <el-button type="primary" icon="Timer" :loading="submitLoading" :disabled="!renewalCanSubmit" @click="submitRenewal">确认续期</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="issueResultOpen" title="证书签发结果" width="920px" append-to-body class="issue-result-dialog">
      <el-descriptions :column="2" border class="result-section">
        <el-descriptions-item label="证书ID">{{ issueResult.certId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="序列号">{{ issueResult.serialNumber || '-' }}</el-descriptions-item>
        <el-descriptions-item label="证书主题" :span="2">{{ issueResult.subject || '-' }}</el-descriptions-item>
      </el-descriptions>
      <div v-if="issueResult.storageType === 'USB_KEY' || issueResult.encStorageType === 'USB_KEY'" class="renewal-result-storage">
        <el-alert title="续期证书已写入 USBKey" type="success" show-icon :closable="false" />
        <el-descriptions :column="2" border size="small" class="mt-4">
          <template v-if="issueResult.storageType === 'USB_KEY'">
            <el-descriptions-item label="签名证书应用">{{ issueResultStorageInfo.application || '-' }}</el-descriptions-item>
            <el-descriptions-item label="签名证书容器">{{ issueResultStorageInfo.container || '-' }}</el-descriptions-item>
          </template>
          <template v-if="issueResult.encStorageType === 'USB_KEY'">
            <el-descriptions-item label="加密证书应用">{{ issueResultEncStorageInfo.application || '-' }}</el-descriptions-item>
            <el-descriptions-item label="加密证书容器">{{ issueResultEncStorageInfo.container || '-' }}</el-descriptions-item>
          </template>
        </el-descriptions>
      </div>
      <el-alert
        v-if="issueResult.storageType === 'CLIENT' || issueResult.encStorageType === 'CLIENT'"
        class="renewal-result-storage"
        title="续期证书已自动下载；原私钥仍由客户端持有。"
        type="success"
        show-icon
        :closable="false"
      />
      <el-alert
        v-if="issueResult.storageType === 'RA' || issueResult.encStorageType === 'RA'"
        class="renewal-result-storage"
        :title="renewalRaDownloadStatus === 'success' ? '续期证书保持 RA 私钥托管，PKCS#12 已自动下载。' : '续期证书保持 RA 私钥托管。'"
        :type="renewalRaDownloadStatus === 'error' ? 'warning' : 'success'"
        show-icon
        :closable="false"
      />
      <div class="result-actions">
        <el-button icon="CopyDocument" @click="copyCert(issueResult.cert)">复制证书</el-button>
        <el-button type="primary" icon="Download" @click="downloadCert(issueResult)">下载证书</el-button>
        <el-button v-if="issueResult.certificateChain" icon="Download" @click="downloadCertPem(issueResult.certificateChain, 'certificate-chain')">
          下载证书链
        </el-button>
        <el-button v-if="issueResult.fileBase64" type="success" icon="Download" @click="downloadKeyStore(issueResult)"
          >下载{{ issueResult.fileFormat }}</el-button
        >
      </div>
      <el-input v-model="issueResult.cert" type="textarea" :rows="10" readonly class="cert-result-textarea" />
      <div v-if="issueResult.encCert" class="encryption-result">
        <el-divider content-position="left">加密证书</el-divider>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="加密证书ID">{{ issueResult.encCertId || '-' }}</el-descriptions-item>
          <el-descriptions-item label="加密序列号">{{ issueResult.encSerialNumber || '-' }}</el-descriptions-item>
        </el-descriptions>
        <div class="encryption-actions">
          <el-button icon="CopyDocument" @click="copyCert(issueResult.encCert)">复制加密证书</el-button>
          <el-button type="primary" icon="Download" @click="downloadCertPem(issueResult.encCert, issueResult.encSerialNumber || 'enc-cert')"
            >下载加密证书</el-button
          >
        </div>
        <el-input v-model="issueResult.encCert" type="textarea" :rows="8" readonly class="cert-result-textarea" />
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="issueResultOpen = false">关闭</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="detailOpen" title="待签发详情" width="720px" append-to-body>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="业务类型">{{ detail.businessTypeName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="业务编号">{{ detail.businessId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="申请用户">{{ detail.userName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="所属部门">{{ detail.deptName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="原证书序列号">{{ detail.serialNumber || '-' }}</el-descriptions-item>
        <el-descriptions-item label="证书主题">{{ detail.subject || '-' }}</el-descriptions-item>
        <el-descriptions-item label="根证书">{{ detail.rootName || detail.rootId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="证书模板">{{ detail.profileName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="申请原因">{{ detail.reason || '-' }}</el-descriptions-item>
        <el-descriptions-item label="CSR">
          <pre class="csr-preview">{{ detail.csr || '-' }}</pre>
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup name="RaCertIssue" lang="ts">
import { ElMessage, FormInstance, FormRules } from 'element-plus';
import {
  confirmRaRenewalDistribution,
  executeRaCert,
  getRaCertIssue,
  issueRaCert,
  pageRaCertIssue,
  RaCertIssue,
  RaCertIssueResult,
  DualCertIssueInfo
} from '@/api/ra/certIssue';
import { downloadRaPkcs12 } from '@/api/ra/cert';
import CertSubject, { typeMapping, sortSubjectItems } from '@/components/CertSubject/index.vue';
import { parseJson } from '@/utils/json';
import SKFClient from '@/api/skf/skf_api';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const businessTypeOptions = [
  { label: '证书申请', value: 'cert_apply' },
  { label: '证书补办', value: 'cert_reissue' },
  { label: '证书续签', value: 'cert_renewal' },
  { label: '证书更新', value: 'cert_update' }
];

const rows = ref<RaCertIssue[]>([]);
const loading = ref(false);
const submitLoading = ref(false);
const showSearch = ref(true);
const total = ref(0);
const issueOpen = ref(false);
const detailOpen = ref(false);
const issueResultOpen = ref(false);
const renewalOpen = ref(false);
const renewalPin = ref('');
const renewalStep = ref('');
const renewalPkcs12Password = ref('');
const renewalPkcs12ConfirmPassword = ref('');
const renewalRaDownloadStatus = ref<'idle' | 'success' | 'error'>('idle');
const renewalClientConfirmed = ref(false);
const renewalCheckLoading = ref(false);
const renewalUsbChecks = ref<Record<string, { ready: boolean; message: string }>>({});
const issueStep = ref('');
const current = ref<Partial<RaCertIssue>>({});
const detail = ref<Partial<RaCertIssue>>({});
const issueResult = ref<Partial<RaCertIssueResult>>({});
const issueResultStorageInfo = computed<any>(() => parseJson(issueResult.value.storageInfo || '{}') || {});
const issueResultEncStorageInfo = computed<any>(() => parseJson(issueResult.value.encStorageInfo || '{}') || {});
const dualCertInfo = ref<DualCertIssueInfo | null>(null);
const renewalConf = computed<any>(() => parseJson(String(current.value.conf || '{}')) || {});
interface RenewalStorageTarget {
  role?: 'PRIMARY' | 'PAIRED';
  certId?: string | number;
  serialNumber?: string;
  keySource?: string;
  storageType?: string;
  storageInfo?: Record<string, any>;
  hasManagedPrivateKey?: boolean;
  ready?: boolean;
  message?: string;
}
const renewalTargets = computed<RenewalStorageTarget[]>(() => {
  if (Array.isArray(renewalConf.value.targets) && renewalConf.value.targets.length) return renewalConf.value.targets;
  return [
    {
      role: 'PRIMARY',
      certId: current.value.oldCertId,
      serialNumber: current.value.serialNumber,
      storageType: renewalConf.value.storageType,
      storageInfo: renewalConf.value.storageInfo || {},
      ready: Boolean(renewalConf.value.storageType),
      message: renewalConf.value.storageType ? '使用原存储方式续期' : '缺少原存储方式'
    }
  ];
});
const renewalStaticReady = computed(() => renewalConf.value.ready !== false && renewalTargets.value.every((target) => target.ready !== false));
const hasRenewalUsbTarget = computed(() => renewalTargets.value.some((target) => target.storageType === 'USB_KEY'));
const renewalUsbTargets = computed(() => renewalTargets.value.filter((target) => target.storageType === 'USB_KEY'));
const hasRenewalRaTarget = computed(() => renewalTargets.value.some((target) => target.storageType === 'RA'));
const renewalRaTargets = computed(() => renewalTargets.value.filter((target) => target.storageType === 'RA'));
const hasRenewalClientTarget = computed(() => renewalTargets.value.some((target) => target.storageType === 'CLIENT'));
const renewalPkcs12PasswordError = computed(() => {
  if (!renewalPkcs12Password.value) return '';
  return renewalPkcs12Password.value.length < 8 ? '导出口令至少 8 个字符' : '';
});
const renewalPkcs12ConfirmError = computed(() => {
  if (!renewalPkcs12ConfirmPassword.value) return '';
  return renewalPkcs12ConfirmPassword.value !== renewalPkcs12Password.value ? '两次输入的口令不一致' : '';
});
const renewalPkcs12Ready = computed(
  () => !hasRenewalRaTarget.value || (renewalPkcs12Password.value.length >= 8 && renewalPkcs12ConfirmPassword.value === renewalPkcs12Password.value)
);
const renewalUsbReady = computed(() =>
  renewalTargets.value
    .filter((target) => target.storageType === 'USB_KEY')
    .every((target) => renewalUsbChecks.value[renewalTargetKey(target)]?.ready === true)
);
const renewalCanSubmit = computed(
  () =>
    renewalStaticReady.value &&
    (!hasRenewalUsbTarget.value || (Boolean(renewalPin.value) && renewalUsbReady.value)) &&
    renewalPkcs12Ready.value &&
    (!hasRenewalClientTarget.value || renewalClientConfirmed.value)
);
const renewalReadyMessage = computed(() => {
  if (!renewalStaticReady.value) return renewalConf.value.readinessMessage || '原存储信息不完整，不能执行续期';
  if (hasRenewalUsbTarget.value && !renewalUsbReady.value) return '请连接原 USBKey，并检测原设备、应用和容器';
  if (hasRenewalRaTarget.value && !renewalPkcs12Ready.value) return '请设置并确认至少 8 个字符的 PKCS#12 导出口令';
  if (hasRenewalClientTarget.value && !renewalClientConfirmed.value) return '请确认原客户端私钥仍然存在且可用';
  return '已具备按原存储方式续期的条件';
});
const isPostQuantumDual = computed(() => {
  if (current.value.businessType === 'cert_update') {
    const kind = String(updateConf.value.updateKind || '');
    if (kind === 'pq-dual') return true;
    if (kind === 'pq-single') return false;
  }
  if (dualCertInfo.value?.certMode !== 'dual') return false;
  const text =
    `${current.value.rootName || ''} ${dualCertInfo.value.signProfileName || ''} ${dualCertInfo.value.encryptProfileName || ''} ${current.value.profileConf || ''}`.toUpperCase();
  return text.includes('ML-DSA') || text.includes('MLDSA') || text.includes('ML-KEM') || text.includes('MLKEM');
});
const isCertUpdate = computed(() => current.value.businessType === 'cert_update');
const updateConf = computed<any>(() => parseJson(String(current.value.conf || '{}')) || {});
const isPostQuantumUpdate = computed(() => {
  const kind = String(updateConf.value.updateKind || '');
  return kind === 'pq-dual' || kind === 'pq-single' || Boolean(updateConf.value.postQuantum) || isPostQuantumDual.value;
});
const supportsDualRoot = computed(() => {
  const rootName = (current.value.rootName || '').toUpperCase();
  return isPostQuantumDual.value || rootName.includes('SM2') || rootName.includes('ML-DSA') || rootName.includes('MLDSA');
});
const isRsaKmcEncryption = computed(() => {
  if (dualCertInfo.value?.certMode === 'dual') {
    return false;
  }
  const conf = parseJson(String(current.value.conf || '{}')) || {};
  if (String(conf.updateKind || '') === 'rsa-kmc-enc') {
    return true;
  }
  const rsaRoot = String(conf.rootAlgorithm || current.value.rootName || '')
    .toUpperCase()
    .includes('RSA');
  if (!rsaRoot) {
    return false;
  }
  if (String(conf.certUsage || '').toUpperCase() === 'ENCRYPTION' && String(conf.keySource || '').toUpperCase() === 'KMC') {
    return true;
  }
  return isEncryptionProfileConf(current.value.profileConf, current.value.profileName);
});
const queryFormRef = ref<FormInstance>();
const issueFormRef = ref<FormInstance>();
const certProviders = ref<string[]>([]);
const certDevices = ref<string[]>([]);
const certApps = ref<string[]>([]);
let skfClientPromise: Promise<any> | null = null;

const issueTypeOptions = computed(() => {
  if (isRsaKmcEncryption.value) {
    return [
      { label: 'USB Key', value: 'usb_key' },
      { label: '签发到文件', value: 'file' }
    ];
  }
  return [
    { label: 'CSR', value: 'csr' },
    { label: 'USB Key', value: 'usb_key', disabled: isPostQuantumUpdate.value },
    { label: '签发到文件', value: 'file', disabled: isPostQuantumUpdate.value }
  ];
});

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

const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  businessType: '',
  keyword: ''
});

const issueForm = reactive({
  issueType: 'csr' as 'csr' | 'usb_key' | 'file',
  csr: '',
  subject: '',
  subjectItems: [] as any[],
  extensionItems: [] as any[],
  provider: '',
  device: '',
  appName: '',
  containerName: '',
  pin: '',
  fileFormat: 'PKCS12' as const,
  filePassword: ''
});

const rules: FormRules = {
  issueType: [{ required: true, message: '请选择签发方式', trigger: 'change' }],
  csr: [
    {
      validator: (_rule, value, callback) => {
        if (isRsaKmcEncryption.value || issueForm.issueType !== 'csr') {
          callback();
          return;
        }
        if (!String(value || '').trim()) {
          callback(new Error('CSR不能为空'));
          return;
        }
        callback();
      },
      trigger: 'blur'
    }
  ],
  subject: [
    {
      validator: (_rule, value, callback) => {
        if ((issueForm.issueType !== 'csr' || isRsaKmcEncryption.value) && issueForm.subjectItems.length === 0 && !String(value || '').trim()) {
          if (isCertUpdate.value) {
            callback();
            return;
          }
          callback(new Error('证书主题不能为空'));
          return;
        }
        callback();
      },
      trigger: 'blur'
    }
  ],
  provider: [{ required: true, message: '请选择设备提供商', trigger: 'change' }],
  device: [{ required: true, message: '请选择设备', trigger: 'change' }],
  appName: [{ required: true, message: '请选择应用', trigger: 'change' }],
  containerName: [{ required: true, message: '请输入容器名', trigger: 'blur' }],
  pin: [{ required: true, message: '请输入User PIN', trigger: 'blur' }],
  fileFormat: [{ required: true, message: '请选择文件格式', trigger: 'change' }],
  filePassword: [{ required: true, message: '请输入文件密码', trigger: 'blur' }]
};

function parsePage(res: any) {
  const page = res.data || res;
  return {
    rows: page.rows || page.records || [],
    total: page.total || 0
  };
}

function updateKindTag(row: RaCertIssue) {
  if (row.businessType !== 'cert_update') return '';
  const kind = String((parseJson(String(row.conf || '{}')) || {}).updateKind || '');
  if (kind.endsWith('-dual')) return '双证';
  if (kind === 'rsa-kmc-enc') return 'RSA-KMC';
  if (kind.startsWith('pq-')) return '抗量子';
  return '';
}

async function getList() {
  loading.value = true;
  try {
    const res = await pageRaCertIssue({
      pageNum: queryParams.pageNum,
      pageSize: queryParams.pageSize,
      businessType: queryParams.businessType || undefined,
      keyword: queryParams.keyword || undefined
    });
    const page = parsePage(res);
    rows.value = page.rows;
    total.value = page.total;
  } finally {
    loading.value = false;
  }
}

function handleQuery() {
  queryParams.pageNum = 1;
  getList();
}

function resetQuery() {
  queryFormRef.value?.resetFields();
  queryParams.businessType = '';
  queryParams.keyword = '';
  handleQuery();
}

function isExecuteType(_type?: string) {
  return false;
}

async function handleExecute(row: RaCertIssue) {
  try {
    await proxy?.$modal.confirm(`确认对证书 ${row.serialNumber || '-'} 执行${row.businessTypeName || '该操作'}？执行后将立即调用 CA。`);
  } catch {
    return;
  }
  loading.value = true;
  try {
    const res = await executeRaCert(row.businessType, row.businessId);
    proxy?.$modal.msgSuccess(`执行成功，证书序列号：${res.data?.serialNumber || row.serialNumber || '-'}`);
    await getList();
  } finally {
    loading.value = false;
  }
}

async function handleIssue(row: RaCertIssue) {
  if (isExecuteType(row.businessType)) {
    await handleExecute(row);
    return;
  }
  const res = await getRaCertIssue(row.businessType, row.businessId);
  current.value = res.data || row;
  if (current.value.businessType === 'cert_renewal') {
    renewalPin.value = '';
    renewalStep.value = '';
    renewalPkcs12Password.value = '';
    renewalPkcs12ConfirmPassword.value = '';
    renewalRaDownloadStatus.value = 'idle';
    renewalClientConfirmed.value = false;
    renewalUsbChecks.value = {};
    renewalOpen.value = true;
    if (hasRenewalUsbTarget.value && renewalStaticReady.value) {
      nextTick(() => checkRenewalStorage(false));
    }
    return;
  }
  // 解析conf中的双证书信息
  dualCertInfo.value = null;
  if (current.value.conf) {
    try {
      const confData = typeof current.value.conf === 'string' ? JSON.parse(current.value.conf) : current.value.conf;
      if (confData?.certMode === 'dual' || String(confData?.updateKind || '').endsWith('-dual')) {
        dualCertInfo.value = {
          certMode: 'dual',
          signProfileId: confData.signProfileId || current.value.profileId,
          signProfileName: confData.signProfileName || current.value.profileName,
          encryptProfileId: confData.encryptProfileId,
          encryptProfileName: confData.encryptProfileName
        };
      }
    } catch (e) {
      /* ignore parse error */
    }
  }
  resetIssueForm();
  issueForm.csr = current.value.csr || '';
  issueForm.subject = current.value.subject || '';
  issueForm.subjectItems = buildSubjectItems(current.value.profileConf, current.value.subject);
  issueForm.extensionItems = buildIssueExtensionItems(parseJson(current.value.profileConf || '{}')?.extensions || []);
  if (isPostQuantumUpdate.value) {
    issueForm.issueType = 'csr';
  } else if (isRsaKmcEncryption.value) {
    issueForm.issueType = 'usb_key';
  }
  issueStep.value = '';
  issueOpen.value = true;
  if (issueForm.issueType === 'usb_key') {
    await refreshCertProviders();
  }
}

async function submitRenewal() {
  if (!current.value.businessId) return;
  if (!renewalStaticReady.value) {
    ElMessage.error(renewalReadyMessage.value);
    return;
  }
  if (hasRenewalClientTarget.value && !renewalClientConfirmed.value) {
    ElMessage.warning('请确认原客户端私钥仍然存在且可用');
    return;
  }
  if (hasRenewalRaTarget.value && !renewalPkcs12Ready.value) {
    ElMessage.warning('请设置并确认至少 8 个字符的 PKCS#12 导出口令');
    return;
  }
  if (hasRenewalUsbTarget.value) {
    if (!renewalPin.value) {
      ElMessage.warning('请输入 USBKey User PIN');
      return;
    }
    renewalStep.value = '正在验证原 USBKey、目标容器和 User PIN...';
    const ready = await checkRenewalStorage(true);
    if (!ready) {
      renewalStep.value = '原 USBKey 条件验证失败，请根据校验说明处理后重试';
      return;
    }
  }
  submitLoading.value = true;
  let renewalId: string | number = current.value.businessId;
  try {
    renewalStep.value = '原存储条件验证通过，正在向 CA 发起续期签发...';
    const res = await issueRaCert('cert_renewal', renewalId, {
      originalPrivateKeyConfirmed: hasRenewalClientTarget.value ? renewalClientConfirmed.value : undefined
    });
    const result = res.data;
    if (!result) throw new Error('续期接口未返回证书');
    renewalId = result.renewalId || renewalId;
    if (result.storageType === 'USB_KEY') {
      renewalStep.value = `CA 已完成签发，正在写入签名证书到 ${storageLocationText(result.storageInfo)}...`;
      await writeRenewedUsbCert(result.storageInfo, result.cert, true);
    }
    if (result.encStorageType === 'USB_KEY' && result.encCert) {
      renewalStep.value = `正在写入加密证书到 ${storageLocationText(result.encStorageInfo)}...`;
      await writeRenewedUsbCert(result.encStorageInfo, result.encCert, false);
    }
    if (result.storageType === 'RA' || result.encStorageType === 'RA') {
      renewalStep.value = 'CA 已完成签发，正在使用原托管私钥生成 PKCS#12...';
      try {
        await downloadRenewedRaPkcs12(result);
        renewalRaDownloadStatus.value = 'success';
      } catch (error: any) {
        renewalRaDownloadStatus.value = 'error';
        ElMessage.warning(`续期成功，但 PKCS#12 自动下载失败：${error?.message || '请在证书列表中重新下载'}`);
      }
    }
    renewalStep.value = '续期证书分发处理完成，正在确认结果...';
    await confirmRaRenewalDistribution(renewalId, true, '续期证书已完成分发');
    renewalOpen.value = false;
    issueResult.value = result;
    issueResultOpen.value = true;
    const clientDownloaded = downloadRenewedClientCertificates(result);
    ElMessage.success(clientDownloaded ? '证书续期成功，新证书已开始下载' : '证书续期并分发成功');
    await getList();
  } catch (error: any) {
    renewalStep.value = `续期执行失败：${error?.message || '未知错误'}`;
    await confirmRaRenewalDistribution(renewalId, false, error?.message || '续期证书分发失败').catch(() => undefined);
    throw error;
  } finally {
    submitLoading.value = false;
  }
}

function renewalTargetKey(target: RenewalStorageTarget) {
  return String(target.certId || target.serialNumber || target.role || 'target');
}

function renewalTargetName(target: RenewalStorageTarget) {
  return `${target.role === 'PAIRED' ? '配对证书' : '主证书'} · ${target.serialNumber || '-'}`;
}

function storageLocationText(storageJson?: string) {
  const storage = parseJson(storageJson || '{}') || {};
  return `${storage.application || '-'}/${storage.container || '-'}`;
}

function downloadRenewedClientCertificates(result: RaCertIssueResult) {
  const certificates: string[] = [];
  if (result.storageType === 'CLIENT' && result.cert) certificates.push(result.cert.trim());
  if (result.encStorageType === 'CLIENT' && result.encCert) certificates.push(result.encCert.trim());
  if (!certificates.length) return false;

  const serial = result.serialNumber || 'renewed-cert';
  const suffix = certificates.length > 1 ? 'dual-renewed' : 'renewed';
  downloadPemContent(`${certificates.join('\n')}\n`, `${serial}_${suffix}`);
  return true;
}

async function downloadRenewedRaPkcs12(result: RaCertIssueResult) {
  const targets: Array<{ id: string | number; serial: string }> = [];
  if (result.storageType === 'RA' && result.certId) targets.push({ id: result.certId, serial: result.serialNumber || 'renewed-cert' });
  if (result.encStorageType === 'RA' && result.encCertId) {
    targets.push({ id: result.encCertId, serial: result.encSerialNumber || 'renewed-enc-cert' });
  }
  if (!targets.length) return false;
  for (const target of targets) {
    const response = await downloadRaPkcs12(target.id, renewalPkcs12Password.value);
    downloadBlob(toBlob(response, 'application/x-pkcs12'), `${target.serial}_renewed.p12`);
  }
  return true;
}

function toBlob(response: any, mimeType: string) {
  const value = response?.data instanceof Blob ? response.data : response;
  return value instanceof Blob ? value : new Blob([value], { type: mimeType });
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function storageTypeName(storageType?: string) {
  return (
    {
      USB_KEY: 'USBKey（写回原容器）',
      RA: 'RA 托管文件',
      CLIENT: '客户端持有'
    }[String(storageType || '').toUpperCase()] ||
    storageType ||
    '未设置'
  );
}

function keySourceName(keySource?: string) {
  return { USB_KEY: 'USBKey', RA: 'RA 托管', CLIENT: '客户端', KMC: 'KMC 托管' }[String(keySource || '').toUpperCase()] || keySource || '-';
}

function renewalTargetReady(target: RenewalStorageTarget) {
  if (target.ready === false) return false;
  if (target.storageType === 'USB_KEY') return renewalUsbChecks.value[renewalTargetKey(target)]?.ready === true;
  if (target.storageType === 'CLIENT') return renewalClientConfirmed.value;
  return true;
}

function renewalTargetMessage(target: RenewalStorageTarget) {
  const usbCheck = renewalUsbChecks.value[renewalTargetKey(target)];
  return usbCheck?.message || target.message || '-';
}

async function checkRenewalStorage(verifyPin = false) {
  const usbTargets = renewalTargets.value.filter((target) => target.storageType === 'USB_KEY');
  if (!usbTargets.length) return true;
  renewalCheckLoading.value = true;
  const checks: Record<string, { ready: boolean; message: string }> = {};
  const verifiedApps = new Set<string>();
  let firstError = '';
  try {
    skfClientPromise = null;
    const skf = await getSkfClient();
    for (const target of usbTargets) {
      const key = renewalTargetKey(target);
      const storage = target.storageInfo || {};
      try {
        const providers = await withTimeout(skf.enumProvider(), 10000, '获取设备提供商超时');
        if (!providers.includes(storage.provider)) throw new Error(`未找到原设备提供商：${storage.provider || '-'}`);
        const devices = await withTimeout(skf.enumDevice(storage.provider), 10000, '获取 USBKey 设备超时');
        if (!devices.includes(storage.device)) throw new Error(`未找到原 USBKey 设备：${storage.device || '-'}`);
        const applications = await withTimeout(skf.enumApplication(storage.provider, storage.device), 10000, '获取 USBKey 应用超时');
        if (!applications.includes(storage.application)) throw new Error(`未找到原应用：${storage.application || '-'}`);
        const containers = await withTimeout(skf.enumContainer(storage.provider, storage.device, storage.application), 10000, '获取 USBKey 容器超时');
        if (!containers.includes(storage.container)) throw new Error(`未找到原容器：${storage.container || '-'}`);
        const appPath = `${storage.provider}/${storage.device}/${storage.application}`;
        if (verifyPin && !verifiedApps.has(appPath)) {
          const pinValid = await withTimeout(skf.checkPIN(appPath, renewalPin.value), 15000, '验证 PIN 超时');
          if (pinValid === false) throw new Error('USBKey User PIN 验证失败');
          verifiedApps.add(appPath);
        }
        checks[key] = { ready: true, message: verifyPin ? '原容器存在，PIN 验证通过' : '原设备、应用和容器均存在' };
      } catch (error: any) {
        const message = error?.message || String(error) || '原 USBKey 检测失败';
        checks[key] = { ready: false, message };
        if (!firstError) firstError = message;
      }
    }
  } catch (error: any) {
    firstError = error?.message || String(error) || '无法连接 SKF 服务';
    usbTargets.forEach((target) => {
      checks[renewalTargetKey(target)] = { ready: false, message: `无法连接 SKF 服务：${firstError}` };
    });
  } finally {
    renewalUsbChecks.value = checks;
    renewalCheckLoading.value = false;
  }
  if (firstError && verifyPin) ElMessage.error(firstError);
  return !firstError;
}

async function writeRenewedUsbCert(storageJson: string | undefined, cert: string, isSignCert: boolean) {
  const storage = parseJson(storageJson || '{}') || {};
  if (!storage.provider || !storage.device || !storage.application || !storage.container) {
    throw new Error('续期证书缺少原 USBKey 容器信息');
  }
  const skf = await getSkfClient();
  await skf.checkPIN(`${storage.provider}/${storage.device}/${storage.application}`, renewalPin.value);
  await skf.importCertificate(storage.provider, storage.device, storage.application, storage.container, isSignCert, cert);
}

async function handleDetail(row: RaCertIssue) {
  const res = await getRaCertIssue(row.businessType, row.businessId);
  detail.value = res.data || row;
  detailOpen.value = true;
}

function submitIssue() {
  issueFormRef.value?.validate(async (valid) => {
    if (!valid || !current.value.businessType || current.value.businessId === undefined) {
      return;
    }
    if (!isCertUpdate.value && !validateIssueExtensions()) {
      return;
    }
    if (isPostQuantumUpdate.value && issueForm.issueType !== 'csr') {
      ElMessage.error('抗量子证书只支持客户端生成密钥并提交 CSR');
      return;
    }
    if (isRsaKmcEncryption.value && issueForm.issueType === 'csr') {
      ElMessage.error('RSA加密单证由 KMC 生成密钥，请选择 USB Key 或签发到文件');
      return;
    }
    if (isCertUpdate.value && issueForm.issueType === 'usb_key') {
      const oldContainer = String(updateConf.value?.storageInfo?.container || '');
      if (oldContainer && oldContainer === issueForm.containerName) {
        ElMessage.error('USBKey 更新必须使用新容器，禁止覆盖旧容器');
        return;
      }
    }
    submitLoading.value = true;
    issueStep.value = isCertUpdate.value ? '正在调用 CA 执行证书更新（换密钥）...' : '正在调用 CA 执行证书签发...';
    try {
      const subject = resolveIssueSubject();
      let csr = issueForm.csr;
      if (issueForm.issueType === 'usb_key') {
        issueStep.value = '正在连接 SKF 服务并验证 USB Key PIN...';
        const skf = await getSkfClient();
        const appPath = `${issueForm.provider}/${issueForm.device}/${issueForm.appName}`;
        await withTimeout(skf.checkPIN(appPath, issueForm.pin), 15000, '验证 PIN 超时');
        if (!isRsaKmcEncryption.value) {
          issueStep.value = '正在 USB Key 中生成密钥并创建 CSR...';
          const p10Res = await withTimeout(
            skf.createPKCS10(
              issueForm.provider,
              issueForm.device,
              issueForm.appName,
              subject,
              resolveKeyAlgorithm(),
              resolveKeySize(),
              issueForm.containerName
            ),
            30000,
            '生成 CSR 超时'
          );
          csr = p10Res?.pem || p10Res?.csr || p10Res;
        } else {
          issueStep.value = '正在向 CA 申请 KMC 生成的 RSA 加密证书...';
        }
      }
      const res = await issueRaCert(current.value.businessType, current.value.businessId, {
        issueType: issueForm.issueType,
        csr: csr || undefined,
        subject: subject || undefined,
        extensions: buildIssueExtensionsPayload(),
        fileFormat: issueForm.issueType === 'file' ? issueForm.fileFormat : undefined,
        filePassword: issueForm.issueType === 'file' ? issueForm.filePassword : undefined,
        provider: issueForm.issueType === 'usb_key' ? issueForm.provider : undefined,
        device: issueForm.issueType === 'usb_key' ? issueForm.device : undefined,
        application: issueForm.issueType === 'usb_key' ? issueForm.appName : undefined,
        container: issueForm.issueType === 'usb_key' ? issueForm.containerName : undefined
      });
      if (issueForm.issueType === 'usb_key' && res.data?.cert) {
        const skf = await getSkfClient();
        if (isRsaKmcEncryption.value) {
          if (!res.data.encryptionPrivateKey) {
            throw new Error('CA未返回可写入 USBKey 的 RSA 加密私钥材料');
          }
          issueStep.value = '正在写入 KMC RSA 加密密钥对到 USB Key...';
          await withTimeout(
            skf.importKeyPair(
              issueForm.provider,
              issueForm.device,
              issueForm.appName,
              issueForm.containerName,
              'RSA',
              res.data.encryptionPrivateKey,
              ''
            ),
            30000,
            '写入 KMC RSA 加密密钥对超时'
          );
          issueStep.value = '正在写入加密证书到 USB Key...';
          await withTimeout(
            skf.importCertificate(issueForm.provider, issueForm.device, issueForm.appName, issueForm.containerName, false, res.data.cert),
            30000,
            '写入 USB Key 证书超时'
          );
        } else {
          issueStep.value = '正在写入证书到 USB Key...';
          await withTimeout(
            skf.importCertificate(issueForm.provider, issueForm.device, issueForm.appName, issueForm.containerName, true, res.data.cert),
            30000,
            '写入 USB Key 证书超时'
          );
          if (res.data.encCert) {
            if (!res.data.encryptionPrivateKey) {
              throw new Error('CA未返回可写入 USBKey 的加密私钥材料');
            }
            issueStep.value = '正在写入 KMC 加密密钥对到 USB Key...';
            await withTimeout(
              skf.importKeyPair(
                issueForm.provider,
                issueForm.device,
                issueForm.appName,
                issueForm.containerName,
                'SM2',
                res.data.encryptionPrivateKey,
                ''
              ),
              30000,
              '写入 KMC 加密密钥对超时'
            );
            issueStep.value = '正在写入加密证书到 USB Key...';
            await withTimeout(
              skf.importCertificate(issueForm.provider, issueForm.device, issueForm.appName, issueForm.containerName, false, res.data.encCert),
              30000,
              '写入加密证书超时'
            );
          }
        }
      }
      issueStep.value = '证书签发成功，正在刷新待签发列表...';
      issueResult.value = res.data || {};
      proxy?.$modal.msgSuccess(`签发成功，证书序列号：${res.data?.serialNumber || '-'}`);
      issueOpen.value = false;
      issueResultOpen.value = true;
      await getList();
    } finally {
      submitLoading.value = false;
      issueStep.value = '';
    }
  });
}

function closeIssueDialog() {
  issueStep.value = '';
  issueFormRef.value?.clearValidate();
}

function resetIssueForm() {
  issueForm.issueType = 'csr';
  issueForm.csr = '';
  issueForm.subject = '';
  issueForm.subjectItems = [];
  issueForm.extensionItems = [];
  issueForm.provider = '';
  issueForm.device = '';
  issueForm.appName = '';
  issueForm.containerName = `cert-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
  issueForm.pin = '';
  issueForm.fileFormat = 'PKCS12';
  issueForm.filePassword = '';
  certProviders.value = [];
  certDevices.value = [];
  certApps.value = [];
  issueFormRef.value?.clearValidate();
}

async function handleIssueTypeChange(value: string | number | boolean) {
  if (isPostQuantumUpdate.value && value !== 'csr') {
    issueForm.issueType = 'csr';
    ElMessage.warning('抗量子证书不支持 USBKey 或 RA 生成密钥，请提交客户端 CSR');
    return;
  }
  if (isRsaKmcEncryption.value && value === 'csr') {
    issueForm.issueType = 'usb_key';
    ElMessage.warning('RSA加密单证由 KMC 生成密钥，无需提交 CSR');
    return;
  }
  issueForm.issueType = value as any;
  issueFormRef.value?.clearValidate();
  if (issueForm.issueType === 'usb_key') {
    await refreshCertProviders();
  }
}

function buildSubjectItems(profileConf?: string, subject?: string) {
  const conf = parseJson(profileConf || '{}');
  const rdns = conf?.subject?.rdns || (Array.isArray(conf?.subject) ? conf.subject : []);
  if (!Array.isArray(rdns) || rdns.length === 0) {
    return [];
  }
  const subjectMap = parseSubject(subject);
  const items: any[] = [];
  rdns.forEach((rdn: any) => {
    const rdnType = (typeof rdn.type === 'object' ? rdn.type.description : rdn.type) || '';
    let compType = String(rdnType).toLowerCase();
    for (const [type, meta] of Object.entries(typeMapping)) {
      if (meta.key.toLowerCase() === compType || type.toLowerCase() === compType || meta.label.toLowerCase().includes(compType)) {
        compType = type;
        break;
      }
    }
    const count = Math.max(1, rdn.minOccurs === undefined ? 1 : Number(rdn.minOccurs));
    for (let i = 0; i < count; i++) {
      const key = typeMapping[compType]?.key || compType;
      items.push({ type: compType, value: subjectMap[key] || '', minOccurs: rdn.minOccurs, maxOccurs: rdn.maxOccurs, regex: rdn.regex });
    }
  });
  return sortSubjectItems(items);
}

function parseSubject(subject?: string) {
  const map: Record<string, string> = {};
  String(subject || '')
    .split(',')
    .map((item) => item.trim())
    .forEach((item) => {
      const index = item.indexOf('=');
      if (index > 0) {
        map[item.slice(0, index).trim()] = item.slice(index + 1).trim();
      }
    });
  return map;
}

function resolveIssueSubject() {
  if (issueForm.issueType === 'csr' && !isRsaKmcEncryption.value) {
    return issueForm.subject || undefined;
  }
  if (issueForm.subjectItems.length === 0) {
    return issueForm.subject;
  }
  return issueForm.subjectItems
    .filter((item: any) => item.value)
    .map((item: any) => `${typeMapping[item.type]?.key || item.type}=${item.value}`)
    .join(',');
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
  const ext = issueForm.extensionItems[extIndex];
  if (!ext) return;
  ext.names.push({ type: ext.modes?.[0] || 'DNSName', value: '' });
}

function removeSanName(extIndex: number, nameIndex: number) {
  const ext = issueForm.extensionItems[extIndex];
  if (!ext || ext.names.length <= 1) return;
  ext.names.splice(nameIndex, 1);
}

function buildIssueExtensionsPayload() {
  const extensions = (issueForm.extensionItems || [])
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
  for (const ext of issueForm.extensionItems || []) {
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

function resolveKeyAlgorithm() {
  const text = `${current.value.rootName || ''} ${current.value.profileName || ''}`.toUpperCase();
  return text.includes('RSA') ? 'RSA' : 'SM2';
}

function resolveKeySize() {
  const text = `${current.value.rootName || ''} ${current.value.profileName || ''}`.toUpperCase();
  const match = text.match(/RSA[-_ ]?(\d{4})/);
  return resolveKeyAlgorithm() === 'RSA' ? Number(match?.[1] || 2048) : 256;
}

function isEncryptionProfileConf(profileConf?: string, profileName?: string) {
  const name = String(profileName || '');
  const upperName = name.toUpperCase();
  if (name.includes('加密') || upperName.includes('ENCRYPTION') || upperName.includes('TLS_ENC') || upperName.includes('TLS-ENC')) {
    return true;
  }
  let conf: any = {};
  try {
    conf = parseJson(profileConf || '{}') || {};
  } catch {
    conf = {};
  }
  const category = String(conf.profileCategory || conf.certLevel || conf.metadata?.category || '').toUpperCase();
  if (category === 'DUAL_ENC' || category === 'TLS_ENC' || category.includes('ENCRYPTION')) {
    return true;
  }
  if (String(conf.dualCert?.role || '').toUpperCase() === 'ENCRYPTION') {
    return true;
  }
  const usages = collectProfileKeyUsages(conf);
  const hasSign = usages.some((usage) => usage.includes('digitalsignature') || usage.includes('nonrepudiation') || usage.includes('contentcommitment'));
  const hasEnc = usages.some((usage) => usage.includes('encipher') || usage.includes('encrypt'));
  return hasEnc && !hasSign;
}

function collectProfileKeyUsages(conf: any) {
  const usages: string[] = [];
  const push = (value: any) => {
    if (value == null) {
      return;
    }
    if (typeof value === 'string') {
      usages.push(value.toLowerCase());
      return;
    }
    if (typeof value === 'object') {
      const token = String(value.value || value.description || value.oid || '').toLowerCase();
      if (token) {
        usages.push(token);
      }
    }
  };
  if (Array.isArray(conf?.certUsages)) {
    conf.certUsages.forEach(push);
  }
  const extensions = Array.isArray(conf?.extensions) ? conf.extensions : [];
  extensions.forEach((ext: any) => {
    const items = ext?.keyUsage?.usages || ext?.usages;
    if (Array.isArray(items)) {
      items.forEach(push);
    }
  });
  return usages;
}

const getSkfClient = async () => {
  if (skfClientPromise) {
    return skfClientPromise;
  }
  const skf = new SKFClient('ws://127.0.0.1:9001');
  skfClientPromise = skf.connect().then(async () => {
    try {
      await skf.setLanguage('CN');
    } catch (e) {}
    return skf;
  });
  return skfClientPromise;
};

async function refreshCertProviders() {
  certProviders.value = [];
  try {
    issueStep.value = '正在连接 SKF 服务并读取 USB Key 设备...';
    skfClientPromise = null;
    const skf = await getSkfClient();
    certProviders.value = await withTimeout(skf.enumProvider(), 10000, '获取设备提供商超时');
    if (certProviders.value.length > 0) {
      issueForm.provider = certProviders.value[0];
      await onCertProviderChange();
    }
  } catch (e: any) {
    ElMessage.error(`无法连接 SKF 服务: ${e?.message || e || '未知错误'}`);
  } finally {
    issueStep.value = '';
  }
}

async function onCertProviderChange() {
  certDevices.value = [];
  certApps.value = [];
  if (!issueForm.provider) return;
  const skf = await getSkfClient();
  certDevices.value = await withTimeout(skf.enumDevice(issueForm.provider), 10000, '获取设备列表超时');
  issueForm.device = certDevices.value[0] || '';
  if (issueForm.device) {
    await onCertDeviceChange();
  }
}

async function onCertDeviceChange() {
  certApps.value = [];
  if (!issueForm.provider || !issueForm.device) return;
  const skf = await getSkfClient();
  certApps.value = await withTimeout(skf.enumApplication(issueForm.provider, issueForm.device), 10000, '获取应用列表超时');
  issueForm.appName = certApps.value[0] || '';
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

async function copyCert(cert?: string) {
  if (!cert) {
    return;
  }
  await navigator.clipboard.writeText(cert);
  proxy?.$modal.msgSuccess('证书已复制');
}

function downloadCert(result: Partial<RaCertIssueResult>) {
  if (!result.cert) {
    return;
  }
  downloadCertPem(result.cert, result.serialNumber || 'ra-cert');
}

function downloadCertPem(certPem?: string, fileName?: string) {
  if (!certPem) return;
  downloadPemContent(certPem, fileName || 'cert');
}

function downloadPemContent(content: string, fileName: string) {
  const blob = new Blob([content], { type: 'application/x-pem-file;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.pem`;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadKeyStore(result: Partial<RaCertIssueResult>) {
  if (!result.fileBase64) {
    return;
  }
  const binary = atob(result.fileBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = result.fileName || `${result.serialNumber || 'ra-cert'}.p12`;
  link.click();
  URL.revokeObjectURL(url);
}

onMounted(() => {
  getList();
});
</script>

<style scoped lang="scss">
.ra-cert-issue-page {
  display: flex;
  flex-direction: column;
  min-width: 0;

  .query-panel {
    margin-bottom: 12px;
    padding: 14px 16px 0;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
    background: var(--el-fill-color-extra-light);
  }

  .query-form {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;

    :deep(.el-form-item) {
      margin-right: 20px;
      margin-bottom: 14px;
    }
  }

  .business-type-select {
    width: 190px;
  }

  .keyword-input {
    width: 300px;
  }

  .query-actions {
    margin-left: auto;
    margin-right: 0 !important;
  }

  .list-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 42px;
    gap: 16px;
  }

  .list-heading,
  .toolbar-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .list-title {
    color: var(--el-text-color-primary);
    font-size: 15px;
    font-weight: 600;
  }

  .issue-table {
    width: 100%;

    :deep(.el-table__header th) {
      color: var(--el-text-color-regular);
      font-weight: 600;
      background: var(--el-fill-color-light);
    }

    :deep(.el-table__cell) {
      padding: 9px 0;
    }
  }

  .business-type-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .mb16 {
    margin-bottom: 16px;
  }

  .csr-preview {
    max-height: 220px;
    margin: 0;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .issue-step-alert {
    margin-bottom: 12px;
  }

  :global(.cert-issue-dialog) {
    max-width: calc(100vw - 32px);
  }

  :global(.cert-issue-dialog .el-dialog__body) {
    max-height: calc(100vh - 154px);
    overflow: hidden;
    padding: 16px 18px 0;
  }

  :global(.cert-issue-dialog .el-dialog__footer) {
    padding: 12px 18px 16px;
    border-top: 1px solid var(--el-border-color-lighter);
  }

  .issue-form {
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 190px);
    overflow: hidden;

    :deep(.el-select),
    :deep(.el-date-editor.el-input) {
      width: 100%;
    }

    :deep(.el-form-item) {
      margin-bottom: 14px;
    }
  }

  .issue-section-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    min-height: 0;
    overflow: auto;
    padding-right: 2px;
  }

  .issue-info-section,
  .subject-section,
  .extension-section {
    grid-column: 1 / -1;
  }

  .issue-info-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0 16px;

    &.compact {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .csr-form-item {
    margin-top: 2px;
  }

  .issue-descriptions {
    :deep(.el-descriptions__label) {
      width: 112px;
      color: var(--el-text-color-secondary);
      font-weight: 500;
    }

    :deep(.el-descriptions__content) {
      color: var(--el-text-color-primary);
      word-break: break-word;
    }
  }

  .issue-top-grid {
    display: grid;
    grid-template-columns: minmax(300px, 0.9fr) minmax(280px, 1fr) minmax(260px, 1fr);
    gap: 12px 16px;
    align-items: start;
    flex: 0 0 auto;
    padding: 12px 14px 2px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
    background: var(--el-fill-color-lighter);
  }

  .issue-type-item {
    :deep(.el-segmented) {
      --el-segmented-item-selected-bg-color: var(--el-color-primary);
      --el-segmented-item-selected-color: var(--el-color-white);
      width: 100%;
    }
  }

  .issue-content-grid {
    display: grid;
    grid-template-columns: minmax(320px, 0.72fr) minmax(0, 1fr);
    gap: 14px;
    min-height: 0;
    margin-top: 14px;
    overflow: hidden;
  }

  .issue-summary-pane,
  .issue-params-pane {
    min-width: 0;
    min-height: 0;
  }

  .issue-params-pane {
    overflow: auto;
    padding-right: 2px;
  }

  .form-section {
    margin-bottom: 0;
    padding: 14px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
    background: var(--el-fill-color-blank);
  }

  .summary-section {
    height: 100%;

    :deep(.el-descriptions__label) {
      width: 112px;
      color: var(--el-text-color-secondary);
      font-weight: 500;
    }

    :deep(.el-descriptions__content) {
      color: var(--el-text-color-primary);
      word-break: break-word;
    }
  }

  .params-section {
    min-height: 100%;
  }

  .subject-scroll-area {
    max-height: 280px;
    overflow: auto;
    padding: 2px 8px 0 0;
  }

  .issue-extension-section {
    margin-top: 14px;
  }

  .section-subtitle {
    display: flex;
    align-items: center;
    min-height: 22px;
    margin: 2px 0 10px;
    color: var(--el-text-color-primary);
    font-size: 13px;
    font-weight: 600;

    &::before {
      display: inline-block;
      width: 3px;
      height: 14px;
      margin-right: 7px;
      border-radius: 2px;
      background: var(--el-color-primary);
      content: '';
    }
  }

  .extension-scroll-area {
    max-height: 320px;
    overflow: auto;
    padding-right: 6px;
  }

  .issue-extension-item {
    padding: 12px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
    background: var(--el-fill-color-extra-light);

    & + .issue-extension-item {
      margin-top: 10px;
    }
  }

  .issue-extension-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
    color: var(--el-text-color-primary);
    font-size: 13px;
    font-weight: 600;
  }

  .san-row {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }

  .key-usage-checkbox-group {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px 12px;

    :deep(.el-checkbox) {
      margin-right: 0;
      height: 24px;
    }
  }

  .usb-key-tip {
    margin-bottom: 12px;
  }

  .media-subtitle {
    margin-top: 14px;
  }

  .issue-device-row {
    display: flex;
    width: 100%;
    gap: 8px;
  }

  .section-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 24px;
    margin-bottom: 12px;
    color: var(--el-text-color-primary);
    font-size: 15px;
    font-weight: 600;
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .result-section {
    margin-bottom: 12px;
  }

  .result-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 10px;
    margin-bottom: 12px;
  }

  .encryption-result {
    margin-top: 18px;
  }

  .encryption-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 10px 0;
  }

  .cert-result-textarea {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  }

  .renewal-storage-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 18px 0 10px;
    color: var(--el-text-color-primary);
    font-size: 15px;
    font-weight: 600;
  }

  .renewal-target-list {
    display: grid;
    gap: 12px;
  }

  .renewal-target {
    padding: 12px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
  }

  .renewal-target-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 28px;
    margin-bottom: 10px;
    font-weight: 600;
  }

  .renewal-client-confirm {
    margin-top: 4px;
  }

  .renewal-write-target {
    border-color: var(--el-color-primary-light-7);
    background: var(--el-color-primary-light-9);
  }

  .renewal-ra-target {
    border-color: var(--el-color-success-light-7);
    background: var(--el-color-success-light-9);
  }

  .renewal-result-storage {
    margin-top: 16px;
  }

  @media (max-width: 1200px) {
    .issue-section-grid,
    .issue-info-grid,
    .issue-info-grid.compact {
      grid-template-columns: 1fr;
    }

    .issue-top-grid {
      grid-template-columns: 1fr;
    }

    .issue-content-grid {
      grid-template-columns: 1fr;
      overflow: auto;
    }

    .issue-form {
      overflow: auto;
    }

    .issue-params-pane {
      overflow: visible;
    }
  }

  @media (max-width: 760px) {
    .query-panel {
      padding: 12px 12px 0;
    }

    .query-form {
      display: block;

      :deep(.el-form-item) {
        display: flex;
        margin-right: 0;
      }

      :deep(.el-form-item__content) {
        min-width: 0;
      }
    }

    .business-type-select,
    .keyword-input {
      width: 100%;
    }

    .query-actions {
      margin-left: 0;

      :deep(.el-form-item__content) {
        justify-content: flex-end;
      }
    }

    .list-toolbar {
      align-items: flex-start;
    }

    .result-actions,
    .encryption-actions {
      justify-content: flex-start;
    }

    :global(.cert-issue-dialog .el-dialog__body) {
      max-height: calc(100vh - 132px);
      overflow: auto;
    }

    .key-usage-checkbox-group {
      grid-template-columns: 1fr;
    }

    .san-row {
      flex-wrap: wrap;

      :deep(.el-select) {
        width: 100% !important;
      }
    }
  }
}

:global(.renewal-dialog) {
  max-width: calc(100vw - 32px);
}

:global(.renewal-dialog .el-dialog__body) {
  max-height: calc(100vh - 160px);
  overflow: auto;
}

:global(.cert-issue-dialog) {
  max-width: calc(100vw - 32px);
}

:global(.cert-issue-dialog .el-dialog__header) {
  margin-right: 0;
  padding: 16px 18px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

:global(.cert-issue-dialog .el-dialog__title) {
  color: var(--el-text-color-primary);
  font-size: 17px;
  font-weight: 600;
}

:global(.cert-issue-dialog .el-dialog__body) {
  max-height: calc(100vh - 154px);
  overflow: hidden;
  padding: 16px 18px 0;
}

:global(.cert-issue-dialog .el-dialog__footer) {
  padding: 12px 18px 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

:global(.cert-issue-dialog .issue-form) {
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 190px);
  overflow: hidden;
}

:global(.cert-issue-dialog .issue-form .el-select),
:global(.cert-issue-dialog .issue-form .el-date-editor.el-input) {
  width: 100%;
}

:global(.cert-issue-dialog .issue-form .el-form-item) {
  margin-bottom: 14px;
}

:global(.cert-issue-dialog .issue-section-grid) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  min-height: 0;
  overflow: auto;
  padding-right: 2px;
}

:global(.cert-issue-dialog .issue-info-section),
:global(.cert-issue-dialog .subject-section),
:global(.cert-issue-dialog .extension-section) {
  grid-column: 1 / -1;
}

:global(.cert-issue-dialog .issue-info-grid) {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 16px;
}

:global(.cert-issue-dialog .issue-info-grid.compact) {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

:global(.cert-issue-dialog .csr-form-item) {
  margin-top: 2px;
}

:global(.cert-issue-dialog .issue-descriptions .el-descriptions__label) {
  width: 112px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

:global(.cert-issue-dialog .issue-descriptions .el-descriptions__content) {
  color: var(--el-text-color-primary);
  word-break: break-word;
}

:global(.cert-issue-dialog .issue-top-grid) {
  display: grid;
  grid-template-columns: minmax(300px, 0.9fr) minmax(280px, 1fr) minmax(260px, 1fr);
  gap: 12px 16px;
  align-items: start;
  flex: 0 0 auto;
  padding: 12px 14px 2px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
}

:global(.cert-issue-dialog .issue-type-item .el-segmented) {
  --el-segmented-item-selected-bg-color: var(--el-color-primary);
  --el-segmented-item-selected-color: var(--el-color-white);
  width: 100%;
}

:global(.cert-issue-dialog .issue-content-grid) {
  display: grid;
  grid-template-columns: minmax(320px, 0.72fr) minmax(0, 1fr);
  gap: 14px;
  min-height: 0;
  margin-top: 14px;
  overflow: hidden;
}

:global(.cert-issue-dialog .issue-summary-pane),
:global(.cert-issue-dialog .issue-params-pane) {
  min-width: 0;
  min-height: 0;
}

:global(.cert-issue-dialog .issue-params-pane) {
  overflow: auto;
  padding-right: 2px;
}

:global(.cert-issue-dialog .form-section) {
  margin-bottom: 0;
  padding: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-blank);
}

:global(.cert-issue-dialog .summary-section) {
  height: 100%;
}

:global(.cert-issue-dialog .summary-section .el-descriptions__label) {
  width: 112px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

:global(.cert-issue-dialog .summary-section .el-descriptions__content) {
  color: var(--el-text-color-primary);
  word-break: break-word;
}

:global(.cert-issue-dialog .params-section) {
  min-height: 100%;
}

:global(.cert-issue-dialog .params-section .issue-info-grid) {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

:global(.cert-issue-dialog .dual-cert-alert) {
  margin-bottom: 14px;
}

:global(.cert-issue-dialog .subject-scroll-area) {
  max-height: 280px;
  overflow: auto;
  padding: 2px 8px 0 0;
}

:global(.cert-issue-dialog .issue-extension-section) {
  margin-top: 14px;
}

:global(.cert-issue-dialog .section-subtitle) {
  display: flex;
  align-items: center;
  min-height: 22px;
  margin: 2px 0 10px;
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 600;
}

:global(.cert-issue-dialog .section-subtitle::before) {
  display: inline-block;
  width: 3px;
  height: 14px;
  margin-right: 7px;
  border-radius: 2px;
  background: var(--el-color-primary);
  content: '';
}

:global(.cert-issue-dialog .extension-scroll-area) {
  max-height: 320px;
  overflow: auto;
  padding-right: 6px;
}

:global(.cert-issue-dialog .issue-extension-item) {
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-extra-light);
}

:global(.cert-issue-dialog .issue-extension-item + .issue-extension-item) {
  margin-top: 10px;
}

:global(.cert-issue-dialog .issue-extension-title) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 600;
}

:global(.cert-issue-dialog .san-row) {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

:global(.cert-issue-dialog .key-usage-checkbox-group) {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px 12px;
}

:global(.cert-issue-dialog .key-usage-checkbox-group .el-checkbox) {
  margin-right: 0;
  height: 24px;
}

:global(.cert-issue-dialog .usb-key-tip) {
  margin-bottom: 12px;
}

:global(.cert-issue-dialog .media-subtitle) {
  margin-top: 14px;
}

:global(.cert-issue-dialog .issue-device-row) {
  display: flex;
  width: 100%;
  gap: 8px;
}

:global(.cert-issue-dialog .section-title) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 24px;
  margin-bottom: 12px;
  color: var(--el-text-color-primary);
  font-size: 15px;
  font-weight: 600;
}

:global(.cert-issue-dialog .dialog-footer) {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 1200px) {
  :global(.cert-issue-dialog .issue-section-grid),
  :global(.cert-issue-dialog .issue-info-grid),
  :global(.cert-issue-dialog .issue-info-grid.compact) {
    grid-template-columns: 1fr;
  }

  :global(.cert-issue-dialog .issue-top-grid),
  :global(.cert-issue-dialog .issue-content-grid) {
    grid-template-columns: 1fr;
  }

  :global(.cert-issue-dialog .issue-content-grid),
  :global(.cert-issue-dialog .issue-form) {
    overflow: auto;
  }

  :global(.cert-issue-dialog .issue-params-pane) {
    overflow: visible;
  }
}

@media (max-width: 760px) {
  :global(.cert-issue-dialog .el-dialog__body) {
    max-height: calc(100vh - 132px);
    overflow: auto;
  }

  :global(.cert-issue-dialog .key-usage-checkbox-group) {
    grid-template-columns: 1fr;
  }

  :global(.cert-issue-dialog .san-row) {
    flex-wrap: wrap;
  }

  :global(.cert-issue-dialog .san-row .el-select) {
    width: 100% !important;
  }
}
</style>
