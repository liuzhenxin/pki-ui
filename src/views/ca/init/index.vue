<template>
  <div class="app-container">
    <el-card v-loading="loading">
      <el-steps :active="active" finish-status="success" simple>
        <el-step title="协议" />
        <el-step title="初始化模板" />
        <el-step title="初始化根证书" />
        <el-step title="管理员设置" />
        <el-step title="审计员设置" />
        <el-step title="完成" />
      </el-steps>

      <div class="wizard-content">
        <div v-if="active === 0" class="step-content">
          <h2>欢迎使用 {{ tenantCode.toUpperCase() }}</h2>
          <div class="agreement-text">
            <Agreement :tenantCode="tenantCode" :tenantName="tenantName" :companyName="companyName" />
          </div>
          <el-checkbox v-model="agree" class="agree-checkbox">我已阅读并同意用户协议</el-checkbox>
        </div>

        <div v-if="active === 1" class="step-content" style="width: 80%; margin: auto">
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 20px">
            <h2 style="margin: 0">初始化模板</h2>
            <el-button
              type="info"
              text
              circle
              style="font-size: 24px; padding: 12px"
              :icon="QuestionFilled"
              @click="showTemplateHelp = true"
            />
          </div>

          <el-drawer v-model="showTemplateHelp" title="证书模板说明" direction="rtl" size="450px">
            <div class="template-help-container">
              <el-alert title="什么是证书模板？" type="info" :closable="false" show-icon class="help-header-alert">
                <p>证书模板是在签发证书时引用的配置蓝图，用于控制证书包含的内容。在CA系统初始化时，您可以选择以下类型的模板：</p>
              </el-alert>

              <div class="help-card root-ca">
                <div class="help-card-header">
                  <el-tag type="danger" effect="dark" round size="small">必选</el-tag>
                  <span class="help-card-title">RootCA证书模板 (RootCA)</span>
                </div>
                <div class="help-card-body">
                  用于自签发该 CA 的根证书。在初始化时，<b>必须至少选择一个RootCA证书模板</b>作为信任锚体系的基础。
                </div>
              </div>

              <div class="help-card sub-ca">
                <div class="help-card-header">
                  <el-tag type="warning" effect="light" round size="small">可选</el-tag>
                  <span class="help-card-title">子CA证书模板 (SubCA)</span>
                </div>
                <div class="help-card-body">
                  用于签发下一级从属 CA (Subordinate CA) 的证书。通常用于构建多层级的证书信任链。
                </div>
              </div>

              <div class="help-card end-entity">
                <div class="help-card-header">
                  <el-tag type="success" effect="light" round size="small">可选</el-tag>
                  <span class="help-card-title">终端实体证书模板 (EndEntity)</span>
                </div>
                <div class="help-card-body">
                  用于签发普通用户、设备或服务的最终业务证书，不具备向下签发其他证书的能力。
                </div>
              </div>
            </div>
          </el-drawer>

          <el-table
            :data="templateData"
            style="width: 100%"
            class="template-table"
            :header-cell-style="{ background: '#f8f9fa', color: '#606266', fontWeight: 600 }"
            @selection-change="handleTemplateSelectionChange"
          >
            <template #empty>
              <div class="empty-state">
                <el-empty description="暂无可用的证书模板" :image-size="120" />
              </div>
            </template>
            <el-table-column type="selection" width="55" align="center" />
            <el-table-column prop="id" label="ID" width="80" align="center" />
            <el-table-column prop="name" label="模板名称" min-width="200" show-overflow-tooltip>
              <template #default="{ row }">
                <span style="font-weight: 500; color: #303133">{{ row.name }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="type" label="模板类型" min-width="150">
              <template #default="{ row }">
                <el-tag
                  :type="row.type === 'RootCA' ? 'danger' : row.type === 'SubCA' ? 'warning' : 'success'"
                  effect="light"
                  round
                >
                  {{ getProfileTypeLabel(row.type) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120" align="center">
              <template #default="{ row }">
                <el-button type="primary" link :icon="View" @click="handleTemplateDetail(row)">详情</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div v-if="active === 1 && !hasRootCASelected && selectedTemplates.length > 0" class="validation-warning">
            <el-icon><Warning /></el-icon>
            <span>请至少选择一个RootCA证书模板 (RootCA) 作为可信根。</span>
          </div>
        </div>

        <div v-if="active === 2" class="step-content">
          <div class="step-header" style="display: flex; justify-content: space-between; align-items: center; width: 100%">
            <h2>初始化根证书</h2>
            <el-button
              type="info"
              text
              circle
              style="font-size: 24px; padding: 12px"
              :icon="QuestionFilled"
              @click="showRootCaHelp = true"
            />
          </div>

          <el-drawer v-model="showRootCaHelp" title="根证书初始化说明" direction="rtl" size="500px">
            <div class="template-help-container">
              <el-alert title="根证书类型" type="info" :closable="false" show-icon class="help-header-alert">
                <p>根证书是证书中心的信任源头。系统支持两种签发模式：</p>
              </el-alert>

              <div class="help-card root-ca">
                <div class="help-card-header">
                  <span class="help-card-title">自签根证书</span>
                </div>
                <div class="help-card-body">
                  系统会自动生成私钥，并使用该私钥对生成的证书进行签名。这是构建独立信任体系的常用方式。
                </div>
              </div>

              <div class="help-card sub-ca">
                <div class="help-card-header">
                  <span class="help-card-title">外部CA签发</span>
                </div>
                <div class="help-card-body">
                  系统生成 CSR（证书签名请求），您需要将其交由上级或第三方 CA 进行签发，然后再将签回的证书导入。
                </div>
              </div>

              <el-divider />

              <h4>关键参数说明</h4>
              <ul class="help-list">
                <li><b>密钥算法</b>：推荐使用 <b>SM2</b>（国密算法）或 <b>RSA</b> 2048位及以上。</li>
                <li>
                  <b>签名器类型</b>：
                  <ul>
                    <li><b>PKCS12</b>：软件签名，生成的私钥以加密文件形式存储。</li>
                    <li><b>SDF</b>：硬件签名，使用加密卡或加密机，私钥受硬件保护。</li>
                  </ul>
                </li>
                <li>
                  <b>有效期模式</b>：
                  <ul>
                    <li><b>截止 (Cutoff)</b>：所有签发的证书有效期不超过父证书。</li>
                    <li><b>严格 (Strict)</b>：申请期限超过父证书时报错。</li>
                    <li><b>宽松 (Lax)</b>：允许签发，但有效期会被截断。</li>
                  </ul>
                </li>
              </ul>
            </div>
          </el-drawer>
          <el-radio-group v-model="rootType" style="margin-bottom: 20px">
            <el-radio-button label="self">自签根证书</el-radio-button>
            <el-radio-button label="external">外部CA签发</el-radio-button>
          </el-radio-group>

          <el-form
            :model="rootCaForm"
            :rules="rootCaRules"
            ref="rootCaFormRef"
            label-width="140px"
            style="width: 700px"
          >
            <el-tabs type="border-card">
              <el-tab-pane label="基本信息">
                <el-form-item label="CA名称" prop="name">
                  <el-input v-model="rootCaForm.name" placeholder="请输入CA名称" />
                </el-form-item>
                <CertSubject v-model="rootCaForm.subjectItems" propPrefix="subjectItems" />
                <el-form-item label="密钥算法" prop="algo">
                  <el-select v-model="rootCaForm.algo">
                    <el-option v-for="a in rootCaAlgos" :key="a" :label="a" :value="a" />
                  </el-select>
                </el-form-item>
                <el-form-item label="签名器类型" prop="signerType">
                  <el-select v-model="rootCaForm.signerType">
                    <el-option label="PKCS12" value="PKCS12" />
                    <el-option label="JKS" value="JKS" />
                    <el-option label="SDF" value="SDF" />
                  </el-select>
                </el-form-item>
                <el-form-item v-if="rootCaForm.signerType === 'SDF'" label="密钥索引" prop="keyIndex">
                  <el-input-number v-model="rootCaForm.keyIndex" :min="1" :step="1" placeholder="正整数" />
                </el-form-item>
                <el-form-item label="密码" prop="password">
                  <el-input v-model="rootCaForm.password" type="password" show-password placeholder="请输入签名器密码" />
                </el-form-item>

                <div
                  v-if="rootType === 'external'"
                  style="margin-top: 20px; border-top: 1px dashed #eee; padding-top: 20px"
                >
                  <el-form-item label="CSR操作">
                    <el-button type="primary" @click="handleDownloadCsr">生成并下载 CSR</el-button>
                  </el-form-item>
                  <el-form-item label="导入签名证书" required>
                    <el-upload
                      ref="externalCertUploadRef"
                      action="#"
                      :limit="1"
                      :on-exceed="handleExternalCertExceed"
                      :auto-upload="false"
                      :on-change="handleExternalCertChange"
                      :on-remove="handleExternalCertRemove"
                      v-model:file-list="externalCertFileList"
                      accept=".cer,.crt,.pem"
                    >
                      <el-button type="primary">点击上传</el-button>
                      <template #tip>
                        <div class="el-upload__tip">请上传外部CA签发的证书文件 (.cer, .crt, .pem)</div>
                      </template>
                    </el-upload>
                    <el-button v-if="externalCertPem" type="text" @click="showExternalCertDialog = true"
                      >查看证书详情</el-button
                    >
                  </el-form-item>
                </div>
              </el-tab-pane>

              <el-tab-pane label="有效期配置">
                <el-form-item label="最大有效期" prop="maxValidity">
                  <el-input v-model.number="rootCaForm.maxValidity" placeholder="请输入正整数" style="width: 200px">
                    <template #append>
                      <el-select v-model="rootCaForm.maxValidityUnit" style="width: 80px">
                        <el-option label="年" value="y" />
                        <el-option label="天" value="d" />
                      </el-select>
                    </template>
                  </el-input>
                </el-form-item>
                <el-form-item label="过期周期(天)" prop="expirationPeriod">
                  <el-input-number v-model="rootCaForm.expirationPeriod" :min="1" />
                </el-form-item>
                <el-form-item label="保留过期证书(天)" prop="keepExpiredCertDays">
                  <el-input-number v-model="rootCaForm.keepExpiredCertDays" />
                </el-form-item>
                <el-form-item label="有效期模式" prop="validityMode">
                  <el-select v-model="rootCaForm.validityMode">
                    <el-option label="截止" value="cutoff" />
                    <el-option label="严格" value="strict" />
                    <el-option label="宽松" value="lax" />
                  </el-select>
                </el-form-item>
              </el-tab-pane>

              <el-tab-pane label="CRL配置">
                <el-form-item label="更新间隔(小时)" prop="crlIntervalHours">
                  <el-input-number v-model="rootCaForm.crlIntervalHours" :min="1" />
                </el-form-item>
                <el-form-item label="全量CRL间隔" prop="crlFullIntervals">
                  <el-input-number v-model="rootCaForm.crlFullIntervals" :min="1" />
                </el-form-item>
                <el-form-item label="重叠时间" prop="crlOverlap">
                  <el-input v-model="rootCaForm.crlOverlap" placeholder="例如: 90d" />
                </el-form-item>
                <el-form-item label="更新时间点" prop="crlIntervalTime">
                  <el-input v-model="rootCaForm.crlIntervalTime" placeholder="例如: 01:00" />
                </el-form-item>
                <el-form-item label="下一CRL编号" prop="nextCrlNo">
                  <el-input-number v-model="rootCaForm.nextCrlNo" :min="1" />
                </el-form-item>
              </el-tab-pane>

              <el-tab-pane label="URI配置">
                <el-form-item
                  v-for="(item, index) in rootCaForm.cacertUris"
                  :key="'cacert-' + index"
                  :label="index === 0 ? 'CA证书URI' : ' '"
                  :prop="'cacertUris.' + index + '.value'"
                >
                  <div style="display: flex; width: 100%">
                    <el-input v-model="item.value" style="flex: 1; margin-right: 10px" />
                    <el-button
                      v-if="index === 0"
                      @click="addUri('cacertUris')"
                      type="primary"
                      :icon="Plus"
                      circle
                      size="small"
                    />
                    <el-button
                      v-if="index !== 0"
                      @click="removeUri('cacertUris', index)"
                      type="danger"
                      :icon="Minus"
                      circle
                      size="small"
                    />
                  </div>
                </el-form-item>

                <el-form-item
                  v-for="(item, index) in rootCaForm.crlUris"
                  :key="'crl-' + index"
                  :label="index === 0 ? 'CRL URI' : ' '"
                  :prop="'crlUris.' + index + '.value'"
                >
                  <div style="display: flex; width: 100%">
                    <el-input v-model="item.value" style="flex: 1; margin-right: 10px" />
                    <el-button
                      v-if="index === 0"
                      @click="addUri('crlUris')"
                      type="primary"
                      :icon="Plus"
                      circle
                      size="small"
                    />
                    <el-button
                      v-if="index !== 0"
                      @click="removeUri('crlUris', index)"
                      type="danger"
                      :icon="Minus"
                      circle
                      size="small"
                    />
                  </div>
                </el-form-item>

                <el-form-item
                  v-for="(item, index) in rootCaForm.ocspUris"
                  :key="'ocsp-' + index"
                  :label="index === 0 ? 'OCSP URI' : ' '"
                  :prop="'ocspUris.' + index + '.value'"
                >
                  <div style="display: flex; width: 100%">
                    <el-input v-model="item.value" style="flex: 1; margin-right: 10px" />
                    <el-button
                      v-if="index === 0"
                      @click="addUri('ocspUris')"
                      type="primary"
                      :icon="Plus"
                      circle
                      size="small"
                    />
                    <el-button
                      v-if="index !== 0"
                      @click="removeUri('ocspUris', index)"
                      type="danger"
                      :icon="Minus"
                      circle
                      size="small"
                    />
                  </div>
                </el-form-item>
              </el-tab-pane>

              <el-tab-pane label="高级配置">
                <el-form-item label="序列号长度" prop="snSize">
                  <el-input-number v-model="rootCaForm.snSize" :min="1" />
                </el-form-item>
                <el-form-item label="状态" prop="status">
                  <el-select v-model="rootCaForm.status">
                    <el-option label="激活" value="active" />
                    <el-option label="停用" value="inactive" />
                  </el-select>
                </el-form-item>
              </el-tab-pane>
            </el-tabs>
          </el-form>
        </div>

        <div v-if="active === 3" class="step-content">
          <div class="step-header" style="display: flex; justify-content: space-between; align-items: center; width: 100%">
            <div style="display: flex; align-items: center; gap: 20px">
              <h2 style="margin: 0">管理员设置</h2>
              <div v-if="isSkfMonitoring" class="monitoring-status">
                <span class="pulse-dot"></span>
                <span class="status-text">正在监控 USB Key 插拨...</span>
              </div>
            </div>
            <el-button
              type="info"
              text
              circle
              style="font-size: 24px; padding: 12px"
              :icon="QuestionFilled"
              @click="showAdminHelp = true"
            />
          </div>

          <el-drawer v-model="showAdminHelp" title="管理员 USBKey 设置说明" direction="rtl" size="500px">
            <div class="template-help-container">
              <el-alert title="管理员证书" type="info" :closable="false" show-icon class="help-header-alert">
                <p>系统初始化需要管理员（admin）和审计员（auditor），推荐使用硬件 USBKey 存储身份证书。</p>
              </el-alert>

              <div class="help-card end-entity">
                <div class="help-card-header">
                  <span class="help-card-title">USBKey 操作流程</span>
                </div>
                <div class="help-card-body">
                  1. 插入 USB Key。<br/>
                  2. 选择 <b>设备提供商</b> (Provider) 并 <b>刷新</b>。<br/>
                  3. 选择对应的 <b>设备</b>、<b>应用</b>。<br/>
                  4. 输入 <b>容器名</b> (通常新建一个，如 admin)。<br/>
                  5. 输入 USBKey 的 <b>User PIN</b> 码。<br/>
                  6. 点击 <b>生成 CSR 并签发</b>。
                </div>
              </div>

              <el-divider />

              <h4>常见问题</h4>
              <ul class="help-list">
                <li><b>找不到设备？</b> 请确保本地已安装并运行了 SKF 服务 (liuzx-skf)。</li>
                <li><b>PIN 码验证失败？</b> PIN 码是您 USB Key 的解锁密码，通常默认为 123456 或 888888，请查阅设备说明书。</li>
                <li><b>容器名冲突？</b> 如果容器已存在，签名可能会覆盖旧密钥，或者操作失败。建议使用新的容器名。</li>
              </ul>
            </div>
          </el-drawer>
          <el-form :model="adminForm" :rules="adminRules" ref="adminFormRef" label-width="120px" style="width: 500px">
            <el-form-item label="用户名" prop="username">
              <el-input v-model="adminForm.username" disabled />
            </el-form-item>

            <div style="margin-top: 20px; border-top: 1px dashed #eee; padding-top: 20px; margin-bottom: 20px">
              <h4 style="margin-top: 0; color: #606266; font-size: 14px">证书主题信息</h4>
              <CertSubject v-model="adminForm.subjectItems" propPrefix="subjectItems" />
            </div>

            <div style="margin-top: 20px; border-top: 1px dashed #eee; padding-top: 20px; margin-bottom: 20px">
              <h4 style="margin-top: 0; color: #606266; font-size: 14px">USBKey 证书设置</h4>
              <el-form-item label="设备提供商" prop="provider">
                <div class="flex-row" style="display: flex; gap: 10px; width: 100%">
                  <el-select
                    v-model="adminForm.provider"
                    placeholder="请选择或刷新"
                    style="flex: 1"
                    @change="onAdminProviderChange"
                  >
                    <el-option v-for="p in adminProviders" :key="p" :label="p" :value="p" />
                  </el-select>
                  <el-button @click="refreshAdminProviders" :icon="Refresh" circle />
                </div>
              </el-form-item>

              <el-form-item label="设备列表" prop="device">
                <el-select
                  v-model="adminForm.device"
                  placeholder="请选择设备"
                  style="width: 100%"
                  @change="onAdminDeviceChange"
                >
                  <el-option v-for="d in adminDevices" :key="d" :label="d" :value="d" />
                </el-select>
              </el-form-item>

              <el-form-item label="应用" prop="appName">
                <el-select
                  v-model="adminForm.appName"
                  placeholder="请选择应用"
                  style="width: 100%"
                  @change="onAdminAppChange"
                >
                  <el-option v-for="a in adminApps" :key="a" :label="a" :value="a" />
                </el-select>
              </el-form-item>

              <el-form-item label="容器名" prop="containerName">
                <el-input v-model="adminForm.containerName" placeholder="建议使用 admin 作为容器名" />
              </el-form-item>

              <el-form-item label="User PIN" prop="pin">
                <el-input v-model="adminForm.pin" type="password" show-password placeholder="请输入 USBKey User PIN" />
              </el-form-item>

              <el-form-item label="证书操作">
                <el-button
                  type="primary"
                  :loading="adminGeneratingCert"
                  @click="handleGenerateAdminCert"
                  style="width: 100%"
                >
                  生成 CSR 并签发写入 USBKey
                </el-button>
              </el-form-item>

              <el-form-item v-if="adminCertPem" label="已签发证书">
                <el-button type="success" link @click="showAdminCertDialog = true">查看已签发管理员证书详情</el-button>
              </el-form-item>
            </div>

            <el-form-item label="平台登录密码" prop="password">
              <el-input v-model="adminForm.password" type="password" show-password placeholder="请输入平台登录新密码" />
            </el-form-item>
            <el-form-item label="确认密码" prop="confirmPassword">
              <el-input
                v-model="adminForm.confirmPassword"
                type="password"
                show-password
                placeholder="请再次输入新密码"
              />
            </el-form-item>
          </el-form>
        </div>

        <div v-if="active === 4" class="step-content">
          <div class="step-header" style="display: flex; justify-content: space-between; align-items: center; width: 100%">
            <div style="display: flex; align-items: center; gap: 20px">
              <h2 style="margin: 0">审计员设置</h2>
              <div v-if="isSkfMonitoring" class="monitoring-status">
                <span class="pulse-dot"></span>
                <span class="status-text">正在监控 USB Key 插拨...</span>
              </div>
            </div>
            <el-button
              type="info"
              text
              circle
              style="font-size: 24px; padding: 12px"
              :icon="QuestionFilled"
              @click="showAuditorHelp = true"
            />
          </div>

          <el-drawer v-model="showAuditorHelp" title="审计员设置说明" direction="rtl" size="500px">
            <div class="template-help-container">
              <el-alert title="三员管理" type="info" :closable="false" show-icon class="help-header-alert">
                <p>根据安全审计要求，系统实行三员分立。审计员负责对管理员的操作进行事后审计。</p>
              </el-alert>

              <div class="help-card sub-ca">
                <div class="help-card-header">
                  <span class="help-card-title">操作提示</span>
                </div>
                <div class="help-card-body">
                  审计员的证书生成流程与管理员一致。请插入<b>另一支</b> USB Key（推荐）或在同一支 Key 的不同容器中生成。
                </div>
              </div>
            </div>
          </el-drawer>
          <el-form
            :model="auditorForm"
            :rules="auditorRules"
            ref="auditorFormRef"
            label-width="120px"
            style="width: 500px"
          >
            <el-form-item label="用户名" prop="username">
              <el-input v-model="auditorForm.username" disabled />
            </el-form-item>

            <div style="margin-top: 20px; border-top: 1px dashed #eee; padding-top: 20px; margin-bottom: 20px">
              <h4 style="margin-top: 0; color: #606266; font-size: 14px">证书主题信息</h4>
              <CertSubject v-model="auditorForm.subjectItems" propPrefix="subjectItems" />
            </div>

            <div style="margin-top: 20px; border-top: 1px dashed #eee; padding-top: 20px; margin-bottom: 20px">
              <h4 style="margin-top: 0; color: #606266; font-size: 14px">USBKey 证书设置</h4>
              <el-form-item label="设备提供商" prop="provider">
                <div class="flex-row" style="display: flex; gap: 10px; width: 100%">
                  <el-select
                    v-model="auditorForm.provider"
                    placeholder="请选择或刷新"
                    style="flex: 1"
                    @change="onAuditorProviderChange"
                  >
                    <el-option v-for="p in auditorProviders" :key="p" :label="p" :value="p" />
                  </el-select>
                  <el-button @click="refreshAuditorProviders" :icon="Refresh" circle />
                </div>
              </el-form-item>

              <el-form-item label="设备列表" prop="device">
                <el-select
                  v-model="auditorForm.device"
                  placeholder="请选择设备"
                  style="width: 100%"
                  @change="onAuditorDeviceChange"
                >
                  <el-option v-for="d in auditorDevices" :key="d" :label="d" :value="d" />
                </el-select>
              </el-form-item>

              <el-form-item label="应用" prop="appName">
                <el-select
                  v-model="auditorForm.appName"
                  placeholder="请选择应用"
                  style="width: 100%"
                  @change="onAuditorAppChange"
                >
                  <el-option v-for="a in auditorApps" :key="a" :label="a" :value="a" />
                </el-select>
              </el-form-item>

              <el-form-item label="容器名" prop="containerName">
                <el-input v-model="auditorForm.containerName" placeholder="建议使用 auditor 作为容器名" />
              </el-form-item>

              <el-form-item label="User PIN" prop="pin">
                <el-input v-model="auditorForm.pin" type="password" show-password placeholder="请输入 USBKey User PIN" />
              </el-form-item>

              <el-form-item label="证书操作">
                <el-button
                  type="primary"
                  :loading="auditorGeneratingCert"
                  @click="handleGenerateAuditorCert"
                  style="width: 100%"
                >
                  生成 CSR 并签发写入 USBKey
                </el-button>
              </el-form-item>

              <el-form-item v-if="auditorCertPem" label="已签发证书">
                <el-button type="success" link @click="showAuditorCertDialog = true">查看已签发审计员证书详情</el-button>
              </el-form-item>
            </div>

            <el-form-item label="平台登录密码" prop="password">
              <el-input v-model="auditorForm.password" type="password" show-password placeholder="请输入平台登录新密码" />
            </el-form-item>
            <el-form-item label="确认密码" prop="confirmPassword">
              <el-input
                v-model="auditorForm.confirmPassword"
                type="password"
                show-password
                placeholder="请再次输入新密码"
              />
            </el-form-item>
          </el-form>
        </div>

        <div v-if="active === 5" class="step-content">
          <h2>安装完成</h2>
          <el-result icon="success" title="初始化成功" sub-title="您可以点击下方按钮进入系统"> </el-result>
        </div>
      </div>

      <div class="wizard-actions">
        <el-button @click="prev" :disabled="active === 0 || active === 5 || loading">上一步</el-button>
        <el-button type="primary" :loading="loading" @click="next" :disabled="!canNext">{{ nextButtonText }}</el-button>
      </div>
    </el-card>

    <!-- 外部证书详情弹窗 -->
    <el-dialog v-model="showExternalCertDialog" title="外部签发证书详情" width="60%">
      <X509Cert v-if="showExternalCertDialog" :certPem="externalCertPem" />
    </el-dialog>

    <!-- 生成的自签名根证书详情弹窗 -->
    <el-dialog
      v-model="showGeneratedRootCaDialog"
      title="初始化根证书成功"
      width="60%"
      :before-close="handleGeneratedRootCaConfirm"
    >
      <X509Cert v-if="showGeneratedRootCaDialog" :certPem="generatedRootCaPem" />
      <template #footer>
        <span class="dialog-footer">
          <el-button type="primary" @click="handleGeneratedRootCaConfirm">确 定 并 继 续</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 管理员证书详情弹窗 -->
    <el-dialog v-model="showAdminCertDialog" title="管理员证书详情" width="60%">
      <X509Cert v-if="showAdminCertDialog" :certPem="adminCertPem" />
    </el-dialog>

    <!-- 审计员证书详情弹窗 -->
    <el-dialog v-model="showAuditorCertDialog" title="审计员证书详情" width="60%">
      <X509Cert v-if="showAuditorCertDialog" :certPem="auditorCertPem" />
    </el-dialog>

    <!-- 模板详情弹窗 -->
    <el-dialog v-model="showTemplateDetailDialog" title="模板详情" width="60%">
      <CertProfile v-if="showTemplateDetailDialog" :profile="currentTemplate" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted, watch, getCurrentInstance, ComponentInternalInstance } from 'vue';
import {
  ElMessage,
  FormInstance,
  FormRules,
  UploadInstance,
  UploadUserFile,
  UploadProps,
  UploadRawFile,
  genFileId
} from 'element-plus';
import { useRouter } from 'vue-router';
import { listProfile, listInitProfile, getProfile, initProfiles } from '@/api/ca/profile';
import { uploadUserCert, resetUserPwd } from '@/api/system/user';
import { getTenant, updateTenant } from '@/api/system/tenant';
import { genRootCa, importExternalCert, issueAdminCert, deleteAllRootCa } from '@/api/ca/root';
import { useUserStore } from '@/store/modules/user';
import { useTagsViewStore } from '@/store/modules/tagsView';
import X509Cert from '@/components/X509Cert/index.vue';
import CertProfile from '@/components/CertProfile/index.vue';
import Agreement from '@/components/Agreement/index.vue';
import CertSubject, { typeMapping, sortSubjectItems } from '@/components/CertSubject/index.vue';
import { parseJson, parseKeyAlgorithms } from '@/utils/json';
const { proxy } = getCurrentInstance() as ComponentInternalInstance;
import * as forge from 'node-forge';
import { Plus, Minus, QuestionFilled, Warning, Refresh, View } from '@element-plus/icons-vue';

// 引入 SKFClient
import SKFClient from '@/api/skf/skf_api';

let skfClientPromise: Promise<any> | null = null;

const getSkfClient = (): Promise<any> => {
  if (!skfClientPromise) {
    skfClientPromise = new Promise((resolve, reject) => {
      const client = new SKFClient('ws://127.0.0.1:9001');

      const timeout = setTimeout(() => {
        skfClientPromise = null;
        reject(new Error('连接 SKF 服务超时'));
      }, 5000);

      client
        .connect()
        .then(() => {
          clearTimeout(timeout);
          resolve(client);
        })
        .catch((err: any) => {
          clearTimeout(timeout);
          skfClientPromise = null;
          reject(err);
        });

      client.on('error', (err: any) => {
        console.error('SKF Client Error', err);
        if (!client.isConnected()) {
          skfClientPromise = null;
        }
      });

      client.on('disconnect', () => {
        console.log('SKF Client Disconnected');
        skfClientPromise = null;
      });
    });
  }
  return skfClientPromise;
};

// --- USB Key Monitoring ---
let usbMonitoringActive = false;
const monitoredProviders = new Set<string>();
const isSkfMonitoring = ref(false);

const stopUsbMonitoring = async (forceDisconnect = false) => {
  if (usbMonitoringActive || forceDisconnect) {
    console.log(`Stopping USB monitoring (force=${forceDisconnect})...`);
    usbMonitoringActive = false;
    monitoredProviders.clear();
    isSkfMonitoring.value = false;

    if (forceDisconnect && skfClientPromise) {
      try {
        const skf = await getSkfClient();
        skf.disconnect();
        skfClientPromise = null;
      } catch (e) {
        skfClientPromise = null;
      }
    }
  }
};

const monitorLoop = async () => {
  while (usbMonitoringActive) {
    try {
      const skf = await getSkfClient();
      const providers = await skf.enumProvider();

      if (providers.length === 0) {
        isSkfMonitoring.value = false;
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }

      isSkfMonitoring.value = true;
      // Start monitoring for new providers only
      providers.forEach((p: string) => {
        if (!monitoredProviders.has(p)) {
          monitoredProviders.add(p);
          monitorProvider(p);
        }
      });

      // Wait before checking for new providers again
      await new Promise((r) => setTimeout(r, 10000));
    } catch (e) {
      if (usbMonitoringActive) {
        console.warn('USB monitor loop error:', e);
        isSkfMonitoring.value = false;
        await new Promise((r) => setTimeout(r, 5000));
      } else {
        break;
      }
    }
  }
};

const monitorProvider = async (provider: string) => {
  console.log(`Starting monitor for provider: ${provider}`);
  while (usbMonitoringActive) {
    try {
      const skf = await getSkfClient();
      const event = await skf.waitForDevEvent(provider);
      console.log(`USB Event on ${provider}:`, event);

      if (usbMonitoringActive) {
        // Refresh appropriate lists
        if (active.value === 3) {
          await refreshAdminProviders();
          ElMessage({
            message: `检测到设备 ${event.deviceName} ${event.event === 1 ? '插入' : '拔出'}，已自动刷新`,
            type: 'info',
            duration: 2000
          });
        } else if (active.value === 4) {
          await refreshAuditorProviders();
          ElMessage({
            message: `检测到设备 ${event.deviceName} ${event.event === 1 ? '插入' : '拔出'}，已自动刷新`,
            type: 'info',
            duration: 2000
          });
        }
      }
    } catch (e) {
      if (usbMonitoringActive) {
        // Log less frequently or only on real errors
        await new Promise((r) => setTimeout(r, 2000));
      } else {
        break;
      }
    }
  }
};

const startUsbMonitoring = async () => {
  if (usbMonitoringActive) return;
  console.log('Starting USB monitoring...');
  usbMonitoringActive = true;
  isSkfMonitoring.value = true;

  await monitorLoop();
};

const router = useRouter();
const userStore = useUserStore();
const tagsViewStore = useTagsViewStore();
const active = ref(0);
const agree = ref(false);
const loading = ref(false);

// 常量定义
const ADMIN_USER_ID = '401';
const AUDITOR_USER_ID = '402';

// 租户信息
const tenantCode = ref('');
const tenantName = ref('');
const companyName = ref('');

// 初始化模板
const templateData = ref([]);
const selectedTemplates = ref([]);
const showTemplateDetailDialog = ref(false);
const showTemplateHelp = ref(false);
const showRootCaHelp = ref(false);
const showAdminHelp = ref(false);
const showAuditorHelp = ref(false);
const currentTemplate = ref({});

const loadTemplateData = async () => {
  console.log('loadTemplateData: Fetching profiles...');
  try {
    const res = await listInitProfile();
    templateData.value = res.data.map((p: any) => ({
      ...p,
      // Normalize type from certLevel if type is missing or generic
      type: p.type || p.certLevel || 'EndEntity'
    }));
    console.log('loadTemplateData: Profiles fetched and normalized:', templateData.value?.length);
    if (templateData.value) {
      templateData.value.forEach((p: any) => console.log(`  - [${p.id}] ${p.name} (${p.type})`));
    }
    // If we are already past step 1, assume all returned profiles were selected
    if (active.value > 1 && selectedTemplates.value.length === 0) {
      selectedTemplates.value = templateData.value;
      console.log('loadTemplateData: Automatically selected all profiles at step', active.value);
    }
  } catch (error) {
    console.error('loadTemplateData: Error', error);
    ElMessage.error('获取模板列表失败');
  }
};

watch(active, async (newActive) => {
  if (newActive === 1) {
    await loadTemplateData();
  }
  if (newActive === 2) {
    console.log('Step 2: Starting initialization', selectedTemplates.value.length);
    // 先删除所有根证书
    try {
      await deleteAllRootCa();
      console.log('Step 2: Deleted all existing root certificates');
    } catch (error) {
      console.error('Step 2: Failed to delete root certificates', error);
      ElMessage.warning('删除旧根证书失败，但继续初始化流程');
    }

    if (selectedTemplates.value.length === 0) {
      await loadTemplateData();
      console.log('Step 2: Templates loaded', selectedTemplates.value.length);
    }
    const rootCaTemplate = selectedTemplates.value.find((t: any) => t.name === 'RootCA证书模板') || rootCaTemplates.value[0];
    console.log('Step 2: Target template', rootCaTemplate?.name, rootCaTemplate?.id);
    console.log('Step 2: All selected templates', selectedTemplates.value.map((t: any) => ({ id: t.id, name: t.name, type: t.type })));
    console.log('Step 2: RootCA templates', rootCaTemplates.value.map((t: any) => ({ id: t.id, name: t.name })));
    if (rootCaTemplate) {
      rootCaForm.profileId = (rootCaTemplate as any).id;
      console.log('Step 2: Loading profile with ID', rootCaForm.profileId);
      await loadProfileToForm(rootCaForm.profileId, rootCaForm);
      console.log('Step 2: Template applied', rootCaForm.subjectItems.length);
    } else {
      console.error('Step 2: No RootCA template found!');
      ElMessage.error('未找到RootCA证书模板，请确保已选择至少一个RootCA证书模板');
    }

    // Ensure subjectItems is at least initialized with basic structure if still empty
    if (!rootCaForm.subjectItems || rootCaForm.subjectItems.length === 0) {
      console.log('Step 2: No template data for subject, using default');
      rootCaForm.subjectItems = sortSubjectItems([
        { type: 'country', value: 'CN' },
        { type: 'organization', value: '' },
        { type: 'commonName', value: '' }
      ]);
    }
  }
  if (newActive === 3) {
    if (selectedTemplates.value.length === 0) {
      await loadTemplateData();
    }
    const defaultC = rootCaForm.subjectItems.find((i: any) => i.type === 'country')?.value || 'CN';
    const defaultO = rootCaForm.subjectItems.find((i: any) => i.type === 'organization')?.value || '';

    // Use "通用证书模板" if available, fallback to any EndEntity template
    const eeTemplate =
      selectedTemplates.value.find((t: any) => t.name === '通用证书模板') ||
      selectedTemplates.value.find((t: any) => t.type === 'EndEntity');
    if (eeTemplate) {
      adminForm.profileId = eeTemplate.id;
      await loadProfileToForm(eeTemplate.id, adminForm, {
        country: defaultC,
        organization: defaultO,
        commonName: 'admin'
      });
    } else {
      adminForm.subjectItems = sortSubjectItems([
        { type: 'country', value: defaultC },
        { type: 'organization', value: defaultO },
        { type: 'organizationalUnit', value: '' },
        { type: 'commonName', value: 'admin' }
      ]);
    }
    await refreshAdminProviders();
  }
  if (newActive === 4) {
    // 强制断开 SK F连接，确保在步骤4时重新建立连接
    await stopUsbMonitoring(true);

    if (selectedTemplates.value.length === 0) {
      await loadTemplateData();
    }
    const defaultC = rootCaForm.subjectItems.find((i: any) => i.type === 'country')?.value || 'CN';
    const defaultO = rootCaForm.subjectItems.find((i: any) => i.type === 'organization')?.value || '';

    // Use "通用证书模板" if available, fallback to any EndEntity template
    const eeTemplate =
      selectedTemplates.value.find((t: any) => t.name === '通用证书模板') ||
      selectedTemplates.value.find((t: any) => t.type === 'EndEntity');
    if (eeTemplate) {
      auditorForm.profileId = eeTemplate.id;
      await loadProfileToForm(eeTemplate.id, auditorForm, {
        country: defaultC,
        organization: defaultO,
        commonName: 'auditor'
      });
    } else {
      auditorForm.subjectItems = sortSubjectItems([
        { type: 'country', value: defaultC },
        { type: 'organization', value: defaultO },
        { type: 'organizationalUnit', value: '' },
        { type: 'commonName', value: 'auditor' }
      ]);
    }
    // 等待一小段时间，确保 SK F连接断开
    await new Promise((r) => setTimeout(r, 500));
    await refreshAuditorProviders();
  }

  // Handle USB Monitoring Lifecycle
  if (newActive === 3 || newActive === 4) {
    await startUsbMonitoring();
  } else {
    await stopUsbMonitoring();
  }
});

onUnmounted(() => {
  stopUsbMonitoring();
});

const handleTemplateSelectionChange = (val: any) => {
  selectedTemplates.value = val;
};

const handleTemplateDetail = (row: any) => {
  try {
    const conf = parseJson(row.conf);
    currentTemplate.value = conf || row;
  } catch (e) {
    currentTemplate.value = row;
  }
  showTemplateDetailDialog.value = true;
};

const profileTypeMap: Record<string, string> = {
  RootCA: 'RootCA证书模板',
  SubCA: '子CA证书模板',
  EndEntity: '终端实体证书模板'
};

const getProfileTypeLabel = (type: string) => {
  return profileTypeMap[type] || type;
};

// 初始化根证书
const rootType = ref('self'); // 'self' | 'external'
const showGeneratedRootCaDialog = ref(false);
const generatedRootCaPem = ref('');

const handleGeneratedRootCaConfirm = async () => {
  showGeneratedRootCaDialog.value = false;
  await updateTenantStep();
};

const formatToPem = (base64: string) => {
  if (base64.includes('BEGIN CERTIFICATE')) return base64;
  const chunked = base64.match(/.{1,64}/g)?.join('\n') || base64;
  return `-----BEGIN CERTIFICATE-----\n${chunked}\n-----END CERTIFICATE-----`;
};

const rootCaFormRef = ref<FormInstance>();
const rootCaForm = reactive({
  profileId: '' as string | number,
  rootcaProfileName: '', // Template name for backend
  name: '',
  // Subject
  subjectItems: [] as any[],

  // Key
  algo: 'SM2',
  signerType: 'PKCS12',
  keyIndex: 1,
  password: '',

  // Validity
  maxValidity: 10,
  maxValidityUnit: 'y',
  expirationPeriod: 365,
  keepExpiredCertDays: -1,
  validityMode: 'cutoff',

  // CRL
  crlIntervalHours: 24,
  crlFullIntervals: 90,
  crlOverlap: '90d',
  crlIntervalTime: '01:00',
  nextCrlNo: 2,

  // URIs
  cacertUris: [{ value: 'https://myorg.org/rootca1.der' }],
  crlUris: [{ value: 'https://localhost:8081/dummy/crl/?type=crl&name=rootca1' }],
  ocspUris: [{ value: 'https://localhost:8080/ocsp/responder1' }],

  // Advanced
  snSize: 20,
  status: 'active'
});

const rootCaAlgos = ref<string[]>([]);

const rootCaTemplates = computed(() => {
  const filtered = selectedTemplates.value.filter((t: any) => (t as any).type === 'RootCA');
  console.log('Computed rootCaTemplates:', filtered.length, 'from total selected:', selectedTemplates.value.length);
  return filtered;
});

const loadProfileToForm = async (id: string | number, form: any, defaultValues?: any) => {
  console.log('loadProfileToForm start', id, form === rootCaForm ? 'RootCA' : 'Other');
  if (!typeMapping) {
    console.error('typeMapping is NOT defined in index.vue!');
  }
  loading.value = true;
  try {
    const res = await getProfile(id);
    console.log('getProfile response', res);
    const profile = res.data;
    if (!profile) {
      throw new Error('Profile data is empty');
    }
    console.log('Profile loaded', profile.name, profile.id);
    // Remove JSON comments before parsing
    const parseConf = (confStr: string) => {
      // Remove single-line comments (// ...)
      const withoutSingleLine = confStr.replace(/\/\/.*$/gm, '');
      // Remove multi-line comments (/* ... */)
      const withoutComments = withoutSingleLine.replace(/\/\*[\s\S]*?\*\//g, '');
      return JSON.parse(withoutComments);
    };
    const conf = typeof profile.conf === 'string' ? parseConf(profile.conf) : profile.conf;
    if (conf) {
      console.log('Profile config parsed', !!conf.subject);
      // 1. Subject Items
      if (conf.subject) {
        const items: any[] = [];
        const rdns = Array.isArray(conf.subject) ? conf.subject : conf.subject.rdns || [];
        rdns.forEach((rdn: any) => {
          const rdnType = rdn.type || {};
          let compType = (rdnType.description || rdnType.oid || '').toLowerCase();
          for (const [type, meta] of Object.entries(typeMapping)) {
            if (meta.key.toLowerCase() === compType || type.toLowerCase() === compType) {
              compType = type;
              break;
            }
          }
          let val = rdn.value || '';
          if (!val && defaultValues && defaultValues[compType]) {
            // Check if there is a regex constraint (like :FQDN), if so, don't use the simple default value
            const hasRegex = !!rdn.regex;
            if (!hasRegex) {
              val = defaultValues[compType];
            }
          }

          // If minOccurs > 1, create multiple items
          const count = Math.max(1, rdn.minOccurs || 0);
          for (let i = 0; i < count; i++) {
            items.push({
              type: compType,
              value: val,
              minOccurs: rdn.minOccurs,
              maxOccurs: rdn.maxOccurs,
              regex: rdn.regex
            });
          }
        });
        form.subjectItems = sortSubjectItems(items);
        console.log('Subject items set from template', form.subjectItems.length);
      }

      // 2. Profile Name
      if (form === rootCaForm) {
        form.rootcaProfileName = profile.name || '';
      }

      // 3. Validity (only for Root CA)
      if (form === rootCaForm && conf.validity) {
        const v = conf.validity;
        const unit = v.slice(-1);
        const val = parseInt(v.slice(0, -1));
        if (!isNaN(val)) {
          form.maxValidity = val;
          form.maxValidityUnit = unit || 'y';
        }
      }

      // 4. Algorithms (only for Root CA)
      if (form === rootCaForm && conf.keyAlgorithms) {
        const algos = parseKeyAlgorithms(conf.keyAlgorithms);
        rootCaAlgos.value = algos;
        if (algos.length > 0 && !algos.includes(form.algo)) {
          form.algo = algos[0];
        }
      }
    }
  } catch (e) {
    console.error('Failed to load template details', e);
    ElMessage.error('获取模板详情失败');
  } finally {
    loading.value = false;
  }
};

const rootCaRules = reactive<FormRules>({
  name: [{ required: true, message: '请输入CA名称', trigger: 'blur' }],
  password: [{ required: true, message: '请输入签名器密码', trigger: 'blur' }],
  keyIndex: [
    { required: true, message: '请输入密钥索引', trigger: 'blur' },
    { type: 'integer', message: '必须为正整数', trigger: 'blur', min: 1 }
  ],
  maxValidity: [
    { required: true, message: '请输入最大有效期', trigger: 'blur' },
    { type: 'integer', message: '必须为正整数', trigger: 'blur', min: 1 }
  ]
});

watch(
  () => rootCaForm.maxValidityUnit,
  (newUnit) => {
    if (newUnit === 'y') {
      rootCaForm.maxValidity = 10;
    } else if (newUnit === 'd') {
      rootCaForm.maxValidity = 3650;
    }
  }
);

const addUri = (field: 'cacertUris' | 'crlUris' | 'ocspUris') => {
  rootCaForm[field].push({ value: '' });
};

const removeUri = (field: 'cacertUris' | 'crlUris' | 'ocspUris', index: number) => {
  rootCaForm[field].splice(index, 1);
};

// 外部证书上传
const externalCertUploadRef = ref<UploadInstance>();
const externalCertFileList = ref<UploadUserFile[]>([]);
const externalCertPem = ref<string>('');
const showExternalCertDialog = ref(false);

const handleExternalCertExceed: UploadProps['onExceed'] = (files) => {
  externalCertUploadRef.value!.clearFiles();
  const file = files[0] as UploadRawFile;
  file.uid = genFileId();
  externalCertUploadRef.value!.handleStart(file);
};

const handleExternalCertChange: UploadProps['onChange'] = async (uploadFile) => {
  if (uploadFile.raw) {
    const pem = await readFileContent(uploadFile.raw);
    if (pem) {
      externalCertPem.value = pem;
      showExternalCertDialog.value = true;
    } else {
      ElMessage.error('上传文件必须是x509证书文件');
      externalCertPem.value = pem || '';
      externalCertUploadRef.value!.clearFiles();
    }
  } else {
    externalCertPem.value = '';
  }
};

const handleExternalCertRemove: UploadProps['onRemove'] = () => {
  externalCertPem.value = '';
};

const handleDownloadCsr = async () => {
  if (!rootCaFormRef.value) return;
  try {
    await rootCaFormRef.value.validate();
  } catch (error) {
    return;
  }
  // 这里应该调用后端接口生成CSR，或者在前端生成
  // 暂时模拟
  ElMessage.success('CSR 生成请求已发送（模拟），请检查下载');
  console.log('Generating CSR for:', rootCaForm);
};

// 证书解析相关
const readFileContent = async (file: File): Promise<string | null> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const bytes = new Uint8Array(arrayBuffer);
        let content = '';
        for (let i = 0; i < bytes.length; i++) {
          content += String.fromCharCode(bytes[i]);
        }

        // 检查是否是 PEM 格式
        if (content.includes('-----BEGIN CERTIFICATE-----')) {
          resolve(content);
        } else {
          // 尝试将 DER 转换为 PEM
          try {
            const derBuffer = forge.util.createBuffer(content, 'raw');
            const asn1 = forge.asn1.fromDer(derBuffer);
            const cert = forge.pki.certificateFromAsn1(asn1);
            const pem = forge.pki.certificateToPem(cert);
            resolve(pem);
          } catch (derError) {
            // 如果 forge 无法解析（如 SM2），尝试手动包装成 PEM
            const base64 = forge.util.encode64(content);
            const pem = `-----BEGIN CERTIFICATE-----\n${base64.match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----`;
            resolve(pem);
          }
        }
      } catch (error) {
        console.error('File reading error:', error);
        resolve(null);
      }
    };
    // 读取为 ArrayBuffer 以兼容
    reader.readAsArrayBuffer(file);
    reader.onerror = () => reject(null);
  });
};

