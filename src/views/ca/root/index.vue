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
        <el-dropdown @command="handleCommand">
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
      <el-table-column label="状态" align="center" prop="status">
        <template #default="scope">
          <el-tag :type="scope.row.status === '1' ? 'success' : 'info'">{{ scope.row.status === '1' ? '有效' : '无效' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button link type="primary" icon="View" @click="handleView(scope.row)">详情</el-button>
          <el-button link type="primary" icon="Download" @click="handleDownload(scope.row)">下载</el-button>
          <el-button link type="success" icon="Stamp" @click="handleAuthorizeProfile(scope.row)">授权模板</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <!-- 创建证书对话框 -->
    <el-dialog :title="title" v-model="open" width="600px" append-to-body>
      <el-tabs v-model="activeTab">
        <el-tab-pane v-if="dialogType === 'root'" label="自签根证书" name="self">
          <el-form :model="selfForm" :rules="selfRules" ref="selfFormRef" label-width="140px">
            <el-tabs type="border-card">
              <el-tab-pane label="基本信息">
                <el-form-item label="证书名称" prop="name">
                  <el-input v-model="selfForm.name" placeholder="请输入证书名称" />
                </el-form-item>
                <el-form-item label="证书模板" prop="profileId">
                  <el-select v-model="selfForm.profileId" placeholder="请选择模板" @change="onProfileChange" style="width: 100%">
                    <el-option v-for="item in rootCaProfiles" :key="item.id" :label="item.name" :value="item.id" />
                  </el-select>
                </el-form-item>
                <CertSubject v-model="selfForm.subjectItems" propPrefix="subjectItems" />
                <el-form-item label="密钥算法" prop="keyAlgorithm">
                  <el-select v-model="selfForm.keyAlgorithm" style="width: 100%">
                    <el-option v-for="item in availableAlgos" :key="item" :label="item" :value="item" />
                  </el-select>
                </el-form-item>
                <el-form-item label="签名器类型" prop="signerType">
                  <el-select v-model="selfForm.signerType" style="width: 100%">
                    <el-option label="PKCS12" value="PKCS12" />
                    <el-option label="JKS" value="JKS" />
                    <el-option label="SDF" value="SDF" />
                  </el-select>
                </el-form-item>
                <el-form-item v-if="selfForm.signerType === 'SDF'" label="密钥索引" prop="keyIndex">
                  <el-input-number v-model="selfForm.keyIndex" :min="1" style="width: 100%" />
                </el-form-item>
                <el-form-item label="密码" prop="password">
                  <el-input v-model="selfForm.password" type="password" show-password placeholder="请输入签名器密码" />
                </el-form-item>
              </el-tab-pane>

              <el-tab-pane label="有效期配置">
                <el-form-item label="最大有效期" prop="validity">
                  <el-input v-model.number="selfForm.validity" placeholder="请输入正整数" style="width: 100%">
                    <template #append>
                      <el-select v-model="selfForm.validityUnit" style="width: 80px">
                        <el-option label="年" value="y" />
                        <el-option label="天" value="d" />
                      </el-select>
                    </template>
                  </el-input>
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
                <el-form-item label="更新间隔(小时)" prop="crlIntervalHours">
                  <el-input-number v-model="selfForm.crlIntervalHours" :min="1" style="width: 100%" />
                </el-form-item>
                <el-form-item label="全量CRL间隔" prop="crlFullIntervals">
                  <el-input-number v-model="selfForm.crlFullIntervals" :min="1" style="width: 100%" />
                </el-form-item>
                <el-form-item label="重叠时间" prop="crlOverlap">
                  <el-input v-model="selfForm.crlOverlap" placeholder="例如: 90d" />
                </el-form-item>
                <el-form-item label="更新时间点" prop="crlIntervalTime">
                  <el-input v-model="selfForm.crlIntervalTime" placeholder="例如: 01:00" />
                </el-form-item>
                <el-form-item label="下一CRL编号" prop="nextCrlNo">
                  <el-input-number v-model="selfForm.nextCrlNo" :min="1" style="width: 100%" />
                </el-form-item>
              </el-tab-pane>

              <el-tab-pane label="URI配置">
                <el-form-item
                  v-for="(item, index) in selfForm.cacertUris"
                  :key="'cacert-' + index"
                  :label="index === 0 ? 'CA证书URI' : ' '"
                >
                  <div style="display: flex; width: 100%">
                    <el-input v-model="item.value" style="flex: 1; margin-right: 10px" />
                    <el-button v-if="index === 0" @click="addUri('cacertUris')" type="primary" :icon="Plus" circle size="small" />
                    <el-button v-if="index !== 0" @click="removeUri('cacertUris', index)" type="danger" :icon="Minus" circle size="small" />
                  </div>
                </el-form-item>

                <el-form-item
                  v-for="(item, index) in selfForm.crlUris"
                  :key="'crl-' + index"
                  :label="index === 0 ? 'CRL URI' : ' '"
                >
                  <div style="display: flex; width: 100%">
                    <el-input v-model="item.value" style="flex: 1; margin-right: 10px" />
                    <el-button v-if="index === 0" @click="addUri('crlUris')" type="primary" :icon="Plus" circle size="small" />
                    <el-button v-if="index !== 0" @click="removeUri('crlUris', index)" type="danger" :icon="Minus" circle size="small" />
                  </div>
                </el-form-item>

                <el-form-item
                  v-for="(item, index) in selfForm.ocspUris"
                  :key="'ocsp-' + index"
                  :label="index === 0 ? 'OCSP URI' : ' '"
                >
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
        <el-tab-pane v-if="dialogType === 'sub'" label="从属CA（由上级签发）" name="import">
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

    <!-- 证书详情弹窗 -->
    <el-dialog v-model="showDetail" title="证书详情" width="60%">
      <X509Cert v-if="showDetail" :certPem="currentCertPem" />
    </el-dialog>
  </div>
</template>

<script setup name="RootCert" lang="ts">
import { ref, reactive, toRefs, getCurrentInstance, ComponentInternalInstance, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, FormInstance, UploadInstance, UploadProps } from 'element-plus';
import { ArrowDown, Search, Refresh, View, Download, Plus, Minus, Stamp } from '@element-plus/icons-vue';
import X509Cert from '@/components/X509Cert/index.vue';
import CertSubject, { typeMapping, sortSubjectItems } from '@/components/CertSubject/index.vue';
import { listProfile, getProfile } from '@/api/ca/profile';
import { listRootCa, genRootCa } from '@/api/ca/root';
import { X509 } from 'jsrsasign';
import { parseJson, parseKeyAlgorithms } from '@/utils/json';
import { parseTime } from '@/utils/ruoyi';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;
const router = useRouter();

const loading = ref(false);
const showSearch = ref(true);
const total = ref(0);
const certList = ref([]);
const open = ref(false);
const title = ref('');
const activeTab = ref('self');
const showDetail = ref(false);
const currentCertPem = ref('');
const dialogType = ref('root'); // 'root' or 'sub'
const rootCaProfiles = ref([]);
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
    crlIntervalHours: 24,
    crlFullIntervals: 90,
    crlOverlap: '90d',
    crlIntervalTime: '01:00',
    nextCrlNo: 2,
    // URI配置
    cacertUris: [{ value: 'https://myorg.org/rootca1.der' }],
    crlUris: [{ value: 'https://localhost:8081/dummy/crl/?type=crl&name=rootca1' }],
    ocspUris: [{ value: 'https://localhost:8080/ocsp/responder1' }],
    // 高级配置
    snSize: 20,
    status: 'active'
  },
  importForm: {
    name: '',
    csr: '',
    certFile: null as File | null
  }
});

