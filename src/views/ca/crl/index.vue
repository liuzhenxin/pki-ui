<script setup name="CrlManagement" lang="ts">
import { ComponentInternalInstance, getCurrentInstance, nextTick, reactive, ref, toRefs } from 'vue';
import { ElMessage, FormInstance, FormRules, UploadProps, UploadUserFile } from 'element-plus';
import { UploadFilled } from '@element-plus/icons-vue';
import { to } from 'await-to-js';
import { exportCrl, genCrl, getCrl, importCrl, pageCrl, publishCrl, removeCrl } from '@/api/crl';
import { CrlGenForm, CrlPublishForm, CrlQuery } from '@/api/crl/types';
import { listRootCa } from '@/api/ca/root';
import { pagePublisher } from '@/api/ca/publisher';
import { parseTime } from '@/utils/ruoyi';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const crlList = ref<any[]>([]);
const rootList = ref<any[]>([]);
const publisherList = ref<any[]>([]);
const publishRecords = ref<any[]>([]);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref<Array<string | number>>([]);
const multiple = ref(true);
const total = ref(0);

const queryFormRef = ref<FormInstance>();
const issueFormRef = ref<FormInstance>();

const issueDialog = reactive({
  visible: false,
  loading: false
});

const publishDialog = reactive({
  visible: false,
  loading: false
});

const detailDialog = reactive({
  visible: false,
  title: 'CRL详情',
  data: {} as any
});

const uploadDialog = reactive({
  visible: false,
  loading: false,
  fileList: [] as UploadUserFile[]
});

const data = reactive({
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    rootId: undefined,
    crlNo: '',
    deltaCrl: ''
  } as CrlQuery,
  issueForm: {
    rootId: undefined,
    crlScope: 0,
    deltaCrl: false
  } as CrlGenForm,
  publishForm: {
    crlId: undefined,
    publisherId: undefined
  } as CrlPublishForm
});

const { queryParams, issueForm, publishForm } = toRefs(data);

const issueRules: FormRules = {
  rootId: [{ required: true, message: '请选择根CA', trigger: 'change' }]
};

function formatCrlType(row: any) {
  return Number(row.deltaCrl) === 1 || row.deltaCrl === true ? '增量CRL' : '全量CRL';
}

function getRootName(rootId: string | number) {
  const root = rootList.value.find((item: any) => item.id === rootId);
  return root?.name || rootId;
}

function getPublisherName(publisherId?: string | number) {
  if (!publisherId) {
    return 'CA关联发布者';
  }
  const publisher = publisherList.value.find((item: any) => item.id === publisherId);
  return publisher?.name || publisherId;
}

function addPublishRecord(record: any) {
  publishRecords.value.unshift({
    time: parseTime(new Date(), '{h}:{i}:{s}'),
    ...record
  });
  publishRecords.value = publishRecords.value.slice(0, 10);
}

async function loadOptions() {
  try {
    const [rootRes, publisherRes] = await Promise.all([
      listRootCa({ pageNum: 1, pageSize: 200 }),
      pagePublisher({ pageNum: 1, pageSize: 200, status: '0' })
    ]);
    rootList.value = rootRes.data?.rows || rootRes.data?.records || [];
    publisherList.value = publisherRes.data?.rows || publisherRes.data?.records || [];
  } catch (error) {
    rootList.value = [];
    publisherList.value = [];
  }
}

/** 查询CRL列表 */
async function getList() {
  loading.value = true;
  try {
    const res = await pageCrl(queryParams.value);
    crlList.value = [];
    total.value = res.data?.total || 0;
    await nextTick();
    crlList.value = res.data?.rows || res.data?.records || [];
  } catch (error) {
  } finally {
    loading.value = false;
  }
}