// 管理员设置
const adminFormRef = ref<FormInstance>();
const adminCertPem = ref<string>('');
const showAdminCertDialog = ref(false);
const adminGeneratingCert = ref(false);

const adminForm = reactive({
  username: 'admin',
  password: '',
  confirmPassword: '',
  provider: '',
  device: '',
  appName: '',
  containerName: 'admin',
  pin: '',
  subjectItems: [] as any[],
  profileId: '' as string | number
});

const adminProviders = ref<string[]>([]);
const adminDevices = ref<string[]>([]);
const adminApps = ref<string[]>([]);

const refreshAdminProviders = async () => {
  try {
    const skf = await getSkfClient();
    const providers = await skf.enumProvider();
    adminProviders.value = providers;
    if (providers.length > 0) {
      adminForm.provider = providers[0];
      await onAdminProviderChange();
    } else {
      adminForm.provider = '';
      adminDevices.value = [];
      adminForm.device = '';
    }
  } catch (e: any) {
    ElMessage.error('SKF 服务连接失败: ' + (e.message || e));
  }
};

const onAdminProviderChange = async () => {
  if (!adminForm.provider) return;
  try {
    const skf = await getSkfClient();
    const devices = await skf.enumDevice(adminForm.provider);
    adminDevices.value = devices;
    if (devices.length > 0) {
      adminForm.device = devices[0];
      await onAdminDeviceChange();
    } else {
      adminForm.device = '';
      adminApps.value = [];
      adminForm.appName = '';
    }
  } catch (e: any) {
    ElMessage.error('枚举设备失败: ' + (e.message || e));
  }
};

