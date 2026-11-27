<template>
  <div class="app-container fawvw-employee-page">
    <div class="summary-strip">
      <div class="metric">
        <span class="metric-label">可办理员工</span>
        <strong>{{ summaryReady ? summary.activeEmployees : '—' }}</strong>
      </div>
      <div class="metric">
        <span class="metric-label">中方员工</span>
        <strong>{{ summaryReady ? summary.chineseEmployees : '—' }}</strong>
      </div>
      <div class="metric">
        <span class="metric-label">外方员工</span>
        <strong>{{ summaryReady ? summary.foreignEmployees : '—' }}</strong>
      </div>
      <div class="metric">
        <span class="metric-label">本地员工</span>
        <strong>{{ summaryReady ? summary.localEmployees : '—' }}</strong>
      </div>
      <div class="metric wide">
        <span class="metric-label">最近同步</span>
        <strong>{{ syncText }}</strong>
        <small v-if="summaryReady && summary.latestSyncTime">{{ summary.latestSyncTime.replace('T', ' ').slice(0, 19) }}</small>
        <el-button v-if="summaryFailed" link type="primary" @click="loadSummary()">重试统计</el-button>
        <el-tag :type="syncConfig.sourceMode === 'API' ? 'success' : 'warning'" effect="plain" size="small">
          {{ syncConfig.sourceMode === 'API' ? '接口数据' : '演示数据' }}
        </el-tag>
      </div>
    </div>
    <div ref="employeeLayout" class="employee-layout" :style="{ '--org-width': `${orgWidth}px` }">
      <aside class="org-column">
        <el-card shadow="never" class="org-panel">
          <template #header>
            <div class="panel-header">
              <span>组织科室</span>
              <el-tag size="small" type="info" effect="plain">{{ summary.departments || 0 }}</el-tag>
            </div>
          </template>
          <el-input v-model="orgKeyword" placeholder="搜索科室或组织路径" aria-label="搜索组织科室" prefix-icon="Search" clearable />
          <div v-loading="orgLoading" class="org-body">
            <div v-if="orgLoadFailed" class="org-empty">
              <span>组织科室加载失败</span><el-button link type="primary" @click="loadOrgTree">重试</el-button>
            </div>
              <div v-show="!orgSearchTerm" class="org-viewport" tabindex="0" aria-label="组织科室树">
                <el-tree
                  class="org-tree"
                  node-key="id"
                  :data="orgTreeData"
                  :props="orgTreeProps"
                  :indent="14"
                  :expand-on-click-node="false"
                  :current-node-key="selectedDirectoryNode"
                  :default-expanded-keys="defaultOrgExpanded"
                  highlight-current
                  @node-click="handleOrgClick"
                >
                  <template #default="{ data }"><span :title="data.path || data.label">{{ data.label }}</span></template>
                </el-tree>
              </div>
              <template v-if="orgSearchTerm">
                <div class="org-result-count" aria-live="polite">
                  {{ orgMatches.length }} 个匹配科室<span v-if="orgMatches.length > orgSearchLimit">，显示前 {{ orgSearchLimit }} 个</span>
                </div>
                <div v-if="!orgMatches.length" class="org-empty">未找到匹配科室</div>
                <ul v-else class="org-results">
                  <li v-for="item in orgMatches.slice(0, orgSearchLimit)" :key="item.node.id">
                    <button type="button" :aria-pressed="selectedDirectoryNode === item.node.id" @click="handleOrgClick(item.node)">
                      <strong>{{ item.node.label }}</strong>
                      <span v-if="item.path !== item.node.label">{{ item.path }}</span>
                    </button>
                  </li>
                </ul>
              </template>
          </div>
        </el-card>
        <div
          class="org-resize-handle"
          role="separator"
          aria-label="调整组织科室宽度"
          aria-orientation="vertical"
          :aria-valuemin="240"
          :aria-valuemax="maxOrgWidth"
          :aria-valuenow="Math.min(orgWidth, maxOrgWidth)"
          tabindex="0"
          @pointerdown="startOrgResize"
          @pointermove="moveOrgResize"
          @lostpointercapture="orgResizeStart = undefined"
          @keydown.left.prevent="resizeOrgBy(-24)"
          @keydown.right.prevent="resizeOrgBy(24)"
        />
      </aside>

      <div ref="employeeColumn" class="employee-column">
        <el-card shadow="never" class="employee-panel">
          <div v-if="selectedOrg" class="org-selection">
            <span class="org-selection-label">当前部门</span>
            <span class="org-selection-path">{{ selectedOrg.path }}</span>
            <el-tooltip content="清除科室筛选" placement="top">
              <el-button link icon="Close" aria-label="清除科室筛选" @click="clearOrgSelection" />
            </el-tooltip>
          </div>
          <div v-show="showSearch" class="query-panel">
            <el-form :model="queryParams" :inline="true" label-width="96px" class="query-form" @submit.prevent="handleQuery">
              <el-form-item label="关键词" prop="keyword">
                <el-input v-model="queryParams.keyword" clearable placeholder="姓名 / 域账号 / 工号" />
              </el-form-item>
              <el-form-item label="域账号" prop="domainAccount">
                <el-input v-model="queryParams.domainAccount" clearable placeholder="请输入域账号" />
              </el-form-item>
              <el-form-item label="数据来源">
                <el-select v-model="queryParams.source" clearable placeholder="全部来源">
                  <el-option label="大众同步" value="API" />
                  <el-option label="本地创建" value="LOCAL" />
                </el-select>
              </el-form-item>
              <el-form-item label="中方 / 外方" prop="foreignFlag">
                <el-select v-model="queryParams.foreignFlag" clearable :value-on-clear="null" placeholder="全部">
                  <el-option label="中方" :value="false" />
                  <el-option label="外方" :value="true" />
                </el-select>
              </el-form-item>
              <el-form-item label="在职状态" prop="status">
                <el-select v-model="queryParams.status" clearable placeholder="全部状态">
                  <el-option label="在职" value="A" />
                  <el-option label="离职" value="I" />
                </el-select>
              </el-form-item>
              <el-form-item class="query-actions">
                <el-button type="primary" icon="Search" native-type="submit">搜索</el-button>
                <el-button icon="RefreshLeft" @click="resetQuery">重置</el-button>
              </el-form-item>
            </el-form>
          </div>

          <el-row class="mb8 toolbar-row">
            <el-col v-if="!localSelected && auth.hasPermi('ra:employee:manage')" :span="1.5">
              <el-button type="primary" plain icon="Plus" @click="openCreate">新增员工</el-button>
            </el-col>
            <el-col v-if="!localSelected && auth.hasPermi('ra:employee:manage')" :span="1.5">
              <el-button plain icon="Upload" @click="openImport">外部导入</el-button>
            </el-col>
            <el-col v-if="canReadApplicants" :span="1.5">
              <el-button plain type="primary" icon="Plus" @click="localDialogs?.openAccount(selectedLocalDeptId)">新增用户</el-button>
            </el-col>
            <el-col v-if="selectedDirectoryNode === ALL_ORG_ID && auth.hasPermiAnd(['sys:dept:save', 'ra:admin'])" :span="1.5">
              <el-button plain icon="OfficeBuilding" @click="localDialogs?.openDepartment('0')">新增部门</el-button>
            </el-col>
            <el-col v-if="selectedLocalDeptId && auth.hasPermi('sys:dept:save')" :span="1.5">
              <el-button plain icon="Plus" @click="localDialogs?.openDepartment(selectedLocalDeptId)">新增下级</el-button>
            </el-col>
            <el-col v-if="selectedLocalDeptId && auth.hasPermiAnd(['sys:dept:detail', 'sys:dept:modify', 'ra:admin'])" :span="1.5">
              <el-button plain icon="Edit" @click="localDialogs?.openDepartment(selectedLocalDeptId, true)">修改部门</el-button>
            </el-col>
            <el-col v-if="selectedLocalDeptId && canRemoveSelectedDept" :span="1.5">
              <el-button type="danger" plain icon="Delete" :loading="removingDept" @click="removeLocalDepartment">删除部门</el-button>
            </el-col>
            <el-col v-if="!localSelected && auth.hasPermi('ra:employee:sync')" :span="1.5">
              <el-button type="primary" plain icon="Refresh" :loading="syncing" @click="handleSync">{{
                syncing ? '同步中' : '立即同步'
              }}</el-button>
            </el-col>
            <el-col v-if="!localSelected && auth.hasPermi('ra:employee:config')" :span="1.5">
              <el-button plain icon="Setting" @click="openConfig">同步配置</el-button>
            </el-col>
            <el-col v-if="!localSelected" :span="1.5">
              <el-button plain icon="Clock" @click="openLogs">同步记录</el-button>
            </el-col>
            <el-col v-if="summary.exportAllowed && auth.hasPermi('ra:employee:export')" :span="1.5">
              <el-button plain icon="Download" :loading="exportingEmployees"
                :disabled="loading || employeeListFailed || !appliedEmployeeFilters" @click="downloadEmployeeInfo">导出信息</el-button>
            </el-col>
            <right-toolbar v-model:showSearch="showSearch" @queryTable="loadEmployees" />
          </el-row>

          <el-table v-loading="loading" :data="employeeList" border stripe class="employee-table" :empty-text="employeeListFailed ? '列表加载失败，请重试' : localSelected ? '暂无本地申请用户' : '暂无人员数据'">
            <el-table-column :label="localSelected ? '用户名' : '姓名 / 用户名'" prop="cnName" min-width="130" fixed show-overflow-tooltip />
            <el-table-column label="性别" prop="genderName" width="76" align="center" />
            <el-table-column label="工号" prop="employeeNo" min-width="112" show-overflow-tooltip />
            <el-table-column label="域账号" prop="domainAccount" min-width="120" show-overflow-tooltip />
            <el-table-column label="邮箱" prop="email" min-width="210" show-overflow-tooltip />
            <el-table-column v-if="!localSelected" label="入职时间" prop="enterTime" width="116" align="center" />
            <el-table-column v-if="!localSelected" label="职级/职别" prop="jobGrade" width="110" align="center" />
            <el-table-column label="岗位" prop="jobName" min-width="140" show-overflow-tooltip />
            <el-table-column :label="localSelected ? '所属部门' : '科室 / 部门'" prop="departmentName" min-width="130" show-overflow-tooltip />
            <el-table-column v-if="!localSelected" label="经理级别" prop="managerLevel" width="110" align="center" />
            <el-table-column :label="localSelected ? '用户类别' : '人员类别'" prop="employeeTypeName" width="118" show-overflow-tooltip />
            <el-table-column label="数据来源" width="100" align="center">
              <template #default="{ row }">{{ row.recordSource === 'API' ? '大众同步' : '本地创建' }}</template>
            </el-table-column>
            <el-table-column v-if="!localSelected" label="在职状态" width="120" align="center">
              <template #default="{ row }">
                <el-tag :type="employmentTagType(row)" effect="plain">{{ employmentTagText(row) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="本地状态" width="120" align="center">
              <template #default="{ row }">
                <el-tag :type="isLocallyDisabled(row) ? 'warning' : 'success'" effect="plain">
                  {{ isLocallyDisabled(row) ? '已停用' : '启用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" fixed="right" width="154" align="center">
              <template #default="{ row }">
                <el-tooltip content="详情" placement="top">
                  <el-button link type="primary" icon="View" aria-label="员工详情" @click="openDetail(row)" />
                </el-tooltip>
                <el-tooltip v-if="canDeleteEmployee(row)" content="删除员工" placement="top">
                  <el-button v-hasPermi="['ra:employee:manage']" link type="danger" icon="Delete" aria-label="删除员工" :disabled="deletingEmployee" @click="removeEmployee(row)" />
                </el-tooltip>
              </template>
            </el-table-column>
          </el-table>

          <div v-if="total > 0" class="pagination-container employee-pagination">
            <el-pagination
              :current-page="queryParams.pageNum"
              :page-size="queryParams.pageSize"
              :page-sizes="[10, 20, 30, 50]"
              :total="total"
              background
              layout="total, sizes, prev, slot, next, jumper"
              @update:current-page="changeEmployeePagination($event, queryParams.pageSize)"
              @update:page-size="changeEmployeePagination(queryParams.pageNum, $event)"
            >
              <ul class="employee-pager" aria-label="员工信息页码">
                <li v-for="item in employeePageItems" :key="item.key">
                  <span v-if="item.page == null" class="employee-pager-ellipsis">…</span>
                  <button v-else type="button" :class="{ active: item.page === queryParams.pageNum }"
                    :aria-label="`第 ${item.page} 页`" :aria-current="item.page === queryParams.pageNum ? 'page' : undefined"
                    @click="changeEmployeePagination(item.page, queryParams.pageSize)">{{ item.page }}</button>
                </li>
              </ul>
            </el-pagination>
          </div>
        </el-card>
      </div>
    </div>

    <RaCertDetailDialog ref="employeeCertDetail" :load-detail="getRaCert" />
    <LocalDirectoryDialogs
      ref="localDialogs"
      :departments="localDepartments"
      :allow-local-recovery="canRecoverLocalAccounts"
      @departments-changed="refreshLocalDirectory"
      @accounts-changed="refreshApplicants"
    />
    <el-drawer v-model="detailOpen" title="员工详情" size="min(860px, 95vw)" append-to-body>
      <el-tabs v-model="detailTab">
        <el-tab-pane label="基本资料" name="profile">
      <el-descriptions class="employee-detail-descriptions" :column="1" label-width="9rem" border>
        <el-descriptions-item label="姓名">{{ detail.cnName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="性别">{{ detail.genderName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="域账号">{{ detail.domainAccount || '-' }}</el-descriptions-item>
        <el-descriptions-item label="工号">{{ detail.employeeNo || '-' }}</el-descriptions-item>
        <el-descriptions-item label="入职时间">{{ detail.enterTime || '-' }}</el-descriptions-item>
        <el-descriptions-item label="生日">{{ detail.birthday || '-' }}</el-descriptions-item>
        <el-descriptions-item label="邮箱">{{ detail.email || '-' }}</el-descriptions-item>
        <el-descriptions-item label="部门编码">{{ detail.departmentCode || '-' }}</el-descriptions-item>
        <el-descriptions-item label="所属组织路径">{{ detail.departmentNamePath || detail.departmentName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="岗位">{{ detail.jobName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="职级/职别">{{ detail.jobGrade || '-' }}</el-descriptions-item>
        <el-descriptions-item :label="isLocalAccount(detail) ? '用户类别' : '员工类型'">{{ detail.employeeTypeName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="经理级别">{{ detail.managerLevel || '-' }}</el-descriptions-item>
        <el-descriptions-item v-if="detail.identityKey && !isLocalAccount(detail)">
          <template #label>
            <el-tooltip content="这是系统内部的档案识别键。大众员工同步优先按工号匹配；原工号在本轮名单中缺席、新工号尚未建档时，再用姓名、域账号和出生日期核对是否为同一人。" placement="top">
              <span class="employee-identity-label" tabindex="0">自然人识别键 <el-icon><QuestionFilled /></el-icon></span>
            </el-tooltip>
          </template>
          <span class="identity-key">{{ detail.identityKey || '-' }}</span>
        </el-descriptions-item>
      </el-descriptions>
        </el-tab-pane>
        <el-tab-pane label="办理状态" name="qualification">
          <el-descriptions class="employee-detail-descriptions" :column="1" label-width="9rem" border>
            <el-descriptions-item label="数据来源">{{ detail.localRecoveryRequired ? '待恢复本地账号' : sourceLabel(detail.recordSource) }}</el-descriptions-item>
            <el-descriptions-item label="本地状态">{{ detail.localEnabled === false || applicantDisabled ? '已停用' : '启用' }}</el-descriptions-item>
            <el-descriptions-item label="申请用户">
              {{ detail.raUserId ? '已就绪' : '未同步到系统用户' }}
            </el-descriptions-item>
            <el-descriptions-item v-if="linkedApplicant" label="办理部门">{{ linkedApplicant.deptName || '-' }}</el-descriptions-item>
            <el-descriptions-item v-if="linkedApplicant?.status != null" label="账号状态">
              {{ Number(linkedApplicant.status) === 0 ? '启用' : '停用' }}
            </el-descriptions-item>
            <el-descriptions-item v-if="isLocalAccount(detail) && !detail.domainAccount" label="员工制证">{{ linkedApplicant?.userCategory === 'individual' ? '缺少域账号' : '仅限个人用户' }}</el-descriptions-item>
          </el-descriptions>
          <div class="mt12">
            <el-button v-if="isLocalAccount(detail) && canReadApplicants" @click="localDialogs?.openAccount(undefined, detail.raUserId, detail)">管理本地账号</el-button>
            <el-button v-if="canRecoverLocalAccounts && detail.localRecoveryRequired"
              @click="localDialogs?.openAccount(undefined, detail.raUserId, detail, true)">恢复本地账号</el-button>
            <span v-else-if="canViewLocalRecovery && detail.localRecoveryRequired">恢复账号需要申请用户维护权限</span>
            <el-button v-if="!isLocalAccount(detail) && !detail.localRecoveryRequired && detail.localEnabled !== false" v-hasPermi="['ra:employee:manage']" type="warning" plain @click="changeEmployeeEnabled(false)">停用员工</el-button>
            <el-button v-if="!isLocalAccount(detail) && !detail.localRecoveryRequired && detail.localEnabled === false" v-hasPermi="['ra:employee:manage']" type="success" plain @click="changeEmployeeEnabled(true)">恢复员工</el-button>
          </div>
          <el-divider content-position="left">名下证书</el-divider>
          <EmployeeCertificateInventory v-bind="certificateInventory" :ad-upload-enabled="adUploadEnabled && canUploadAd" @upload-ad="uploadEmployeeCertificateToAd" @page-change="changeCertificatePage" @retry="reloadCertificateInventory" @certificate="openCertificate" />
          <template v-if="adUploadEnabled">
            <el-divider class="employee-ad-divider" content-position="left">AD 上传记录</el-divider>
            <el-descriptions class="employee-detail-descriptions employee-ad-summary" :column="1" label-width="12em" border>
              <el-descriptions-item label="最近成功上传 AD 的证书">
                <el-button v-if="latestAdSuccess" class="ad-serial" link type="primary" @click="openCertificate(latestAdSuccess.certId)">{{ latestAdSuccess.serialNumber }}</el-button>
                <span v-else>-</span>
              </el-descriptions-item>
              <el-descriptions-item label="最近成功上传 AD 的时间">{{ employeeDetailTime(latestAdSuccess?.sendTime) }}</el-descriptions-item>
            </el-descriptions>
            <el-alert v-if="adHistoryFailed" type="error" title="无法读取 AD 上传记录" :closable="false">
              <el-button link type="primary" @click="loadAdHistory()">重新读取</el-button>
            </el-alert>
            <el-table class="employee-ad-history" :data="adHistory" size="small" empty-text="暂无上传记录">
              <el-table-column label="证书序列号" min-width="160">
                <template #default="{ row }"><el-button link type="primary" @click="openCertificate(row.certId)">{{ row.serialNumber }}</el-button></template>
              </el-table-column>
              <el-table-column label="上传时间" min-width="145">
                <template #default="{ row }">{{ employeeDetailTime(row.sendTime) }}</template>
              </el-table-column>
              <el-table-column label="操作人" prop="operator" min-width="88" />
              <el-table-column label="结果" min-width="88">
                <template #default="{ row }">
                  <el-tag :type="row.sendStatus === 1 ? 'success' : row.sendStatus === 2 ? 'danger' : 'info'" :title="row.errorMessage">
                    {{ adHistoryStatus(row.sendStatus) }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>
          </template>
        </el-tab-pane>
        <el-tab-pane label="申请与证书" name="activity">
          <div class="mb8">
            <el-button v-if="canStartBusiness && detail.raUserId" v-hasPermi="['ra:apply']" type="primary" @click="startStandardApply">发起标准证书申请</el-button>
            <el-button v-if="canStartBusiness && detail.id && detail.domainAccount && detail.identityKey" v-hasPermi="['ra:employee-cert:issue']" @click="startEmployeeCert">员工证书制作</el-button>
          </div>
          <el-divider content-position="left">近期办理记录</el-divider>
          <el-table v-loading="activityLoading" :data="processRecords" row-key="key" size="small" empty-text="暂无办理记录">
            <el-table-column label="办理类型" prop="type" min-width="115" />
            <el-table-column label="申请编号 / 任务号" prop="reference" min-width="158" show-overflow-tooltip />
            <el-table-column label="时间" min-width="145">
              <template #default="{ row }">{{ employeeDetailTime(row.time) }}</template>
            </el-table-column>
            <el-table-column label="状态" width="94">
              <template #default="{ row }"><el-tag :type="row.tone">{{ row.status }}</el-tag></template>
            </el-table-column>
            <el-table-column label="办理结果" min-width="170">
              <template #default="{ row }">
                <div v-for="certificate in row.certificates" :key="certificate.cert_id">
                  <el-button link type="primary" @click="openCertificate(certificate.cert_id)">{{ certificate.serial_number }}</el-button>
                  <div>{{ certificate.profile_name || '未关联模板' }}</div>
                </div>
                <div v-if="row.message">{{ row.message }}</div>
                <span v-else-if="!row.certificates.length">-</span>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
      <section class="mt12" aria-label="用户关联说明">
        <el-alert type="info" :closable="false" show-icon title="用户关联说明">
          <p>同步人员和本地用户统一按系统部门办理。管理员可直接选人申请，无需开通员工登录。</p>
          <p>办理流程：选择员工 → 提交申请 → 审核 → 上传 CSR 并签发 → 下载证书。标准申请和签发记录归到该员工关联的用户下。</p>
        </el-alert>
      </section>
    </el-drawer>

    <el-dialog v-model="certificateOpen" title="证书详情" width="min(660px, 95vw)" append-to-body>
      <div v-loading="certificateDetailLoading" class="employee-certificate-detail">
        <el-alert v-if="certificateDetailFailed" title="证书不存在、已变更或无权查看" type="error" :closable="false" />
        <el-descriptions v-if="selectedCertificate" :column="1" size="small" border>
          <el-descriptions-item label="证书序列号">{{ selectedCertificate.serialNumber }}</el-descriptions-item>
          <el-descriptions-item label="证书模板">{{ selectedCertificate.profileName || '未关联模板' }}</el-descriptions-item>
          <el-descriptions-item label="主题">{{ formatCertificateSubject(selectedCertificate.subject) }}</el-descriptions-item>
          <el-descriptions-item label="颁发机构">{{ selectedCertificate.issuerName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="证书用途">{{ selectedCertificate.usage || '-' }}</el-descriptions-item>
          <el-descriptions-item label="来源">{{ certificateSourceLabel(selectedCertificate.source) }}</el-descriptions-item>
          <el-descriptions-item label="记录时间">{{ employeeDetailTime(selectedCertificate.createTime) }}</el-descriptions-item>
          <el-descriptions-item label="有效期">{{ employeeDetailTime(selectedCertificate.notBefore) }} 至 {{ employeeDetailTime(selectedCertificate.notAfter) }}</el-descriptions-item>
          <el-descriptions-item v-if="selectedCertificate.taskNo" label="制作任务">{{ selectedCertificate.taskNo }}</el-descriptions-item>
          <el-descriptions-item
            v-if="selectedCertificate.superseded || ['RECOVER', 'RENEW'].includes(selectedCertificate.productionAction ?? '')"
            label="制作记录"
          >
            <template v-if="['RECOVER', 'RENEW'].includes(selectedCertificate.productionAction ?? '')"
              >已{{ selectedCertificate.productionTime ? '于 ' + employeeDetailTime(selectedCertificate.productionTime) + ' ' : '' }}{{
                selectedCertificate.productionAction === 'RECOVER' ? '密钥恢复' : '续签'
              }}</template
            >
            <template v-else>已有后续制作记录</template>
          </el-descriptions-item>
        </el-descriptions>
      </div>
      <template #footer>
        <el-button @click="certificateOpen = false">关闭</el-button>
        <el-dropdown v-if="selectedCertificate" v-hasPermi="['ra:cert']" class="ml8" @command="downloadEmployeeCertificate">
          <el-button type="primary" icon="Download" :loading="certificateDownloading">下载证书</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="cer">CER</el-dropdown-item>
              <el-dropdown-item command="pem">PEM</el-dropdown-item>
              <el-dropdown-item command="p7b">P7B</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </template>
    </el-dialog>

    <el-dialog v-model="createOpen" title="新增员工" width="min(560px, 96vw)" :show-close="!creating" :close-on-click-modal="!creating" :close-on-press-escape="!creating" append-to-body>
      <el-form :model="createForm" :disabled="creating" label-width="90px">
        <el-form-item label="域账号" required for="new-employee-account"><el-input id="new-employee-account" v-model="createForm.domainAccount" maxlength="128" /></el-form-item>
        <el-form-item label="生日" required for="new-employee-birthday"><el-date-picker id="new-employee-birthday" v-model="createForm.birthday" type="date" value-format="YYYY-MM-DD" style="width: 100%" /></el-form-item>
        <el-form-item label="姓名" required for="new-employee-name"><el-input id="new-employee-name" v-model="createForm.cnName" maxlength="128" /></el-form-item>
        <el-form-item label="工号"><el-input v-model="createForm.employeeNo" maxlength="64" /></el-form-item>
        <el-form-item label="性别"><el-select v-model="createForm.gender" clearable style="width: 100%"><el-option label="男" value="1" /><el-option label="女" value="2" /></el-select></el-form-item>
        <el-form-item label="岗位"><el-input v-model="createForm.jobName" maxlength="128" /></el-form-item>
        <el-form-item label="邮箱"><el-input v-model="createForm.email" maxlength="255" /></el-form-item>
        <el-form-item label="所属部门" required>
          <el-tree-select v-model="createForm.departmentId" :data="orgTree" :props="orgTreeProps" node-key="id" check-strictly filterable style="width: 100%" placeholder="请选择部门" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="creating" @click="createOpen = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="saveEmployee">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="importPreviewOpen" title="外部导入员工" width="min(760px, 96vw)" :show-close="!importing" :close-on-click-modal="!importing" :close-on-press-escape="!importing" append-to-body>
      <div class="mb8">
        <el-button icon="Download" :loading="downloadingImportTemplate" @click="downloadImportTemplate">下载模板</el-button>
        <el-button icon="Upload" :disabled="importing" @click="importPicker?.click()">选择 Excel 文件</el-button>
        <input ref="importPicker" type="file" accept=".xlsx" aria-label="员工导入文件" hidden @change="handleImportFile" />
      </div>
      <el-table v-loading="importing" :data="importPreviewRows.slice(0, 20)" border max-height="420" empty-text="请选择 XLSX 文件（最多 1000 人，5 MB）">
        <el-table-column label="域账号" prop="domainAccount" min-width="140" />
        <el-table-column label="生日" prop="birthday" min-width="115" />
        <el-table-column label="姓名" prop="cnName" min-width="110" />
        <el-table-column label="工号" prop="employeeNo" min-width="110" />
        <el-table-column label="邮箱" prop="email" min-width="170" show-overflow-tooltip />
      </el-table>
      <p v-if="importPreviewRows.length">共 {{ importPreviewRows.length }} 人，预览前 {{ Math.min(20, importPreviewRows.length) }} 人</p>
      <template #footer>
        <el-button :disabled="importing" @click="importPreviewOpen = false">取消</el-button><el-button type="primary" :disabled="!importPreviewRows.length" :loading="importing" @click="confirmImport">确认导入</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="configOpen" title="同步配置" width="520px" append-to-body>
      <el-form :model="syncConfig" label-width="100px">
        <el-form-item label="自动同步">
          <el-switch v-model="syncConfig.enabled" />
          <el-switch v-model="syncConfig.exportAllowed" class="ml16" active-text="允许导出" aria-label="允许导出" />
        </el-form-item>
        <el-form-item label="同步方式">
          <el-radio-group v-model="syncConfig.scheduleType">
            <el-radio-button value="DAILY">每日</el-radio-button>
            <el-radio-button value="HOURLY">按小时</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="syncConfig.scheduleType === 'DAILY'" label="每日时间">
          <el-time-picker v-model="dailyTimeValue" value-format="HH:mm:ss" format="HH:mm:ss" placeholder="选择时间" style="width: 180px" />
        </el-form-item>
        <el-form-item v-else label="小时间隔">
          <el-input-number v-model="syncConfig.intervalHours" :min="1" :max="24" controls-position="right" />
        </el-form-item>
        <el-form-item label="分页大小">
          <el-input-number v-model="syncConfig.pageSize" :min="100" :max="1000" :step="100" controls-position="right" />
        </el-form-item>
        <el-form-item label="数据源">
          <el-select v-model="syncConfig.sourceMode" style="width: 180px">
            <el-option label="演示数据（Mock）" value="MOCK" />
            <el-option label="大众员工接口（API）" value="API" />
          </el-select>
        </el-form-item>
        <template v-if="syncConfig.sourceMode === 'API'">
          <el-divider content-position="left">大众员工接口</el-divider>
          <el-form-item label="接口地址">
            <el-input v-model="syncConfig.apiBaseUrl" placeholder="https://api.faw-vw.com" />
          </el-form-item>
          <el-form-item label="APP_KEY">
            <el-input v-model="syncConfig.apiAppKey" autocomplete="off" />
          </el-form-item>
          <el-form-item label="SECRET_KEY">
            <el-input
              v-model="syncConfig.apiSecretKey"
              type="password"
              show-password
              autocomplete="new-password"
              :placeholder="syncConfig.apiSecretConfigured ? '已配置，留空则不修改' : '请输入 SECRET_KEY'"
            />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="configOpen = false">取消</el-button>
        <el-button type="primary" :loading="savingConfig" @click="saveConfig">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="logsOpen" width="860px" append-to-body>
      <template #header>
        <div class="flex items-center justify-between pr-6">
          <span>同步记录</span>
        </div>
      </template>
      <el-table v-loading="logsLoading" :data="syncLogs" height="min(420px, 55dvh)" border>
        <el-table-column label="任务号" prop="taskNo" min-width="160" show-overflow-tooltip />
        <el-table-column label="触发方式" prop="triggerType" width="110" />
        <el-table-column label="状态" prop="status" width="96" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'SUCCESS' ? 'success' : row.status === 'FAILED' ? 'danger' : 'warning'" effect="plain">{{
              row.status
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="组织" prop="totalOrgs" width="80" align="right" />
        <el-table-column label="员工" prop="totalEmployees" width="90" align="right" />
        <el-table-column label="新增" prop="createdCount" width="80" align="right" />
        <el-table-column label="更新" prop="updatedCount" width="80" align="right" />
        <el-table-column label="工号变更" width="95" align="center">
          <template #default="{ row }">
            <el-button v-if="row.employeeNoChangeCount" link type="primary" @click="openNumberChanges(row.taskNo)">
              {{ row.employeeNoChangeCount }}
            </el-button>
            <span v-else>0</span>
          </template>
        </el-table-column>
        <el-table-column label="本轮离职标记" prop="disabledCount" width="126" align="right">
          <template #header="{ column }">
            <el-tooltip content="本轮未出现在大众名册中、因此新标记为离职的员工。不含历史离职员工。" placement="top">
              <span>{{ column.label }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="本轮异常记录" width="126" align="center">
          <template #header="{ column }">
            <el-tooltip content="本轮未通过同步校验的记录。点击数量查看原因，不计为离职。" placement="top">
              <span>{{ column.label }}</span>
            </el-tooltip>
          </template>
          <template #default="{ row }">
            <el-button v-if="row.invalidCount > 0" link type="danger" @click="openInvalidRecords(row)">{{ row.invalidCount }}</el-button>
            <span v-else>0</span>
          </template>
        </el-table-column>
        <el-table-column label="完成时间" prop="finishTime" min-width="160">
          <template #default="{ row }">{{ parseTime(row.finishTime) || '-' }}</template>
        </el-table-column>
      </el-table>
      <pagination
        :auto-scroll="false"
        v-show="logsTotal > 0"
        v-model:page="logQuery.pageNum"
        v-model:limit="logQuery.pageSize"
        :total="logsTotal"
        @pagination="loadLogs"
      />
    </el-dialog>

    <el-dialog v-model="invalidOpen" title="无效员工记录" width="720px" append-to-body>
      <el-table v-loading="invalidLoading" :data="invalidRecords" height="min(420px, 55dvh)" border empty-text="当前同步任务没有无效记录">
        <el-table-column label="员工号" prop="employeeNo" min-width="130" />
        <el-table-column label="域账号" prop="domainAccount" min-width="150" />
        <el-table-column label="姓名" prop="cnName" min-width="120" />
        <el-table-column label="出生日期" prop="birthday" min-width="110" />
        <el-table-column label="无效原因" prop="reason" min-width="220" />
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button v-if="row.candidateConfirmable" v-hasPermi="['ra:employee:manage']" link type="primary" @click="confirmAccountOwner(row)">核验归属</el-button>
          </template>
        </el-table-column>
      </el-table>
      <pagination
        :auto-scroll="false"
        v-show="invalidTotal > 0"
        v-model:page="invalidQuery.pageNum"
        v-model:limit="invalidQuery.pageSize"
        :total="invalidTotal"
        @pagination="loadInvalidRecords"
      />
    </el-dialog>
    <el-dialog v-model="numberChangesOpen" title="工号变更" width="min(640px, 95vw)" append-to-body>
      <el-table v-loading="numberChangesLoading" :data="numberChanges" height="min(420px, 55dvh)" border empty-text="本轮没有工号变更">
        <el-table-column label="姓名" prop="cnName" min-width="110" show-overflow-tooltip />
        <el-table-column label="域账号" prop="domainAccount" min-width="140" show-overflow-tooltip />
        <el-table-column label="原工号" prop="previousEmployeeNo" min-width="130" show-overflow-tooltip />
        <el-table-column label="新工号" prop="employeeNo" min-width="130" show-overflow-tooltip />
      </el-table>
      <pagination
        v-show="numberChangesTotal > 0"
        v-model:page="numberChangesQuery.pageNum"
        v-model:limit="numberChangesQuery.pageSize"
        :total="numberChangesTotal"
        :auto-scroll="false"
        @pagination="loadNumberChanges"
      />
    </el-dialog>
  </div>
</template>

<script setup name="RaEmployee" lang="ts">
import { formatCertificateSubject } from '@/utils/raCertificateSubject';
import { useRaListRefreshOnReturn } from '@/hooks/useRaListRefreshOnReturn';
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, reactive, ref, shallowRef, watch } from 'vue';
import { getEmployeeAdUploadEnabled, getEmployeeAdHistory, queueEmployeeAdCertificate, type EmployeeAdPublication } from '@/api/ra/employeeCert';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRoute, useRouter } from 'vue-router';
import FileSaver from 'file-saver';
import { downloadRaCert, getRaCert } from '@/api/ra/cert';
import RaCertDetailDialog from '../components/RaCertDetailDialog.vue';
import { certificateDownloadBlob } from '@/utils/raCertificateDownload';
import { listDeptSelectTree, removeDept } from '@/api/ra/dept';
import { getUser, type RaApplicantUserInfo } from '@/api/ra/user';
import type { RaDeptTreeOption } from '@/api/ra/dept/types';
import auth from '@/plugins/auth';
import LocalDirectoryDialogs from './LocalDirectoryDialogs.vue';
import EmployeeCertificateInventory from './EmployeeCertificateInventory.vue';
import { directoryQueryId, employeeDirectoryPath } from '@/utils/fawvwEmployeeNavigation';
import { isFawvwEmployeeSourceActive } from '@/utils/fawvwEmployeeStatus';
import {
  FawvwEmployee,
  FawvwEmployeeQuery,
  FawvwEmployeeSummary,
  FawvwOrgNode,
  FawvwSyncConfig,
  FawvwSyncLog,
  type EmployeeInput,
  type EmployeeActivity,
  type EmployeeCertificateRecord,
  createFawvwEmployee,
  deleteFawvwEmployee,
  downloadFawvwEmployeeImportTemplate,
  importFawvwEmployees,
  previewFawvwEmployeeFile,
  setFawvwEmployeeEnabled,
  confirmFawvwAccountOwner,
  getFawvwEmployeeActivity,
  getEmployeeCertificates,
  getFawvwEmployee,
  getFawvwEmployeeSummary,
  getFawvwSyncConfig,
  getFawvwSyncTask,
  pageEmployeeDirectory,
  exportEmployeeDirectory,
  type EmployeeDirectoryQuery,
  getEmployeeDirectoryDetails,
  type EmployeeDirectoryRow,
  pageFawvwInvalidEmployees,
  pageFawvwSyncLogs,
  pageFawvwEmployeeNumberChanges,
  type FawvwEmployeeNumberChange,
  saveFawvwSyncConfig,
  syncFawvwEmployees
} from '@/api/ra/employee';

const router = useRouter();
const route = useRoute();
const canReadApplicants = computed(() => auth.hasPermi('ra:user'));
const localDialogs = ref<InstanceType<typeof LocalDirectoryDialogs>>();
const localDepartments = shallowRef<RaDeptTreeOption[]>([]);
const removingDept = ref(false);

const ALL_ORG_ID = '__ALL__';
const selectedDirectoryNode = ref(ALL_ORG_ID);
const selectedLocalDeptId = computed(() => selectedDirectoryNode.value === ALL_ORG_ID ? undefined : selectedDirectoryNode.value);
const localSelected = computed(() => queryParams.source === 'LOCAL');
const defaultOrgExpanded = [ALL_ORG_ID];
const orgSearchLimit = 100;
const employeeLayout = ref<HTMLElement>();
const employeeColumn = ref<HTMLElement>();
const employeePagerCount = ref(7);
const employeePageItems = computed(() => {
  const last = Math.ceil(total.value / queryParams.pageSize);
  const current = Math.min(Math.max(1, queryParams.pageNum), last);
  const pages = new Set([1, 2, last, current]);
  if (employeePagerCount.value === 7) {
    pages.add(current - 1);
    pages.add(current + 1);
  }
  const sorted = [...pages].filter(page => page >= 1 && page <= last).sort((a, b) => a - b);
  return sorted.flatMap((page, index) => {
    const previous = sorted[index - 1];
    if (previous != null && page - previous === 2) {
      return [{ key: String(previous + 1), page: previous + 1 }, { key: String(page), page }];
    }
    if (previous != null && page - previous > 2) {
      return [{ key: `gap-${previous}`, page: null }, { key: String(page), page }];
    }
    return [{ key: String(page), page }];
  });
});
let employeeColumnObserver: ResizeObserver | undefined;
const orgWidth = ref(300);
const maxOrgWidth = ref(640);
let orgResizeStart: { x: number; width: number } | undefined;
let layoutObserver: ResizeObserver | undefined;

function changeEmployeePagination(page: number, pageSize: number) {
  if ((page - 1) * pageSize >= total.value) page = 1;
  if (page === queryParams.pageNum && pageSize === queryParams.pageSize) return;
  queryParams.pageNum = page;
  queryParams.pageSize = pageSize;
  void loadEmployees();
}

function setOrgWidth(width: number) {
  orgWidth.value = Math.max(240, Math.min(maxOrgWidth.value, Math.round(width)));
}

function resizeOrgBy(delta: number) {
  setOrgWidth(Math.min(orgWidth.value, maxOrgWidth.value) + delta);
}

function startOrgResize(event: PointerEvent) {
  if (event.button !== 0) return;
  const handle = event.currentTarget as HTMLElement;
  handle.focus();
  handle.setPointerCapture(event.pointerId);
  orgResizeStart = { x: event.clientX, width: Math.min(orgWidth.value, maxOrgWidth.value) };
  event.preventDefault();
}

function moveOrgResize(event: PointerEvent) {
  if (orgResizeStart && (event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId)) {
    setOrgWidth(orgResizeStart.width + event.clientX - orgResizeStart.x);
  }
}

const loading = ref(false);
const employeeListFailed = ref(false);
let employeeRequestId = 0;
let employeeListRequest: AbortController | undefined;
const orgLoading = ref(false);
const orgLoadFailed = ref(false);
const syncing = ref(false);
let syncPollTimer: ReturnType<typeof setTimeout> | undefined;
let syncPollVersion = 0;
let pageDisposed = false;
const savingConfig = ref(false);
const logsLoading = ref(false);
const showSearch = ref(true);
const total = ref(0);
const logsTotal = ref(0);
const orgKeyword = ref('');
const detailOpen = ref(false);
const detail = ref<EmployeeListRow>({});
const detailTab = ref('profile');
const activityLoading = ref(false);
const activity = ref<EmployeeActivity>({ applies: [], employeeCertificates: [] });
const certificateInventory = reactive({
  rows: [] as EmployeeCertificateRecord[], total: 0, page: 1, pageSize: 10, loading: false, failed: false
});
const certificateRefresh = ref(0);
const certificateOpen = ref(false);
const certificateDetailLoading = ref(false);
const certificateDetailFailed = ref(false);
const certificateDownloading = ref(false);
const selectedCertificate = ref<EmployeeCertificateRecord>();
let certificateDetailRequest = 0;
const applyStatuses: Record<number, string> = { 0: '新申请', 1: '待签发', 2: '审核拒绝', 3: '已签发' };
const issueStatuses: Record<string, string> = { PENDING: '待签发', ISSUING: '签发中', FAILED: '签发失败', ISSUED: '已签发' };
const processRecords = computed(() => [
  ...(activity.value.applies || []).map((item) => ({
    key: `apply-${item.id}`, type: '标准证书申请', reference: item.id, time: item.create_time,
    status: applyStatuses[Number(item.status)] || '状态未知',
    tone: Number(item.status) === 3 ? 'success' : Number(item.status) === 2 ? 'danger' : 'warning',
    certificates: item.certificates || [], message: Number(item.status) === 2 ? item.review_comment : ''
  })),
  ...(activity.value.employeeCertificates || []).map((item) => ({
    key: `issue-${item.id}`, type: item.key_source === 'LEGACY_PFX' ? '存量证书导入' : '员工证书制作',
    reference: item.task_no || '-', time: item.process_time || item.create_time,
    status: issueStatuses[item.issue_status] || '状态未知',
    tone: item.issue_status === 'ISSUED' ? 'success' : item.issue_status === 'FAILED' ? 'danger' : 'warning',
    certificates: item.issue_status === 'ISSUED' && item.ra_cert_id && item.serial_number
      ? [{ cert_id: item.ra_cert_id, serial_number: item.serial_number, profile_name: item.profile_name }] : [],
    message: item.issue_status === 'ISSUED' && item.ra_cert_id ? '' : item.issue_message
  }))
].sort((a, b) => employeeDetailTime(b.time).localeCompare(employeeDetailTime(a.time))));
const createOpen = ref(false);
const creating = ref(false);
const deletingEmployee = ref(false);
const importing = ref(false);
const downloadingImportTemplate = ref(false);
const importPreviewOpen = ref(false);
const importPreviewRows = ref<EmployeeInput[]>([]);
const importPicker = ref<HTMLInputElement>();
const createForm = reactive<EmployeeInput>({ employeeNo: '', domainAccount: '', birthday: '', cnName: '', email: '', departmentId: '', gender: '', jobName: '' });
let detailRequestId = 0;
const configOpen = ref(false);
const adUploadEnabled = ref(false);
const employeeCertDetail = ref<InstanceType<typeof RaCertDetailDialog>>();
const adHistory = ref<EmployeeAdPublication[]>([]);
const adHistoryFailed = ref(false);
const adHistoryBusy = ref(false);
const canUploadAd = computed(() => auth.hasPermi('ra:employee-cert:distribute'));
const latestAdSuccess = computed(() =>
  adHistory.value.filter(row => row.sendStatus === 1).sort((a, b) => (b.sendTime || '').localeCompare(a.sendTime || ''))[0]);
let adHistoryRequest = 0;
let adHistoryTimer: ReturnType<typeof setTimeout> | undefined;

function adHistoryStatus(status: number) {
  return ({ 0: '待运行', 1: '成功', 2: '失败', 3: '运行中' } as Record<number, string>)[status] || '-';
}

async function loadAdHistory() {
  clearTimeout(adHistoryTimer);
  const request = ++adHistoryRequest;
  const id = detail.value.id;
  if (!id || !detailOpen.value || !adUploadEnabled.value) return;
  adHistoryFailed.value = false;
  try {
    const response = await getEmployeeAdHistory(id);
    if (request !== adHistoryRequest || !detailOpen.value) return;
    adHistory.value = unwrap(response) || [];
    if (adHistory.value.some(row => row.sendStatus === 0 || row.sendStatus === 3)) {
      adHistoryTimer = setTimeout(loadAdHistory, 2500);
    }
  } catch {
    if (request === adHistoryRequest) adHistoryFailed.value = true;
  }
}

watch(() => [detailOpen.value, detail.value.id, adUploadEnabled.value] as const, () => {
  adHistory.value = [];
  void loadAdHistory();
});
onUnmounted(() => { ++adHistoryRequest; clearTimeout(adHistoryTimer); });

async function uploadEmployeeCertificateToAd(row: EmployeeCertificateRecord) {
  const employeeId = detail.value.id;
  if (!employeeId || adHistoryBusy.value || !canUploadAd.value) return;
  adHistoryBusy.value = true;
  try {
    await ElMessageBox.confirm(`确认上传证书 ${row.serialNumber} 至 AD？`, '确认 AD 上传', { type: 'warning' });
    await queueEmployeeAdCertificate(employeeId, row.id);
    ElMessage.success('已加入 AD 上传队列');
    if (employeeId === detail.value.id) void loadAdHistory();
  } catch {
    // Request errors are shown by the API client.
  } finally {
    adHistoryBusy.value = false;
  }
}

let employeePageActive = false;
function loadAdUploadSetting() {
  getEmployeeAdUploadEnabled().then(response => { adUploadEnabled.value = unwrap(response) === true; }).catch(() => { adUploadEnabled.value = false; });
}
const logsOpen = ref(false);
const invalidOpen = ref(false);
const invalidLoading = ref(false);
type EmployeeListRow = Partial<FawvwEmployee> & { applicant?: RaApplicantUserInfo; localRecoveryRequired?: boolean };
const employeeList = ref<EmployeeListRow[]>([]);
const syncLogs = ref<FawvwSyncLog[]>([]);
const invalidRecords = ref<any[]>([]);
const numberChangesOpen = ref(false);
const numberChangesLoading = ref(false);
const numberChanges = ref<FawvwEmployeeNumberChange[]>([]);
const numberChangesTotal = ref(0);
const numberChangesQuery = reactive({ pageNum: 1, pageSize: 10 });
let numberChangesTaskNo = '';
let numberChangesRequest = 0;
const invalidTotal = ref(0);
const invalidTaskNo = ref('');
const orgTree = computed(() => directoryDepartments(localDepartments.value, 1));
const fetchedApplicant = ref<RaApplicantUserInfo>();
const linkedApplicant = computed(() => detail.value.applicant || fetchedApplicant.value);
const applicantDisabled = computed(() => linkedApplicant.value?.status != null && Number(linkedApplicant.value.status) !== 0);
const isLocalAccount = (row: EmployeeListRow) => row.recordSource === 'LOCAL_USER' && row.raUserId != null;
const isLocallyDisabled = (row: EmployeeListRow) => row.localEnabled === false || (row.applicant?.status != null && Number(row.applicant.status) !== 0);
const employmentTagType = (row: EmployeeListRow): 'warning' | 'danger' | 'success' | 'info' => {
  if (row.recordSource !== 'API') return 'warning';
  if (row.sourceStatusName === '离职') return 'danger';
  if (row.sourceStatusName === '在职') return 'success';
  return 'info';
};
const employmentTagText = (row: EmployeeListRow) => (row.recordSource !== 'API' ? '本地' : row.sourceStatusName || row.employeeStatus);
const employeeCanStartBusiness = (employee: Partial<FawvwEmployee>) => employee.identityStatus === 'VALID' && employee.localEnabled !== false
  && (employee.recordSource !== 'API' || isFawvwEmployeeSourceActive(employee.sourceStatus));
const canStartBusiness = computed(() => !applicantDisabled.value && !detail.value.localRecoveryRequired && (detail.value.id != null
  ? employeeCanStartBusiness(detail.value) : isLocalAccount(detail.value)));
const canDeleteEmployee = (employee: Partial<FawvwEmployee>) => ['MANUAL', 'IMPORT'].includes(employee.recordSource || '');
const summary = reactive<FawvwEmployeeSummary>({
  localEmployees: 0,
  activeEmployees: 0,
  foreignEmployees: 0,
  chineseEmployees: 0,
  departments: 0,
  demoEnabled: true
});
const canViewLocalRecovery = computed(() => summary.canViewLocalRecovery ?? auth.hasPermi('ra:admin'));
const canRecoverLocalAccounts = computed(() => summary.canRestoreLocalAccounts ?? (canReadApplicants.value && auth.hasPermi('ra:admin')));
const summaryReady = ref(false);
const summaryFailed = ref(false);
let summaryRequestId = 0;
const syncConfig = reactive<FawvwSyncConfig>({
  enabled: true,
  exportAllowed: false,
  scheduleType: 'DAILY',
  dailyTime: '02:00:00',
  intervalHours: 24,
  pageSize: 1000,
  sourceMode: 'MOCK'
});
const queryParams = reactive<FawvwEmployeeQuery & { source?: string }>({
  pageNum: 1,
  pageSize: 10,
  keyword: '',
  domainAccount: '',
  departmentId: '',
  foreignFlag: null,
  status: '',
  source: ''
});
const logQuery = reactive({
  pageNum: 1,
  pageSize: 10,
  status: ''
});
const invalidQuery = reactive({ pageNum: 1, pageSize: 10 });

const orgTreeProps = { label: 'label', children: 'children' };
function directoryDepartments(nodes: RaDeptTreeOption[], depth: number): FawvwOrgNode[] {
  return nodes.map((node) => ({
    id: String(node.id), label: node.name, depth, childCount: node.children?.length || 0,
    children: directoryDepartments(node.children || [], depth + 1)
  }));
}
const orgTreeData = computed<FawvwOrgNode[]>(() => [
  {
    id: ALL_ORG_ID,
    label: '全部部门',
    depth: 0,
    childCount: localDepartments.value.length,
    children: orgTree.value
  }
]);
const orgIndex = computed(() => {
  const entries = new Map<string, { node: FawvwOrgNode; path: string }>();
  const visit = (nodes: FawvwOrgNode[], parentPath = '') => {
    for (const node of nodes) {
      const path = node.path?.trim() || (parentPath ? `${parentPath} / ${node.label}` : node.label);
      entries.set(node.id, { node, path });
      if (node.children?.length) visit(node.children, path);
    }
  };
  visit(orgTreeData.value[0].children || []);
  return entries;
});
const orgSearchTerm = computed(() => orgKeyword.value.trim().toLowerCase());
const orgMatches = computed(() => {
  const keyword = orgSearchTerm.value;
  if (!keyword) return [];
  const entries = Array.from(orgIndex.value.values());
  return entries
    .map((item) => ({ item, rank: item.node.id.toLowerCase() === keyword || item.node.label.toLowerCase() === keyword ? 0
      : item.node.label.toLowerCase().includes(keyword) ? 1 : item.path.toLowerCase().includes(keyword) ? 2 : -1 }))
    .filter(({ rank }) => rank >= 0)
    .sort((a, b) => a.rank - b.rank)
    .map(({ item }) => item);
});
const selectedOrg = computed(() => orgIndex.value.get(selectedDirectoryNode.value));
const canRemoveSelectedDept = computed(() => (selectedOrg.value?.node.depth ?? 0) > 1
  && auth.hasPermiAnd(['sys:dept:remove', 'ra:admin']));
const dailyTimeValue = computed({
  get: () => syncConfig.dailyTime || '02:00:00',
  set: (value: string) => {
    syncConfig.dailyTime = value || '02:00:00';
  }
});
const syncText = computed(() => {
  if (summaryFailed.value) return '统计加载失败';
  if (!summaryReady.value) return '加载中';
  if (!summary.latestSyncStatus && !summary.latestSyncTime) {
    return '未同步';
  }
  const statusLabels: Record<string, string> = { RUNNING: '同步中', SUCCESS: '同步成功', FAILED: '同步失败' };
  const status = summary.latestSyncStatus || '';
  const totalText = status !== 'RUNNING' && summary.latestSyncEmployees != null ? ` / ${summary.latestSyncEmployees}人` : '';
  return `${statusLabels[status] || status || '已同步'}${totalText}`;
});

const unwrap = (response: any) => {
  const body = response?.data ?? response;
  return body?.data ?? body;
};

const loadSummary = async () => {
  const requestId = ++summaryRequestId;
  summaryFailed.value = false;
  try {
    const data = unwrap(await getFawvwEmployeeSummary()) as FawvwEmployeeSummary | undefined;
    if (pageDisposed || requestId !== summaryRequestId) return;
    if (typeof data?.activeEmployees !== 'number') {
      summaryFailed.value = true;
      return;
    }
    Object.assign(summary, data);
    summaryReady.value = true;
  } catch {
    if (!pageDisposed && requestId === summaryRequestId) summaryFailed.value = true;
  }
};

const loadOrgTree = async () => {
  if (orgLoading.value) return;
  orgLoading.value = true;
  orgLoadFailed.value = false;
  try {
    const { data } = await listDeptSelectTree({ hideEmptyEmployeeOther: true });
    if (!pageDisposed) {
      localDepartments.value = data || [];
      if (queryParams.departmentId && !selectedOrg.value) clearOrgSelection();
    }
  } catch {
    if (!pageDisposed) orgLoadFailed.value = true;
  } finally {
    orgLoading.value = false;
  }
};

let appliedEmployeeFilters: EmployeeDirectoryQuery | undefined;
const exportingEmployees = ref(false);

async function downloadEmployeeInfo() {
  if (exportingEmployees.value || loading.value || employeeListFailed.value || !appliedEmployeeFilters || !summary.exportAllowed) return;
  exportingEmployees.value = true;
  try {
    const response = await exportEmployeeDirectory(appliedEmployeeFilters);
    FileSaver.saveAs(await certificateDownloadBlob(response, 'text/csv'), '员工信息.csv');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导出员工信息失败');
  } finally {
    exportingEmployees.value = false;
  }
}

const loadEmployees = () => {
  const requestId = ++employeeRequestId;
  employeeListRequest?.abort();
  const request = employeeListRequest = new AbortController();
  const isCurrent = () => requestId === employeeRequestId && !pageDisposed;
  loading.value = true;
  employeeListFailed.value = false;
  const filters = localSelected.value ? { status: '', foreignFlag: null } : {};
  const requestedFilters = { ...queryParams, ...filters, departmentId: selectedLocalDeptId.value };
  return pageEmployeeDirectory(requestedFilters, request.signal)
    .then((response) => {
      if (!isCurrent()) return;
      const page = unwrap(response) || {};
      employeeList.value = (page.records || []).map(toEmployeeListRow);
      appliedEmployeeFilters = requestedFilters;
      total.value = Number(page.total || 0);
    })
    .catch(() => {
      if (!isCurrent()) return;
      employeeList.value = [];
      total.value = 0;
      employeeListFailed.value = true;
    })
    .finally(() => {
      if (isCurrent()) {
        employeeListRequest = undefined;
        loading.value = false;
      }
    });
};

function displayedEmployeeDepartment(employee: FawvwEmployee, mappedDepartment?: string) {
  if (employee.recordSource === 'API' && !employee.departmentId && mappedDepartment === '其他') return undefined;
  return mappedDepartment || employee.departmentName;
}

function toEmployeeListRow({ employee, applicant, localRecoveryRequired }: EmployeeDirectoryRow): EmployeeListRow {
  const categories: Record<string, string> = { individual: '个人用户', organization: '企业用户', device: '设备用户' };
  if (employee && employee.recordSource !== 'LOCAL_USER') {
    return { ...employee, applicant, localRecoveryRequired, departmentName: displayedEmployeeDepartment(employee, applicant?.deptName) };
  }
  return { ...employee, applicant, recordSource: 'LOCAL_USER', raUserId: applicant.id, cnName: applicant.username,
    domainAccount: applicant.domainAccount, email: applicant.mail, departmentName: applicant.deptName,
    employeeTypeName: categories[applicant.userCategory || ''] || '-' };
}

const handleQuery = () => {
  queryParams.pageNum = 1;
  loadEmployees();
};

const resetQuery = () => {
  queryParams.keyword = '';
  queryParams.domainAccount = '';
  queryParams.foreignFlag = null;
  queryParams.status = '';
  queryParams.source = '';
  handleQuery();
};

const clearOrgSelection = () => {
  selectedDirectoryNode.value = ALL_ORG_ID;
  queryParams.departmentId = '';
  handleQuery();
};

const handleOrgClick = (node: FawvwOrgNode) => {
  selectedDirectoryNode.value = node.id;
  queryParams.departmentId = selectedLocalDeptId.value || '';
  handleQuery();
};

async function refreshLocalDirectory() {
  await loadOrgTree();
  loadEmployees();
}

async function removeLocalDepartment() {
  const id = selectedLocalDeptId.value;
  if (!id || !canRemoveSelectedDept.value || removingDept.value) return;
  removingDept.value = true;
  try {
    const confirmed = await ElMessageBox.confirm(
      `确认删除「${selectedOrg.value?.node.label}」？有用户、下级部门或历史申请的部门不能删除。`,
      '删除部门', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    ).then(() => true, () => false);
    if (!confirmed) return;
    await removeDept([id]);
    if (selectedLocalDeptId.value === id) {
      selectedDirectoryNode.value = ALL_ORG_ID;
      queryParams.pageNum = 1;
    }
    await refreshLocalDirectory();
    ElMessage.success('部门已删除');
  } finally {
    removingDept.value = false;
  }
}

const applicantRefresh = ref(0);
function refreshApplicants(deletedId?: string | number) {
  applicantRefresh.value++;
  handleQuery();
  loadSummary();
  if (!detailOpen.value || (!isLocalAccount(detail.value) && !detail.value.localRecoveryRequired)) return;
  if (detail.value.localRecoveryRequired || (deletedId != null && String(detail.value.raUserId) === String(deletedId))) {
    ++detailRequestId;
    detailOpen.value = false;
  } else {
    openDetail(detail.value, detailTab.value);
  }
}

const openDetail = (row: EmployeeListRow, tab = 'profile', refresh = true) => {
  const requestId = ++detailRequestId;
  const isCurrent = () => requestId === detailRequestId && !pageDisposed;
  detail.value = row;
  certificateOpen.value = false;
  ++certificateDetailRequest;
  detailOpen.value = true;
  detailTab.value = tab;
  activity.value = { applies: [], employeeCertificates: [] };
  Object.assign(certificateInventory, { rows: [], total: 0, page: 1, loading: false, failed: false });
  reloadCertificateInventory();
  const loadActivity = (request: Promise<unknown>) => {
    activityLoading.value = true;
    request.catch(() => { if (isCurrent()) ElMessage.error('申请与证书记录加载失败'); })
      .finally(() => { if (isCurrent()) activityLoading.value = false; });
  };
  activityLoading.value = false;
  if (isLocalAccount(row) && row.raUserId != null) {
    loadActivity(getEmployeeDirectoryDetails(row.raUserId).then(({ data }) => {
      if (!isCurrent()) return;
      detail.value = toEmployeeListRow(data.person);
      activity.value = data.activity;
    }));
    return;
  }
  if (row.id == null) return;
  loadActivity(getFawvwEmployeeActivity(row.id).then((response) => {
    if (isCurrent()) activity.value = unwrap(response) || { applies: [], employeeCertificates: [] };
  }));
  if (refresh) {
    getFawvwEmployee(row.id).then((response) => {
      const employee = unwrap(response);
      if (isCurrent() && employee) detail.value = { ...row, ...employee, departmentName: displayedEmployeeDepartment(employee, row.applicant?.deptName) };
    }).catch(() => {
      // Keep the selected list record when the detail refresh fails.
    });
  }
};

function changeCertificatePage(page: number) {
  certificateInventory.page = page;
}

function reloadCertificateInventory() {
  certificateRefresh.value++;
}

function employeeDetailTime(value?: string | number) {
  if (typeof value === 'number') return new Date(value).toLocaleString('sv-SE', { hour12: false });
  return String(value ?? '').replace('T', ' ').slice(0, 19) || '-';
}

function certificateSourceLabel(source?: string) {
  const labels: Record<string, string> = { LEGACY_PFX: '存量 PFX 导入', LEGACY_SQL: '历史数据迁移', RA: 'RA 制作', CSR: 'CSR 申请', KMC: 'KMC 托管' };
  return source ? labels[source] || source : '-';
}

async function openCertificate(id: string | number) {
  if (auth.hasPermi('ra:cert') && employeeCertDetail.value) {
    await employeeCertDetail.value.open({ id });
    return;
  }
  const userId = detail.value.raUserId;
  const employeeId = userId == null ? detail.value.id : undefined;
  if (userId == null && employeeId == null) return;
  const request = ++certificateDetailRequest;
  const current = () => request === certificateDetailRequest && !pageDisposed && detailOpen.value && certificateOpen.value;
  selectedCertificate.value = undefined;
  certificateDetailFailed.value = false;
  certificateDetailLoading.value = true;
  certificateOpen.value = true;
  try {
    const { data } = await getEmployeeCertificates({ userId, employeeId, certificateId: id, pageNum: 1, pageSize: 1 });
    if (!current()) return;
    selectedCertificate.value = data?.records?.[0];
    certificateDetailFailed.value = !selectedCertificate.value;
  } catch {
    if (current()) certificateDetailFailed.value = true;
  } finally {
    if (current()) certificateDetailLoading.value = false;
  }
}

const certificateMimeTypes = { cer: 'application/pkix-cert', pem: 'application/x-pem-file', p7b: 'application/x-pkcs7-certificates' };
async function downloadEmployeeCertificate(format: keyof typeof certificateMimeTypes) {
  const certificate = selectedCertificate.value;
  if (!certificate || certificateDownloading.value || !Object.hasOwn(certificateMimeTypes, format)) return;
  certificateDownloading.value = true;
  try {
    const response = await downloadRaCert(certificate.id, format);
    FileSaver.saveAs(await certificateDownloadBlob(response, certificateMimeTypes[format]), `${certificate.serialNumber}.${format}`);
  } catch {
    ElMessage.error('下载失败，请确认有证书下载权限且证书文件仍可用');
  } finally {
    certificateDownloading.value = false;
  }
}

watch(detailOpen, (open) => {
  if (!open) certificateOpen.value = false;
});

watch([
  () => detailOpen.value && detailTab.value === 'qualification' ? detail.value.raUserId : undefined,
  () => detailOpen.value && detailTab.value === 'qualification' && detail.value.raUserId == null ? detail.value.id : undefined,
  () => certificateInventory.page,
  certificateRefresh
], async ([userId, employeeId, page], _, onCleanup) => {
  if (userId == null && employeeId == null) {
    certificateInventory.loading = false;
    return;
  }
  let current = true;
  onCleanup(() => { current = false; });
  certificateInventory.failed = false;
  certificateInventory.loading = true;
  try {
    const { data } = await getEmployeeCertificates({ userId, employeeId, pageNum: page, pageSize: certificateInventory.pageSize });
    if (!current || pageDisposed) return;
    certificateInventory.rows = data?.records || [];
    certificateInventory.total = Number(data?.total) || 0;
  } catch {
    if (current && !pageDisposed) certificateInventory.failed = true;
  } finally {
    if (current && !pageDisposed) certificateInventory.loading = false;
  }
});

watch(() => [detailOpen.value && canReadApplicants.value && !detail.value.applicant ? detail.value.raUserId : undefined, applicantRefresh.value] as const, async ([userId], _, onCleanup) => {
  fetchedApplicant.value = undefined;
  if (!userId) return;
  let current = true;
  onCleanup(() => { current = false; });
  try {
    const response = await getUser(userId, true);
    if (current) fetchedApplicant.value = response.data;
  } catch {
    // Association is retained even when this operator cannot read the applicant's department.
  }
});

watch(() => [route.path, route.query.employeeId, route.query.entry], async ([path, employeeId], _, onCleanup) => {
  const id = directoryQueryId(employeeId);
  if (path !== employeeDirectoryPath || !id) return;
  const version = detailRequestId;
  let current = true;
  onCleanup(() => { current = false; });
  try {
    const employee = unwrap(await getFawvwEmployee(id));
    if (current && version === detailRequestId && employee?.id) openDetail(employee, 'qualification', false);
  } catch {
    // Request errors are handled by the shared client.
  }
}, { immediate: true });

const sourceLabel = (source?: string) => ({ API: '大众接口', MANUAL: '手工创建', IMPORT: '外部导入', LOCAL_USER: '本地创建' } as Record<string, string>)[source || ''] || '-';

function openCreate() {
  Object.assign(createForm, { employeeNo: '', domainAccount: '', birthday: '', cnName: '', email: '', departmentId: selectedLocalDeptId.value || '', gender: '', jobName: '' });
  createOpen.value = true;
}

async function saveEmployee() {
  if (creating.value) return;
  if (!createForm.domainAccount.trim() || !createForm.birthday || !createForm.cnName.trim() || !createForm.departmentId) {
    ElMessage.warning('请填写域账号、生日、姓名和所属部门');
    return;
  }
  creating.value = true;
  try {
    await createFawvwEmployee({ ...createForm });
    createOpen.value = false;
    ElMessage.success('员工已创建');
    await Promise.all([loadEmployees(), loadSummary()]);
  } finally {
    creating.value = false;
  }
}

function openImport() {
  importPreviewRows.value = [];
  importPreviewOpen.value = true;
}

async function downloadImportTemplate() {
  if (downloadingImportTemplate.value) return;
  downloadingImportTemplate.value = true;
  try {
    const blob = await downloadFawvwEmployeeImportTemplate();
    if (!blob.type.includes('spreadsheetml')) {
      ElMessage.error('员工导入模板下载失败');
      return;
    }
    FileSaver.saveAs(blob, '员工导入模板.xlsx');
  } finally {
    downloadingImportTemplate.value = false;
  }
}

async function handleImportFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || importing.value) return;
  importPreviewRows.value = [];
  if (!file.name.toLowerCase().endsWith('.xlsx') || file.size > 5_000_000) {
    ElMessage.warning('只能导入不超过5MB的xlsx文件');
    return;
  }
  importing.value = true;
  try {
    importPreviewRows.value = unwrap(await previewFawvwEmployeeFile(file)) || [];
    if (!importPreviewRows.value.length) ElMessage.warning('文件中没有可导入的员工');
  } finally {
    importing.value = false;
  }
}

async function confirmImport() {
  if (importing.value || !importPreviewRows.value.length) return;
  importing.value = true;
  try {
    const count = unwrap(await importFawvwEmployees(importPreviewRows.value));
    importPreviewOpen.value = false;
    importPreviewRows.value = [];
    ElMessage.success(`已导入 ${count} 名员工`);
    await Promise.all([loadEmployees(), loadSummary()]);
  } finally {
    importing.value = false;
  }
}

async function removeEmployee(row: FawvwEmployee) {
  if (deletingEmployee.value || !canDeleteEmployee(row)) return;
  deletingEmployee.value = true;
  try {
    try {
      await ElMessageBox.confirm(`确定删除员工 ${row.cnName}（${row.domainAccount}）？`, '删除员工', {
        type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消'
      });
    } catch { return; }
    await deleteFawvwEmployee(row.id);
    if (String(detail.value.id) === String(row.id)) detailOpen.value = false;
    if (employeeList.value.length === 1 && queryParams.pageNum > 1) queryParams.pageNum--;
    ElMessage.success('员工已删除');
    await Promise.all([loadEmployees(), loadSummary()]);
  } finally {
    deletingEmployee.value = false;
  }
}

async function changeEmployeeEnabled(enabled: boolean) {
  if (!detail.value.id) return;
  try {
    await ElMessageBox.confirm(enabled ? '确认恢复该员工？' : '停用后将禁止新业务，历史记录仍保留。确认停用？', '员工状态');
  } catch { return; }
  await setFawvwEmployeeEnabled(detail.value.id, enabled);
  detail.value.localEnabled = enabled;
  ElMessage.success(enabled ? '已恢复' : '已停用');
  await Promise.all([loadEmployees(), loadSummary()]);
}

async function confirmAccountOwner(row: any) {
  if (!row.id) return;
  try {
    await ElMessageBox.confirm(`请核实 ${row.cnName}（${row.domainAccount}，出生日期 ${row.birthday || '-'}）为该账号当前持有人。确认后其他身份保持停用，不会继承其自助授权。`, '核验账号归属', { type: 'warning' });
  } catch { return; }
  await confirmFawvwAccountOwner(row.id);
  ElMessage.success('已确认账号归属');
  loadInvalidRecords();
  await Promise.all([loadEmployees(), loadSummary()]);
}

function startStandardApply() {
  const { id, raUserId } = detail.value;
  if (raUserId == null || !canStartBusiness.value) return;
  const person = id == null ? { applicantId: String(raUserId) } : { employeeId: String(id) };
  void router.push({ path: '/ra-certificate/ra-cert-apply', query: { ...person, entry: String(Date.now()) } });
}

function startEmployeeCert() {
  if (detail.value.id && detail.value.identityKey) void router.push({ path: '/ra-cert-management/ra-employee-cert-issue', query: { employeeId: String(detail.value.id), identityKey: detail.value.identityKey, entry: String(Date.now()) } });
}

const stopSyncPolling = () => {
  syncPollVersion++;
  if (syncPollTimer) clearTimeout(syncPollTimer);
};

const watchSyncTask = (taskNo: string) => {
  stopSyncPolling();
  const version = syncPollVersion;
  syncing.value = true;
  const poll = async () => {
    try {
      const log = unwrap(await getFawvwSyncTask(taskNo)) as FawvwSyncLog;
      if (pageDisposed || version !== syncPollVersion) return;
      if (log.status === 'RUNNING') {
        syncPollTimer = setTimeout(poll, 5000);
        return;
      }
      syncing.value = false;
      if (log.status === 'SUCCESS') {
        if (log.errorMessage) ElMessage.warning(log.errorMessage);
        else ElMessage.success(`同步完成：${log.totalEmployees || 0} 名员工`);
      } else {
        ElMessage.error(log.errorMessage || '同步失败，请查看同步记录');
      }
      loadSummary();
      void refreshLocalDirectory();
      if (logsOpen.value) loadLogs();
    } catch {
      if (pageDisposed || version !== syncPollVersion) return;
      syncing.value = false;
      ElMessage.warning('查询同步状态失败，后台任务可能仍在执行，请查看同步记录');
    }
  };
  void poll();
};

const handleSync = async () => {
  if (syncing.value) return;
  syncing.value = true;
  try {
    const log = unwrap(await syncFawvwEmployees()) as FawvwSyncLog;
    if (!pageDisposed) {
      ElMessage.info('同步任务已提交');
      watchSyncTask(log.taskNo);
    }
  } catch {
    syncing.value = false;
  }
};

const resumeSync = async () => {
  const page = unwrap(await pageFawvwSyncLogs({ pageNum: 1, pageSize: 1, status: 'RUNNING' }));
  const running = (page?.records || page?.rows || [])[0] as FawvwSyncLog | undefined;
  if (running && !pageDisposed && !syncing.value) watchSyncTask(running.taskNo);
};

const openConfig = () => {
  loadSyncConfig(true);
};

const loadSyncConfig = (open = false) => {
  getFawvwSyncConfig().then((response) => {
    Object.assign(syncConfig, unwrap(response) || syncConfig);
    configOpen.value = open;
  });
};

const saveConfig = () => {
  savingConfig.value = true;
  saveFawvwSyncConfig(syncConfig)
    .then((response) => {
      Object.assign(syncConfig, unwrap(response) || syncConfig);
      syncConfig.apiSecretKey = '';
      summary.exportAllowed = syncConfig.exportAllowed === true;
      ElMessage.success('同步配置已保存');
      configOpen.value = false;
      loadSummary();
    })
    .finally(() => {
      savingConfig.value = false;
    });
};

const openLogs = () => {
  logsOpen.value = true;
  loadLogs();
};

const loadLogs = () => {
  logsLoading.value = true;
  pageFawvwSyncLogs(logQuery)
    .then((response) => {
      const page = unwrap(response) || {};
      syncLogs.value = page.records || page.rows || [];
      logsTotal.value = Number(page.total || 0);
    })
    .finally(() => {
      logsLoading.value = false;
    });
};

function openNumberChanges(taskNo: string) {
  numberChangesTaskNo = taskNo;
  numberChangesQuery.pageNum = 1;
  numberChanges.value = [];
  numberChangesTotal.value = 0;
  numberChangesOpen.value = true;
  void loadNumberChanges();
}

async function loadNumberChanges() {
  const request = ++numberChangesRequest;
  numberChangesLoading.value = true;
  try {
    const page = unwrap(await pageFawvwEmployeeNumberChanges(numberChangesTaskNo, numberChangesQuery.pageNum, numberChangesQuery.pageSize));
    if (request !== numberChangesRequest) return;
    numberChanges.value = page.records || [];
    numberChangesTotal.value = page.total || 0;
  } finally {
    if (request === numberChangesRequest) numberChangesLoading.value = false;
  }
}

const openInvalidRecords = (row: FawvwSyncLog) => {
  invalidTaskNo.value = row.taskNo;
  invalidQuery.pageNum = 1;
  invalidOpen.value = true;
  loadInvalidRecords();
};

const loadInvalidRecords = () => {
  if (!invalidTaskNo.value) {
    return;
  }
  invalidLoading.value = true;
  pageFawvwInvalidEmployees(invalidTaskNo.value, invalidQuery.pageNum, invalidQuery.pageSize)
    .then((response) => {
      const page = unwrap(response) || {};
      invalidRecords.value = page.records || page.rows || [];
      invalidTotal.value = Number(page.total || 0);
    })
    .finally(() => {
      invalidLoading.value = false;
    });
};

onMounted(() => {
  employeePageActive = true;
  loadAdUploadSetting();
  if (employeeLayout.value) {
    layoutObserver = new ResizeObserver(([entry]) => {
      maxOrgWidth.value = Math.max(240, Math.min(640, Math.floor(entry.contentRect.width - 436)));
    });
    layoutObserver.observe(employeeLayout.value);
  }
  if (employeeColumn.value) {
    employeeColumnObserver = new ResizeObserver(([entry]) => {
      employeePagerCount.value = entry.contentRect.width < 820 ? 5 : 7;
    });
    employeeColumnObserver.observe(employeeColumn.value);
  }
  loadSummary();
  loadSyncConfig();
  loadOrgTree();
  loadEmployees();
  void resumeSync().catch(() => {});
});
onDeactivated(() => { employeePageActive = false; });
onActivated(() => { if (!employeePageActive) { employeePageActive = true; loadAdUploadSetting(); } });

onUnmounted(() => {
  layoutObserver?.disconnect();
  employeeColumnObserver?.disconnect();
  pageDisposed = true;
  employeeListRequest?.abort();
  stopSyncPolling();
});
useRaListRefreshOnReturn(() => {
  loadSummary();
  return refreshLocalDirectory();
});
</script>

<style scoped lang="scss">
.employee-certificate-detail {
  min-height: 48px;
  overflow-wrap: anywhere;
}

.fawvw-employee-page {
  .employee-layout {
    display: grid;
    grid-template-columns: clamp(240px, var(--org-width), min(640px, calc(100% - 436px))) minmax(0, 1fr);
    gap: 16px;
    align-items: stretch;
  }

  .org-column,
  .employee-column {
    min-width: 0;
  }

  .org-panel,
  .employee-panel {
    border-radius: 6px;
  }

  .org-column {
    position: relative;
  }

  .org-panel {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;

    :deep(.el-card__body) {
      display: flex;
      flex-direction: column;
      min-height: 0;
      flex: 1;
    }
  }

  .org-resize-handle {
    position: absolute;
    z-index: 1;
    inset: 0 -14px 0 auto;
    width: 14px;
    display: grid;
    place-items: center;
    cursor: col-resize;
    touch-action: none;

    &::before {
      content: '';
      width: 3px;
      height: 34px;
      border-radius: 2px;
      background: var(--el-border-color);
    }

    &:hover::before,
    &:focus-visible::before {
      background: var(--el-color-primary);
    }
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-weight: 600;
  }

  .org-body {
    margin-top: 12px;
    min-height: 0;
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .org-viewport,
  .org-results {
    min-height: 0;
    overflow: auto;
    scrollbar-gutter: stable;
  }

  .org-viewport:focus-visible {
    outline: 2px solid var(--el-color-primary);
    outline-offset: 2px;
  }

  .org-tree {
    width: max-content;
    min-width: 100%;

    :deep(.el-tree-node__content) {
      padding-right: 12px;
      white-space: nowrap;
    }
  }

  .org-empty,
  .org-result-count {
    padding: 8px 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }

  .org-empty {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .org-results {
    padding: 0;
    margin: 0;
    list-style: none;

    li + li {
      border-top: 1px solid var(--el-border-color-lighter);
    }

    button {
      display: grid;
      gap: 4px;
      width: 100%;
      padding: 8px;
      border: 0;
      background: none;
      color: var(--el-text-color-primary);
      text-align: left;
      cursor: pointer;
      overflow-wrap: anywhere;
    }

    button:hover,
    button[aria-pressed='true'] {
      background: var(--el-color-primary-light-9);
    }

    button:focus-visible {
      outline: 2px solid var(--el-color-primary);
      outline-offset: -2px;
    }

    span {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  .org-selection {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    padding: 8px 10px;
    margin-bottom: 12px;
    border-radius: 4px;
    background: var(--el-color-primary-light-9);
    line-height: 22px;
  }

  .org-selection-label {
    flex: none;
    color: var(--el-text-color-secondary);
  }

  .org-selection-path {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .summary-strip {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(115px, 100%), 1fr));
    gap: 10px;
    align-items: stretch;
    margin-bottom: 12px;

  }

  .metric {
    min-height: 58px;
    padding: 10px 12px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 6px;
    background: var(--el-bg-color);
  }

  .metric-label {
    display: block;
    color: var(--el-text-color-secondary);
    font-size: 12px;
    line-height: 18px;
  }

  .metric strong {
    display: block;
    margin-top: 4px;
    font-size: 20px;
    line-height: 24px;
    color: var(--el-text-color-primary);
  }

  .metric.wide strong {
    font-size: 15px;
  }

  .metric.wide :deep(.el-tag) {
    margin-top: 4px;
  }

  .query-panel {
    margin-bottom: 16px;
    padding: 14px 16px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
  }

  .query-form {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 14px 18px;

    :deep(.el-form-item) {
      flex: 0 1 296px;
      display: flex;
      max-width: 100%;
      min-width: 0;
      margin: 0;
    }

    :deep(.el-form-item__label) {
      white-space: nowrap;
    }

    :deep(.el-form-item__content) {
      min-width: 0;
    }

    :deep(.el-input),
    :deep(.el-select) {
      width: 100%;
    }

    :deep(.query-actions) {
      flex: 0 0 auto;
      margin-left: auto;

      .el-form-item__content {
        flex-wrap: nowrap;
      }
    }
  }

  .toolbar-row {
    display: flex;
    align-items: center;
    gap: 8px 10px;
  }

  .employee-pagination {
    max-width: 100%;
    overflow-x: auto;

    :deep(.el-pagination) {
      float: none;
      width: max-content;
      min-width: 100%;
      flex-wrap: nowrap;
      justify-content: safe flex-end;
    }

    :deep(.el-pagination__sizes .el-select) {
      width: 105px;
    }
  }

  .employee-pager {
    display: flex;
    align-items: center;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .employee-pager button,
  .employee-pager-ellipsis {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 32px;
  }

  .employee-pager button {
    border: 0;
    border-radius: 2px;
    color: var(--el-text-color-regular);
    background: var(--el-fill-color-light);
    cursor: pointer;
  }

  .employee-pager button.active {
    color: var(--el-color-white);
    background: var(--el-color-primary);
  }

  .employee-table {
    width: 100%;
  }
}

.employee-ad-divider {
  margin-top: 36px;
  margin-bottom: 20px;
}

.employee-detail-descriptions.employee-ad-summary {
  margin-bottom: 16px;
  :deep(.el-descriptions__label) {
    white-space: nowrap;
  }
  .ad-serial {
    max-width: 100%;
    height: auto;
    white-space: normal;
    text-align: left;
    overflow-wrap: anywhere;
  }
  .ad-serial :deep(span) { display: block; min-width: 0; }
}

.employee-detail-descriptions {
  :deep(.el-descriptions__table) {
    table-layout: fixed;
  }

  :deep(.el-descriptions__label) {
    white-space: nowrap;
  }

  :deep(.el-descriptions__content) {
    overflow-wrap: anywhere;
  }

  .employee-identity-label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .identity-key {
    display: inline-block;
    max-width: 100%;
    overflow-wrap: anywhere;
  }
}

@media (max-width: 1060px) {
  .fawvw-employee-page {
    .employee-layout {
      grid-template-columns: minmax(0, 1fr);
    }

    .org-panel {
      position: static;
    }

    .org-resize-handle {
      display: none;
    }

    .org-viewport,
    .org-results {
      max-height: 280px;
    }
  }
}

</style>