function handleQuery() {
  queryParams.value.pageNum = 1;
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

function handleIssue() {
  issueForm.value = {
    rootId: queryParams.value.rootId,
    crlScope: 0,
    deltaCrl: false
  };
  issueDialog.visible = true;
}

async function submitIssue() {
  issueFormRef.value?.validate(async (valid: boolean) => {
    if (!valid) return;
    issueDialog.loading = true;
    try {
      const res = await genCrl(issueForm.value);
      ElMessage.success(issueForm.value.deltaCrl ? '增量CRL签发成功' : '全量CRL签发成功');
      addPublishRecord({
        action: issueForm.value.deltaCrl ? '签发增量' : '签发全量',
        crlNo: res.data?.crlNo || res.data?.id || '-',
        publisherName: '-',
        status: '成功',
        message: 'CRL已生成'
      });
      issueDialog.visible = false;
      await getList();
    } catch (error: any) {
      ElMessage.error(error.response?.data?.msg || error.message || '签发CRL失败');
    } finally {
      issueDialog.loading = false;
    }
  });
}

function handlePublish(row: any) {
  publishForm.value = {
    crlId: row.id,
    publisherId: undefined
  };
  detailDialog.data = row;
  publishDialog.visible = true;
}

async function submitPublish() {
  if (!publishForm.value.crlId) return;
  publishDialog.loading = true;
  try {
    await publishCrl(publishForm.value);
    addPublishRecord({
      action: '发布CRL',
      crlNo: detailDialog.data?.crlNo || publishForm.value.crlId,
      publisherName: getPublisherName(publishForm.value.publisherId),
      status: '成功',
      message: '已提交发布'
    });
    ElMessage.success('CRL发布成功');
    publishDialog.visible = false;
  } catch (error: any) {
    addPublishRecord({
      action: '发布CRL',
      crlNo: detailDialog.data?.crlNo || publishForm.value.crlId,
      publisherName: getPublisherName(publishForm.value.publisherId),
      status: '失败',
      message: error.response?.data?.msg || error.message || 'CRL发布失败'
    });
    ElMessage.error(error.response?.data?.msg || error.message || 'CRL发布失败');
  } finally {
    publishDialog.loading = false;
  }
}

async function handleDetail(row: any) {
  try {
    const res = await getCrl(row.id);
    detailDialog.data = res.data || row;
  } catch (error) {
    detailDialog.data = row;
  }
  detailDialog.title = `CRL详情 - ${detailDialog.data.crlNo || row.id}`;
  detailDialog.visible = true;
}

async function handleDelete(row?: any) {
  const crlIds = row?.id || ids.value;
  const [err] = await to(proxy?.$modal.confirm('是否确认删除CRL编号为"' + crlIds + '"的数据项？') as any);
  if (!err) {
    try {
      await removeCrl(Array.isArray(crlIds) ? crlIds : [crlIds]);
      await getList();
      proxy?.$modal.msgSuccess('删除成功');
    } catch (error) {}
  }
}

function handleImport() {
  uploadDialog.visible = true;
  uploadDialog.fileList = [];
}

async function submitImport() {
  if (uploadDialog.fileList.length === 0) {
    ElMessage.warning('请选择要导入的CRL文件');
    return;
  }

  uploadDialog.loading = true;
  try {
    const formData = new FormData();
    uploadDialog.fileList.forEach((file) => {
      if (file.raw) {
        formData.append('files', file.raw);
      }
    });
    await importCrl(formData);
    ElMessage.success('导入成功');
    uploadDialog.visible = false;
    await getList();
  } catch (error) {
    ElMessage.error('导入失败');
  } finally {
    uploadDialog.loading = false;
  }
}

async function handleExport() {
  try {
    const blob = await exportCrl(queryParams.value);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `crl_${new Date().getTime()}.zip`;
    link.click();
    window.URL.revokeObjectURL(url);
    ElMessage.success('导出成功');
  } catch (error) {
    ElMessage.error('导出失败');
  }
}

const beforeUpload: UploadProps['beforeUpload'] = (file) => {
  const isCrl = file.name.endsWith('.crl') || file.name.endsWith('.pem') || file.name.endsWith('.der');
  if (!isCrl) {
    ElMessage.error('只支持上传CRL文件');
    return false;
  }
  return true;
};

const handleFileChange: UploadProps['onChange'] = (_uploadFile, uploadFiles) => {
  uploadDialog.fileList = uploadFiles;
};

loadOptions();
getList();
</script>

<template>
  <div class="p-2">
    <transition :enter-active-class="proxy?.animate.searchAnimate.enter" :leave-active-class="proxy?.animate.searchAnimate.leave">
      <div v-show="showSearch" class="mb-10px">
        <el-card shadow="hover">
          <el-form ref="queryFormRef" :model="queryParams" :inline="true">
            <el-form-item label="根CA" prop="rootId">
              <el-select v-model="queryParams.rootId" placeholder="请选择根CA" clearable filterable style="width: 220px">
                <el-option v-for="item in rootList" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="CRL编号" prop="crlNo">
              <el-input v-model="queryParams.crlNo" placeholder="请输入CRL编号" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="CRL类型" prop="deltaCrl">
              <el-select v-model="queryParams.deltaCrl" placeholder="CRL类型" clearable style="width: 140px">
                <el-option label="全量CRL" :value="0" />
                <el-option label="增量CRL" :value="1" />
              </el-select>
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
            <el-button type="primary" plain icon="Stamp" @click="handleIssue" v-hasPermi="['ca:crl:issue']">签发CRL</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete" v-hasPermi="['ca:crl:remove']">删除</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="warning" plain icon="Upload" @click="handleImport" v-hasPermi="['ca:crl:import']">导入</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="info" plain icon="Download" @click="handleExport" v-hasPermi="['ca:crl:export']">导出查询</el-button>
          </el-col>
          <right-toolbar v-model:show-search="showSearch" @query-table="getList"></right-toolbar>
        </el-row>
      </template>

      <el-table v-loading="loading" border :data="crlList" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="50" align="center" />
        <el-table-column label="CRL编号" align="center" prop="crlNo" width="130" :show-overflow-tooltip="true" />
        <el-table-column label="根CA" align="center" prop="rootId" min-width="180" :show-overflow-tooltip="true">
          <template #default="scope">{{ getRootName(scope.row.rootId) }}</template>
        </el-table-column>
        <el-table-column label="类型" align="center" prop="deltaCrl" width="100">
          <template #default="scope">
            <el-tag :type="Number(scope.row.deltaCrl) === 1 ? 'warning' : 'success'">{{ formatCrlType(scope.row) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Scope" align="center" prop="crlScope" width="90" />
        <el-table-column label="本次更新时间" align="center" prop="thisUpdate" width="180" />
        <el-table-column label="下次更新时间" align="center" prop="nextBefore" width="180" />
        <el-table-column label="Base CRL编号" align="center" prop="baseCrlNo" width="130" />
        <el-table-column label="SHA1" align="center" prop="sha1" min-width="220" :show-overflow-tooltip="true" />
        <el-table-column label="操作" fixed="right" width="190" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-button link type="primary" icon="View" @click="handleDetail(scope.row)" v-hasPermi="['ca:crl:detail']">详情</el-button>
            <el-button link type="success" icon="Promotion" @click="handlePublish(scope.row)" v-hasPermi="['ca:crl:publish']">发布</el-button>
            <el-button link type="danger" icon="Delete" @click="handleDelete(scope.row)" v-hasPermi="['ca:crl:remove']">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />
    </el-card>

    <el-card class="mt-10px" shadow="hover">
      <template #header>发布记录</template>
      <el-table :data="publishRecords" border size="small" empty-text="暂无本次操作记录">
        <el-table-column label="时间" prop="time" width="150" />
        <el-table-column label="操作" prop="action" width="120" />
        <el-table-column label="CRL编号" prop="crlNo" width="130" />
        <el-table-column label="发布目标" prop="publisherName" min-width="180" show-overflow-tooltip />
        <el-table-column label="结果" prop="status" width="90">
          <template #default="scope">
            <el-tag :type="scope.row.status === '成功' ? 'success' : 'danger'">{{ scope.row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="说明" prop="message" min-width="220" show-overflow-tooltip />
      </el-table>
    </el-card>

    <el-dialog v-model="issueDialog.visible" title="签发CRL" width="560px" append-to-body>
      <el-form ref="issueFormRef" :model="issueForm" :rules="issueRules" label-width="120px">
        <el-form-item label="根CA" prop="rootId">
          <el-select v-model="issueForm.rootId" placeholder="请选择根CA" filterable style="width: 100%">
            <el-option v-for="item in rootList" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="CRL Scope">
          <el-input-number v-model="issueForm.crlScope" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="CRL类型">
          <el-radio-group v-model="issueForm.deltaCrl">
            <el-radio-button :value="false">全量CRL</el-radio-button>
            <el-radio-button :value="true">增量CRL</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" :loading="issueDialog.loading" @click="submitIssue">签 发</el-button>
          <el-button @click="issueDialog.visible = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="publishDialog.visible" title="发布CRL" width="560px" append-to-body>
      <el-form :model="publishForm" label-width="120px">
        <el-form-item label="CRL编号">
          <el-input :model-value="detailDialog.data?.crlNo || publishForm.crlId" disabled />
        </el-form-item>
        <el-form-item label="目标发布者">
          <el-select v-model="publishForm.publisherId" placeholder="不选择则发布到CA关联发布者" clearable filterable style="width: 100%">
            <el-option v-for="item in publisherList" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" :loading="publishDialog.loading" @click="submitPublish">发 布</el-button>
          <el-button @click="publishDialog.visible = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="detailDialog.visible" :title="detailDialog.title" width="760px" append-to-body>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="CRL编号">{{ detailDialog.data?.crlNo }}</el-descriptions-item>
        <el-descriptions-item label="根CA">{{ getRootName(detailDialog.data?.rootId) }}</el-descriptions-item>
        <el-descriptions-item label="CRL类型">{{ formatCrlType(detailDialog.data || {}) }}</el-descriptions-item>
        <el-descriptions-item label="CRL Scope">{{ detailDialog.data?.crlScope }}</el-descriptions-item>
        <el-descriptions-item label="本次更新时间">{{ detailDialog.data?.thisUpdate }}</el-descriptions-item>
        <el-descriptions-item label="下次更新时间">{{ detailDialog.data?.nextBefore }}</el-descriptions-item>
        <el-descriptions-item label="Base CRL编号">{{ detailDialog.data?.baseCrlNo || '-' }}</el-descriptions-item>
        <el-descriptions-item label="SHA1">{{ detailDialog.data?.sha1 }}</el-descriptions-item>
      </el-descriptions>
      <el-input class="mt-10px" :model-value="detailDialog.data?.crl" type="textarea" :rows="12" readonly placeholder="暂无CRL内容" />
    </el-dialog>

    <el-dialog v-model="uploadDialog.visible" title="导入CRL" width="600px" append-to-body>
      <el-upload
        drag
        :auto-upload="false"
        :file-list="uploadDialog.fileList"
        :on-change="handleFileChange"
        :before-upload="beforeUpload"
        multiple
        accept=".crl,.pem,.der"
      >
        <el-icon class="el-icon--upload">
          <upload-filled />
        </el-icon>
        <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
        <template #tip>
          <div class="el-upload__tip">支持 .crl, .pem, .der 格式的CRL文件</div>
        </template>
      </el-upload>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" :loading="uploadDialog.loading" @click="submitImport">确 定</el-button>
          <el-button @click="uploadDialog.visible = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>