const onAdminDeviceChange = async () => {
  if (!adminForm.provider || !adminForm.device) return;
  try {
    const skf = await getSkfClient();
    const apps = await skf.enumApplication(adminForm.provider, adminForm.device);
    adminApps.value = apps;
    if (apps.length > 0) {
      adminForm.appName = apps[0];
    } else {
      adminForm.appName = '';
    }
  } catch (e: any) {
    ElMessage.error('枚举应用失败: ' + (e.message || e));
  }
};

const onAdminAppChange = () => {
  // Can fetch containers if needed
};

const handleGenerateAdminCert = async () => {
  if (!adminFormRef.value) return;

  // Validate only the fields needed for CSR generation
  const fieldsToValidate = [
    'provider',
    'device',
    'appName',
    'containerName',
    'pin',
    ...adminForm.subjectItems.map((_, i) => `subjectItems.${i}.value`)
  ];

  try {
    await adminFormRef.value.validateField(fieldsToValidate);
  } catch (error) {
    console.warn('Form validation failed for CSR generation', error);
    return;
  }

  if (adminGeneratingCert.value) return;
  adminGeneratingCert.value = true;

  try {
    // Stop monitoring and force disconnect to clear any blocked waitForDevEvent
    await stopUsbMonitoring(true);

    ElMessage.info({ message: '正在连接 SKF 服务...', duration: 2000 });
    const skf = await getSkfClient();

    // 1. 验证 PIN 并生成 CSR
    ElMessage.info({ message: '正在验证 PIN...', duration: 2000 });
    await skf.checkPIN(`${adminForm.provider}/${adminForm.device}/${adminForm.appName}`, adminForm.pin);

    ElMessage.info({ message: '正在从 USBKey 生成 CSR (可能需要几秒，请留意 Key 上的指示)...', duration: 5000 });
    const subject = adminForm.subjectItems
      .filter((item: any) => item.value)
      .map((item: any) => {
        const key = typeMapping[item.type as keyof typeof typeMapping]?.key || item.type;
        return `${key}=${item.value}`;
      })
      .join(',');

    const keyType = rootCaForm.algo === 'RSA' ? 'RSA' : 'SM2';
    const keyLength = keyType === 'RSA' ? 2048 : 256;

    console.log('Creating PKCS10:', { subject, keyType, keyLength, container: adminForm.containerName });
    const csrRes = await skf.createPKCS10(
      adminForm.provider,
      adminForm.device,
      adminForm.appName,
      subject,
      keyType,
      keyLength,
      adminForm.containerName
    );

    // 2. 调用后端接口签发证书
    ElMessage.info({ message: '正在请求后端签发管理员证书...', duration: 2000 });
    const issueRes = await issueAdminCert({
      csrPem: csrRes.pem,
      profileId: adminForm.profileId
    });
    if (!issueRes.data || !issueRes.data.cert) {
      throw new Error('签发证书失败: 无返回数据');
    }
    const signedCertPem = formatToPem(issueRes.data.cert);

    // 3. 导入证书到 USBKey
    ElMessage.info('正在将证书写入 USBKey...');
    await skf.importCertificate(
      adminForm.provider,
      adminForm.device,
      adminForm.appName,
      csrRes.container,
      true, // isSign
      signedCertPem
    );

    adminCertPem.value = signedCertPem;
    ElMessage.success('管理员证书生成并写入成功');
  } catch (e: any) {
    console.error('管理员证书生成失败', e);
    ElMessage.error('管理员证书生成失败: ' + (e.message || e));
  } finally {
    adminGeneratingCert.value = false;
    // Resume monitoring
    await startUsbMonitoring();
  }
};

