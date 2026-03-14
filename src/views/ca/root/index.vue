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
      <el-table-column label="ID" align="center" prop="id" />
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
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <!-- 创建证书对话框 -->
    <el-dialog :title="title" v-model="open" width="600px" append-to-body>
      <el-tabs v-model="activeTab">
        <el-tab-pane v-if="dialogType === 'root'" label="自签根证书" name="self">
          <el-form ref="selfFormRef" :model="selfForm" :rules="selfRules" label-width="100px">
            <el-form-item label="证书模板" prop="profileId">
              <el-select v-model="selfForm.profileId" placeholder="请选择模板" @change="onProfileChange" style="width: 100%">
                <el-option
                  v-for="item in rootCaProfiles"
                  :key="item.id"
                  :label="item.name"
                  :value="item.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="证书名称" prop="name">
              <el-input v-model="selfForm.name" placeholder="请输入证书名称" />
            </el-form-item>

            <CertSubject v-model="selfForm.subjectItems" propPrefix="subjectItems" />

            <el-form-item label="有效期(年)" prop="validity">
              <el-input-number v-model="selfForm.validity" :min="1" :max="100" />
            </el-form-item>
            <el-form-item label="密钥算法" prop="keyAlgorithm">
              <el-select v-model="selfForm.keyAlgorithm">
                <el-option v-for="alg in availableAlgos" :key="alg" :label="alg" :value="alg" />
              </el-select>
            </el-form-item>
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
import { ref, reactive, toRefs, getCurrentInstance, ComponentInternalInstance } from 'vue';
import { ElMessage, FormInstance, UploadInstance, UploadProps } from 'element-plus';
import { ArrowDown, Search, Refresh, View, Download } from '@element-plus/icons-vue';
import X509Cert from '@/components/X509Cert/index.vue';
import CertSubject, { typeMapping, sortSubjectItems } from '@/components/CertSubject/index.vue';
import { listProfile, getProfile } from '@/api/ca/profile';
import { listRootCa } from '@/api/ca/root';
import { X509 } from 'jsrsasign';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

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
    profileId: undefined,
    subjectItems: [] as any[],
    validity: 10,
    keyAlgorithm: 'RSA2048'
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
  profileId: [{ required: true, message: '请选择证书模板', trigger: 'change' }]
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
  try {
    const res = await listProfile();
    // 假设后端返回的数据结构，过滤出RootCA类型的模板
    rootCaProfiles.value = res.data.filter((p: any) => p.type === 'RootCA' || p.certLevel === 'RootCA');
    if (rootCaProfiles.value.length > 0) {
      // 默认选中第一个
      selfForm.value.profileId = (rootCaProfiles.value[0] as any).id;
      await onProfileChange(selfForm.value.profileId);
    }
  } catch (error) {
    ElMessage.error('加载证书模板失败');
  }
}

/** 模板变更处理 */
async function onProfileChange(profileId: any) {
  if (!profileId) return;
  try {
    const res = await getProfile(profileId);
    const profile = res.data;
    const conf = typeof profile.conf === 'string' ? JSON.parse(profile.conf) : profile.conf;

    if (conf) {
      // 1. 设置有效期
      if (conf.validity) {
        const v = conf.validity;
        const val = parseInt(v.replace(/\D/g, ''));
        if (!isNaN(val)) {
          selfForm.value.validity = val;
        }
      }

      // 2. 设置可选算法
      if (conf.keyAlgorithms && Array.isArray(conf.keyAlgorithms)) {
        availableAlgos.value = conf.keyAlgorithms.map((a: any) => typeof a === 'string' ? a : (a.name || a.type));
        if (availableAlgos.value.length > 0) {
          selfForm.value.keyAlgorithm = availableAlgos.value[0];
        }
      }

      // 3. 设置主题项
      if (conf.subject) {
        const items: any[] = [];
        conf.subject.forEach((rdn: any) => {
          let compType = rdn.type.toLowerCase();
          for (const [type, meta] of Object.entries(typeMapping)) {
            if (meta.key.toLowerCase() === rdn.type.toLowerCase() || type.toLowerCase() === rdn.type.toLowerCase()) {
              compType = type;
              break;
            }
          }

          const count = Math.max(1, rdn.minOccurs || 0);
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
      }
    }
  } catch (error) {
    console.error('加载模板详情失败', error);
    ElMessage.error('加载模板详情失败');
  }
}

/** 重置表单 */
function reset() {
  selfForm.value = {
    name: '',
    profileId: undefined,
    subjectItems: [],
    validity: 10,
    keyAlgorithm: 'RSA2048'
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
    selfFormRef.value?.validate((valid) => {
      if (valid) {
        // 构建Subject字符串
        const subject = selfForm.value.subjectItems
          .filter((item: any) => item.value)
          .map((item: any) => {
            const key = typeMapping[item.type as keyof typeof typeMapping]?.key || item.type;
            return `${key}=${item.value}`;
          })
          .join(',');

        console.log('Submit Self Signed:', { ...selfForm.value, subject });
        ElMessage.success('根CA证书创建成功');
        open.value = false;
        getList();
      }
    });
  } else {
    importFormRef.value?.validate((valid) => {
      if (valid) {
        if (!importForm.value.certFile) {
          ElMessage.error('请上传证书文件');
          return;
        }
        // 调用导入二级根证书API
        console.log('Submit Import:', importForm.value);
        ElMessage.success('子CA证书导入成功');
        open.value = false;
        getList();
      }
    });
  }
}

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

getList();
</script>

<style scoped lang="scss">
.dialog-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
