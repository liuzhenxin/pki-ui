<template>
  <div class="p-2">
    <transition :enter-active-class="proxy?.animate.searchAnimate.enter" :leave-active-class="proxy?.animate.searchAnimate.leave">
      <div v-show="showSearch" class="mb-10px">
        <el-card shadow="hover">
          <el-form ref="queryFormRef" :model="queryParams" :inline="true">
            <el-form-item label="发布者名称" prop="name">
              <el-input v-model="queryParams.name" placeholder="请输入发布者名称" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="发布者类型" prop="type">
              <el-select v-model="queryParams.type" placeholder="请选择类型" clearable style="width: 160px">
                <el-option label="LDAP" value="LDAP" />
                <el-option label="数据库" value="DATABASE" />
                <el-option label="文件系统" value="FILE" />
                <el-option label="HTTP" value="HTTP" />
                <el-option label="OCSP" value="OCSP" />
              </el-select>
            </el-form-item>
            <el-form-item label="创建时间" prop="createTime">
              <el-date-picker
                v-model="queryParams.createTime"
                type="daterange"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                value-format="YYYY-MM-DD"
                style="width: 260px"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
              <el-button icon="Refresh" @click="resetQuery">重置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </div>
    </transition>

    <el-card shadow="hover">
      <template #header>
        <el-row :gutter="10">
          <el-col :span="1.5">
            <el-button v-hasPermi="['ca:publisher:save']" type="primary" plain icon="Plus" @click="handleAdd">新增</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button v-hasPermi="['ca:publisher:import']" type="success" plain icon="Upload" @click="handleImport">导入</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button v-hasPermi="['ca:publisher:export']" type="warning" plain icon="Download" @click="handleExport">导出</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button v-hasPermi="['ca:publisher:remove']" type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete()"
              >删除</el-button
            >
          </el-col>
          <el-col :span="1.5">
            <el-button v-hasPermi="['ca:publisher:queue:page']" plain icon="List" @click="queueOpen = !queueOpen">
              {{ queueOpen ? '收起队列' : '发布队列' }}
              <el-badge v-if="queueTotal > 0" :value="queueTotal" class="ml-5px" />
            </el-button>
          </el-col>
          <right-toolbar v-model:show-search="showSearch" @query-table="getList"></right-toolbar>
        </el-row>
      </template>

      <el-table v-loading="loading" border :data="publisherList" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="50" align="center" />
        <el-table-column type="index" label="序号" width="80" align="center" />
        <el-table-column label="发布者名称" align="center" prop="name" min-width="180" :show-overflow-tooltip="true" />
        <el-table-column label="发布者类型" align="center" prop="type" width="130">
          <template #default="scope">
            <el-tag v-if="scope.row.type === 'DATABASE' || scope.row.type === 'DB'" type="primary">数据库</el-tag>
            <el-tag v-else-if="scope.row.type === 'FILE'" type="success">文件系统</el-tag>
            <el-tag v-else-if="scope.row.type === 'LDAP'" type="warning">LDAP</el-tag>
            <el-tag v-else-if="scope.row.type === 'OCSP'" type="info">OCSP</el-tag>
            <el-tag v-else-if="scope.row.type === 'HTTP'" type="info">HTTP</el-tag>
            <el-tag v-else type="info">{{ scope.row.type || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="配置" align="center" prop="conf" min-width="220" :show-overflow-tooltip="true">
          <template #default="scope">
            <el-button v-if="scope.row.conf" link type="primary" @click="handleViewConf(scope.row)">查看配置</el-button>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" align="center" prop="createTime" width="180">
          <template #default="scope">
            <span>{{ scope.row.createTime || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="220" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-tooltip content="查看" placement="top">
              <el-button v-hasPermi="['ca:publisher:detail']" link type="primary" icon="View" @click="handleDetail(scope.row)"></el-button>
            </el-tooltip>
            <el-tooltip content="修改" placement="top">
              <el-button v-hasPermi="['ca:publisher:modify']" link type="primary" icon="Edit" @click="handleUpdate(scope.row)"></el-button>
            </el-tooltip>
            <el-tooltip content="测试连接" placement="top">
              <el-button v-hasPermi="['ca:publisher:test']" link type="success" icon="Connection" @click="handleTestConnection(scope.row)"></el-button>
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <el-button v-hasPermi="['ca:publisher:remove']" link type="danger" icon="Delete" @click="handleDelete(scope.row)"></el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
    </el-card>

    <!-- 发布队列面板 -->
    <el-card v-if="queueOpen" shadow="hover" class="mt-10px">
      <template #header>
        <el-row :gutter="10">
          <el-col :span="1.5">
            <span class="queue-title">发布队列</span>
          </el-col>
          <el-col :span="6">
            <el-select v-model="queueParams.status" placeholder="按状态筛选" clearable size="small" style="width: 160px" @change="handleQueueQuery">
              <el-option label="待发布" value="PENDING" />
              <el-option label="发布中" value="PROCESSING" />
              <el-option label="发布成功" value="SUCCESS" />
              <el-option label="发布失败" value="FAILED" />
            </el-select>
          </el-col>
          <el-col :span="1.5">
            <el-button v-hasPermi="['ca:publisher:retry']" type="warning" plain size="small" icon="RefreshRight" :disabled="queueMultiple" @click="handleQueueRetry()">重试选中</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="primary" plain size="small" icon="Refresh" @click="handleQueueQuery">刷新</el-button>
          </el-col>
        </el-row>
      </template>

      <el-table v-loading="queueLoading" border :data="queueList" @selection-change="handleQueueSelectionChange" size="small">
        <el-table-column type="selection" width="40" align="center" />
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column label="证书ID" align="center" prop="certId" width="100" />
        <el-table-column label="证书类型" align="center" prop="certType" width="100">
          <template #default="scope">
            <el-tag v-if="scope.row.certType === 'SIGNING'" type="primary" size="small">签名</el-tag>
            <el-tag v-else-if="scope.row.certType === 'ENCRYPTION'" type="warning" size="small">加密</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="发布者ID" align="center" prop="publisherId" width="100" />
        <el-table-column label="状态" align="center" prop="status" width="100">
          <template #default="scope">
            <el-tag v-if="scope.row.status === 'PENDING'" type="info" size="small">待发布</el-tag>
            <el-tag v-else-if="scope.row.status === 'PROCESSING'" type="warning" size="small">发布中</el-tag>
            <el-tag v-else-if="scope.row.status === 'SUCCESS'" type="success" size="small">成功</el-tag>
            <el-tag v-else-if="scope.row.status === 'FAILED'" type="danger" size="small">失败</el-tag>
            <span v-else>{{ scope.row.status }}</span>
          </template>
        </el-table-column>
        <el-table-column label="重试次数" align="center" prop="retryCount" width="90" />
        <el-table-column label="错误信息" align="center" prop="errorMessage" min-width="200" :show-overflow-tooltip="true">
          <template #default="scope">
            <span :style="{ color: scope.row.errorMessage ? 'var(--el-color-danger)' : '' }">{{ scope.row.errorMessage || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="下次重试" align="center" prop="nextRetryTime" width="170">
          <template #default="scope">
            <span>{{ scope.row.nextRetryTime || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="80" align="center">
          <template #default="scope">
            <el-tooltip content="重试" placement="top">
              <el-button v-hasPermi="['ca:publisher:retry']" link type="warning" icon="RefreshRight" size="small" @click="handleQueueRetry(scope.row)"></el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <pagination v-show="queueTotal > 0" v-model:page="queueParams.pageNum" v-model:limit="queueParams.pageSize" :total="queueTotal" @pagination="getQueueList" />
    </el-card>

    <!-- 新增/修改/查看对话框 -->
    <el-dialog :title="title" v-model="open" width="800px" append-to-body @close="resetForm">
      <el-form ref="publisherFormRef" :model="form" :rules="rules" label-width="120px" :disabled="readonly">
        <el-form-item label="发布者名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入发布者名称" />
        </el-form-item>
        <el-form-item label="发布者类型" prop="type">
          <el-select v-model="form.type" placeholder="请选择发布者类型" style="width: 100%" :disabled="readonly" @change="handleTypeChange">
            <el-option label="LDAP / AD" value="LDAP" />
            <el-option label="数据库" value="DATABASE" />
          </el-select>
        </el-form-item>

        <!-- === 高级模式切换 === -->
        <el-form-item v-if="form.type && !readonly">
          <el-switch v-model="advancedMode" active-text="高级模式 (JSON)" inactive-text="表单模式" />
        </el-form-item>

        <!-- === 表单模式：类型特定配置 === -->
        <template v-if="!advancedMode && form.type">

          <!-- LDAP 配置 -->
          <template v-if="form.type === 'LDAP'">
            <el-divider content-position="left">连接配置</el-divider>
            <el-form-item label="LDAP URL" prop="ldapUrl">
              <el-input v-model="ldapConfig.url" placeholder="ldap://ad.example.com:389" />
            </el-form-item>
            <el-form-item label="Base DN" prop="ldapBaseDn">
              <el-input v-model="ldapConfig.baseDn" placeholder="dc=example,dc=com" />
            </el-form-item>
            <el-form-item label="绑定 DN" prop="ldapBindDn">
              <el-input v-model="ldapConfig.bindDn" placeholder="cn=admin,dc=example,dc=com" />
            </el-form-item>
            <el-form-item label="绑定密码" prop="ldapPassword">
              <el-input v-model="ldapConfig.password" type="password" show-password placeholder="输入绑定密码" />
            </el-form-item>
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="启用 SSL">
                  <el-switch v-model="ldapConfig.useSsl" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="启用 StartTLS">
                  <el-switch v-model="ldapConfig.useTls" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-divider content-position="left">搜索与属性</el-divider>
            <el-form-item label="证书属性名">
              <el-input v-model="ldapConfig.certAttribute" placeholder="userCertificate;binary" />
            </el-form-item>
            <el-form-item label="搜索 Base">
              <el-input v-model="ldapConfig.searchBase" placeholder="ou=Users,dc=example,dc=com" />
            </el-form-item>
            <el-form-item label="搜索过滤">
              <el-input v-model="ldapConfig.searchFilter" placeholder="(cn={subjectCn})" />
              <div class="form-tip">支持 {subjectCn}、{serialNumber} 占位符</div>
            </el-form-item>
          </template>

          <!-- DATABASE 配置 -->
          <template v-if="form.type === 'DATABASE'">
            <el-divider content-position="left">连接配置</el-divider>
            <el-form-item label="JDBC URL" prop="dbUrl">
              <el-input v-model="dbConfig.url" placeholder="jdbc:mysql://host:3306/dbname" />
            </el-form-item>
            <el-form-item label="驱动类">
              <el-input v-model="dbConfig.driverClass" placeholder="com.mysql.cj.jdbc.Driver" />
            </el-form-item>
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="用户名">
                  <el-input v-model="dbConfig.username" placeholder="数据库用户名" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="密码">
                  <el-input v-model="dbConfig.password" type="password" show-password placeholder="数据库密码" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="附加参数">
              <el-input v-model="dbConfig.additionalParams" placeholder="useSSL=true&serverTimezone=Asia/Shanghai" />
            </el-form-item>
            <el-divider content-position="left">表映射</el-divider>
            <el-form-item label="目标表名">
              <el-input v-model="dbConfig.tableName" placeholder="cert_records" />
            </el-form-item>
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="证书列">
                  <el-input v-model="dbConfig.certColumn" placeholder="cert_pem" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="序列号列">
                  <el-input v-model="dbConfig.serialColumn" placeholder="serial_number" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="主题列">
                  <el-input v-model="dbConfig.subjectColumn" placeholder="subject_dn" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="生效时间列">
                  <el-input v-model="dbConfig.issueTimeColumn" placeholder="issue_time" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="失效时间列">
              <el-input v-model="dbConfig.expireTimeColumn" placeholder="expire_time" />
            </el-form-item>
            <el-form-item label="UPSERT">
              <el-switch v-model="dbConfig.upsertEnabled" />
              <span class="form-tip-inline">使用 INSERT ON DUPLICATE KEY UPDATE</span>
            </el-form-item>
          </template>

          <!-- FILE 配置 -->
          <template v-if="form.type === 'FILE'">
            <el-divider content-position="left">文件输出配置</el-divider>
            <el-form-item label="输出路径" prop="filePath">
              <el-input v-model="fileConfig.path" placeholder="/data/certs/published" />
            </el-form-item>
            <el-form-item label="文件名模式">
              <el-input v-model="fileConfig.filenamePattern" placeholder="{serialNumber}.pem" />
              <div class="form-tip">支持 {serialNumber}、{subjectCn} 占位符</div>
            </el-form-item>
            <el-form-item label="自动创建目录">
              <el-switch v-model="fileConfig.createDirs" />
            </el-form-item>
          </template>

          <!-- HTTP / OCSP 配置 -->
          <template v-if="form.type === 'HTTP' || form.type === 'OCSP'">
            <el-divider content-position="left">HTTP 配置</el-divider>
            <el-form-item label="URL" prop="httpUrl">
              <el-input v-model="httpConfig.url" :placeholder="form.type === 'OCSP' ? 'http://ocsp.example.com' : 'http://target.example.com/api'" />
            </el-form-item>
            <el-form-item label="超时 (ms)">
              <el-input-number v-model="httpConfig.timeout" :min="1000" :max="60000" :step="1000" />
            </el-form-item>
          </template>
        </template>

        <!-- === 高级模式：JSON 编辑器 === -->
        <template v-if="advancedMode || !form.type">
          <el-form-item label="配置" prop="conf">
            <div class="conf-editor">
              <el-input v-model="form.conf" type="textarea" placeholder="请输入发布者配置 JSON" :rows="14" />
              <el-button v-if="!readonly && form.type" class="conf-template-btn" link type="primary" size="small" @click="applyConfTemplate">
                应用 {{ form.type }} 配置模板
              </el-button>
            </div>
            <div class="form-tip">配置内容按发布者类型填写 JSON，例如路径、连接地址或发布策略参数。</div>
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button v-if="!readonly" type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">{{ readonly ? '关 闭' : '取 消' }}</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 配置查看对话框 -->
    <el-dialog title="发布者配置" v-model="confOpen" width="760px" append-to-body>
      <pre class="conf-preview">{{ currentConf }}</pre>
    </el-dialog>

    <!-- 导入对话框 -->
    <el-dialog title="导入发布者" v-model="importOpen" width="420px" append-to-body>
      <el-upload
        ref="uploadRef"
        :limit="1"
        accept=".xlsx,.xls"
        :headers="upload.headers"
        :action="upload.url"
        :disabled="upload.isUploading"
        :on-progress="handleFileUploadProgress"
        :on-success="handleFileSuccess"
        :auto-upload="false"
        drag
      >
        <el-icon class="el-icon--upload">
          <upload-filled />
        </el-icon>
        <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
        <template #tip>
          <div class="el-upload__tip text-center">请上传 .xls, .xlsx 格式文件</div>
        </template>
      </el-upload>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitFileForm">确 定</el-button>
          <el-button @click="importOpen = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="CaPublisher" lang="ts">
import { getCurrentInstance, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox, type UploadInstance } from 'element-plus';
import { UploadFilled } from '@element-plus/icons-vue';
import {
  pagePublisher, getPublisher, savePublisher, modifyPublisher, removePublisher, exportPublisher,
  pagePublishQueue, retryPublish, testPublisherConnection
} from '@/api/ca/publisher';
import { PublisherForm, PublisherQuery, PUBLISHER_CONF_TEMPLATES } from '@/api/ca/publisher/types';

const { proxy } = getCurrentInstance() as any;

// --- Publisher state ---
const loading = ref(true);
const showSearch = ref(true);
const ids = ref<(string | number)[]>([]);
const multiple = ref(true);
const total = ref(0);
const title = ref('');
const open = ref(false);
const readonly = ref(false);
const importOpen = ref(false);
const confOpen = ref(false);
const publisherList = ref<any[]>([]);
const currentConf = ref('');
const advancedMode = ref(false);

const queryFormRef = ref();
const publisherFormRef = ref();
const uploadRef = ref<UploadInstance>();

const queryParams = reactive<PublisherQuery>({
  pageNum: 1,
  pageSize: 10,
  name: undefined,
  type: undefined,
  createTime: undefined
});

const form = ref<PublisherForm>({});

const rules = reactive({
  name: [{ required: true, message: '发布者名称不能为空', trigger: 'blur' }],
  type: [{ required: true, message: '发布者类型不能为空', trigger: 'change' }]
});

const upload = reactive({
  isUploading: false,
  headers: { Authorization: 'Bearer ' + localStorage.getItem('token') },
  url: import.meta.env.VITE_APP_BASE_API + '/ca/v1/publishers/import'
});

// --- 类型特定配置 ---
const ldapConfig = reactive({
  url: '', baseDn: '', bindDn: '', password: '',
  useSsl: false, useTls: false,
  certAttribute: 'userCertificate;binary',
  searchBase: '', searchFilter: '(cn={subjectCn})'
});

const dbConfig = reactive({
  url: '', driverClass: 'com.mysql.cj.jdbc.Driver', username: '', password: '',
  additionalParams: '', tableName: '',
  certColumn: 'cert_pem', serialColumn: 'serial_number',
  subjectColumn: 'subject_dn', issueTimeColumn: 'issue_time',
  expireTimeColumn: 'expire_time', upsertEnabled: true
});

const fileConfig = reactive({
  path: '', filenamePattern: '{serialNumber}.pem', createDirs: true
});

const httpConfig = reactive({
  url: '', timeout: 5000
});

// --- Queue state ---
const queueOpen = ref(false);
const queueLoading = ref(false);
const queueList = ref<any[]>([]);
const queueTotal = ref(0);
const queueIds = ref<(string | number)[]>([]);
const queueMultiple = ref(true);

const queueParams = reactive<{ pageNum: number; pageSize: number; status?: string }>({
  pageNum: 1,
  pageSize: 10,
  status: undefined
});

// ===================== 配置序列化/反序列化 =====================

function parseConfToFields(confStr: string | undefined, type: string) {
  let conf: any = {};
  if (confStr) {
    try { conf = JSON.parse(confStr); } catch { return; }
  }
  switch (type) {
    case 'LDAP':
      ldapConfig.url = conf.url || '';
      ldapConfig.baseDn = conf.baseDn || '';
      ldapConfig.bindDn = conf.bindDn || '';
      ldapConfig.password = conf.password || '';
      ldapConfig.useSsl = conf.useSsl === true;
      ldapConfig.useTls = conf.useTls === true;
      ldapConfig.certAttribute = conf.certAttribute || 'userCertificate;binary';
      ldapConfig.searchBase = conf.searchBase || '';
      ldapConfig.searchFilter = conf.searchFilter || '(cn={subjectCn})';
      break;
    case 'DATABASE':
      dbConfig.url = conf.url || '';
      dbConfig.driverClass = conf.driverClass || 'com.mysql.cj.jdbc.Driver';
      dbConfig.username = conf.username || '';
      dbConfig.password = conf.password || '';
      dbConfig.additionalParams = conf.additionalParams || '';
      dbConfig.tableName = conf.tableName || '';
      dbConfig.certColumn = conf.certColumn || 'cert_pem';
      dbConfig.serialColumn = conf.serialColumn || 'serial_number';
      dbConfig.subjectColumn = conf.subjectColumn || 'subject_dn';
      dbConfig.issueTimeColumn = conf.issueTimeColumn || 'issue_time';
      dbConfig.expireTimeColumn = conf.expireTimeColumn || 'expire_time';
      dbConfig.upsertEnabled = conf.upsertEnabled !== false;
      break;
    case 'FILE':
      fileConfig.path = conf.path || '';
      fileConfig.filenamePattern = conf.filenamePattern || '{serialNumber}.pem';
      fileConfig.createDirs = conf.createDirs !== false;
      break;
    case 'HTTP':
    case 'OCSP':
      httpConfig.url = conf.url || '';
      httpConfig.timeout = conf.timeout || 5000;
      break;
  }
}

function buildConfFromFields(type: string): string {
  let conf: any = {};
  switch (type) {
    case 'LDAP':
      conf = {
        url: ldapConfig.url, baseDn: ldapConfig.baseDn,
        bindDn: ldapConfig.bindDn || undefined,
        password: ldapConfig.password || undefined,
        useSsl: ldapConfig.useSsl || undefined,
        useTls: ldapConfig.useTls || undefined,
        certAttribute: ldapConfig.certAttribute,
        searchBase: ldapConfig.searchBase || undefined,
        searchFilter: ldapConfig.searchFilter
      };
      break;
    case 'DATABASE':
      conf = {
        url: dbConfig.url,
        driverClass: dbConfig.driverClass || undefined,
        username: dbConfig.username || undefined,
        password: dbConfig.password || undefined,
        additionalParams: dbConfig.additionalParams || undefined,
        tableName: dbConfig.tableName,
        certColumn: dbConfig.certColumn,
        serialColumn: dbConfig.serialColumn,
        subjectColumn: dbConfig.subjectColumn || undefined,
        issueTimeColumn: dbConfig.issueTimeColumn || undefined,
        expireTimeColumn: dbConfig.expireTimeColumn || undefined,
        upsertEnabled: dbConfig.upsertEnabled
      };
      break;
    case 'FILE':
      conf = {
        path: fileConfig.path,
        filenamePattern: fileConfig.filenamePattern,
        createDirs: fileConfig.createDirs
      };
      break;
    case 'HTTP':
    case 'OCSP':
      conf = { url: httpConfig.url, timeout: httpConfig.timeout };
      break;
  }
  return JSON.stringify(conf, null, 2);
}

function resetTypeConfigs() {
  Object.assign(ldapConfig, { url: '', baseDn: '', bindDn: '', password: '', useSsl: false, useTls: false, certAttribute: 'userCertificate;binary', searchBase: '', searchFilter: '(cn={subjectCn})' });
  Object.assign(dbConfig, { url: '', driverClass: 'com.mysql.cj.jdbc.Driver', username: '', password: '', additionalParams: '', tableName: '', certColumn: 'cert_pem', serialColumn: 'serial_number', subjectColumn: 'subject_dn', issueTimeColumn: 'issue_time', expireTimeColumn: 'expire_time', upsertEnabled: true });
  Object.assign(fileConfig, { path: '', filenamePattern: '{serialNumber}.pem', createDirs: true });
  Object.assign(httpConfig, { url: '', timeout: 5000 });
}

// ===================== Publisher CRUD =====================

function getList() {
  loading.value = true;
  const params = { ...queryParams };
  if (queryParams.createTime && queryParams.createTime.length === 2) {
    (params as any).params = {
      startTime: queryParams.createTime[0] + ' 00:00:00',
      endTime: queryParams.createTime[1] + ' 23:59:59'
    };
  }
  pagePublisher(params)
    .then((response) => {
      publisherList.value = response.data.records || response.data.rows || [];
      total.value = response.data.total || 0;
    })
    .finally(() => {
      loading.value = false;
    });
}

function cancel() {
  open.value = false;
  resetForm();
}

function resetForm() {
  readonly.value = false;
  advancedMode.value = false;
  resetTypeConfigs();
  form.value = { id: undefined, name: undefined, type: undefined, conf: undefined };
  publisherFormRef.value?.resetFields();
}

function handleQuery() {
  queryParams.pageNum = 1;
  getList();
}

function resetQuery() {
  queryFormRef.value?.resetFields();
  handleQuery();
}

function handleSelectionChange(selection: any[]) {
  ids.value = selection.map((item) => item.id);
  multiple.value = !selection.length;
}

function handleAdd() {
  resetForm();
  open.value = true;
  title.value = '新增发布者';
}

function handleDetail(row: any) {
  resetForm();
  getPublisher(row.id).then((response) => {
    form.value = response.data;
    parseConfToFields(form.value.conf, form.value.type || '');
    readonly.value = true;
    open.value = true;
    title.value = '查看发布者';
  });
}

function handleUpdate(row: any) {
  resetForm();
  const id = row.id || ids.value[0];
  getPublisher(id).then((response) => {
    form.value = response.data;
    parseConfToFields(form.value.conf, form.value.type || '');
    open.value = true;
    title.value = '修改发布者';
  });
}

function submitForm() {
  if (!advancedMode.value && form.value.type) {
    form.value.conf = buildConfFromFields(form.value.type);
  }
  publisherFormRef.value?.validate((valid: boolean) => {
    if (!valid) return;
    const commandData = { co: form.value };
    const request = form.value.id ? modifyPublisher(commandData) : savePublisher(commandData);
    request.then(() => {
      ElMessage.success(form.value.id ? '修改成功' : '新增成功');
      open.value = false;
      getList();
    });
  });
}

function handleDelete(row?: any) {
  const deleteIds = row?.id || ids.value;
  ElMessageBox.confirm('是否确认删除发布者编号为"' + deleteIds + '"的数据项？', '警告', {
    confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning'
  })
    .then(() => removePublisher(Array.isArray(deleteIds) ? deleteIds : [deleteIds]))
    .then(() => { getList(); ElMessage.success('删除成功'); })
    .catch(() => {});
}

function handleImport() { importOpen.value = true; }

function handleExport() {
  ElMessageBox.confirm('是否确认导出发布者数据项?', '警告', {
    confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning'
  })
    .then(() => exportPublisher(queryParams))
    .then((response) => { proxy.download(response, 'publisher_' + new Date().getTime() + '.xlsx'); })
    .catch(() => {});
}

function handleFileUploadProgress() { upload.isUploading = true; }

function handleFileSuccess() {
  upload.isUploading = false;
  uploadRef.value?.clearFiles();
  ElMessage.success('导入成功');
  importOpen.value = false;
  getList();
}

function submitFileForm() { uploadRef.value?.submit(); }

function handleViewConf(row: any) {
  try { currentConf.value = JSON.stringify(JSON.parse(row.conf), null, 2); }
  catch { currentConf.value = row.conf || ''; }
  confOpen.value = true;
}

// ===================== 测试连接 =====================

function handleTestConnection(row: any) {
  const loadingMsg = ElMessage({ message: '正在测试连接...', type: 'info', duration: 0 });
  testPublisherConnection(row.id)
    .then((response) => {
      if (response.data === true || response.data?.result === true) {
        ElMessage.success('连接测试成功');
      } else {
        ElMessage.warning('连接测试失败: ' + (response.data?.msg || response.msg || '未知错误'));
      }
    })
    .catch(() => { ElMessage.error('连接测试失败'); })
    .finally(() => { loadingMsg.close(); });
}

// ===================== 类型切换 =====================

function handleTypeChange(type: string) {
  if (!type) return;
  advancedMode.value = false;
  resetTypeConfigs();
  parseConfToFields(form.value.conf, type);
}

function applyConfTemplate() {
  if (!form.value.type) return;
  const template = PUBLISHER_CONF_TEMPLATES[form.value.type];
  if (template) { form.value.conf = template; }
}

// ===================== 发布队列 =====================

function handleQueueQuery() { queueParams.pageNum = 1; getQueueList(); }

function getQueueList() {
  queueLoading.value = true;
  pagePublishQueue(queueParams)
    .then((response) => {
      queueList.value = response.data.records || response.data.rows || [];
      queueTotal.value = response.data.total || 0;
    })
    .finally(() => { queueLoading.value = false; });
}

function handleQueueSelectionChange(selection: any[]) {
  queueIds.value = selection.map((item) => item.id);
  queueMultiple.value = !selection.length;
}

function handleQueueRetry(row?: any) {
  const retryIds = row?.id ? [row.id] : queueIds.value;
  if (!retryIds || retryIds.length === 0) { ElMessage.warning('请选择要重试的队列项'); return; }
  retryPublish(retryIds)
    .then(() => { ElMessage.success('已加入重试队列'); getQueueList(); })
    .catch(() => { ElMessage.error('重试失败'); });
}

getList();
</script>

<style scoped lang="scss">
.p-2 { padding: 8px; }
.mb-10px { margin-bottom: 10px; }
.mt-10px { margin-top: 10px; }
.ml-5px { margin-left: 5px; }
.small-padding { .cell { padding: 0 5px; } }
.fixed-width { min-width: 220px; }
.form-tip { margin-top: 4px; color: var(--el-text-color-secondary); font-size: 12px; line-height: 18px; }
.form-tip-inline { margin-left: 8px; color: var(--el-text-color-secondary); font-size: 12px; }
.conf-preview {
  max-height: 520px; margin: 0; padding: 12px; overflow: auto;
  color: var(--el-text-color-primary); background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color); border-radius: 4px;
  line-height: 1.5; white-space: pre-wrap; word-break: break-word;
}
.conf-editor { width: 100%; }
.conf-template-btn { margin-top: 4px; }
.queue-title { font-size: 14px; font-weight: 600; line-height: 32px; }
</style>