const adminRules = reactive<FormRules>({
  password: [{ required: true, message: '请输入平台登录新密码', trigger: 'blur' }],
  confirmPassword: [
    { required: true, message: '请再次输入平台登录新密码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== adminForm.password) {
          callback(new Error('两次输入的密码不一致'));
        } else {
          callback();
        }
      },
      trigger: 'blur'
    }
  ],
  provider: [{ required: true, message: '请选择设备提供商', trigger: 'change' }],
  device: [{ required: true, message: '请选择设备', trigger: 'change' }],
  appName: [{ required: true, message: '请选择应用', trigger: 'change' }],
  containerName: [{ required: true, message: '请输入容器名', trigger: 'blur' }],
  pin: [{ required: true, message: '请输入 User PIN', trigger: 'blur' }]
});

// 审计员设置
const auditorFormRef = ref<FormInstance>();
const auditorCertPem = ref<string>('');
const showAuditorCertDialog = ref(false);
const auditorGeneratingCert = ref(false);

const auditorForm = reactive({
  username: 'auditor',
  password: '',
  confirmPassword: '',
  provider: '',
  device: '',
  appName: '',
  containerName: 'auditor',
  pin: '',
  subjectItems: [] as any[],
  profileId: '' as string | number
});

const auditorProviders = ref<string[]>([]);
const auditorDevices = ref<string[]>([]);
const auditorApps = ref<string[]>([]);

