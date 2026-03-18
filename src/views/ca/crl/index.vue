<script setup name="CrlManagement" lang="ts">
import { ref, reactive, toRefs, getCurrentInstance, ComponentInternalInstance, nextTick } from 'vue'
import { ElMessage, ElMessageBox, FormInstance, FormRules, UploadProps, UploadUserFile } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import { to } from 'await-to-js'
import { pageCrl, getCrl, saveCrl, modifyCrl, removeCrl, importCrl, exportCrl } from '@/api/crl'
import { CrlForm, CrlQuery } from '@/api/crl/types'

const { proxy } = getCurrentInstance() as ComponentInternalInstance

const crlList = ref<any[]>([])
const loading = ref(true)
const showSearch = ref(true)
const ids = ref<Array<string | number>>([])
const single = ref(true)
const multiple = ref(true)
const total = ref(0)

const queryFormRef = ref<FormInstance>()
const crlFormRef = ref<FormInstance>()
const formDialogRef = ref<any>()

const dialog = reactive({
  visible: false,
  title: ''
})

const uploadDialog = reactive({
  visible: false,
  loading: false,
  fileList: [] as UploadUserFile[]
})

const initFormData: CrlForm = {
  id: undefined,
  crlName: '',
  issuer: '',
  crl: '',
  status: '0',
  thisUpdate: '',
  nextUpdate: '',
  remark: ''
}

const data = reactive({
  form: { ...initFormData },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    crlName: '',
    issuer: '',
    status: ''
  } as CrlQuery
})

const { queryParams, form } = toRefs(data)

const crlRules: FormRules = {
  crlName: [{ required: true, message: 'CRL名称不能为空', trigger: 'blur' }],
  issuer: [{ required: true, message: '颁发者不能为空', trigger: 'blur' }]
}

/** 查询CRL列表 */
async function getList() {
  loading.value = true
  try {
    const res = await pageCrl(queryParams.value)
    crlList.value = []
    total.value = res.data.total || 0
    await nextTick()
    crlList.value = res.data.rows || res.data.records || []
  } catch (error) {
    console.error('获取列表失败', error)
  } finally {
    loading.value = false
  }
}

/** 搜索按钮操作 */
function handleQuery() {
  queryParams.value.pageNum = 1
  getList()
}

/** 重置按钮操作 */
function resetQuery() {
  queryFormRef.value?.resetFields()
  handleQuery()
}

/** 多选框选中数据 */
function handleSelectionChange(selection: any[]) {
  ids.value = selection.map(item => item.id)
  single.value = selection.length !== 1
  multiple.value = !selection.length
}

/** 新增按钮操作 */
function handleAdd() {
  reset()
  dialog.visible = true
  dialog.title = '新增CRL'
}

/** 修改按钮操作 */
async function handleUpdate(row?: any) {
  reset()
  const id = row?.id || ids.value[0]
  try {
    const { data } = await getCrl(id)
    dialog.visible = true
    dialog.title = '修改CRL'
    Object.assign(form.value, data)
  } catch (error) {
    ElMessage.error('获取CRL信息失败')
  }
}

/** 提交按钮 */
async function submitForm() {
  crlFormRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      try {
        if (form.value.id) {
          await modifyCrl(form.value)
        } else {
          await saveCrl(form.value)
        }
        proxy?.$modal.msgSuccess('操作成功')
        dialog.visible = false
        await getList()
      } catch (error) {
        console.error('操作失败', error)
      }
    }
  })
}

/** 删除按钮操作 */
async function handleDelete(row?: any) {
  const crlIds = row?.id || ids.value
  const [err] = await to(proxy?.$modal.confirm('是否确认删除CRL编号为"' + crlIds + '"的数据项？') as any)
  if (!err) {
    try {
      await removeCrl(Array.isArray(crlIds) ? crlIds : [crlIds])
      await getList()
      proxy?.$modal.msgSuccess('删除成功')
    } catch (error) {
      console.error('删除失败', error)
    }
  }
}

/** 导入按钮操作 */
function handleImport() {
  uploadDialog.visible = true
  uploadDialog.fileList = []
}

/** 导入CRL */
async function submitImport() {
  if (uploadDialog.fileList.length === 0) {
    ElMessage.warning('请选择要导入的CRL文件')
    return
  }

  uploadDialog.loading = true
  try {
    const formData = new FormData()
    uploadDialog.fileList.forEach(file => {
      if (file.raw) {
        formData.append('files', file.raw)
      }
    })
    await importCrl(formData)
    ElMessage.success('导入成功')
    uploadDialog.visible = false
    await getList()
  } catch (error) {
    ElMessage.error('导入失败')
  } finally {
    uploadDialog.loading = false
  }
}

