<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryForm" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item label="证书名称" prop="name">
        <el-input v-model="queryParams.name" placeholder="请输入证书名称" clearable style="width: 240px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-dropdown @command="handleCommand" v-hasPermi="['ca:root:gen']">
          <el-button type="primary" plain>
            创建证书<el-icon class="el-icon--right"><arrow-down /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="root">创建根CA证书</el-dropdown-item>
              <el-dropdown-item command="sub">创建子CA证书</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="certList">
      <el-table-column label="证书名称" align="center" prop="name" />
      <el-table-column label="颁发者" align="center" prop="issuer" />
      <el-table-column label="主题" align="center" prop="subject" />
      <el-table-column label="有效期开始" align="center" prop="notBefore" width="180">
        <template #default="scope">
          <span>{{ parseTime(scope.row.notBefore) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="有效期结束" align="center" prop="notAfter" width="180">
        <template #default="scope">
          <span>{{ parseTime(scope.row.notAfter) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" align="center" width="100">
        <template #default="scope">
          <el-tooltip :content="scope.row.status === '1' ? '证书在有效期内' : '证书已过期或无效'" placement="top">
            <el-tag :type="scope.row.status === '1' ? 'success' : 'info'">{{ scope.row.status === '1' ? '有效' : '无效' }}</el-tag>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" class-name="small-padding" width="380">
        <template #default="scope">
          <el-button link type="primary" icon="View" @click="handleView(scope.row)" v-hasPermi="['ca:root:detail']">详情</el-button>
          <el-dropdown
            trigger="click"
            @command="(command: string) => handleDownload(scope.row, command)"
            v-hasPermi="['ca:root:download']"
          >
            <el-button link type="primary" icon="Download">
              下载<el-icon class="el-icon--right"><arrow-down /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="cert-der">根证书（DER）</el-dropdown-item>
                <el-dropdown-item command="cert-pem">根证书（PEM）</el-dropdown-item>
                <el-dropdown-item command="chain-der">证书链（DER）</el-dropdown-item>
                <el-dropdown-item command="chain-pem">证书链（PEM）</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button link type="success" icon="Stamp" @click="handleAuthorizeProfile(scope.row)" v-hasPermi="['ca:root:authorize']"
            >授权模板</el-button
          >
          <el-button link type="primary" icon="Setting" @click="handleCrlConfig(scope.row)" v-hasPermi="['ca:root:crl-config']">CRL配置</el-button>
          <el-button
            v-if="scope.row.caStatus !== 'inactive'"
            link
            type="warning"
            icon="CircleCloseFilled"
            @click="handleDisable(scope.row)"
            v-hasPermi="['ca:root:disable']"
            >停用</el-button
          >
          <el-button v-else link type="success" icon="SuccessFilled" @click="handleEnable(scope.row)" v-hasPermi="['ca:root:enable']">启用</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <!-- 创建证书对话框 -->
    <el-dialog class="root-cert-dialog" :title="title" v-model="open" width="960px" append-to-body>
      <el-tabs v-model="activeTab">
        <el-tab-pane v-if="dialogType === 'root'" label="自签根证书" name="self">
          <el-form :model="selfForm" :rules="selfRules" ref="selfFormRef" label-width="140px">
            <el-tabs type="border-card">
              <el-tab-pane label="基本信息">
                <el-form-item label="证书名称" prop="name">
                  <el-input v-model="selfForm.name" placeholder="请输入证书名称" />
                </el-form-item>
                <el-form-item label="关联签名者" prop="signerId">
                  <el-select v-model="selfForm.signerId" placeholder="请选择签名者" @change="onSignerChange" style="width: 100%">
                    <el-option v-for="s in signerList" :key="s.id" :label="s.name" :value="s.id" />
                  </el-select>
                </el-form-item>
                <el-form-item label="证书模板" prop="profileId">
                  <el-select v-model="selfForm.profileId" placeholder="请选择模板" @change="onProfileChange" style="width: 100%">
                    <el-option v-for="item in rootCaProfiles" :key="item.id" :label="item.name" :value="item.id" />
                  </el-select>
                </el-form-item>
                <CertSubject v-model="selfForm.subjectItems" propPrefix="subjectItems" />
              </el-tab-pane>

              <el-tab-pane label="有效期配置">
                <el-form-item label="最大有效期" prop="validity">
                  <div class="validity-input">
                    <el-input-number v-model="selfForm.validity" :min="1" :precision="0" controls-position="right" />
                    <el-select v-model="selfForm.validityUnit" class="validity-unit">
                      <el-option label="年" value="y" />
                      <el-option label="天" value="d" />
                    </el-select>
                  </div>
                </el-form-item>
                <el-form-item label="过期周期(天)" prop="expirationPeriod">
                  <el-input-number v-model="selfForm.expirationPeriod" :min="1" style="width: 100%" />
                </el-form-item>
                <el-form-item label="保留过期证书(天)" prop="keepExpiredCertDays">
                  <el-input-number v-model="selfForm.keepExpiredCertDays" style="width: 100%" />
                </el-form-item>
                <el-form-item label="有效期模式" prop="validityMode">
                  <el-select v-model="selfForm.validityMode" style="width: 100%">
                    <el-option label="截止" value="cutoff" />
                    <el-option label="严格" value="strict" />
                    <el-option label="宽松" value="lax" />
                  </el-select>
                </el-form-item>
              </el-tab-pane>

              <el-tab-pane label="CRL配置">
                <div class="crl-help-toolbar">
                  <el-button type="info" text circle :icon="QuestionFilled" @click="showRootCrlHelp = true" />
                </div>
                <el-form-item label="更新间隔(小时)" prop="crlIntervalHours">
                  <el-input-number v-model="selfForm.crlIntervalHours" :min="1" style="width: 100%" />
                </el-form-item>
                <el-form-item label="全量CRL间隔" prop="crlFullIntervals">
                  <el-input-number v-model="selfForm.crlFullIntervals" :min="1" style="width: 100%" />
                </el-form-item>
                <el-form-item label="增量CRL间隔" prop="deltaCrlIntervals">
                  <el-input-number v-model="selfForm.deltaCrlIntervals" :min="0" style="width: 100%" />
                </el-form-item>
                <el-form-item label="重叠时间" prop="crlOverlapValue">
                  <div class="duration-input">
                    <el-input-number v-model="selfForm.crlOverlapValue" :min="1" :precision="0" controls-position="right" />
                    <el-select v-model="selfForm.crlOverlapUnit" class="duration-unit">
                      <el-option label="小时" value="h" />
                      <el-option label="天" value="d" />
                    </el-select>
                  </div>
                </el-form-item>
                <el-form-item label="更新时间点" prop="crlIntervalTime">
                  <el-input v-model="selfForm.crlIntervalTime" placeholder="例如: 00:00" />
                </el-form-item>
                <el-form-item label="下一CRL编号" prop="nextCrlNo">
                  <el-input-number v-model="selfForm.nextCrlNo" :min="1" style="width: 100%" />
                </el-form-item>
              </el-tab-pane>

              <el-tab-pane label="URI配置">
                <el-form-item v-for="(item, index) in selfForm.cacertUris" :key="'cacert-' + index" :label="index === 0 ? 'CA证书URI' : ' '">
                  <div style="display: flex; width: 100%">
                    <el-input v-model="item.value" style="flex: 1; margin-right: 10px" />
                    <el-button v-if="index === 0" @click="addUri('cacertUris')" type="primary" :icon="Plus" circle size="small" />
                    <el-button v-if="index !== 0" @click="removeUri('cacertUris', index)" type="danger" :icon="Minus" circle size="small" />
                  </div>
                </el-form-item>

                <el-form-item v-for="(item, index) in selfForm.crlUris" :key="'crl-' + index" :label="index === 0 ? 'CRL URI' : ' '">
                  <div style="display: flex; width: 100%">
                    <el-input v-model="item.value" style="flex: 1; margin-right: 10px" />
                    <el-button v-if="index === 0" @click="addUri('crlUris')" type="primary" :icon="Plus" circle size="small" />
                    <el-button v-if="index !== 0" @click="removeUri('crlUris', index)" type="danger" :icon="Minus" circle size="small" />
                  </div>
                </el-form-item>

                <el-form-item v-for="(item, index) in selfForm.deltaCrlUris" :key="'delta-crl-' + index" :label="index === 0 ? 'Delta CRL URI' : ' '">
                  <div style="display: flex; width: 100%">
                    <el-input v-model="item.value" style="flex: 1; margin-right: 10px" />
                    <el-button v-if="index === 0" @click="addUri('deltaCrlUris')" type="primary" :icon="Plus" circle size="small" />
                    <el-button v-if="index !== 0" @click="removeUri('deltaCrlUris', index)" type="danger" :icon="Minus" circle size="small" />
                  </div>
                </el-form-item>

                <el-form-item v-for="(item, index) in selfForm.ocspUris" :key="'ocsp-' + index" :label="index === 0 ? 'OCSP URI' : ' '">
                  <div style="display: flex; width: 100%">
                    <el-input v-model="item.value" style="flex: 1; margin-right: 10px" />
                    <el-button v-if="index === 0" @click="addUri('ocspUris')" type="primary" :icon="Plus" circle size="small" />
                    <el-button v-if="index !== 0" @click="removeUri('ocspUris', index)" type="danger" :icon="Minus" circle size="small" />
                  </div>
                </el-form-item>
              </el-tab-pane>

              <el-tab-pane label="高级配置">
                <el-form-item label="序列号长度" prop="snSize">
                  <el-input-number v-model="selfForm.snSize" :min="1" style="width: 100%" />
                </el-form-item>
                <el-form-item label="状态" prop="status">
                  <el-select v-model="selfForm.status" style="width: 100%">
                    <el-option label="激活" value="active" />
                    <el-option label="停用" value="inactive" />
                  </el-select>
                </el-form-item>
              </el-tab-pane>
            </el-tabs>
          </el-form>
        </el-tab-pane>
        <el-tab-pane v-if="dialogType === 'sub'" label="在线签发模式" name="online">
          <el-form ref="onlineSubFormRef" :model="onlineSubForm" :rules="onlineSubRules" label-width="140px">
            <el-form-item label="证书名称" prop="name">
              <el-input v-model="onlineSubForm.name" placeholder="请输入证书名称" />
            </el-form-item>
            <el-form-item label="父级CA" prop="parentCaId">
              <el-select v-model="onlineSubForm.parentCaId" placeholder="请选择父级CA" @change="onParentCaChange" style="width: 100%">
                <el-option v-for="item in certList" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="签名者" prop="signerId">
              <el-select v-model="onlineSubForm.signerId" placeholder="请选择未使用的签名者" @change="onSubSignerChange" style="width: 100%">
                <el-option v-for="s in availableSubSignerList" :key="s.id" :label="s.name" :value="s.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="证书模板" prop="profileId">
              <el-select v-model="onlineSubForm.profileId" placeholder="请选择子CA模板" @change="onSubProfileChange" style="width: 100%">
                <el-option v-for="item in subCaProfiles" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
            </el-form-item>
            <CertSubject v-model="onlineSubForm.subjectItems" propPrefix="subjectItems" />
            <el-form-item label="密钥算法" prop="keyAlgorithm">
              <el-select v-model="onlineSubForm.keyAlgorithm" style="width: 100%">
                <el-option v-for="item in subAvailableAlgos" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
            <el-form-item label="有效期" prop="validity">
              <div class="validity-input">
                <el-input-number
                  v-model="onlineSubForm.validity"
                  :min="1"
                  :precision="0"
                  controls-position="right"
                  @change="onlineSubFormRef?.validateField('validity')"
                />
                <el-select v-model="onlineSubForm.validityUnit" class="validity-unit" @change="onlineSubFormRef?.validateField('validity')">
                  <el-option label="年" value="y" />
                  <el-option label="天" value="d" />
                </el-select>
              </div>
            </el-form-item>
            <el-form-item v-if="onlineSubForm.extensionItems.length > 0" label="扩展信息">
              <div class="sub-extension-list">
                <div v-for="(ext, extIndex) in onlineSubForm.extensionItems" :key="ext.key" class="sub-extension-item">
                  <div class="sub-extension-title">
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
                      <el-button icon="Delete" circle :disabled="ext.names.length <= 1" @click="removeSubSanName(extIndex, nameIndex)" />
                    </div>
                    <el-button type="primary" link icon="Plus" @click="addSubSanName(extIndex)">添加备用名称</el-button>
                  </template>
                  <template v-else-if="ext.kind === 'subjectInfoAccess'">
                    <div v-for="(access, accessIndex) in ext.accesses" :key="`${ext.key}-${accessIndex}`" class="sia-row">
                      <el-select
                        v-model="access.accessMethodOid"
                        placeholder="访问方法"
                        style="width: 190px"
                        @change="onSubSiaAccessMethodChange(extIndex, accessIndex)"
                      >
                        <el-option
                          v-for="method in ext.accessMethods"
                          :key="method.oid"
                          :label="method.description || method.oid"
                          :value="method.oid"
                        />
                      </el-select>
                      <el-select v-model="access.locationType" placeholder="位置类型" style="width: 130px">
                        <el-option v-for="mode in access.modes" :key="mode" :label="getSanModeLabel(mode)" :value="mode" />
                      </el-select>
                      <el-input v-model="access.locationValue" :placeholder="getSanPlaceholder(access.locationType)" />
                      <el-button icon="Delete" circle :disabled="ext.accesses.length <= 1" @click="removeSubSiaAccess(extIndex, accessIndex)" />
                    </div>
                    <el-button type="primary" link icon="Plus" @click="addSubSiaAccess(extIndex)">添加访问位置</el-button>
                  </template>
                  <template v-else-if="ext.kind === 'keyUsage'">
                    <el-checkbox-group v-model="ext.usages" class="key-usage-checkbox-group">
                      <el-checkbox v-for="usage in keyUsageOptions" :key="usage.value" :label="usage.value">
                        <span class="key-usage-label">{{ usage.label }}</span>
                        <span class="key-usage-value">{{ usage.value }}</span>
                      </el-checkbox>
                    </el-checkbox-group>
                  </template>
                  <template v-else>
                    <el-input v-model="ext.value" type="textarea" :rows="3" :placeholder="`请输入 ${ext.label} 的 JSON 或文本值`" />
                  </template>
                </div>
              </div>
            </el-form-item>
          </el-form>
        </el-tab-pane>
        <el-tab-pane v-if="dialogType === 'sub'" label="CSR导入模式" name="import">
          <el-form ref="importFormRef" :model="importForm" :rules="importRules" label-width="100px">
            <el-form-item label="证书名称" prop="name">
              <el-input v-model="importForm.name" placeholder="请输入证书名称" />
            </el-form-item>
            <el-form-item label="CSR生成">
              <el-button type="primary" @click="handleGenerateCSR">生成 CSR</el-button>
              <el-input v-if="importForm.csr" v-model="importForm.csr" type="textarea" :rows="4" readonly style="margin-top: 10px" />
            </el-form-item>
            <el-form-item label="上传证书" prop="certFile">
              <el-upload
                ref="uploadRef"
                action="#"
                :limit="1"
                :auto-upload="false"
                :on-change="handleFileChange"
                :on-remove="handleFileRemove"
                accept=".cer,.crt,.pem"
              >
                <el-button type="primary">点击上传</el-button>
                <template #tip>
                  <div class="el-upload__tip">请上传由上级CA签发的证书文件</div>
                </template>
              </el-upload>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <el-drawer v-model="showRootCrlHelp" title="CRL配置说明" direction="rtl" size="520px">
      <div class="crl-help-content">
        <h4>签发调度</h4>
        <p>CRL配置用于控制根CA注销列表的周期签发。创建根CA后，可在根证书列表的“CRL配置”中维护同一组参数并启动签发线程。</p>
        <ul>
          <li><strong>更新间隔(小时)：</strong>签发线程检查CRL的基础周期，单位为小时。</li>
          <li><strong>全量CRL间隔：</strong>每经过多少个更新间隔签发一次全量CRL。默认4，更新间隔为6小时时即每24小时发布一次。</li>
          <li><strong>增量CRL间隔：</strong>每经过多少个更新间隔签发一次增量CRL。默认1表示每6小时发布一次；填0表示不启用增量CRL周期签发。</li>
        </ul>
        <h4>有效期与编号</h4>
        <ul>
          <li><strong>重叠时间：</strong>新旧CRL的有效期重叠窗口，默认1小时，用于覆盖发布延迟和客户端缓存刷新时间。</li>
          <li><strong>更新时间点：</strong>每天优先触发检查的时间点，格式为HH:mm，例如00:00。</li>
          <li><strong>下一CRL编号：</strong>下一次签发使用的CRL编号，新建根CA默认从1开始。</li>
        </ul>
        <h4>URI配置</h4>
        <p>CRL URI和Delta CRL URI在“URI配置”页填写，会写入证书扩展，供客户端定位全量CRL和增量CRL发布地址。</p>
      </div>
    </el-drawer>

    <!-- 详情弹窗 -->
    <el-dialog v-model="showDetail" title="证书详情" width="60%">
      <X509Cert v-if="showDetail" :certPem="currentCertPem" />
    </el-dialog>

    <el-card v-if="crlConfigDialog.visible" ref="crlConfigPanelRef" class="crl-config-panel" shadow="never">
      <template #header>
        <div class="crl-config-header">
          <div>
            <div class="crl-config-title">{{ crlConfigDialog.title }}</div>
            <div class="crl-config-subtitle">直接在根证书列表下方维护签发策略、发布地址和手动签发操作。</div>
          </div>
          <div class="crl-config-actions">
            <el-tag :type="crlConfigForm.schedulerRunning ? 'success' : 'info'" effect="light">
              {{ crlConfigForm.schedulerRunning ? '线程运行中' : '线程已停止' }}
            </el-tag>
            <el-button link type="primary" @click="refreshCrlConfig">刷新状态</el-button>
            <el-button link type="info" @click="closeCrlConfig">收起</el-button>
          </div>
        </div>
      </template>

      <el-form ref="crlConfigFormRef" :model="crlConfigForm" label-width="150px">
        <el-tabs type="border-card">
          <el-tab-pane label="签发配置">
            <el-row :gutter="16">
              <el-col :xs="24" :sm="12" :lg="8">
                <el-form-item label="更新间隔(小时)" prop="intervalHours">
                  <el-select v-model="crlConfigForm.intervalHours" style="width: 100%">
                    <el-option v-for="item in [1, 2, 3, 4, 6, 8, 12, 24]" :key="item" :label="item + '小时'" :value="item" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12" :lg="8">
                <el-form-item label="全量CRL间隔" prop="fullCrlIntervals">
                  <el-input-number v-model="crlConfigForm.fullCrlIntervals" :min="1" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12" :lg="8">
                <el-form-item label="增量CRL间隔" prop="deltaCrlIntervals">
                  <el-input-number v-model="crlConfigForm.deltaCrlIntervals" :min="0" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12" :lg="8">
                <el-form-item label="下一CRL编号" prop="nextCrlNumber">
                  <el-input-number v-model="crlConfigForm.nextCrlNumber" :min="1" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12" :lg="8">
                <el-form-item label="重叠时间" prop="overlapValue">
                  <div class="duration-input">
                    <el-input-number v-model="crlConfigForm.overlapValue" :min="1" :precision="0" controls-position="right" />
                    <el-select v-model="crlConfigForm.overlapUnit" class="duration-unit">
                      <el-option label="小时" value="h" />
                      <el-option label="天" value="d" />
                    </el-select>
                  </div>
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12" :lg="8">
                <el-form-item label="更新时间点" prop="intervalTime">
                  <el-input v-model="crlConfigForm.intervalTime" placeholder="例如: 00:00" />
                </el-form-item>
              </el-col>
            </el-row>
          </el-tab-pane>
          <el-tab-pane label="发布地址">
            <el-form-item v-for="(item, index) in crlConfigForm.crlUris" :key="'cfg-crl-' + index" :label="index === 0 ? '全量CRL URI' : ' '">
              <div class="uri-row">
                <el-input v-model="item.value" />
                <el-button v-if="index === 0" @click="addCrlConfigUri('crlUris')" type="primary" :icon="Plus" circle size="small" />
                <el-button v-if="index !== 0" @click="removeCrlConfigUri('crlUris', index)" type="danger" :icon="Minus" circle size="small" />
              </div>
            </el-form-item>
            <el-form-item
              v-for="(item, index) in crlConfigForm.deltaCrlUris"
              :key="'cfg-delta-crl-' + index"
              :label="index === 0 ? '增量CRL URI' : ' '"
            >
              <div class="uri-row">
                <el-input v-model="item.value" />
                <el-button v-if="index === 0" @click="addCrlConfigUri('deltaCrlUris')" type="primary" :icon="Plus" circle size="small" />
                <el-button v-if="index !== 0" @click="removeCrlConfigUri('deltaCrlUris', index)" type="danger" :icon="Minus" circle size="small" />
              </div>
            </el-form-item>
          </el-tab-pane>
          <el-tab-pane label="发布操作">
            <el-form-item label="目标发布者">
              <el-select v-model="crlConfigForm.publisherId" placeholder="不选择则发布到CA关联发布者" clearable filterable style="width: 100%">
                <el-option v-for="item in publisherList" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="发布记录">
              <el-table :data="crlOperationRecords" size="small" max-height="220" empty-text="暂无本次操作记录">
                <el-table-column label="时间" prop="time" width="110" />
                <el-table-column label="操作" prop="action" width="130" />
                <el-table-column label="CRL编号" prop="crlNo" width="120" />
                <el-table-column label="目标" prop="publisherName" min-width="150" show-overflow-tooltip />
                <el-table-column label="结果" prop="status" width="90">
                  <template #default="scope">
                    <el-tag :type="scope.row.status === '成功' ? 'success' : 'danger'">{{ scope.row.status }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="说明" prop="message" min-width="180" show-overflow-tooltip />
              </el-table>
            </el-form-item>
          </el-tab-pane>
        </el-tabs>
      </el-form>

      <div class="crl-config-footer">
        <el-button type="primary" @click="submitCrlConfig" v-hasPermi="['ca:root:crl-config']">保 存</el-button>
        <el-button type="success" @click="issueCrl(false)" v-hasPermi="['ca:root:crl-config']">签发全量CRL</el-button>
        <el-button type="warning" @click="issueCrl(true)" v-hasPermi="['ca:root:crl-config']">签发增量CRL</el-button>
        <el-button type="success" plain @click="issueAndPublishCrl(false)" v-if="proxy?.$auth.hasPermiAnd(['ca:root:crl-config', 'ca:crl:publish'])"
          >签发并发布全量</el-button
        >
        <el-button type="warning" plain @click="issueAndPublishCrl(true)" v-if="proxy?.$auth.hasPermiAnd(['ca:root:crl-config', 'ca:crl:publish'])"
          >签发并发布增量</el-button
        >
        <el-button v-if="!crlConfigForm.schedulerRunning" type="primary" @click="startCrlScheduler" v-hasPermi="['ca:root:crl-config']"
          >启动线程</el-button
        >
        <el-button v-else type="danger" @click="stopCrlScheduler" v-hasPermi="['ca:root:crl-config']">停止线程</el-button>
      </div>
    </el-card>

    <!-- 安全确认对话框 -->
    <SecurityConfirm
      v-model="securityConfirm.visible"
      :title="securityConfirm.title"
      :action="securityConfirm.action"
      @confirm="securityConfirm.onConfirm"
    />
  </div>
</template>

<script setup name="RootCert" lang="ts">
import { ref, reactive, toRefs, getCurrentInstance, ComponentInternalInstance, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, FormInstance, UploadInstance, UploadProps } from 'element-plus';
import {
  ArrowDown,
  Search,
  Refresh,
  View,
  Download,
  Plus,
  Minus,
  Stamp,
  QuestionFilled,
  Edit,
  Delete,
  SuccessFilled,
  CircleCloseFilled
} from '@element-plus/icons-vue';
import X509Cert from '@/components/X509Cert/index.vue';
import SecurityConfirm from '@/components/SecurityConfirm/index.vue';
import CertSubject, { typeMapping, sortSubjectItems } from '@/components/CertSubject/index.vue';
import { listProfile, getProfile } from '@/api/ca/profile';
import { listSigner } from '@/api/ca/signer';
import {
  listRootCa,
  getRootCa,
  genRootCa,
  enableRootCa,
  disableRootCa,
  revokeRootCa,
  genSubCaOnline,
  getRootCrlConfig,
  saveRootCrlConfig,
  issueRootCrl,
  startRootCrlScheduler,
  stopRootCrlScheduler
} from '@/api/ca/root';
import { pagePublisher } from '@/api/ca/publisher';
import { publishCrl } from '@/api/crl';
import { X509 } from 'jsrsasign';
import { parseJson, parseKeyAlgorithms } from '@/utils/json';
import { parseTime } from '@/utils/ruoyi';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;
const router = useRouter();

const securityConfirm = reactive({
  visible: false,
  title: '敏感操作安全确认',
  action: '',
  onConfirm: () => {}
});

const crlConfigDialog = reactive({
  visible: false,
  title: 'CRL配置',
  rootId: undefined as string | number | undefined
});

const crlConfigForm = reactive({
  intervalHours: 6,
  fullCrlIntervals: 4,
  deltaCrlIntervals: 1,
  fullCrlThreads: 1,
  deltaCrlThreads: 1,
  overlapValue: 1,
  overlapUnit: 'h',
  intervalTime: '00:00',
  nextCrlNumber: 1,
  crlUris: [{ value: '' }],
  deltaCrlUris: [{ value: '' }],
  schedulerRunning: false,
  publisherId: undefined as string | number | undefined
});

const loading = ref(false);
const showSearch = ref(true);
const total = ref(0);
const certList = ref([]);
const open = ref(false);
const title = ref('');
const activeTab = ref('self');
const showRootCrlHelp = ref(false);
const showDetail = ref(false);
const currentCertPem = ref('');
const dialogType = ref('root'); // 'root' or 'sub'
const rootCaProfiles = ref([]);
const signerList = ref([]);
const publisherList = ref<any[]>([]);
const crlOperationRecords = ref<any[]>([]);
const availableAlgos = ref(['RSA2048', 'RSA4096', 'SM2']);

const queryForm = ref<FormInstance>();

const data = reactive({
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    name: undefined
  },
  selfForm: {
    name: '',
    signerId: undefined as string | number | undefined,
    profileId: undefined as string | number | undefined,
    rootcaProfileName: '', // 模板名称
    subjectItems: [] as any[],
    // 密钥配置
    keyAlgorithm: 'SM2',
    signerType: 'PKCS12',
    keyIndex: 1,
    password: '',
    // 有效期配置
    validity: 10,
    validityUnit: 'y',
    expirationPeriod: 365,
    keepExpiredCertDays: -1,
    validityMode: 'cutoff',
    // CRL配置
    crlIntervalHours: 6,
    crlFullIntervals: 4,
    deltaCrlIntervals: 1,
    fullCrlThreads: 1,
    deltaCrlThreads: 1,
    crlOverlapValue: 1,
    crlOverlapUnit: 'h',
    crlIntervalTime: '00:00',
    nextCrlNo: 1,
    // URI配置
    cacertUris: [{ value: 'https://myorg.org/rootca1.der' }],
    crlUris: [{ value: 'https://localhost:8081/dummy/crl/?type=crl&name=rootca1' }],
    deltaCrlUris: [{ value: '' }],
    ocspUris: [{ value: 'https://localhost:8080/ocsp/responder1' }],
    // 高级配置
    snSize: 20,
    status: 'active'
  },
  importForm: {
    name: '',
    csr: '',
    certFile: null as File | null
  },
  onlineSubForm: {
    name: '',
    parentCaId: undefined as string | number | undefined,
    signerId: undefined as string | number | undefined,
    profileId: undefined as string | number | undefined,
    subjectItems: [] as any[],
    extensionItems: [] as any[],
    keyAlgorithm: 'SM2',
    validity: 5,
    validityUnit: 'y'
  }
});

const { queryParams, selfForm, importForm, onlineSubForm } = toRefs(data);

/** 签名者变更处理 */
function onSignerChange(val: any) {
  const signer = signerList.value.find((s: any) => s.id === val);
  if (signer) {
    selfForm.value.keyAlgorithm = signer.algo;
    selfForm.value.signerType = signer.signerType;
    selfForm.value.keyIndex = signer.keyIndex;
    selfForm.value.password = signer.password;
  }
}

/** 加载签名者列表 */
async function loadSigners() {
  try {
    const res = await listSigner();
    signerList.value = res.data || [];
    if (!selfForm.value.signerId && signerList.value.length > 0) {
      selfForm.value.signerId = (signerList.value[0] as any).id;
      onSignerChange(selfForm.value.signerId);
    }
  } catch (e) {}
}

function refreshAvailableSubSigners() {
  const usedSignerIds = new Set(
    (certList.value || [])
      .map((item: any) => item.signerId)
      .filter((id: any) => id !== undefined && id !== null && id !== '')
      .map((id: any) => String(id))
  );
  availableSubSignerList.value = (signerList.value || []).filter((signer: any) => !usedSignerIds.has(String(signer.id)));
  if (!availableSubSignerList.value.some((signer: any) => String(signer.id) === String(onlineSubForm.value.signerId))) {
    onlineSubForm.value.signerId = availableSubSignerList.value[0]?.id;
  }
  if (onlineSubForm.value.signerId) {
    onSubSignerChange(onlineSubForm.value.signerId);
  }
}

function onSubSignerChange(val: any) {
  const signer = availableSubSignerList.value.find((s: any) => String(s.id) === String(val));
  if (signer?.algo) {
    onlineSubForm.value.keyAlgorithm = signer.algo;
  }
}

const parentCas = ref([]);
const subCaProfiles = ref([]);
const availableSubSignerList = ref<any[]>([]);
const subAvailableAlgos = ref(['RSA2048', 'SM2']);

const keyUsageOptions = [
  { value: 'digitalSignature', label: '数字签名' },
  { value: 'nonRepudiation', label: '不可否认/内容承诺' },
  { value: 'keyEncipherment', label: '密钥加密' },
  { value: 'dataEncipherment', label: '数据加密' },
  { value: 'keyAgreement', label: '密钥协商' },
  { value: 'keyCertSign', label: '证书签名' },
  { value: 'cRLSign', label: 'CRL签名' },
  { value: 'encipherOnly', label: '仅加密' },
  { value: 'decipherOnly', label: '仅解密' }
];

const keyUsageAliasMap: Record<string, string> = {
  '0': 'digitalSignature',
  '1': 'nonRepudiation',
  '2': 'keyEncipherment',
  '3': 'dataEncipherment',
  '4': 'keyAgreement',
  '5': 'keyCertSign',
  '6': 'cRLSign',
  '7': 'encipherOnly',
  '8': 'decipherOnly',
  contentCommitment: 'nonRepudiation'
};

function formatDuration(value: any, unit: any) {
  const numericValue = Number(value);
  return `${Number.isFinite(numericValue) && numericValue > 0 ? Math.floor(numericValue) : 1}${unit || 'h'}`;
}

function parseDuration(value: any, defaultValue = 1, defaultUnit = 'h') {
  const match = String(value || '').trim().match(/^(\d+)\s*([hd])$/i);
  if (!match) {
    return { value: defaultValue, unit: defaultUnit };
  }
  return { value: Number(match[1]), unit: match[2].toLowerCase() };
}

const onlineSubRules = {
  parentCaId: [{ required: true, message: '请选择父级CA', trigger: 'change' }],
  signerId: [{ required: true, message: '请选择签名者', trigger: 'change' }],
  profileId: [{ required: true, message: '请选择证书模板', trigger: 'change' }],
  validity: [
    { required: true, message: '请输入有效期', trigger: 'blur' },
    { type: 'number', message: '必须为正整数', trigger: 'blur', min: 1 },
    { validator: validateSubCaValidity, trigger: ['blur', 'change'] }
  ]
};

const selfRules = {
  name: [{ required: true, message: '请输入证书名称', trigger: 'blur' }],
  signerId: [{ required: true, message: '请选择签名者', trigger: 'change' }],
  profileId: [{ required: true, message: '请选择证书模板', trigger: 'change' }],
  validity: [
    { required: true, message: '请输入最大有效期', trigger: 'blur' },
    { type: 'number', message: '必须为正整数', trigger: 'blur', min: 1 }
  ]
};

const importRules = {
  name: [{ required: true, message: '请输入证书名称', trigger: 'blur' }],
  certFile: [{ required: true, message: '请上传证书文件', trigger: 'change' }]
};

const selfFormRef = ref<FormInstance>();
const importFormRef = ref<FormInstance>();
const onlineSubFormRef = ref<FormInstance>();
const crlConfigFormRef = ref<FormInstance>();
const crlConfigPanelRef = ref<any>();
const uploadRef = ref<UploadInstance>();

/** 解析 X509 日期格式 */
function parseX509Date(zStr: string): Date {
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
  return new Date(Date.UTC(y as any, m, d as any, h as any, min as any, s as any));
}

/** 格式化 X509 日期为显示格式 */
function formatX509Date(zStr: string): string {
  const date = parseX509Date(zStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function getSubCaNotAfter(value: number, unit: string): Date {
  const notAfter = new Date();
  if (unit === 'd') {
    notAfter.setDate(notAfter.getDate() + value);
  } else {
    notAfter.setFullYear(notAfter.getFullYear() + value);
  }
  return notAfter;
}

function validateSubCaValidity(_rule: any, value: number, callback: (error?: Error) => void) {
  if (!value || value <= 0 || !onlineSubForm.value.parentCaId) {
    callback();
    return;
  }
  const parentCa = certList.value.find((item: any) => item.id === onlineSubForm.value.parentCaId);
  if (!parentCa?.notAfterTime) {
    callback();
    return;
  }
  const subCaNotAfter = getSubCaNotAfter(value, onlineSubForm.value.validityUnit);
  if (subCaNotAfter.getTime() > parentCa.notAfterTime) {
    callback(new Error('子CA有效期不能大于上级根证书有效期'));
    return;
  }
  callback();
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

function normalizeKeyUsageValue(usage: any) {
  const raw =
    typeof usage === 'string'
      ? usage
      : usage?.value || usage?.name || usage?.description || usage?.oid || usage?.keyUsage?.description || usage?.keyUsage?.oid || '';
  const value = String(raw || '').trim();
  return keyUsageAliasMap[value] || value;
}

function getTemplateKeyUsages(ext: any) {
  const values = (ext?.keyUsage?.usages || [])
    .map(normalizeKeyUsageValue)
    .filter((value: string) => keyUsageOptions.some((item) => item.value === value));
  return Array.from(new Set(values));
}

function buildSubCaExtensionItems(extensions: any[]) {
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
      if (key === 'subjectinfoaccess') {
        const accessMethods = (ext?.subjectInfoAccess?.accesses || []).map((access: any) => ({
          oid: access?.accessMethod?.oid || '',
          description: access?.accessMethod?.description || access?.accessMethod?.oid || '',
          modes: access?.accessLocation?.modes?.length ? access.accessLocation.modes : ['uniformResourceIdentifier']
        }));
        const defaultMethod = accessMethods[0] || {
          oid: '1.3.6.1.5.5.7.48.5',
          description: 'ad-caRepository',
          modes: ['uniformResourceIdentifier']
        };
        return {
          key: `${meta.oid || meta.description || 'sia'}-${index}`,
          kind: 'subjectInfoAccess',
          label: getExtensionLabel(ext),
          oid: meta.oid,
          description: meta.description,
          critical: !!ext.critical,
          required: ext.inRequest === 'required' || !!ext.required,
          accessMethods,
          accesses: [
            {
              accessMethodOid: defaultMethod.oid,
              locationType: defaultMethod.modes[0],
              locationValue: '',
              modes: defaultMethod.modes
            }
          ]
        };
      }
      if (key === 'keyusage') {
        return {
          key: `${meta.oid || meta.description || 'keyusage'}-${index}`,
          kind: 'keyUsage',
          label: getExtensionLabel(ext),
          oid: meta.oid || '2.5.29.15',
          description: meta.description || 'keyUsage',
          critical: !!ext.critical,
          required: ext.inRequest === 'required' || !!ext.required,
          usages: getTemplateKeyUsages(ext)
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

function addSubSanName(extIndex: number) {
  const ext = onlineSubForm.value.extensionItems[extIndex];
  if (!ext) return;
  ext.names.push({ type: ext.modes?.[0] || 'DNSName', value: '' });
}

function removeSubSanName(extIndex: number, nameIndex: number) {
  const ext = onlineSubForm.value.extensionItems[extIndex];
  if (!ext || ext.names.length <= 1) return;
  ext.names.splice(nameIndex, 1);
}

function getSubSiaAccessMethod(ext: any, oid: string) {
  return (ext.accessMethods || []).find((method: any) => method.oid === oid) || ext.accessMethods?.[0];
}

function addSubSiaAccess(extIndex: number) {
  const ext = onlineSubForm.value.extensionItems[extIndex];
  if (!ext) return;
  const method = ext.accessMethods?.[0] || {
    oid: '1.3.6.1.5.5.7.48.5',
    description: 'ad-caRepository',
    modes: ['uniformResourceIdentifier']
  };
  ext.accesses.push({
    accessMethodOid: method.oid,
    locationType: method.modes?.[0] || 'uniformResourceIdentifier',
    locationValue: '',
    modes: method.modes || ['uniformResourceIdentifier']
  });
}

function removeSubSiaAccess(extIndex: number, accessIndex: number) {
  const ext = onlineSubForm.value.extensionItems[extIndex];
  if (!ext || ext.accesses.length <= 1) return;
  ext.accesses.splice(accessIndex, 1);
}

function onSubSiaAccessMethodChange(extIndex: number, accessIndex: number) {
  const ext = onlineSubForm.value.extensionItems[extIndex];
  const access = ext?.accesses?.[accessIndex];
  if (!ext || !access) return;
  const method = getSubSiaAccessMethod(ext, access.accessMethodOid);
  access.modes = method?.modes?.length ? method.modes : ['uniformResourceIdentifier'];
  if (!access.modes.includes(access.locationType)) {
    access.locationType = access.modes[0];
  }
}

function buildSubCaExtensionsPayload() {
  const extensions = (onlineSubForm.value.extensionItems || [])
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
      if (ext.kind === 'subjectInfoAccess') {
        const accesses = (ext.accesses || [])
          .filter((access: any) => access.locationValue && String(access.locationValue).trim())
          .map((access: any) => {
            const method = getSubSiaAccessMethod(ext, access.accessMethodOid);
            return {
              accessMethod: {
                oid: access.accessMethodOid,
                description: method?.description || access.accessMethodOid
              },
              accessLocation: {
                type: access.locationType,
                value: String(access.locationValue).trim()
              }
            };
          });
        if (!accesses.length) return null;
        return {
          type: { oid: ext.oid, description: ext.description },
          critical: ext.critical,
          subjectInfoAccess: { accesses }
        };
      }
      if (ext.kind === 'keyUsage') {
        const usages = (ext.usages || []).filter((usage: string) => keyUsageOptions.some((item) => item.value === usage));
        if (!usages.length) return null;
        return {
          type: { oid: ext.oid || '2.5.29.15', description: ext.description || 'keyUsage' },
          critical: ext.critical,
          keyUsage: { usages }
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

function validateSubCaExtensions() {
  for (const ext of onlineSubForm.value.extensionItems || []) {
    if (!ext.required) continue;
    if (ext.kind === 'subjectAlternativeName') {
      const hasValue = (ext.names || []).some((name: any) => name.value && String(name.value).trim());
      if (!hasValue) {
        ElMessage.warning(`请输入${ext.label}`);
        return false;
      }
    } else if (ext.kind === 'subjectInfoAccess') {
      const hasValue = (ext.accesses || []).some((access: any) => access.locationValue && String(access.locationValue).trim());
      if (!hasValue) {
        ElMessage.warning(`请输入${ext.label}`);
        return false;
      }
    } else if (ext.kind === 'keyUsage') {
      if (!ext.usages || ext.usages.length === 0) {
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

/** 解析证书信息 */
function parseCertInfo(certPem: string) {
  if (!certPem) return null;

  const x509 = new X509();
  try {
    x509.readCertPEM(certPem);

    // 格式化 DN
    const formatDN = (array: any[]) => {
      if (!array || array.length === 0) return '';
      return array
        .map((e: any) => {
          const type = e[0].type;
          const val = e[0].value;
          return `${type}=${val}`;
        })
        .join(', ');
    };

    const issuer = formatDN(x509.getIssuer().array);
    const subject = formatDN(x509.getSubject().array);
    const notBefore = x509.getNotBefore();
    const notAfter = x509.getNotAfter();

    // 判断证书状态（是否在有效期内）
    const now = new Date();
    const notBeforeDate = parseX509Date(notBefore);
    const notAfterDate = parseX509Date(notAfter);
    const status = now >= notBeforeDate && now <= notAfterDate ? '1' : '0';

    return {
      issuer,
      subject,
      notBefore: formatX509Date(notBefore),
      notAfter: formatX509Date(notAfter),
      notAfterTime: notAfterDate.getTime(),
      status,
      pem: certPem
    };
  } catch (e) {
    return null;
  }
}

/** 查询列表 */
async function getList() {
  loading.value = true;
  try {
    const res = await listRootCa(queryParams.value);

    // 处理分页数据结构
    let rawList = [];
    let totalCount = 0;

    if (res.data) {
      // 尝试不同的数据结构
      if (Array.isArray(res.data.records)) {
        rawList = res.data.records;
        totalCount = res.data.total || 0;
      } else if (Array.isArray(res.data.rows)) {
        rawList = res.data.rows;
        totalCount = res.data.total || 0;
      } else if (Array.isArray(res.data.list)) {
        rawList = res.data.list;
        totalCount = res.data.total || 0;
      } else if (Array.isArray(res.data)) {
        rawList = res.data;
        totalCount = res.data.length;
      }
    }

    // 解析每个证书
    certList.value = rawList
      .map((item: any) => {
        const certInfo = parseCertInfo(item.cert);
        return {
          id: item.id,
          name: item.name,
          caStatus: item.caStatus,
          cert: item.cert,
          certchain: item.certchain,
          ...certInfo
        };
      })
      .filter((item: any) => item.issuer); // 过滤掉解析失败的证书

    total.value = totalCount;
  } catch (error: any) {
    const errMsg = error.response?.data?.msg || error.message || '获取根证书列表失败';
    ElMessage.error(errMsg);
    certList.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

/** 搜索按钮操作 */
function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

/** 重置按钮操作 */
function resetQuery() {
  queryForm.value?.resetFields();
  handleQuery();
}

/** 新增按钮操作 */
async function handleCommand(command: string) {
  reset();
  if (command === 'root') {
    dialogType.value = 'root';
    title.value = '创建根CA证书';
    activeTab.value = 'self';
    // 加载数据
    await loadRootCaProfiles();
    await loadSigners();
  } else if (command === 'sub') {
    dialogType.value = 'sub';
    title.value = '创建子CA证书';
    activeTab.value = 'online';
    await Promise.all([loadSubCaProfiles(), loadSigners()]);
    refreshAvailableSubSigners();
  }
  open.value = true;
}

/** 加载RootCA模板列表 */
async function loadRootCaProfiles() {
  try {
    // 调用listProfile API，传递type参数筛选RootCA模板
    const res = await listProfile({ type: 'RootCA' });

    const profiles = res.data || [];

    if (profiles.length === 0) {
      ElMessage.warning('没有找到可用的RootCA证书模板');
      return;
    }

    // 设置模板列表
    rootCaProfiles.value = profiles;

    // 默认选中第一个
    const firstProfile = profiles[0];
    selfForm.value.profileId = firstProfile.id;

    // 调用模板变更处理
    await onProfileChange(selfForm.value.profileId);
  } catch (error: any) {
    ElMessage.error('加载RootCA证书模板失败: ' + (error.response?.data?.msg || error.message));
  }
}

/** 加载SubCA模板列表 */
async function loadSubCaProfiles() {
  try {
    const res = await listProfile({ type: 'SubCA' });
    subCaProfiles.value = res.data || [];
    if (subCaProfiles.value.length > 0) {
      onlineSubForm.value.profileId = subCaProfiles.value[0].id;
      await onSubProfileChange(onlineSubForm.value.profileId);
    }
  } catch (error: any) {
    ElMessage.error('加载子CA证书模板失败');
  }
}

/** 子CA模板变更处理 */
async function onSubProfileChange(profileId: any) {
  if (!profileId) return;
  try {
    const res = await getProfile(profileId);
    const profile = res.data;
    const conf = parseJson(profile.conf);

    if (conf) {
      // 设置有效期
      if (conf.validity) {
        const v = conf.validity;
        const unit = v.slice(-1);
        const val = parseInt(v.slice(0, -1));
        if (!isNaN(val)) {
          onlineSubForm.value.validity = val;
          onlineSubForm.value.validityUnit = unit || 'y';
        }
      }

      // 设置主题项
      const rdns = conf.subject?.rdns || conf.subject;
      if (rdns && Array.isArray(rdns) && rdns.length > 0) {
        const items: any[] = [];
        rdns.forEach((rdn: any) => {
          const rdnType = (typeof rdn.type === 'object' ? rdn.type.description : rdn.type) || '';
          let compType = rdnType.toLowerCase();
          for (const [type, meta] of Object.entries(typeMapping)) {
            if (meta.key.toLowerCase() === compType || type.toLowerCase() === compType) {
              compType = type;
              break;
            }
          }
          items.push({
            type: compType,
            value: rdn.value || '',
            minOccurs: rdn.minOccurs,
            maxOccurs: rdn.maxOccurs
          });
        });
        onlineSubForm.value.subjectItems = sortSubjectItems(items);
      }

      onlineSubForm.value.extensionItems = buildSubCaExtensionItems(conf.extensions || []);
    }
  } catch (error) {}
}

/** 模板变更处理 */
async function onProfileChange(profileId: any) {
  if (!profileId) return;

  try {
    const res = await getProfile(profileId);
    const profile = res.data;

    const conf = parseJson(profile.conf);

    if (conf) {
      // 1. 设置模板名称
      selfForm.value.rootcaProfileName = profile.name || '';

      // 2. 设置有效期
      if (conf.validity) {
        const v = conf.validity;
        const unit = v.slice(-1);
        const val = parseInt(v.slice(0, -1));
        if (!isNaN(val)) {
          selfForm.value.validity = val;
          selfForm.value.validityUnit = unit || 'y';
        }
      }

      // 3. 设置可选算法
      if (conf.keyAlgorithms && Array.isArray(conf.keyAlgorithms)) {
        const algos: string[] = [];
        conf.keyAlgorithms.forEach((a: any) => {
          if (typeof a === 'string') {
            algos.push(a);
            return;
          }
          // 处理复杂结构
          const mainDesc = a.algorithms?.[0]?.description;
          if (mainDesc === 'RSA' && a.parameters?.rsa?.modulus) {
            a.parameters.rsa.modulus.forEach((m: number) => {
              algos.push(`RSA${m}`);
            });
          } else if (mainDesc === 'EC' && a.parameters?.ec?.curves?.[0]?.description?.toLowerCase().includes('sm2')) {
            algos.push('SM2');
          } else if (mainDesc === 'EC' && a.parameters?.ec?.curves?.[0]?.description) {
            algos.push(a.parameters.ec.curves[0].description.toUpperCase());
          } else if (mainDesc) {
            // 支持 PQC (ML-DSA 等) 或其他直接在 description 中定义的算法
            algos.push(mainDesc);
          } else if (a.name || a.type) {
            algos.push(a.name || a.type);
          }
        });
        availableAlgos.value = algos;
        if (availableAlgos.value.length > 0) {
          selfForm.value.keyAlgorithm = availableAlgos.value[0];
        }
      }

      // 4. 设置主题项
      const rdns = conf.subject?.rdns || conf.subject;
      if (rdns && Array.isArray(rdns) && rdns.length > 0) {
        const items: any[] = [];
        rdns.forEach((rdn: any) => {
          // 处理 type: { oid: '...', description: '...' } 或 type: '...'
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
            items.push({
              type: compType,
              value: rdn.value || '',
              minOccurs: rdn.minOccurs,
              maxOccurs: rdn.maxOccurs
            });
          }
        });
        selfForm.value.subjectItems = sortSubjectItems(items);
      } else {
        // 如果没有subject配置，使用默认的主题项
        selfForm.value.subjectItems = sortSubjectItems([
          { type: 'country', value: 'CN', minOccurs: 1, maxOccurs: 1 },
          { type: 'organization', value: '业务部门', minOccurs: 1, maxOccurs: 1 },
          { type: 'organizationalUnit', value: '业务管理员', minOccurs: 0, maxOccurs: 1 },
          { type: 'commonName', value: 'DemoCA', minOccurs: 1, maxOccurs: 1 }
        ]);
      }

      // 5. 设置CRL配置
      if (conf.crlControl) {
        if (conf.crlControl.intervalHours) {
          selfForm.value.crlIntervalHours = conf.crlControl.intervalHours;
        }
        if (conf.crlControl.fullIntervals) {
          selfForm.value.crlFullIntervals = conf.crlControl.fullIntervals;
        }
        if (conf.crlControl.deltaCrlIntervals) {
          selfForm.value.deltaCrlIntervals = conf.crlControl.deltaCrlIntervals;
        }
        if (conf.crlControl.fullCrlThreads) {
          selfForm.value.fullCrlThreads = conf.crlControl.fullCrlThreads;
        }
        if (conf.crlControl.deltaCrlThreads) {
          selfForm.value.deltaCrlThreads = conf.crlControl.deltaCrlThreads;
        }
        if (conf.crlControl.overlap) {
          const overlap = parseDuration(conf.crlControl.overlap);
          selfForm.value.crlOverlapValue = overlap.value;
          selfForm.value.crlOverlapUnit = overlap.unit;
        }
        if (conf.crlControl.intervalTime) {
          selfForm.value.crlIntervalTime = conf.crlControl.intervalTime;
        }
        if (conf.crlControl.nextCrlNumber) {
          selfForm.value.nextCrlNo = conf.crlControl.nextCrlNumber;
        }
      }

      // 6. 设置URI配置
      if (conf.caCertUris && Array.isArray(conf.caCertUris) && conf.caCertUris.length > 0) {
        selfForm.value.cacertUris = conf.caCertUris.map((uri: string) => ({ value: uri }));
      }
      if (conf.crlUris && Array.isArray(conf.crlUris) && conf.crlUris.length > 0) {
        selfForm.value.crlUris = conf.crlUris.map((uri: string) => ({ value: uri }));
      }
      if (conf.deltaCrlUris && Array.isArray(conf.deltaCrlUris) && conf.deltaCrlUris.length > 0) {
        selfForm.value.deltaCrlUris = conf.deltaCrlUris.map((uri: string) => ({ value: uri }));
      }
      if (conf.ocspUris && Array.isArray(conf.ocspUris) && conf.ocspUris.length > 0) {
        selfForm.value.ocspUris = conf.ocspUris.map((uri: string) => ({ value: uri }));
      }
    } else {
    }
  } catch (error) {
    ElMessage.error('加载模板详情失败: ' + (error as any).message);

    // 使用默认的主题项
    selfForm.value.subjectItems = sortSubjectItems([
      { type: 'country', value: 'CN', minOccurs: 1, maxOccurs: 1 },
      { type: 'organization', value: '业务部门', minOccurs: 1, maxOccurs: 1 },
      { type: 'organizationalUnit', value: '业务管理员', minOccurs: 0, maxOccurs: 1 },
      { type: 'commonName', value: 'DemoCA', minOccurs: 1, maxOccurs: 1 }
    ]);
  }
}

/** 重置表单 */
function reset() {
  selfForm.value = {
    name: '',
    signerId: undefined as string | number | undefined,
    profileId: undefined,
    rootcaProfileName: '',
    subjectItems: [],
    keyAlgorithm: 'SM2',
    signerType: 'PKCS12',
    keyIndex: 1,
    password: '',
    validity: 10,
    validityUnit: 'y',
    expirationPeriod: 365,
    keepExpiredCertDays: -1,
    validityMode: 'cutoff',
    crlIntervalHours: 6,
    crlFullIntervals: 4,
    deltaCrlIntervals: 1,
    fullCrlThreads: 1,
    deltaCrlThreads: 1,
    crlOverlapValue: 1,
    crlOverlapUnit: 'h',
    crlIntervalTime: '00:00',
    nextCrlNo: 1,
    cacertUris: [{ value: 'https://myorg.org/rootca1.der' }],
    crlUris: [{ value: 'https://localhost:8081/dummy/crl/?type=crl&name=rootca1' }],
    deltaCrlUris: [{ value: '' }],
    ocspUris: [{ value: 'https://localhost:8080/ocsp/responder1' }],
    snSize: 20,
    status: 'active'
  };
  importForm.value = {
    name: '',
    csr: '',
    certFile: null
  };
  onlineSubForm.value = {
    name: '',
    parentCaId: undefined,
    signerId: undefined,
    profileId: undefined,
    subjectItems: [],
    extensionItems: [],
    keyAlgorithm: 'SM2',
    validity: 5,
    validityUnit: 'y'
  };
  if (selfFormRef.value) selfFormRef.value.resetFields();
  if (importFormRef.value) importFormRef.value.resetFields();
  if (onlineSubFormRef.value) onlineSubFormRef.value.resetFields();
  if (uploadRef.value) uploadRef.value.clearFiles();
}

/** 取消按钮 */
function cancel() {
  open.value = false;
  reset();
}

/** 生成CSR */
function handleGenerateCSR() {
  // 这里应该调用后端API生成CSR
  // 模拟生成
  importForm.value.csr = '-----BEGIN CERTIFICATE REQUEST-----\nMIIC...';
  ElMessage.success('CSR 生成成功');
}

/** 文件上传变更 */
const handleFileChange: UploadProps['onChange'] = (file) => {
  importForm.value.certFile = file.raw as File;
};

const handleFileRemove: UploadProps['onRemove'] = () => {
  importForm.value.certFile = null;
};

/** 提交按钮 */
function submitForm() {
  if (activeTab.value === 'self') {
    selfFormRef.value?.validate(async (valid: boolean) => {
      if (valid) {
        loading.value = true;
        try {
          const crlControlArr = [
            `interval.hours=${selfForm.value.crlIntervalHours}`,
            `fullcrl.intervals=${selfForm.value.crlFullIntervals}`,
            `deltacrl.intervals=${selfForm.value.deltaCrlIntervals}`,
            `fullcrl.threads=${selfForm.value.fullCrlThreads}`,
            `deltacrl.threads=${selfForm.value.deltaCrlThreads}`,
            `overlap=${formatDuration(selfForm.value.crlOverlapValue, selfForm.value.crlOverlapUnit)}`,
            `interval.time=${selfForm.value.crlIntervalTime}`
          ];

          const reqData = {
            name: selfForm.value.name,
            signerId: selfForm.value.signerId,
            rootcaProfile: selfForm.value.rootcaProfileName,
            subject: selfForm.value.subjectItems
              .filter((item: any) => item.value)
              .map((item: any) => {
                const key = typeMapping[item.type as keyof typeof typeMapping]?.key || item.type;
                return `${key}=${item.value}`;
              })
              .join(','),
            algo: selfForm.value.keyAlgorithm,
            signerType: selfForm.value.signerType,
            keyIndex: selfForm.value.keyIndex,
            password: selfForm.value.password,
            maxValidity: selfForm.value.validity + selfForm.value.validityUnit,
            expirationPeriod: selfForm.value.expirationPeriod,
            keepExpiredCertDays: selfForm.value.keepExpiredCertDays,
            validityModeS: selfForm.value.validityMode === 'cutoff' ? 'CUTOFF' : selfForm.value.validityMode === 'strict' ? 'STRICT' : 'LAX',
            caStatus: selfForm.value.status,
            snLen: selfForm.value.snSize,
            nextCrlNumber: selfForm.value.nextCrlNo,
            crlControl: crlControlArr.join(','),
            caCertUris: selfForm.value.cacertUris.map((u: any) => u.value).filter((v: any) => v),
            crlUris: selfForm.value.crlUris.map((u: any) => u.value).filter((v: any) => v),
            deltaCrlUris: selfForm.value.deltaCrlUris.map((u: any) => u.value).filter((v: any) => v),
            ocspUris: selfForm.value.ocspUris.map((u: any) => u.value).filter((v: any) => v)
          };

          const res = await genRootCa({ co: reqData });
          if (res.data) {
            ElMessage.success('证书生成成功');
            open.value = false;
            getList();
          }
        } catch (error: any) {
          const errMsg = error.response?.data?.msg || error.message || '证书生成失败';
          ElMessage.error(errMsg);
        } finally {
          loading.value = false;
        }
      }
    });
  } else if (activeTab.value === 'online') {
    onlineSubFormRef.value?.validate(async (valid: boolean) => {
      if (valid) {
        if (!validateSubCaExtensions()) {
          return;
        }
        loading.value = true;
        try {
          const reqData = {
            name: onlineSubForm.value.name,
            parentRootId: onlineSubForm.value.parentCaId,
            profileId: onlineSubForm.value.profileId,
            signerId: onlineSubForm.value.signerId,
            subject: onlineSubForm.value.subjectItems
              .filter((item: any) => item.value)
              .map((item: any) => {
                const key = typeMapping[item.type as keyof typeof typeMapping]?.key || item.type;
                return `${key}=${item.value}`;
              })
              .join(','),
            algo: onlineSubForm.value.keyAlgorithm,
            maxValidity: onlineSubForm.value.validity + onlineSubForm.value.validityUnit,
            extensions: buildSubCaExtensionsPayload()
          };
          const res = await genSubCaOnline(reqData);
          if (res.data) {
            ElMessage.success('子CA签发成功');
            open.value = false;
            getList();
          }
        } catch (error: any) {
          const errMsg = error.response?.data?.msg || error.message || '子CA签发失败';
          ElMessage.error(errMsg);
        } finally {
          loading.value = false;
        }
      }
    });
  } else {
    importFormRef.value?.validate((valid) => {
      if (valid) {
        if (!importForm.value.certFile) {
          ElMessage.error('请上传证书文件');
          return;
        }
        ElMessage.warning('子CA证书导入接口暂未接入，请使用在线签发功能');
      }
    });
  }
}

const addUri = (field: 'cacertUris' | 'crlUris' | 'deltaCrlUris' | 'ocspUris') => {
  selfForm.value[field].push({ value: '' });
};

const removeUri = (field: 'cacertUris' | 'crlUris' | 'deltaCrlUris' | 'ocspUris', index: number) => {
  selfForm.value[field].splice(index, 1);
};

function getResultData(res: any) {
  return res?.data ?? res ?? {};
}

function toNumberValue(value: any, defaultValue: number) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : defaultValue;
}

function applyCrlConfig(data: any) {
  const config = getResultData(data);
  crlConfigForm.intervalHours = toNumberValue(config?.intervalHours, 6);
  crlConfigForm.fullCrlIntervals = toNumberValue(config?.fullCrlIntervals, 4);
  crlConfigForm.deltaCrlIntervals = toNumberValue(config?.deltaCrlIntervals, 1);
  crlConfigForm.fullCrlThreads = toNumberValue(config?.fullCrlThreads, 1);
  crlConfigForm.deltaCrlThreads = toNumberValue(config?.deltaCrlThreads, 1);
  const overlap = parseDuration(config?.overlap);
  crlConfigForm.overlapValue = overlap.value;
  crlConfigForm.overlapUnit = overlap.unit;
  crlConfigForm.intervalTime = config?.intervalTime || '00:00';
  crlConfigForm.nextCrlNumber = toNumberValue(config?.nextCrlNumber, 1);
  crlConfigForm.crlUris = (config?.crlUris && config.crlUris.length > 0 ? config.crlUris : ['']).map((value: string) => ({ value }));
  crlConfigForm.deltaCrlUris = (config?.deltaCrlUris && config.deltaCrlUris.length > 0 ? config.deltaCrlUris : ['']).map((value: string) => ({ value }));
  crlConfigForm.schedulerRunning = !!config?.schedulerRunning;
}

async function loadPublisherList() {
  try {
    const res = await pagePublisher({ pageNum: 1, pageSize: 200, status: '0' });
    publisherList.value = res.data?.rows || res.data?.records || [];
  } catch (error) {
    publisherList.value = [];
  }
}

function getSelectedPublisherName() {
  if (!crlConfigForm.publisherId) {
    return 'CA关联发布者';
  }
  const publisher = publisherList.value.find((item: any) => item.id === crlConfigForm.publisherId);
  return publisher?.name || String(crlConfigForm.publisherId);
}

function addCrlOperationRecord(record: any) {
  crlOperationRecords.value.unshift({
    time: parseTime(new Date(), '{h}:{i}:{s}'),
    publisherName: getSelectedPublisherName(),
    ...record
  });
  crlOperationRecords.value = crlOperationRecords.value.slice(0, 10);
}

async function handleCrlConfig(row: any) {
  crlConfigDialog.rootId = row.id;
  crlConfigDialog.title = `CRL配置 - ${row.name}`;
  crlConfigForm.publisherId = undefined;
  crlOperationRecords.value = [];
  try {
    await loadPublisherList();
    const res = await getRootCrlConfig(row.id);
    applyCrlConfig(res);
    crlConfigDialog.visible = true;
    await nextTick();
    crlConfigPanelRef.value?.$el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error: any) {
    ElMessage.error(error.response?.data?.msg || error.message || '加载CRL配置失败');
  }
}

function closeCrlConfig() {
  crlConfigDialog.visible = false;
  crlConfigDialog.rootId = undefined;
}

async function refreshCrlConfig() {
  if (!crlConfigDialog.rootId) return;
  try {
    const res = await getRootCrlConfig(crlConfigDialog.rootId);
    applyCrlConfig(res);
    ElMessage.success('CRL线程状态已刷新');
  } catch (error: any) {
    ElMessage.error(error.response?.data?.msg || error.message || '刷新CRL配置失败');
  }
}

function buildCrlConfigPayload() {
  return {
    intervalHours: crlConfigForm.intervalHours,
    fullCrlIntervals: crlConfigForm.fullCrlIntervals,
    deltaCrlIntervals: crlConfigForm.deltaCrlIntervals,
    fullCrlThreads: crlConfigForm.fullCrlThreads,
    deltaCrlThreads: crlConfigForm.deltaCrlThreads,
    overlap: formatDuration(crlConfigForm.overlapValue, crlConfigForm.overlapUnit),
    intervalTime: crlConfigForm.intervalTime,
    nextCrlNumber: crlConfigForm.nextCrlNumber,
    crlUris: crlConfigForm.crlUris.map((u: any) => u.value).filter((v: any) => v),
    deltaCrlUris: crlConfigForm.deltaCrlUris.map((u: any) => u.value).filter((v: any) => v)
  };
}

async function submitCrlConfig() {
  if (!crlConfigDialog.rootId) return;
  try {
    const res = await saveRootCrlConfig(crlConfigDialog.rootId, buildCrlConfigPayload());
    applyCrlConfig(res);
    ElMessage.success('CRL配置已保存');
    getList();
  } catch (error: any) {
    ElMessage.error(error.response?.data?.msg || error.message || '保存CRL配置失败');
  }
}

async function issueCrl(deltaCrl: boolean) {
  if (!crlConfigDialog.rootId) return;
  try {
    const issueRes = await issueRootCrl(crlConfigDialog.rootId, { deltaCrl, crlScope: 0 });
    addCrlOperationRecord({
      action: deltaCrl ? '签发增量' : '签发全量',
      crlNo: issueRes.data?.crlNo || issueRes.data?.id || '-',
      status: '成功',
      message: 'CRL已生成'
    });
    ElMessage.success(deltaCrl ? '增量CRL签发成功' : '全量CRL签发成功');
    const res = await getRootCrlConfig(crlConfigDialog.rootId);
    applyCrlConfig(res);
    getList();
  } catch (error: any) {
    addCrlOperationRecord({
      action: deltaCrl ? '签发增量' : '签发全量',
      crlNo: '-',
      status: '失败',
      message: error.response?.data?.msg || error.message || 'CRL签发失败'
    });
    ElMessage.error(error.response?.data?.msg || error.message || 'CRL签发失败');
  }
}

async function issueAndPublishCrl(deltaCrl: boolean) {
  if (!crlConfigDialog.rootId) return;
  try {
    const issueRes = await issueRootCrl(crlConfigDialog.rootId, { deltaCrl, crlScope: 0 });
    const crl = issueRes.data || {};
    await publishCrl({ crlId: crl.id, publisherId: crlConfigForm.publisherId });
    addCrlOperationRecord({
      action: deltaCrl ? '签发发布增量' : '签发发布全量',
      crlNo: crl.crlNo || crl.id || '-',
      status: '成功',
      message: 'CRL已生成并提交发布'
    });
    ElMessage.success(deltaCrl ? '增量CRL已签发并发布' : '全量CRL已签发并发布');
    await refreshCrlConfig();
    getList();
  } catch (error: any) {
    addCrlOperationRecord({
      action: deltaCrl ? '签发发布增量' : '签发发布全量',
      crlNo: '-',
      status: '失败',
      message: error.response?.data?.msg || error.message || 'CRL签发发布失败'
    });
    ElMessage.error(error.response?.data?.msg || error.message || 'CRL签发发布失败');
  }
}

async function startCrlScheduler() {
  if (!crlConfigDialog.rootId) return;
  try {
    const res = await startRootCrlScheduler(crlConfigDialog.rootId);
    applyCrlConfig(res);
    ElMessage.success('CRL签发线程已启动');
  } catch (error: any) {
    ElMessage.error(error.response?.data?.msg || error.message || '启动CRL签发线程失败');
  }
}

async function stopCrlScheduler() {
  if (!crlConfigDialog.rootId) return;
  try {
    const res = await stopRootCrlScheduler(crlConfigDialog.rootId);
    applyCrlConfig(res);
    ElMessage.success('CRL签发线程已停止');
  } catch (error: any) {
    ElMessage.error(error.response?.data?.msg || error.message || '停止CRL签发线程失败');
  }
}

const addCrlConfigUri = (field: 'crlUris' | 'deltaCrlUris') => {
  crlConfigForm[field].push({ value: '' });
};

const removeCrlConfigUri = (field: 'crlUris' | 'deltaCrlUris', index: number) => {
  crlConfigForm[field].splice(index, 1);
};

/** 查看详情 */
function handleView(row: any) {
  currentCertPem.value = row.pem; // 假设row中有pem字段
  showDetail.value = true;
}

/** 下载证书 */
async function handleDownload(row: any, command: string) {
  try {
    const res = await getRootCa(row.id);
    const root = res.data || row;
    const certPem = normalizePem(root.cert || row.cert || row.pem);
    const chainPem = normalizePem(root.certchain || row.certchain || certPem);
    const baseName = sanitizeFilename(root.name || row.name || 'root-ca');

    switch (command) {
      case 'cert-der':
        saveBlob(pemToDerBlob(certPem), `${baseName}.crt`);
        break;
      case 'cert-pem':
        saveBlob(new Blob([certPem], { type: 'application/x-pem-file' }), `${baseName}.pem`);
        break;
      case 'chain-der':
        saveBlob(pemChainToDerBlob(chainPem), `${baseName}-chain.der`);
        break;
      case 'chain-pem':
        saveBlob(new Blob([chainPem], { type: 'application/x-pem-file' }), `${baseName}-chain.pem`);
        break;
      default:
        ElMessage.warning('不支持的下载格式');
    }
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.msg || error?.message || '下载证书失败');
  }
}

function normalizePem(pem: string) {
  if (!pem) {
    throw new Error('证书内容为空');
  }
  const value = String(pem).trim();
  if (value.includes('-----BEGIN CERTIFICATE-----')) {
    return value.endsWith('\n') ? value : `${value}\n`;
  }
  const body = value.replace(/\s+/g, '').match(/.{1,64}/g)?.join('\n') || value;
  return `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----\n`;
}

function pemToDerBlob(pem: string) {
  const base64 = pem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s+/g, '');
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: 'application/pkix-cert' });
}

function pemChainToDerBlob(pem: string) {
  const matches = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
  if (!matches || matches.length === 0) {
    return pemToDerBlob(pem);
  }
  const parts = matches.map((item) => pemToDerBlob(item));
  return new Blob(parts, { type: 'application/octet-stream' });
}

function sanitizeFilename(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, '_');
}

function saveBlob(blob: Blob, filename: string) {
  const link = document.createElement('a');
  const url = window.URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

/** 授权模板按钮操作 */
function handleAuthorizeProfile(row: any) {
  router.push({
    path: '/ca/root/authorize-profile',
    query: { id: row.id }
  });
}

/** 启用按钮操作 */
async function handleEnable(row: any) {
  try {
    await proxy?.$modal.confirm(`确认要启用名称为 "${row.name}" 的证书吗？`);
    await enableRootCa(row.id);
    ElMessage.success('启用成功');
    getList();
  } catch (error) {}
}

/** 停用按钮操作 */
async function handleDisable(row: any) {
  try {
    await proxy?.$modal.confirm(`确认要停用名称为 "${row.name}" 的证书吗？停用后将无法使用该证书进行签发。`);
    await disableRootCa(row.id);
    ElMessage.success('停用成功');
    getList();
  } catch (error) {}
}

/** 注销按钮操作 */
async function handleRevoke(row: any) {
  try {
    const { value: reason } = await proxy?.$modal.prompt('请输入注销原因', '注销根证书', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPlaceholder: '请输入注销原因 (例如: keyCompromise, superseded)',
      inputValidator: (val: string) => {
        if (!val) return '原因不能为空';
      }
    });

    if (reason) {
      // 触发安全确认
      securityConfirm.action = `注销根证书 "${row.name}" (原因: ${reason})`;
      securityConfirm.onConfirm = async () => {
        try {
          await revokeRootCa(row.id, reason);
          ElMessage.success('注销成功');
          getList();
        } catch (error) {}
      };
      securityConfirm.visible = true;
    }
  } catch (error) {
    // 处理取消输入原因
  }
}

/** 父级CA变更处理 */
function onParentCaChange(val: any) {
  if (val) {
    onlineSubFormRef.value?.validateField('validity');
  }
}

getList();
</script>

<style scoped lang="scss">
.dialog-footer {
  display: flex;
  justify-content: flex-end;
}

.root-cert-dialog {
  :deep(.el-dialog) {
    max-width: calc(100vw - 32px);
  }

  :deep(.el-dialog__body) {
    max-height: calc(100vh - 180px);
    overflow-y: auto;
    padding: 16px 22px 10px;
  }

  :deep(.el-tabs__content) {
    overflow: visible;
  }
}

.crl-config-panel {
  margin-top: 16px;
  border: 1px solid #dcdfe6;
}

.crl-help-toolbar {
  display: flex;
  justify-content: flex-end;
  margin: -2px 0 8px;
}

.crl-help-toolbar .el-button {
  font-size: 18px;
}

.crl-help-content {
  color: #303133;
  font-size: 14px;
  line-height: 1.7;
}

.crl-help-content h4 {
  margin: 0 0 8px;
  color: #303133;
  font-size: 15px;
}

.crl-help-content h4:not(:first-child) {
  margin-top: 18px;
}

.crl-help-content p {
  margin: 0 0 10px;
}

.crl-help-content ul {
  margin: 0;
  padding-left: 18px;
}

.crl-help-content li {
  margin-bottom: 8px;
}

.crl-config-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.crl-config-title {
  color: #303133;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.crl-config-subtitle {
  margin-top: 4px;
  color: #909399;
  font-size: 12px;
  line-height: 18px;
}

.crl-config-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.uri-row {
  display: flex;
  width: 100%;
  gap: 10px;
}

.uri-row .el-input {
  flex: 1;
}

.validity-input {
  display: flex;
  width: 100%;
  gap: 8px;
}

.validity-input :deep(.el-input-number) {
  flex: 1;
  width: auto;
}

.validity-unit {
  width: 88px;
  flex: none;
}

.duration-input {
  display: flex;
  width: 100%;
  gap: 8px;
}

.duration-input :deep(.el-input-number) {
  flex: 1;
  width: auto;
}

.duration-unit {
  width: 88px;
  flex: none;
}

.sub-extension-list {
  width: 100%;
}

.sub-extension-item {
  padding: 10px 0;
  border-bottom: 1px solid #ebeef5;
}

.sub-extension-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  color: #303133;
  font-weight: 600;
}

.san-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.san-row .el-input {
  flex: 1;
}

.sia-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.sia-row .el-input {
  flex: 1;
}

.key-usage-checkbox-group {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 8px 12px;
  width: 100%;
}

.key-usage-checkbox-group :deep(.el-checkbox) {
  height: 34px;
  margin-right: 0;
  padding: 0 10px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
}

.key-usage-label {
  margin-right: 6px;
}

.key-usage-value {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.crl-config-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
</style>