const refreshAuditorProviders = async () => {
  console.log('refreshAuditorProviders: Starting...');
  try {
    const skf = await getSkfClient();
    console.log('refreshAuditorProviders: Connected to SKF');
    const providers = await skf.enumProvider();
    console.log('refreshAuditorProviders: Providers:', providers);
    auditorProviders.value = providers;
    if (providers.length > 0) {
      auditorForm.provider = providers[0];
      console.log('refreshAuditorProviders: Selected provider:', providers[0]);
      await onAuditorProviderChange();
    } else {
      auditorForm.provider = '';
      auditorDevices.value = [];
      auditorForm.device = '';
      console.log('refreshAuditorProviders: No providers found');
    }
  } catch (e: any) {
    console.error('refreshAuditorProviders: Error', e);
    ElMessage.error('SKF 服务连接失败: ' + (e.message || e));
  }
};

const onAuditorProviderChange = async () => {
  if (!auditorForm.provider) return;
  try {
    const skf = await getSkfClient();
    const devices = await skf.enumDevice(auditorForm.provider);
    auditorDevices.value = devices;
    if (devices.length > 0) {
      auditorForm.device = devices[0];
      await onAuditorDeviceChange();
    } else {
      auditorForm.device = '';
      auditorApps.value = [];
      auditorForm.appName = '';
    }
  } catch (e: any) {
    ElMessage.error('枚举设备失败: ' + (e.message || e));
  }
};

