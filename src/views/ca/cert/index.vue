<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryForm" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item label="证书名称" prop="name">
        <el-input v-model="queryParams.name" placeholder="请输入证书名称" clearable style="width: 240px" @keyup.enter="handleQuery" />
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
        <el-dropdown @command="handleIssueCommand">
          <el-button type="primary" plain icon="Plus">
            签发证书<el-icon class="el-icon--right"><arrow-down /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="key">USB Key 签发</el-dropdown-item>
              <el-dropdown-item command="p10">PKCS10 签发</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete">删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="warning" plain icon="Download" :disabled="multiple" @click="handleExport">导出</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="certList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="证书名称" align="center" prop="name" :show-overflow-tooltip="true" />
      <el-table-column label="序列号" align="center" prop="serialNumber" width="120" />
      <el-table-column label="颁发者" align="center" prop="issuer" :show-overflow-tooltip="true" />
      <el-table-column label="主题" align="center" prop="subject" :show-overflow-tooltip="true" />
      <el-table-column label="有效期结束" align="center" prop="notAfter" width="160" />
      <el-table-column label="状态" align="center" prop="status" width="100">
        <template #default="scope">
          <el-tag :type="getStatusType(scope.row.status)">{{ getStatusLabel(scope.row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button link type="primary" icon="View" @click="handleView(scope.row)">详情</el-button>
          <el-button link type="primary" icon="Download" @click="handleDownload(scope.row)">下载</el-button>
          <el-button v-if="scope.row.status === 'VALID'" link type="danger" icon="CircleClose" @click="handleRevoke(scope.row)">吊销</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

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
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitRevoke">确 定</el-button>
          <el-button @click="revokeOpen = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 签发证书对话框 -->
    <el-dialog v-model="issueOpen" :title="issueTitle" width="850px" append-to-body top="5vh" @close="closeIssueDialog">
      <el-form ref="issueFormRef" :model="issueForm" :rules="issueRules" label-width="120px">
        <el-row :gutter="20">
          <el-col :span="12">
            <div class="form-section">
              <div class="section-title">颁发者与模板</div>
              <el-form-item label="颁发者" prop="rootId">
                <el-select v-model="issueForm.rootId" placeholder="请选择颁发者" style="width: 100%" @change="handleRootChange">
                  <el-option v-for="item in rootList" :key="item.id" :label="item.name" :value="item.id" />
                </el-select>
              </el-form-item>
              <el-form-item label="证书模板" prop="profileId">
                <el-select v-model="issueForm.profileId" placeholder="请选择模板" style="width: 100%" @change="handleProfileChange">
                  <el-option v-for="item in profileList" :key="item.id" :label="item.name" :value="item.id" />
                </el-select>
              </el-form-item>
            </div>

            <div class="form-section" v-if="issueForm.subjectItems.length > 0">
              <div class="section-title">主体信息 (Subject)</div>
              <div class="subject-scroll-area">
                <CertSubject v-model="issueForm.subjectItems" propPrefix="subjectItems" />
              </div>
            </div>
          </el-col>

          <el-col :span="12">
            <div v-if="issueType === 'key'" class="form-section">
              <div class="section-title">
                <span>USBKey 证书设置</span>
                <div v-if="monitoring" class="monitoring-tag">
                  <span class="pulse-dot"></span>
                  正在监控设备插拔...
                </div>
              </div>
              <el-form-item label="设备提供商" prop="provider">
                <div class="flex-row" style="display: flex; gap: 10px; width: 100%">
                  <el-select v-model="issueForm.provider" placeholder="请选择或刷新" style="flex: 1" @change="onCertProviderChange">
                    <el-option v-for="p in certProviders" :key="p" :label="p" :value="p" />
                  </el-select>
                  <el-button @click="refreshCertProviders" :icon="Refresh" circle />
                </div>
              </el-form-item>
              <el-form-item label="设备列表" prop="device">
                <el-select v-model="issueForm.device" placeholder="请选择设备" style="width: 100%" @change="onCertDeviceChange">
                  <el-option v-for="d in certDevices" :key="d" :label="d" :value="d" />
                </el-select>
              </el-form-item>
              <el-form-item label="应用" prop="appName">
                <el-select v-model="issueForm.appName" placeholder="请选择应用" style="width: 100%">
                  <el-option v-for="a in certApps" :key="a" :label="a" :value="a" />
                </el-select>
              </el-form-item>
              <el-form-item label="容器名" prop="containerName">
                <el-input v-model="issueForm.containerName" placeholder="已自动生成随机容器名" />
              </el-form-item>
              <el-form-item label="User PIN" prop="pin">
                <el-input v-model="issueForm.pin" type="password" show-password placeholder="请输入 USBKey User PIN" />
              </el-form-item>
            </div>

            <div v-if="issueType === 'p10'" class="form-section">
              <div class="section-title">PKCS10 CSR 内容</div>
              <el-form-item label="CSR PEM" prop="csr" label-width="0">
                <el-input v-model="issueForm.csr" type="textarea" :rows="15" placeholder="-----BEGIN CERTIFICATE REQUEST----- ..." />
              </el-form-item>
            </div>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" :loading="issueLoading" @click="submitIssue">确认签发</el-button>
          <el-button @click="issueOpen = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="CertManagement" lang="ts">
import { ref, reactive, toRefs, getCurrentInstance, ComponentInternalInstance, onMounted } from 'vue';
import { ElMessage, ElMessageBox, FormInstance } from 'element-plus';
import { ArrowDown, Plus, View, Download, Delete, CircleClose, Refresh, Search, Document, Key, QuestionFilled, Cpu, InfoFilled, Warning } from '@element-plus/icons-vue';
import X509Cert from '@/components/X509Cert/index.vue';
import CertSubject, { typeMapping, sortSubjectItems } from '@/components/CertSubject/index.vue';
import { pageCert, getCert, revokeCert, removeCert, exportCert, issueCert } from '@/api/ca/cert';
import { listRootCa, getRootCa } from '@/api/ca/root';
import { listProfile, getProfile } from '@/api/ca/profile';
import { X509 } from 'jsrsasign';
import { parseJson, parseKeyAlgorithms } from '@/utils/json';
import { parseTime } from '@/utils/ruoyi';
import SKFClient from '@/api/skf/skf_api';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

// SKF 客户端单例管理
let skfClientPromise: Promise<any> | null = null;
const getSkfClient = (): Promise<any> => {
  if (skfClientPromise) return skfClientPromise;
  const skf = new SKFClient('ws://127.0.0.1:9001');
  skfClientPromise = new Promise((resolve, reject) => {
    skf.connect()
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

// 签发相关状态
const issueOpen = ref(false);
const issueLoading = ref(false);
const monitoring = ref(false);
const issueTitle = ref('');
const issueType = ref('key'); 
const rootList = ref([]);
const profileList = ref([]);
const allProfileList = ref([]); 
const certProviders = ref<string[]>([]);
const certDevices = ref<string[]>([]);
const certApps = ref<string[]>([]);
const issueFormRef = ref<FormInstance>();

const data = reactive({
  queryParams: { pageNum: 1, pageSize: 10, name: undefined, serialNumber: undefined },
  revokeForm: { id: undefined as string | number | undefined, reason: 0 },
  issueForm: {
    rootId: undefined as string | number | undefined,
    profileId: undefined as string | number | undefined,
    name: '',
    subjectItems: [] as any[],
    provider: '', device: '', appName: '', containerName: '', pin: '123456', csr: ''
  }
});

const { queryParams, revokeForm, issueForm } = toRefs(data);

const issueRules = {
  rootId: [{ required: true, message: '请选择颁发者', trigger: 'change' }],
  profileId: [{ required: true, message: '请选择证书模板', trigger: 'change' }],
  provider: [{ required: true, message: '请选择厂商', trigger: 'change' }],
  device: [{ required: true, message: '请选择设备', trigger: 'change' }],
  appName: [{ required: true, message: '请选择应用', trigger: 'change' }],
  containerName: [{ required: true, message: '请输入容器名称', trigger: 'blur' }],
  pin: [{ required: true, message: '请输入PIN码', trigger: 'blur' }],
  csr: [{ required: true, message: '请输入CSR', trigger: 'blur' }]
};

async function loadRoots() { try { const res = await listRootCa({ pageNum: 1, pageSize: 100 }); rootList.value = res.data.rows || res.data.records || []; } catch (e) {} }
async function loadProfiles() { try { const res = await listProfile(); allProfileList.value = (res.data || []).filter((p: any) => p.type !== 'RootCA'); profileList.value = []; } catch (e) {} }

async function refreshCertProviders() {
  certProviders.value = [];
  try {
    skfClientPromise = null;
    const skf = await getSkfClient();
    try { await skf.setLanguage('CN'); } catch(e) {}
    const providers = await skf.enumProvider();
    certProviders.value = providers;
    if (providers.length > 0) { issueForm.value.provider = providers[0]; await onCertProviderChange(); }
    if (issueOpen.value && !monitoring.value && issueType.value === 'key') startDeviceMonitoring();
  } catch (e: any) {
    console.error('SKF Service Error:', e);
    const errorMsg = e?.message || (typeof e === 'string' ? e : 'SKF 服务连接异常');
    ElMessage.error('无法连接到 SKF 服务: ' + errorMsg);
  }
}

async function startDeviceMonitoring() {
  if (monitoring.value) return;
  monitoring.value = true;
  try {
    const skf = await getSkfClient();
    while (monitoring.value && issueOpen.value) {
      try {
        const prov = issueForm.value.provider || (certProviders.value.length > 0 ? certProviders.value[0] : null);
        if (!prov) { await new Promise(resolve => setTimeout(resolve, 2000)); continue; }
        const event = await skf.waitForDeviceEvent(prov);
        if (event.event === 1) { ElMessage.success(`检测到设备插入: ${event.deviceName}`); await refreshCertProviders(); }
        else if (event.event === 2) { ElMessage.warning(`设备已拔出: ${event.deviceName}`); await refreshCertProviders(); }
      } catch (e: any) { if (e.message && !e.message.includes('timeout')) { console.warn('设备监控异常:', e); await new Promise(resolve => setTimeout(resolve, 5000)); } }
    }
  } finally { monitoring.value = false; }
}

async function onCertProviderChange() {
  certDevices.value = [];
  if (!issueForm.value.provider) return;
  try {
    const skf = await getSkfClient();
    const devices = await skf.enumDevice(issueForm.value.provider);
    certDevices.value = devices;
    if (devices.length > 0) { issueForm.value.device = devices[0]; await onCertDeviceChange(); }
  } catch (e: any) { ElMessage.error('获取设备列表失败'); }
}

async function onCertDeviceChange() {
  certApps.value = [];
  if (!issueForm.value.provider || !issueForm.value.device) return;
  try {
    const skf = await getSkfClient();
    const apps = await skf.enumApplication(issueForm.value.provider, issueForm.value.device);
    certApps.value = apps;
    if (apps.length > 0) issueForm.value.appName = apps[0];
  } catch (e: any) { ElMessage.error('获取应用列表失败'); }
}

async function handleRootChange(val: any) {
  if (!val) { profileList.value = []; issueForm.value.profileId = undefined; issueForm.value.subjectItems = []; return; }
  try {
    const res = await getRootCa(val);
    const authorizedIds = res.data.profileIds || [];
    profileList.value = allProfileList.value.filter((p: any) => authorizedIds.some((authId: any) => String(authId) === String(p.id)));
    issueForm.value.profileId = undefined; issueForm.value.subjectItems = [];
  } catch (e) {}
}

async function handleProfileChange(val: any) {
  if (!val) return;
  try {
    const res = await getProfile(val);
    const conf = parseJson(res.data.conf);
    if (conf && conf.subject) {
      const items: any[] = [];
      const rdns = conf.subject.rdns || (Array.isArray(conf.subject) ? conf.subject : []);
      rdns.forEach((rdn: any) => {
        const rdnType = (typeof rdn.type === 'object' ? rdn.type.description : rdn.type) || '';
        let compType = rdnType.toLowerCase();
        for (const [type, meta] of Object.entries(typeMapping)) { if (meta.key.toLowerCase() === compType || type.toLowerCase() === compType) { compType = type; break; } }
        const count = Math.max(1, rdn.minOccurs === undefined ? 1 : rdn.minOccurs);
        for (let i = 0; i < count; i++) { items.push({ type: compType, value: '', minOccurs: rdn.minOccurs, maxOccurs: rdn.maxOccurs }); }
      });
      issueForm.value.subjectItems = sortSubjectItems(items);
    }
  } catch (e) {}
}

function handleIssueCommand(command: string) {
  issueType.value = command;
  issueTitle.value = command === 'key' ? 'USB Key 签发' : 'PKCS10 签发';
  resetIssueForm();
  issueForm.value.containerName = 'cert-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
  issueOpen.value = true;
  if (command === 'key') refreshCertProviders();
}

function resetIssueForm() {
  issueForm.value = { rootId: undefined, profileId: undefined, name: '', subjectItems: [], provider: '', device: '', appName: '', containerName: '', pin: '123456', csr: '' };
  if (issueFormRef.value) issueFormRef.value.resetFields();
}

function closeIssueDialog() { issueOpen.value = false; monitoring.value = false; }

async function submitIssue() {
  issueFormRef.value?.validate(async (valid) => {
    if (valid) {
      issueLoading.value = true;
      let skf: any = null;
      try {
        let finalCsr = '';
        if (issueType.value === 'key') {
          skf = await getSkfClient();
          const appPath = `${issueForm.value.provider}/${issueForm.value.device}/${issueForm.value.appName}`;
          ElMessage.info('正在验证 PIN...');
          await skf.checkPIN(appPath, issueForm.value.pin);
          const subject = issueForm.value.subjectItems.filter((i: any) => i.value).map((i: any) => {
            const key = typeMapping[i.type as keyof typeof typeMapping]?.key || i.type;
            return `${key}=${i.value}`;
          }).join(',');
          ElMessage.info('正在生成 CSR...');
          const p10Res = await skf.createPKCS10(issueForm.value.provider, issueForm.value.device, issueForm.value.appName, subject, 'SM2', 256, issueForm.value.containerName);
          finalCsr = p10Res.pem;
        } else { finalCsr = issueForm.value.csr; }

        ElMessage.info('正在签发证书...');
        const res = await issueCert({ rootId: issueForm.value.rootId, profileId: issueForm.value.profileId, csrPem: finalCsr });
        if (res.data && res.data.cert) {
          if (issueType.value === 'key' && skf) {
            ElMessage.info('正在写入 USB Key...');
            await skf.importCertificate(issueForm.value.provider, issueForm.value.device, issueForm.value.appName, issueForm.value.containerName, true, res.data.cert);
          }
          ElMessage.success('签发成功'); issueOpen.value = false; getList();
        } else { throw new Error(res.msg || '后端签发结果异常'); }
      } catch (e: any) {
        console.error('Issue Error:', e);
        const errorMsg = e?.message || (typeof e === 'string' ? e : '操作失败');
        ElMessage.error('签发失败: ' + errorMsg);
      } finally { issueLoading.value = false; }
    }
  });
}

function getStatusType(status: string) { switch (status) { case 'VALID': return 'success'; case 'REVOKED': return 'danger'; case 'EXPIRED': return 'warning'; default: return 'info'; } }
function getStatusLabel(status: string) { switch (status) { case 'VALID': return '有效'; case 'REVOKED': return '已吊销'; case 'EXPIRED': return '已过期'; default: return status || '未知'; } }
function handleQuery() { queryParams.value.pageNum = 1; getList(); }
function resetQuery() { proxy?.resetForm('queryForm'); handleQuery(); }
function handleSelectionChange(selection: any[]) { ids.value = selection.map(item => item.id); single.value = selection.length !== 1; multiple.value = !selection.length; }
function handleView(row: any) { currentCertPem.value = row.cert || row.pem; showDetail.value = true; }
function handleDownload(row: any) {
  const pem = row.cert || row.pem;
  if (!pem) { ElMessage.error('内容为空'); return; }
  const blob = new Blob([pem], { type: 'application/x-pem-file' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.download = `${row.serialNumber}.crt`; link.click();
}
function handleRevoke(row: any) { revokeForm.value.id = row.id; revokeForm.value.reason = 0; revokeOpen.value = true; }
async function submitRevoke() {
  try { await revokeCert(revokeForm.value as any); ElMessage.success('吊销成功'); revokeOpen.value = false; getList(); }
  catch (error: any) { ElMessage.error('失败'); }
}
function handleDelete(row: any) {
  const certIds = row.id || ids.value;
  ElMessageBox.confirm('确认删除？', '提示', { type: 'warning' }).then(async () => {
    try { await removeCert(Array.isArray(certIds) ? certIds : [certIds]); ElMessage.success('成功'); getList(); } catch (e) {}
  });
}
async function handleExport() {
  try {
    const res = await exportCert(ids.value);
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(new Blob([res]));
    link.download = `certs_${Date.now()}.zip`; link.click();
  } catch (e) {}
}

function parseCertInfo(certPem: string) {
  if (!certPem) return null;
  const x509 = new X509();
  try {
    x509.readCertPEM(certPem);
    const issuer = x509.getIssuerString();
    const subject = x509.getSubjectString();
    const notAfter = x509.getNotAfter();
    const serialNumber = x509.getSerialNumberHex();
    return { issuer, subject, notAfter: formatX509Date(notAfter), serialNumber: serialNumber.toUpperCase(), pem: certPem };
  } catch (e) { return null; }
}

function formatX509Date(zStr: string): string {
  if (!zStr) return '-';
  try {
    let y, m, d, h, min, s;
    if (zStr.length === 13) {
      y = '20' + zStr.substring(0, 2); m = parseInt(zStr.substring(2, 4)) - 1; d = zStr.substring(4, 6);
      h = zStr.substring(6, 8); min = zStr.substring(8, 10); s = zStr.substring(10, 12);
    } else {
      y = zStr.substring(0, 4); m = parseInt(zStr.substring(4, 6)) - 1; d = zStr.substring(6, 8);
      h = zStr.substring(8, 10); min = zStr.substring(10, 12); s = zStr.substring(12, 14);
    }
    const date = new Date(Date.UTC(y as any, m, d as any, h as any, min as any, s as any));
    return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch (e) { return zStr; }
}

async function getList() {
  loading.value = true;
  try {
    const res = await pageCert(queryParams.value);
    let rawList = res.data?.rows || res.data?.records || [];
    total.value = res.data?.total || 0;
    certList.value = rawList.map((item: any) => {
      const info = parseCertInfo(item.cert);
      return { ...item, ...info };
    });
  } catch (error: any) { ElMessage.error('获取列表失败'); } finally { loading.value = false; }
}

onMounted(() => { loadRoots(); loadProfiles(); getList(); });
</script>

<style scoped lang="scss">
.mb8 { margin-bottom: 8px; }
.section-h4 { margin-top: 0; margin-bottom: 15px; color: #606266; font-size: 14px; }
.cert-section-header { margin-bottom: 15px; }
.cert-divider-section { margin-top: 20px; border-top: 1px dashed #eee; padding-top: 20px; margin-bottom: 20px; }
.flex-between { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; .section-h4 { margin-bottom: 0; } }
.monitoring-tag { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #67c23a; font-weight: normal; background: #f0f9eb; padding: 2px 10px; border-radius: 12px; border: 1px solid #e1f3d8; }
.pulse-dot { width: 6px; height: 6px; background-color: #67c23a; border-radius: 50%; position: relative; &::after { content: ''; position: absolute; width: 100%; height: 100%; background-color: #67c23a; border-radius: 50%; animation: pulse 2s infinite; } }
@keyframes pulse { 0% { transform: scale(1); opacity: 0.8; } 70% { transform: scale(2.5); opacity: 0; } 100% { transform: scale(1); opacity: 0; } }
.subject-scroll-area { max-height: 400px; overflow-y: auto; padding-right: 5px; }
.flex-row { display: flex; align-items: center; }
.ml-2 { margin-left: 10px; }
</style>
