<template>
  <div class="app-container fawvw-ca-cert-page">
    <BusinessNoticeSettingsDialog ref="businessNoticeSettings" module="root" />
    <el-card v-show="showSearch" shadow="never" class="query-card">
      <el-form :model="queryParams" label-width="100px" class="query-form">
        <el-form-item label="所属根证书">
          <el-select v-model="queryParams.rootId" clearable filterable placeholder="全部根证书">
            <el-option v-for="root in rootOptions" :key="root.id" :value="root.id" :label="`${root.displayName} · ${root.fingerprint.slice(-17)}`" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="queryParams.keyword" clearable placeholder="名称、主题、序列号、指纹" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="证书类型">
          <el-select v-model="queryParams.certificateType" clearable placeholder="全部">
            <el-option label="根证书" value="ROOT" />
            <el-option label="中间证书" value="INTERMEDIATE" />
          </el-select>
        </el-form-item>
        <el-form-item label="有效期状态">
          <el-select v-model="queryParams.validityStatus" clearable placeholder="全部">
            <el-option label="有效" value="VALID" />
            <el-option label="临近到期" value="EXPIRING" />
            <el-option label="已过期" value="EXPIRED" />
            <el-option label="未生效" value="NOT_YET_VALID" />
          </el-select>
        </el-form-item>
        <el-form-item label="管理状态">
          <el-select v-model="queryParams.managementStatus" clearable placeholder="全部">
            <el-option label="启用" value="ACTIVE" />
            <el-option label="停用" value="DISABLED" />
          </el-select>
        </el-form-item>
        <el-form-item label="颁发者">
          <el-input v-model="queryParams.issuer" clearable placeholder="颁发者名称或 DN" @keyup.enter="handleQuery" />
        </el-form-item>
        <el-form-item label="来源">
          <el-select v-model="queryParams.sourceType" clearable placeholder="全部">
            <el-option label="RA同步" value="RA_SYNC" />
            <el-option label="手工导入" value="IMPORTED" />
          </el-select>
        </el-form-item>
        <el-form-item label="到期日期" class="expiry-item">
          <el-date-picker
            v-model="expiryRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            unlink-panels
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
        <el-col :span="1.5">
          <el-button v-hasPermi="['ra:fawvw-ca-cert:sync']" plain icon="RefreshRight" @click="handleSync">同步当前RA证书</el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button v-hasPermi="['ra:fawvw-ca-cert:import']" type="primary" plain icon="Upload" @click="importOpen = true">导入根证书</el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button v-hasPermi="['ra:fawvw-ca-cert:edit']" plain icon="Bell" @click="businessNoticeSettings?.open()">通知设置</el-button>
        </el-col>
        <right-toolbar v-model:showSearch="showSearch" @queryTable="loadList" />
      </el-row>

      <el-alert
        title="本页面是 FAW-VW 独立证书台账：同步仅读取当前 RA 根证书和证书链；导入和维护不会影响平台管理员的 CA 管理。"
        type="info"
        :closable="false"
        show-icon
        class="mb12"
      />

      <el-table ref="treeTable" v-loading="loading" :data="rows" row-key="id" default-expand-all border stripe empty-text="暂无根证书或中间证书记录">
        <el-table-column label="证书名称" prop="displayName" min-width="240" show-overflow-tooltip>
          <template #default="{ row }">
            <span>{{ row.displayName }}</span>
            <el-tooltip v-if="!row.linked" :content="row.warning" placement="top">
              <el-tag type="danger" size="small" class="ml8">链路异常</el-tag>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="所属根证书" min-width="180" show-overflow-tooltip>
          <template #default="{ row }"
            ><el-button link type="primary" @click="openChain(row)">{{ rootName(row) }}</el-button></template
          >
        </el-table-column>
        <el-table-column label="类型" width="100" align="center">
          <template #default="{ row }"
            ><el-tag :type="row.certificateType === 'ROOT' ? 'danger' : 'warning'" effect="plain">{{
              row.certificateType === 'ROOT' ? '根证书' : '中间证书'
            }}</el-tag></template
          >
        </el-table-column>
        <el-table-column label="序列号" prop="serialNumber" min-width="170" show-overflow-tooltip />
        <el-table-column label="颁发者" prop="issuerDn" min-width="180" show-overflow-tooltip />
        <el-table-column label="到期时间" prop="notAfter" width="166" align="center"
          ><template #default="{ row }">{{ dateTime(row.notAfter) }}</template></el-table-column
        >
        <el-table-column label="有效期" width="112" align="center"
          ><template #default="{ row }"
            ><el-tooltip :disabled="!row.expiryWarning" :content="row.expiryWarning" placement="top"><el-tag :type="validityTag(row.validityStatus)" effect="light">{{ row.validityStatusName }}</el-tag></el-tooltip></template
          ></el-table-column
        >
        <el-table-column label="来源" width="115" align="center"
          ><template #default="{ row }">{{ row.sourceType === 'RA_SYNC' ? (row.sourceActive === false ? '历史同步' : 'RA同步') : '手工导入' }}</template></el-table-column
        >
        <el-table-column label="管理状态" width="100" align="center"
          ><template #default="{ row }"
            ><el-tag :type="row.managementStatus === 'ACTIVE' ? 'success' : 'info'" effect="plain">{{
              row.managementStatus === 'ACTIVE' ? '启用' : '停用'
            }}</el-tag></template
          ></el-table-column
        >
        <el-table-column label="操作" fixed="right" width="218" align="center">
          <template #default="{ row }">
            <CertRowAction label="查看详情" icon="View" @click="openDetail(row)" />
            <CertRowAction v-hasPermi="['ra:fawvw-ca-cert:edit']" label="维护" icon="Edit" @click="openEdit(row)" />
            <CertRowAction v-hasPermi="['ra:fawvw-ca-cert:edit']" label="发送通知" icon="Message"
              :disabled="sendingNotice || row.managementStatus !== 'ACTIVE' || row.sourceActive === false || businessCertificateNoticeBlocked(row.notAfter)"
              @click="sendNotice(row)" />
            <CertRowAction label="查看证书链" icon="Connection" @click="openChain(row)" />
            <CertRowAction label="下载证书" icon="Download" @command="(format) => downloadCertificate(row, format as 'cer' | 'p7b')">
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="cer">单张证书 CER</el-dropdown-item>
                  <el-dropdown-item command="p7b">证书链 P7B</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </CertRowAction>
            <CertRowAction v-if="canRemoveCertificate(row)" v-hasPermi="['ra:fawvw-ca-cert:edit']" label="移除证书" type="danger" icon="Delete" @click="removeCertificate(row)" />
          </template>
        </el-table-column>
      </el-table>
      <div v-if="total > 0" class="mt12">共 {{ total }} 组</div>
      <pagination
        v-show="total > 0"
        v-model:page="queryParams.pageNum"
        v-model:limit="queryParams.pageSize"
        :total="total"
        :auto-scroll="false"
        layout="sizes, prev, pager, next, jumper"
        @pagination="loadList"
      />
    </el-card>

    <el-drawer v-model="chainOpen" title="证书链" size="min(900px, 95vw)" append-to-body>
      <el-table :data="chainRows" row-key="id" default-expand-all border>
        <el-table-column label="证书名称" prop="displayName" min-width="220" show-overflow-tooltip />
        <el-table-column label="类型" width="100"
          ><template #default="{ row }">{{ row.certificateType === 'ROOT' ? '根证书' : '中间证书' }}</template></el-table-column
        >
        <el-table-column label="到期时间" width="170"
          ><template #default="{ row }">{{ dateTime(row.notAfter) }}</template></el-table-column
        >
        <el-table-column label="链路校验" min-width="180"
          ><template #default="{ row }">
            <el-tag :type="row.linked ? 'success' : 'danger'">{{ row.linked ? '签名匹配' : '链路异常' }}</el-tag>
            <span v-if="row.warning"> {{ row.warning }}</span>
          </template></el-table-column
        >
      </el-table>
    </el-drawer>

    <el-dialog v-model="importOpen" title="导入根证书及中间证书链" width="min(650px, 96vw)" append-to-body @closed="resetImport">
      <el-alert
        title="根证书文件必须是一张自签名 CA 证书；证书链可选，链中的中间证书会自动关联到该根证书。单个文件最大 5MB。"
        type="info"
        :closable="false"
        show-icon
        class="mb12"
      />
      <el-form label-width="110px">
        <el-form-item label="根证书文件" required>
          <el-upload
            :auto-upload="false"
            :limit="1"
            accept=".cer,.crt,.pem"
            :on-change="(file: any) => (rootFile = file.raw)"
            :on-remove="() => (rootFile = undefined)"
            ><el-button icon="Upload">选择文件</el-button></el-upload
          >
        </el-form-item>
        <el-form-item label="证书链文件">
          <el-upload
            :auto-upload="false"
            :limit="1"
            accept=".cer,.crt,.pem"
            :on-change="(file: any) => (chainFile = file.raw)"
            :on-remove="() => (chainFile = undefined)"
            ><el-button icon="Upload">选择证书链</el-button></el-upload
          >
        </el-form-item>
      </el-form>
      <template #footer
        ><el-button @click="importOpen = false">取消</el-button
        ><el-button type="primary" :loading="importing" @click="handleImport">导入</el-button></template
      >
    </el-dialog>

    <el-drawer v-model="detailOpen" title="证书详情" size="min(760px, 95vw)" append-to-body>
      <template v-if="detail">
        <el-alert v-if="detail.parseWarning" :title="detail.parseWarning" type="warning" :closable="false" show-icon class="mb12" />
        <el-descriptions title="基本信息" :column="1" border class="ca-detail">
          <el-descriptions-item label="证书名称">{{ detail.certificate.displayName }}</el-descriptions-item>
          <el-descriptions-item label="证书类型">{{ detail.certificate.certificateType === 'ROOT' ? '根证书' : '中间证书' }}</el-descriptions-item>
          <el-descriptions-item label="所属根证书">{{ rootName(detail.certificate) }}</el-descriptions-item>
          <el-descriptions-item label="链路校验">
            <el-tag :type="detailChain?.linked ? 'success' : 'danger'">{{ detailChain?.linked ? '签名匹配' : '链路异常' }}</el-tag>
            <span v-if="detailChain?.warning" class="ml8">{{ detailChain.warning }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="主题 DN">{{ formatCertificateSubject(detail.certificate.subjectDn) }}</el-descriptions-item>
          <el-descriptions-item label="颁发者 DN">{{ detail.certificate.issuerDn }}</el-descriptions-item>
          <el-descriptions-item label="序列号">{{ detail.certificate.serialNumber }}</el-descriptions-item>
          <el-descriptions-item label="生效时间">{{ dateTime(detail.certificate.notBefore) }}</el-descriptions-item>
          <el-descriptions-item label="到期时间">{{ dateTime(detail.certificate.notAfter) }}</el-descriptions-item>
          <el-descriptions-item label="有效期状态">
            <el-tag :type="validityTag(detail.certificate.validityStatus)">{{ detail.certificate.validityStatusName }}</el-tag>
            <div v-if="detail.certificate.expiryWarning">{{ detail.certificate.expiryWarning }}</div>
          </el-descriptions-item>
          <el-descriptions-item label="来源">{{ detail.certificate.sourceType === 'RA_SYNC' ? '当前RA同步' : '手工导入' }}</el-descriptions-item>
          <el-descriptions-item label="管理状态">{{ detail.certificate.managementStatus === 'ACTIVE' ? '启用' : '停用' }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{ dateTime(detail.certificate.updateTime) }}</el-descriptions-item>
          <el-descriptions-item label="备注">{{ detail.certificate.remark || '-' }}</el-descriptions-item>
        </el-descriptions>
        <el-descriptions title="X.509 属性" :column="1" border class="ca-detail mt12">
          <el-descriptions-item label="版本">{{ detail.version == null ? '-' : `V${detail.version}` }}</el-descriptions-item>
          <el-descriptions-item label="签名算法">{{ detail.signatureAlgorithm || '-' }}</el-descriptions-item>
          <el-descriptions-item label="公钥算法">{{ detail.publicKeyAlgorithm || '-' }}</el-descriptions-item>
          <el-descriptions-item label="密钥用途">{{ detail.keyUsages.join('、') || '未声明' }}</el-descriptions-item>
          <el-descriptions-item label="路径长度约束">{{ detail.parseWarning ? '-' : (detail.pathLength ?? '未限制') }}</el-descriptions-item>
          <el-descriptions-item label="SHA-256 指纹">{{ detail.certificate.fingerprint }}</el-descriptions-item>
        </el-descriptions>
        <el-collapse v-if="detail.certificate.certificatePem" class="mt12">
          <el-collapse-item name="pem" title="PEM 证书正文">
            <el-input :model-value="detail.certificate.certificatePem" type="textarea" :rows="8" readonly />
          </el-collapse-item>
        </el-collapse>
      </template>
    </el-drawer>

    <el-drawer v-model="editOpen" title="维护证书管理信息" size="560px" append-to-body>
      <el-alert
        title="主题、序列号和有效期由证书文件解析，只读展示，避免台账信息与证书本体不一致。"
        type="info"
        :closable="false"
        show-icon
        class="mb12"
      />
      <el-form label-width="95px">
        <el-form-item label="证书名称"><el-input v-model="editForm.displayName" maxlength="200" show-word-limit /></el-form-item>
        <el-form-item label="管理状态"
          ><el-radio-group v-model="editForm.managementStatus"
            ><el-radio value="ACTIVE">启用</el-radio><el-radio value="DISABLED">停用</el-radio></el-radio-group
          ></el-form-item
        >
        <el-form-item label="备注"><el-input v-model="editForm.remark" type="textarea" :rows="4" maxlength="1000" show-word-limit /></el-form-item>
      </el-form>
      <template #footer
        ><el-button @click="editOpen = false">取消</el-button><el-button type="primary" :loading="saving" @click="saveEdit">保存</el-button></template
      >
    </el-drawer>
  </div>
</template>

<script setup name="FawvwCaCert" lang="ts">
import { formatCertificateSubject } from '@/utils/raCertificateSubject';
import CertRowAction from '../components/CertRowAction.vue';
import { notifyBusinessCertificates } from '@/api/ra/businessNoticeSettings';
import { businessCertificateNoticeBlocked } from '@/utils/businessCertificateNotice';
import BusinessNoticeSettingsDialog from '../components/BusinessNoticeSettingsDialog.vue';
import { useRaListRefreshOnReturn } from '@/hooks/useRaListRefreshOnReturn';
import { ElMessage, ElMessageBox, type TableInstance } from 'element-plus';
import { ref, reactive, onMounted, onActivated, nextTick } from 'vue';
import { saveAs } from 'file-saver';
import {
  FawvwCaCertificate,
  FawvwCaCertQuery,
  type FawvwCaCertificateDetail,
  getFawvwCaCertificateDetail,
  importFawvwCaCertificate,
  pageFawvwCaCertificateTree,
  syncFawvwCaCertificates,
  updateFawvwCaCertificate
} from '@/api/ra/fawvwCaCert';
import { getFawvwCaRoots, getFawvwCaChain, removeFawvwCaCertificate, downloadFawvwCaCertificate, type FawvwCaChainEntry } from '@/api/ra/fawvwCaCert';

const rootOptions = ref<{ id: string | number; displayName: string; fingerprint: string }[]>([]);
type ChainNode = FawvwCaCertificate & { linked: boolean; warning: string; children: ChainNode[] };
const chainRows = ref<ChainNode[]>([]);
const chainOpen = ref(false);
const treeTable = ref<TableInstance>();
const businessNoticeSettings = ref<InstanceType<typeof BusinessNoticeSettingsDialog>>();
const sendingNotice = ref(false);

async function sendNotice(row: FawvwCaCertificate) {
  if (row.id == null || sendingNotice.value || businessCertificateNoticeBlocked(row.notAfter)) return;
  if (!(await ElMessageBox.confirm('确认按通知设置发送这张证书的有效期提醒？', '通知确认', { type: 'warning' }).then(() => true, () => false))) return;
  sendingNotice.value = true;
  try {
    const count = unwrap<number>(await notifyBusinessCertificates('root', [row.id]));
    ElMessage.info(count ? '通知已入队' : '没有可发送的通知，请检查通知渠道和收件范围');
  } finally {
    sendingNotice.value = false;
  }
}

async function expandTree() {
  await nextTick();
  const expand = (nodes: ChainNode[]) =>
    nodes.forEach((node) => {
      if (node.children.length) {
        treeTable.value?.toggleRowExpansion(node, true);
        expand(node.children);
      }
    });
  expand(rows.value);
}

function rootName(row: FawvwCaCertificate) {
  const id = row.certificateType === 'ROOT' ? row.id : row.parentId;
  const root = rootOptions.value.find((item) => String(item.id) === String(id));
  return root ? `${root.displayName} · ${root.fingerprint.slice(-17)}` : '所属根缺失';
}

async function openChain(row: FawvwCaCertificate) {
  const entries = unwrap<FawvwCaChainEntry[]>(await getFawvwCaChain(row.id));
  chainRows.value = buildTree(entries);
  chainOpen.value = true;
}

function buildTree(entries: FawvwCaChainEntry[]): ChainNode[] {
  const nodes = new Map(
    entries.map((entry) => [
      String(entry.certificate.id),
      { ...entry.certificate, linked: entry.linked, warning: entry.warning, children: [] as ChainNode[] }
    ])
  );
  const top: ChainNode[] = [];
  for (const entry of entries) {
    const node = nodes.get(String(entry.certificate.id))!;
    const parent = entry.linked && entry.issuerId != null ? nodes.get(String(entry.issuerId)) : undefined;
    if (parent) parent.children.push(node);
    else top.push(node);
  }
  return top;
}

async function downloadCertificate(row: FawvwCaCertificate, format: 'cer' | 'p7b') {
  const blob = (await downloadFawvwCaCertificate(row.id, format)) as unknown as Blob;
  if (blob.type.includes('json')) {
    const error = JSON.parse(await blob.text());
    ElMessage.error(error.msg || error.message || '证书下载失败');
    return;
  }
  saveAs(blob, `ca-${row.id}.${format}`);
}

function canRemoveCertificate(row: ChainNode): boolean {
  return row.certificateType === 'ROOT' ? isRemovableChainMember(row) : row.children.length === 0 && isRemovableChainMember(row);
}

function isRemovableChainMember(row: ChainNode): boolean {
  return row.sourceType === 'IMPORTED' && row.sourceRootId == null && row.children.every(isRemovableChainMember);
}

async function removeCertificate(row: FawvwCaCertificate) {
  const message =
    row.certificateType === 'ROOT'
      ? '移除该根证书及其整条证书链？仅移除本台账，不吊销已签发证书，也不修改管理员根证书。'
      : '从本台账移除该中间证书？不会吊销证书或修改管理员根证书。';
  if (!await ElMessageBox.confirm(message, '移除证书', { type: 'warning' }).then(() => true, () => false)) return;
  await removeFawvwCaCertificate(row.id);
  ElMessage.success('已移除');
  detailOpen.value = false;
  chainOpen.value = false;
  await loadRoots();
  handleQuery();
}

async function loadRoots() {
  rootOptions.value = unwrap<any[]>(await getFawvwCaRoots());
  if (queryParams.rootId != null && !rootOptions.value.some((root) => String(root.id) === String(queryParams.rootId))) queryParams.rootId = undefined;
}

const rows = ref<ChainNode[]>([]);
const loading = ref(false);
const total = ref(0);
const showSearch = ref(true);
const importOpen = ref(false);
const importing = ref(false);
const detailOpen = ref(false);
const editOpen = ref(false);
const saving = ref(false);
const detail = ref<FawvwCaCertificateDetail>();
const detailChain = ref<Pick<ChainNode, 'linked' | 'warning'>>();
const rootFile = ref<File>();
const chainFile = ref<File>();
const editForm = reactive({
  id: undefined as string | number | undefined,
  displayName: '',
  managementStatus: 'ACTIVE' as 'ACTIVE' | 'DISABLED',
  remark: ''
});
const queryParams = reactive<FawvwCaCertQuery>({
  pageNum: 1,
  pageSize: 10,
  keyword: '',
  certificateType: '',
  validityStatus: '',
  managementStatus: ''
});
const expiryRange = ref<[string, string] | null>(null);

function unwrap<T>(res: any): T {
  const body = res?.data ?? res;
  return (body?.data ?? body) as T;
}

async function loadList() {
  loading.value = true;
  try {
    const page = unwrap<any>(
      await pageFawvwCaCertificateTree({ ...queryParams, expiresFrom: expiryRange.value?.[0], expiresTo: expiryRange.value?.[1] })
    );
    const families: FawvwCaChainEntry[][] = page.records || page.rows || [];
    rows.value = families.flatMap(buildTree);
    total.value = Number(page.total || 0);
    await expandTree();
  } finally {
    loading.value = false;
  }
}

function handleQuery() {
  queryParams.pageNum = 1;
  loadList();
}
function resetQuery() {
  Object.assign(queryParams, {
    pageNum: 1,
    pageSize: queryParams.pageSize,
    keyword: '',
    certificateType: '',
    validityStatus: '',
    managementStatus: '',
    issuer: '',
    sourceType: '',
    rootId: undefined
  });
  expiryRange.value = null;
  loadList();
}
function resetImport() {
  rootFile.value = undefined;
  chainFile.value = undefined;
}

async function handleSync() {
  await ElMessageBox.confirm('同步仅读取当前 RA 的根证书和证书链，不会修改 CA 管理数据。确认同步？', '同步当前RA证书', { type: 'warning' });
  const result = unwrap<any>(await syncFawvwCaCertificates());
  await loadRoots();
  const summary = `同步完成：根证书 ${result.rootCount || 0} 个，中间证书 ${result.intermediateCount || 0} 个`;
  if (result.invalidCount) {
    ElMessage.warning(`${summary}，${result.invalidCount} 条未同步；${(result.warnings || []).join('；')}`);
  } else {
    ElMessage.success(summary);
  }
  loadList();
}

async function handleImport() {
  if (!rootFile.value) {
    ElMessage.warning('请选择根证书文件');
    return;
  }
  const data = new FormData();
  data.append('rootCertificate', rootFile.value);
  if (chainFile.value) data.append('certificateChain', chainFile.value);
  importing.value = true;
  try {
    const result = unwrap<any>(await importFawvwCaCertificate(data));
    await loadRoots();
    ElMessage.success(`导入成功，已关联 ${result.intermediateCount || 0} 张中间证书`);
    importOpen.value = false;
    loadList();
  } finally {
    importing.value = false;
  }
}

async function openDetail(row: ChainNode) {
  detail.value = unwrap<FawvwCaCertificateDetail>(await getFawvwCaCertificateDetail(row.id));
  detailChain.value = { linked: row.linked, warning: row.warning };
  detailOpen.value = true;
}
function openEdit(row: FawvwCaCertificate) {
  Object.assign(editForm, { id: row.id, displayName: row.displayName, managementStatus: row.managementStatus, remark: row.remark || '' });
  editOpen.value = true;
}
async function saveEdit() {
  if (!editForm.id || !editForm.displayName.trim()) {
    ElMessage.warning('请输入证书名称');
    return;
  }
  saving.value = true;
  try {
    await updateFawvwCaCertificate(editForm as any);
    await loadRoots();
    ElMessage.success('证书管理信息已保存');
    editOpen.value = false;
    loadList();
  } finally {
    saving.value = false;
  }
}
function dateTime(value?: string) {
  return value ? String(value).replace('T', ' ').slice(0, 19) : '-';
}
function validityTag(status?: string) {
  return ({ VALID: 'success', EXPIRING: 'warning', EXPIRED: 'danger', NOT_YET_VALID: 'info' } as Record<string, string>)[status || ''] || 'info';
}

onActivated(expandTree);
onMounted(async () => {
  await loadRoots();
  await loadList();
});
useRaListRefreshOnReturn(async () => {
  await loadRoots();
  await loadList();
});
</script>

<style scoped lang="scss">
.fawvw-ca-cert-page {
  .query-card {
    margin-bottom: 12px;
  }
  .query-form {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 310px), 1fr));
    gap: 12px 16px;

    :deep(.el-form-item) {
      min-width: 0;
      margin-bottom: 0;
    }

    :deep(.el-select),
    :deep(.el-date-editor) {
      width: 100%;
      min-width: 0;
    }

    .query-actions :deep(.el-form-item__content) {
      justify-content: flex-end;
    }
  }

  @media (max-width: 560px) {
    .query-form :deep(.el-form-item:not(.query-actions)) {
      display: block;
    }
    .query-form :deep(.el-form-item__label) {
      justify-content: flex-start;
    }
    .query-form :deep(.el-form-item__content) {
      margin-left: 0 !important;
    }
  }
  .toolbar-row {
    align-items: center;
  }
}

.ca-detail {
  :deep(.el-descriptions__label) {
    width: 120px;
  }

  :deep(.el-descriptions__content) {
    overflow-wrap: anywhere;
  }
}

</style>