const onAuditorDeviceChange = async () => {
  if (!auditorForm.provider || !auditorForm.device) return;
  try {
    const skf = await getSkfClient();
    const apps = await skf.enumApplication(auditorForm.provider, auditorForm.device);
    auditorApps.value = apps;
    if (apps.length > 0) {
      auditorForm.appName = apps[0];
    } else {
      auditorForm.appName = '';
    }
  } catch (e: any) {
    ElMessage.error('枚举应用失败: ' + (e.message || e));
  }
};

const onAuditorAppChange = () => {
  // Can fetch containers if needed
};

const handleGenerateAuditorCert = async () => {
  if (!auditorFormRef.value) return;

  // Validate only the fields needed for CSR generation
  const fieldsToValidate = [
    'provider',
    'device',
    'appName',
    'containerName',
    'pin',
    ...auditorForm.subjectItems.map((_, i) => `subjectItems.${i}.value`)
  ];

  try {
    await auditorFormRef.value.validateField(fieldsToValidate);
  } catch (error) {
    console.warn('Form validation failed for CSR generation', error);
    return;
  }

  if (auditorGeneratingCert.value) return;
  auditorGeneratingCert.value = true;

  try {
    // Stop monitoring and force disconnect
    await stopUsbMonitoring(true);

    ElMessage.info({ message: '正在连接 SKF 服务...', duration: 2000 });
    const skf = await getSkfClient();

    // 1. 验证 PIN 并生成 CSR
    ElMessage.info({ message: '正在验证 PIN...', duration: 2000 });
    await skf.checkPIN(`${auditorForm.provider}/${auditorForm.device}/${auditorForm.appName}`, auditorForm.pin);

    ElMessage.info({ message: '正在从 USBKey 生成 CSR (可能需要几秒，请留意 Key 上的指示)...', duration: 5000 });
    const subject = auditorForm.subjectItems
      .filter((item: any) => item.value)
      .map((item: any) => {
        const key = typeMapping[item.type as keyof typeof typeMapping]?.key || item.type;
        return `${key}=${item.value}`;
      })
      .join(',');

    const keyType = rootCaForm.algo === 'RSA' ? 'RSA' : 'SM2';
    const keyLength = keyType === 'RSA' ? 2048 : 256;

    console.log('Creating PKCS10 for auditor:', { subject, keyType, keyLength, container: auditorForm.containerName });
    const csrRes = await skf.createPKCS10(
      auditorForm.provider,
      auditorForm.device,
      auditorForm.appName,
      subject,
      keyType,
      keyLength,
      auditorForm.containerName
    );

    // 2. 调用后端接口签发证书
    ElMessage.info({ message: '正在请求后端签发审计员证书...', duration: 2000 });
    const issueRes = await issueAdminCert({
      csrPem: csrRes.pem,
      profileId: auditorForm.profileId
    });
    if (!issueRes.data || !issueRes.data.cert) {
      throw new Error('签发证书失败: 无返回数据');
    }
    const signedCertPem = formatToPem(issueRes.data.cert);

    // 3. 导入证书到 USBKey
    ElMessage.info({ message: '正在将证书写入 USBKey...', duration: 2000 });
    await skf.importCertificate(
      auditorForm.provider,
      auditorForm.device,
      auditorForm.appName,
      csrRes.container,
      true, // isSign
      signedCertPem
    );

    auditorCertPem.value = signedCertPem;
    ElMessage.success('审计员证书生成并写入成功');
    // Resume monitoring
    await startUsbMonitoring();
  } catch (e: any) {
    console.error('审计员证书生成失败', e);
    ElMessage.error('审计员证书生成失败: ' + (e.message || e));
    // Resume monitoring
    await startUsbMonitoring();
  } finally {
    auditorGeneratingCert.value = false;
  }
};