/** 导出按钮操作 */
async function handleExport() {
  if (ids.value.length === 0) {
    ElMessage.warning('请选择要导出的CRL')
    return
  }

  try {
    const blob = await exportCrl(ids.value)
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `crl_${new Date().getTime()}.zip`
    link.click()
    window.URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (error) {
    ElMessage.error('导出失败')
  }
}

/** 重置操作表单 */
function reset() {
  form.value = { ...initFormData }
  crlFormRef.value?.resetFields()
}

/** 关闭对话框 */
function cancel() {
  dialog.visible = false
  reset()
}

/** 文件上传前校验 */
const beforeUpload: UploadProps['beforeUpload'] = (file) => {
  const isCrl = file.name.endsWith('.crl') || file.name.endsWith('.pem') || file.name.endsWith('.der')
  if (!isCrl) {
    ElMessage.error('只支持上传CRL文件')
    return false
  }
  return true
}

/** 文件上传 */
const handleFileChange: UploadProps['onChange'] = (uploadFile, uploadFiles) => {
  uploadDialog.fileList = uploadFiles
}

getList()
</script>

<template>
  <div class="p-2">
    <transition :enter-active-class="proxy?.animate.searchAnimate.enter"
                :leave-active-class="proxy?.animate.searchAnimate.leave">
      <div v-show="showSearch" class="mb-10px">
        <el-card shadow="hover">
          <el-form ref="queryFormRef" :model="queryParams" :inline="true">
            <el-form-item label="CRL名称" prop="crlName">
              <el-input v-model="queryParams.crlName" placeholder="请输入CRL名称" clearable
                        @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="颁发者" prop="issuer">
              <el-input v-model="queryParams.issuer" placeholder="请输入颁发者" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="状态" prop="status">
              <el-select v-model="queryParams.status" placeholder="CRL状态" clearable>
                <el-option label="正常" value="0" />
                <el-option label="已过期" value="1" />
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
            <el-button type="primary" plain icon="Plus" @click="handleAdd">新增</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate">修改</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete">删除</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="warning" plain icon="Upload" @click="handleImport">导入</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button type="info" plain icon="Download" :disabled="multiple" @click="handleExport">导出</el-button>
          </el-col>
          <right-toolbar v-model:show-search="showSearch" @query-table="getList"></right-toolbar>
        </el-row>
      </template>

      <el-table v-loading="loading" border :data="crlList" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="50" align="center" />
        <el-table-column label="CRL名称" align="center" prop="crlName" width="200" :show-overflow-tooltip="true" />
        <el-table-column label="颁发者" align="center" prop="issuer" width="250" :show-overflow-tooltip="true" />
        <el-table-column label="本次更新时间" align="center" prop="thisUpdate" width="180" />
        <el-table-column label="下次更新时间" align="center" prop="nextUpdate" width="180" />
        <el-table-column label="状态" align="center" prop="status" width="100">
          <template #default="scope">
            <el-tag v-if="scope.row.status === '0'" type="success">正常</el-tag>
            <el-tag v-else type="danger">已过期</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="150" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-tooltip content="修改" placement="top">
              <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)"></el-button>
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)"></el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize"
                  :total="total" @pagination="getList" />
    </el-card>

    <!-- 添加或修改CRL对话框 -->
    <el-dialog ref="formDialogRef" v-model="dialog.visible" :title="dialog.title" width="600px" append-to-body
               @close="cancel">
      <el-form ref="crlFormRef" :model="form" :rules="crlRules" label-width="120px">
        <el-row>
          <el-col :span="24">
            <el-form-item label="CRL名称" prop="crlName">
              <el-input v-model="form.crlName" placeholder="请输入CRL名称" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="24">
            <el-form-item label="颁发者" prop="issuer">
              <el-input v-model="form.issuer" placeholder="请输入颁发者" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="24">
            <el-form-item label="状态" prop="status">
              <el-select v-model="form.status" placeholder="请选择状态" style="width: 100%">
                <el-option label="正常" value="0" />
                <el-option label="已过期" value="1" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="24">
            <el-form-item label="CRL内容" prop="crl">
              <el-input v-model="form.crl" type="textarea" :rows="10" placeholder="请输入CRL内容" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input v-model="form.remark" type="textarea" placeholder="请输入备注" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 导入CRL对话框 -->
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

<style scoped lang="scss">
</style>