const { queryParams, selfForm, importForm } = toRefs(data);

const selfRules = {
  name: [{ required: true, message: '请输入证书名称', trigger: 'blur' }],
  profileId: [{ required: true, message: '请选择证书模板', trigger: 'change' }],
  password: [{ required: true, message: '请输入签名器密码', trigger: 'blur' }],
  keyIndex: [
    { required: true, message: '请输入密钥索引', trigger: 'blur' },
    { type: 'number', message: '必须为正整数', trigger: 'blur', min: 1 }
  ],
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

/** 解析证书信息 */
function parseCertInfo(certPem: string) {
  if (!certPem) return null;

  const x509 = new X509();
  try {
    x509.readCertPEM(certPem);

    // 格式化 DN
    const formatDN = (array: any[]) => {
      if (!array || array.length === 0) return '';
      return array.map((e: any) => {
        let type = e[0].type;
        let val = e[0].value;
        return `${type}=${val}`;
      }).join(', ');
    };

    const issuer = formatDN(x509.getIssuer().array);
    const subject = formatDN(x509.getSubject().array);
    const notBefore = x509.getNotBefore();
    const notAfter = x509.getNotAfter();

    // 判断证书状态（是否在有效期内）
    const now = new Date();
    const notBeforeDate = parseX509Date(notBefore);
    const notAfterDate = parseX509Date(notAfter);
    const status = (now >= notBeforeDate && now <= notAfterDate) ? '1' : '0';

    return {
      issuer,
      subject,
      notBefore: formatX509Date(notBefore),
      notAfter: formatX509Date(notAfter),
      status,
      pem: certPem
    };
  } catch (e) {
    console.error('Failed to parse certificate', e);
    return null;
  }
}

/** 查询列表 */
async function getList() {
  loading.value = true;
  try {
    const res = await listRootCa(queryParams.value);
    console.log('API Response:', res);

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
    certList.value = rawList.map((item: any) => {
      const certInfo = parseCertInfo(item.cert);
      return {
        id: item.id,
        name: item.name,
        ...certInfo
      };
    }).filter((item: any) => item.issuer); // 过滤掉解析失败的证书

    total.value = totalCount;
  } catch (error: any) {
    console.error('获取根证书列表失败', error);
    console.error('错误详情:', error.response?.data || error.message);
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
    // 加载RootCA模板
    await loadRootCaProfiles();
  } else if (command === 'sub') {
    dialogType.value = 'sub';
    title.value = '创建子CA证书';
    activeTab.value = 'import';
  }
  open.value = true;
}

/** 加载RootCA模板列表 */
async function loadRootCaProfiles() {
  console.log('开始加载RootCA证书模板...');
  
  try {
    // 调用listProfile API，传递type参数筛选RootCA模板
    console.log('调用listProfile API，type=RootCA');
    const res = await listProfile({ type: 'RootCA' });
    console.log('listProfile响应:', res);
    
    const profiles = res.data || [];
    console.log('解析后的模板列表:', profiles);
    console.log('模板数量:', profiles.length);
    
    if (profiles.length === 0) {
      console.warn('没有找到RootCA类型的模板');
      ElMessage.warning('没有找到可用的RootCA证书模板');
      return;
    }
    
    // 设置模板列表
    rootCaProfiles.value = profiles;
    console.log('设置rootCaProfiles.value:', rootCaProfiles.value);
    console.log('rootCaProfiles.value.length:', rootCaProfiles.value.length);
    
    // 默认选中第一个
    const firstProfile = profiles[0];
    console.log('默认选中模板:', firstProfile);
    selfForm.value.profileId = firstProfile.id;
    
    // 调用模板变更处理
    console.log('开始调用onProfileChange');
    await onProfileChange(selfForm.value.profileId);
    console.log('onProfileChange调用完成');
    
  } catch (error: any) {
    console.error('加载RootCA证书模板失败', error);
    console.error('错误详情:', error.response?.data || error.message);
    ElMessage.error('加载RootCA证书模板失败: ' + (error.response?.data?.msg || error.message));
  }
}

/** 模板变更处理 */
async function onProfileChange(profileId: any) {
  if (!profileId) return;
  console.log('开始加载模板，profileId:', profileId);
  
  try {
    const res = await getProfile(profileId);
    const profile = res.data;
    console.log('获取到的profile数据:', profile);
    
    const conf = parseJson(profile.conf);
    console.log('解析后的conf:', conf);

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
        console.log('开始解析主题项，rdns:', rdns);
        const items: any[] = [];
        rdns.forEach((rdn: any) => {
          console.log('处理RDN:', rdn);
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
        console.log('设置后的subjectItems:', selfForm.value.subjectItems);
      } else {
        console.warn('模板中没有subject配置，使用默认主题项');
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
        if (conf.crlControl.overlap) {
          selfForm.value.crlOverlap = conf.crlControl.overlap;
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
      if (conf.ocspUris && Array.isArray(conf.ocspUris) && conf.ocspUris.length > 0) {
        selfForm.value.ocspUris = conf.ocspUris.map((uri: string) => ({ value: uri }));
      }
    } else {
      console.warn('模板conf为空，使用默认配置');
    }
  } catch (error) {
    console.error('加载模板详情失败', error);
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
    crlIntervalHours: 24,
    crlFullIntervals: 90,
    crlOverlap: '90d',
    crlIntervalTime: '01:00',
    nextCrlNo: 2,
    cacertUris: [{ value: 'https://myorg.org/rootca1.der' }],
    crlUris: [{ value: 'https://localhost:8081/dummy/crl/?type=crl&name=rootca1' }],
    ocspUris: [{ value: 'https://localhost:8080/ocsp/responder1' }],
    snSize: 20,
    status: 'active'
  };
  importForm.value = {
    name: '',
    csr: '',
    certFile: null
  };
  if (selfFormRef.value) selfFormRef.value.resetFields();
  if (importFormRef.value) importFormRef.value.resetFields();
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
          const reqData = {
            name: selfForm.value.name,
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
            validityModeS: selfForm.value.validityMode === 'cutoff' ? 'CUTOFF' : (selfForm.value.validityMode === 'strict' ? 'STRICT' : 'LAX'),
            caStatus: selfForm.value.status,
            snLen: selfForm.value.snSize,
            nextCrlNumber: selfForm.value.nextCrlNo,
            caCertUris: selfForm.value.cacertUris.map((u: any) => u.value).filter((v: any) => v),
            crlUris: selfForm.value.crlUris.map((u: any) => u.value).filter((v: any) => v),
            ocspUris: selfForm.value.ocspUris.map((u: any) => u.value).filter((v: any) => v)
          };

          const res = await genRootCa({ co: reqData });
          if (res.data) {
            ElMessage.success('证书生成成功');
            open.value = false;
            getList();
          }
        } catch (error: any) {
          console.error('证书生成失败', error);
          const errMsg = error.response?.data?.msg || error.message || '证书生成失败';
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
        // TODO: 调用导入二级根证书API
        console.log('Submit Import:', importForm.value);
        ElMessage.success('子CA证书导入成功');
        open.value = false;
        getList();
      }
    });
  }
}

const addUri = (field: 'cacertUris' | 'crlUris' | 'ocspUris') => {
  selfForm.value[field].push({ value: '' });
};

const removeUri = (field: 'cacertUris' | 'crlUris' | 'ocspUris', index: number) => {
  selfForm.value[field].splice(index, 1);
};

/** 查看详情 */
function handleView(row: any) {
  currentCertPem.value = row.pem; // 假设row中有pem字段
  showDetail.value = true;
}

/** 下载证书 */
function handleDownload(row: any) {
  // 实现下载逻辑
  const blob = new Blob([row.pem], { type: 'application/x-pem-file' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.download = `${row.name}.crt`;
  link.click();
}

/** 授权模板按钮操作 */
function handleAuthorizeProfile(row: any) {
  router.push({
    path: '/ca/root/authorize-profile',
    query: { id: row.id }
  });
}

getList();
</script>

<style scoped lang="scss">
.dialog-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