const auditorRules = reactive<FormRules>({
  password: [{ required: true, message: '请输入平台登录新密码', trigger: 'blur' }],
  confirmPassword: [
    { required: true, message: '请再次输入平台登录新密码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== auditorForm.password) {
          callback(new Error('两次输入的密码不一致'));
        } else {
          callback();
        }
      },
      trigger: 'blur'
    }
  ],
  provider: [{ required: true, message: '请选择设备提供商', trigger: 'change' }],
  device: [{ required: true, message: '请选择设备', trigger: 'change' }],
  appName: [{ required: true, message: '请选择应用', trigger: 'change' }],
  containerName: [{ required: true, message: '请输入容器名', trigger: 'blur' }],
  pin: [{ required: true, message: '请输入 User PIN', trigger: 'blur' }]
});

const nextButtonText = computed(() => {
  if (active.value === 5) {
    return '进入系统';
  }
  return '下一步';
});

const hasRootCASelected = computed(() => {
  return selectedTemplates.value.some((t: any) => t.type === 'RootCA');
});

const canNext = computed(() => {
  if (active.value === 0) {
    return agree.value;
  }
  if (active.value === 1) {
    return selectedTemplates.value.length > 0 && hasRootCASelected.value;
  }
  if (active.value === 2) {
    const basicValid =
      rootCaForm.subjectItems.every((item: any) => {
        const isRequired = item.minOccurs === undefined || item.minOccurs > 0;
        return isRequired ? !!item.value : true;
      }) && rootCaForm.maxValidity > 0;
    if (!basicValid) return false;
    if (rootType.value === 'external') {
      return !!externalCertPem.value;
    }
    return true;
  }
  if (active.value === 3) {
    return adminForm.password && adminForm.confirmPassword && adminCertPem.value;
  }
  if (active.value === 4) {
    return auditorForm.password && auditorForm.confirmPassword && auditorCertPem.value;
  }
  return true;
});

const saveTenantStatus = async (statusValue: number) => {
  try {
    const tenantId = import.meta.env.VITE_TENANT_ID;
    const tenantRes = await getTenant(tenantId);
    if (tenantRes.data) {
      const tenantInfo = tenantRes.data;
      const updateData = {
        co: {
          id: tenantInfo.id,
          name: tenantInfo.name,
          code: tenantInfo.code,
          status: statusValue as any,
          sourceId: tenantInfo.sourceId,
          packageId: tenantInfo.packageId
        }
      };
      await updateTenant(updateData);
    }
  } catch (error) {
    console.error('更新租户状态失败', error);
  }
};

const updateTenantStep = async () => {
  active.value++;
  await saveTenantStatus(active.value);
};

const next = async () => {
  if (active.value < 5) {
    if (active.value === 1) {
      if (selectedTemplates.value.length === 0) return;
      loading.value = true;
      try {
        const ids = selectedTemplates.value.map((t: any) => t.id);
        await initProfiles({ ids });
        await updateTenantStep();
      } catch (error) {
        ElMessage.error('初始化模板失败');
      } finally {
        loading.value = false;
      }
    } else if (active.value === 2) {
      if (!rootCaFormRef.value) return;
      try {
        const valid = await rootCaFormRef.value.validate();
        if (valid) {
          loading.value = true;
          try {
            // map form to GenRootCaCO
            const reqData = {
              name: rootCaForm.name,
              rootcaProfile: rootCaForm.rootcaProfileName,
              subject: rootCaForm.subjectItems
                .filter((item: any) => item.value)
                .map((item: any) => {
                  const key = typeMapping[item.type as keyof typeof typeMapping]?.key || item.type;
                  return `${key}=${item.value}`;
                })
                .join(','),
              algo: rootCaForm.algo,
              signerType: rootCaForm.signerType,
              keyIndex: rootCaForm.keyIndex,
              password: rootCaForm.password,
              maxValidity: rootCaForm.maxValidity + rootCaForm.maxValidityUnit,
              expirationPeriod: rootCaForm.expirationPeriod,
              keepExpiredCertDays: rootCaForm.keepExpiredCertDays,
              validityModeS: rootCaForm.validityMode === 'cutoff' ? 'STRICT' : 'LAX',
              caStatus: rootCaForm.status,
              snLen: rootCaForm.snSize,
              nextCrlNumber: rootCaForm.nextCrlNo,
              caCertUris: rootCaForm.cacertUris.map((u) => u.value).filter((v) => v),
              crlUris: rootCaForm.crlUris.map((u) => u.value).filter((v) => v),
              ocspUris: rootCaForm.ocspUris.map((u) => u.value).filter((v) => v)
            };

            if (rootType.value === 'external') {
              if (!externalCertPem.value) {
                ElMessage.warning('请上传外部CA签发的证书');
                loading.value = false;
                return;
              }
              const externalReqData = { co: { ...reqData, certPem: externalCertPem.value } };
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              const res = await importExternalCert(externalReqData);
              if (res.data && res.data.cert) {
                generatedRootCaPem.value = formatToPem(res.data.cert);
                showGeneratedRootCaDialog.value = true;
              } else {
                await updateTenantStep();
              }
            } else {
              const res = await genRootCa({ co: reqData });
              if (res.data && res.data.cert) {
                generatedRootCaPem.value = formatToPem(res.data.cert);
                showGeneratedRootCaDialog.value = true;
              } else {
                await updateTenantStep();
              }
            }
          } catch (error) {
            console.error('初始化根证书失败', error);
          } finally {
            loading.value = false;
          }
        }
      } catch (error) {
        console.error('表单验证失败', error);
      }
    } else if (active.value === 3) {
      if (!adminFormRef.value) return;
      try {
        const valid = await adminFormRef.value.validate();
        if (valid) {
          if (!adminCertPem.value) {
            ElMessage.warning('请先生成并写入管理员证书');
            return;
          }
          loading.value = true;
          try {
            // 上传证书逻辑已经替换为写入USBKey
            // 这里我们只需要提交生成的证书PEM给后端保存
            // 发起一个表单提交用户证书
            const formData = new FormData();
            const certBlob = new Blob([adminCertPem.value], { type: 'application/x-x509-ca-cert' });
            formData.append('file', certBlob, 'admin.pem');
            formData.append('id', ADMIN_USER_ID); // 管理员ID
            await uploadUserCert(formData);
            
            // 提交证书成功后，重置用户密码
            await resetUserPwd(ADMIN_USER_ID, adminForm.password);

            ElMessage.success('管理员设置成功');
            await updateTenantStep();
          } catch (error) {
            ElMessage.error('管理员设置失败');
          } finally {
            loading.value = false;
          }
        }
      } catch (error) {
        console.error('表单验证失败', error);
      }
    } else if (active.value === 4) {
      if (!auditorFormRef.value) return;
      try {
        const valid = await auditorFormRef.value.validate();
        if (valid) {
          if (!auditorCertPem.value) {
            ElMessage.warning('请先生成并写入审计员证书');
            return;
          }
          loading.value = true;
          try {
            // 提交通过 USBKey 生成并签发的证书数据
            const formData = new FormData();
            const certBlob = new Blob([auditorCertPem.value], { type: 'application/x-x509-ca-cert' });
            formData.append('file', certBlob, 'auditor.pem');
            formData.append('id', AUDITOR_USER_ID); // 审计员ID
            await uploadUserCert(formData);
            
            // 提交证书成功后，重置用户密码
            await resetUserPwd(AUDITOR_USER_ID, auditorForm.password);

            ElMessage.success('审计员设置成功');
            await updateTenantStep();
          } catch (error) {
            console.error('审计员设置或激活租户失败', error);
            ElMessage.error('审计员设置或激活租户失败');
          } finally {
            loading.value = false;
          }
        }
      } catch (error) {
        console.error('表单验证失败', error);
      }
    } else {
      loading.value = true;
      try {
        await updateTenantStep();
      } finally {
        loading.value = false;
      }
    }
  } else {
    loading.value = true;
    try {
      // 更新租户状态为 -1 (系统已完成初始化)
      await saveTenantStatus(-1);

      // 完成向导
      ElMessage.success('初始化完成，请重新登录');

      // 关闭当前标签页 (初始化向导)
      const currentRoute = router.currentRoute.value;
      tagsViewStore.delView(currentRoute);

      // 3. 登出并跳转到登录页
      userStore.logout().then(() => {
        router.replace({
          path: '/login',
          query: {
            redirect: encodeURIComponent('/index')
          }
        });
      });
    } finally {
      loading.value = false;
    }
  }
};

const prev = async () => {
  if (active.value > 0) {
    active.value--;
    await saveTenantStatus(active.value);
  }
};

onMounted(async () => {
  // 获取租户信息
  try {
    const tenantId = import.meta.env.VITE_TENANT_ID;
    const tenantRes = await getTenant(tenantId);
    if (tenantRes.data) {
      tenantCode.value = (tenantRes.data.code || '').toUpperCase();
      tenantName.value = tenantRes.data.name;
      companyName.value = tenantRes.data.companyName || '';

      // 根据 tenant 的 status 恢复到对应步骤
      if (tenantRes.data.status !== undefined && tenantRes.data.status !== null) {
        if ((tenantRes.data.status as any) === 'active') {
          // 如果是原始的 'active' 状态，直接跳到最后一步
          active.value = 5;
        } else {
          const parsedStatus = Number(tenantRes.data.status);
          if (!isNaN(parsedStatus) && parsedStatus >= 0 && parsedStatus <= 5) {
            active.value = parsedStatus;
          }
        }
      }
    }
  } catch (error) {
    console.error('获取租户信息失败', error);
  }

  // 预加载设备列表，如果当前在管理员页面或根证书配置
  setTimeout(() => {
    if (active.value === 3) {
      refreshAdminProviders();
    } else if (active.value === 4) {
      refreshAuditorProviders();
    }
  }, 1000);
});
</script>

<style scoped lang="scss">
.template-help-container {
  padding: 0 10px;

  .help-header-alert {
    margin-bottom: 24px;
    border-radius: 8px;

    p {
      margin-top: 5px;
      line-height: 1.6;
    }
  }

  .help-card {
    background-color: #fff;
    border: 1px solid #ebeef5;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
    transition: all 0.3s;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.02);

    &:hover {
      box-shadow: 0 4px 16px 0 rgba(0, 0, 0, 0.08);
      transform: translateY(-2px);
    }

    .help-card-header {
      display: flex;
      align-items: center;
      margin-bottom: 10px;

      .help-card-title {
        font-weight: 600;
        font-size: 15px;
        color: #303133;
        margin-left: 10px;
      }
    }

    .help-card-body {
      color: #606266;
      font-size: 13px;
      line-height: 1.6;
    }
  }

  .root-ca {
    border-left: 4px solid #f56c6c;
  }
  .sub-ca {
    border-left: 4px solid #e6a23c;
  }
  .end-entity {
    border-left: 4px solid #67c23a;
  }

  .help-list {
    padding-left: 20px;
    margin: 10px 0;

    li {
      margin-bottom: 8px;
      color: #606266;
      font-size: 13px;

      b {
        color: #303133;
      }

      ul {
        margin-top: 5px;
        padding-left: 15px;

        li {
          list-style-type: circle;
          margin-bottom: 4px;
        }
      }
    }
  }

  h4 {
    margin: 20px 0 10px 0;
    font-size: 14px;
    color: #303133;
  }
}

.template-table {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  border: 1px solid #ebeef5;

  :deep(th.el-table__cell) {
    background-color: #f8f9fa !important;
  }
}

.empty-state {
  padding: 40px 0;
}

.validation-warning {
  display: flex;
  align-items: center;
  color: #f56c6c;
  margin-top: 16px;
  background: #fef0f0;
  padding: 10px 16px;
  border-radius: 6px;
  border: 1px solid #fbc4c4;

  .el-icon {
    font-size: 16px;
    margin-right: 8px;
  }

  span {
    font-size: 13px;
    font-weight: 500;
  }
}
.wizard-content {
  margin-top: 20px;
  padding: 40px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  min-height: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.step-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.agreement-text {
  width: 80%;
  height: 460px;
  overflow-y: auto;
  border: 1px solid #dcdfe6;
  padding: 10px;
  margin-bottom: 20px;
  border-radius: 4px;
  background-color: #f5f7fa;
}

.agree-checkbox {
  margin-top: 10px;
}

.wizard-actions {
  margin-top: 20px;
  text-align: center;
}

.cert-info {
  margin-top: 10px;
  padding: 10px;
  background-color: #f0f9eb;
  border: 1px solid #e1f3d8;
  border-radius: 4px;
  width: 100%;
  font-size: 12px;
  color: #67c23a;

  p {
    margin: 5px 0;
    word-break: break-all;
  }
}
.step-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 2px solid #f0f2f5;
  padding-bottom: 10px;
}

.step-header h2 {
  margin: 0;
  font-size: 18px;
  color: #303133;
}

.template-selector {
  display: flex;
  align-items: center;
  gap: 10px;
}

.monitoring-status {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f0f9eb;
  padding: 4px 12px;
  border-radius: 16px;
  border: 1px solid #e1f3d8;
}

.monitoring-status .status-text {
  font-size: 12px;
  color: #67c23a;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background-color: #67c23a;
  border-radius: 50%;
  position: relative;
}

.pulse-dot::after {
  content: '';
  position: absolute;
  width: 100%;
  height: 100%;
  background-color: #67c23a;
  border-radius: 50%;
  z-index: 0;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 0.8;
  }
  70% {
    transform: scale(2.5);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 0;
  }
}
</style>
