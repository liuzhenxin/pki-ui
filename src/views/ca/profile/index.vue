<script setup name="CertProfileManagement" lang="ts">
import { ref, reactive, toRefs, getCurrentInstance, ComponentInternalInstance, nextTick } from 'vue'
import { ElMessage, ElMessageBox, FormInstance, FormRules, UploadProps, UploadUserFile } from 'element-plus'
import { UploadFilled, View, Plus, Delete, Top, Bottom } from '@element-plus/icons-vue'
import { to } from 'await-to-js'
import { useRouter } from 'vue-router'
import {
  pageProfile,
  getProfile,
  saveProfile,
  modifyProfile,
  removeProfile,
  importProfile,
  exportProfile
} from '@/api/ca/profile'
import { ProfileForm, ProfileQuery } from '@/api/ca/profile/types'
import CertProfile from '@/components/CertProfile/index.vue'

const { proxy } = getCurrentInstance() as ComponentInternalInstance
const router = useRouter()

const profileList = ref<any[]>([])
const loading = ref(true)
const showSearch = ref(true)
const ids = ref<Array<string | number>>([])
const single = ref(true)
const multiple = ref(true)
const total = ref(0)
const activeTab = ref('basic')

const queryFormRef = ref<FormInstance>()
const profileFormRef = ref<FormInstance>()
const formDialogRef = ref<any>()

const dialog = reactive({
  visible: false,
  title: ''
})

const detailDialog = reactive({
  visible: false,
  data: null as any,
  confData: null as any
})

const uploadDialog = reactive({
  visible: false,
  loading: false,
  fileList: [] as UploadUserFile[]
})

const initFormData: ProfileForm = {
  id: undefined,
  name: '',
  type: '',
  certLevel: '',
  description: '',
  conf: '',
  subjectItems: [] as any[],
  extensions: [] as any[]
}

const extensionTypes = [
  { label: '基本约束', value: 'BasicConstraints' },
  { label: '密钥用法', value: 'KeyUsage' },
  { label: '增强密钥用法', value: 'ExtendedKeyUsage' },
  { label: '主体密钥标识符', value: 'SubjectKeyIdentifier' },
  { label: '颁发机构密钥标识符', value: 'AuthorityKeyIdentifier' },
  { label: 'CRL分发点', value: 'CRLDistributionPoints' },
  { label: '授权信息访问', value: 'AuthorityInfoAccess' },
  { label: '主体备用名称', value: 'SubjectAlternativeName' },
  { label: '颁发者备用名称', value: 'IssuerAlternativeName' },
  { label: '证书策略', value: 'CertificatePolicies' }
]

// 常用OID列表
const commonOIDs = [
  { oid: '2.5.4.6', description: 'C (国家)' },
  { oid: '2.5.4.10', description: 'O (组织)' },
  { oid: '2.5.4.11', description: 'OU (组织单位)' },
  { oid: '2.5.4.3', description: 'CN (通用名称)' },
  { oid: '2.5.4.8', description: 'ST (省/州)' },
  { oid: '2.5.4.7', description: 'L (城市)' },
  { oid: '2.5.4.5', description: 'SN (序列号)' },
  { oid: '1.2.840.113549.1.9.1', description: 'E (邮箱)' },
  { oid: '2.5.4.42', description: 'GN (名字)' },
  { oid: '2.5.4.4', description: 'SN (姓氏)' },
  { oid: '2.5.4.12', description: 'T (头衔)' },
  { oid: '0.9.2342.19200300.100.1.1', description: 'UID (用户ID)' },
  { oid: '2.5.4.13', description: 'Description (描述)' },
  { oid: '2.5.4.9', description: 'streetAddress (街道地址)' },
  { oid: '2.5.4.17', description: 'postalCode (邮政编码)' }
]

const data = reactive({
  form: { ...initFormData },
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    name: '',
    type: ''
  } as ProfileQuery
})

const { queryParams, form } = toRefs(data)

const profileRules: FormRules = {
  name: [{ required: true, message: '模板名称不能为空', trigger: 'blur' }],
  type: [{ required: true, message: '模板类型不能为空', trigger: 'change' }]
}

/** 查询证书模板列表 */
async function getList() {
  loading.value = true
  try {
    const res = await pageProfile(queryParams.value)
    profileList.value = []
    total.value = res.data.total || 0
    await nextTick()
    profileList.value = res.data.rows || res.data.records || []
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
  router.push('/ca/profile/form')
}

/** 删除按钮操作 */
async function handleDelete(row?: any) {
  const profileIds = row?.id || ids.value
  const [err] = await to(proxy?.$modal.confirm('是否确认删除证书模板编号为"' + profileIds + '"的数据项？') as any)
  if (!err) {
    try {
      await removeProfile(Array.isArray(profileIds) ? profileIds : [profileIds])
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

/** 导入证书模板 */
async function submitImport() {
  if (uploadDialog.fileList.length === 0) {
    ElMessage.warning('请选择要导入的证书模板文件')
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
    await importProfile(formData)
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
    ElMessage.warning('请选择要导出的证书模板')
    return
  }

  try {
    const blob = await exportProfile(ids.value)
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `profiles_${new Date().getTime()}.zip`
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
  form.value.subjectItems = []
  form.value.extensions = []
  profileFormRef.value?.resetFields()
  activeTab.value = 'basic'
}

/** 关闭对话框 */
function cancel() {
  dialog.visible = false
  reset()
}

/** 获取扩展标签 */
function getExtensionLabel(type: string): string {
  const ext = extensionTypes.find(e => e.value === type)
  return ext ? ext.label : type
}

/** 添加扩展 */
function addExtension() {
  if (!form.value.extensions) {
    form.value.extensions = []
  }
  form.value.extensions.push({
    type: '',
    required: false,
    critical: false,
    config: ''
  })
}

/** 删除扩展 */
function removeExtension(index: number) {
  form.value.extensions.splice(index, 1)
}

/** 添加RDN */
function addRdn() {
  if (!form.value.subjectItems) {
    form.value.subjectItems = []
  }
  form.value.subjectItems.push({
    type: {
      oid: '',
      description: ''
    }
  })
}

/** 删除RDN */
function removeRdn(index: number) {
  form.value.subjectItems.splice(index, 1)
}

/** 上移RDN */
function moveUp(index: number) {
  if (index > 0) {
    const temp = form.value.subjectItems[index]
    form.value.subjectItems[index] = form.value.subjectItems[index - 1]
    form.value.subjectItems[index - 1] = temp
  }
}

/** 下移RDN */
function moveDown(index: number) {
  if (index < form.value.subjectItems.length - 1) {
    const temp = form.value.subjectItems[index]
    form.value.subjectItems[index] = form.value.subjectItems[index + 1]
    form.value.subjectItems[index + 1] = temp
  }
}

/** 添加常用OID */
function addCommonRdn(common: { oid: string; description: string }) {
  if (!form.value.subjectItems) {
    form.value.subjectItems = []
  }
  form.value.subjectItems.push({
    type: {
      oid: common.oid,
      description: common.description
    }
  })
}

/** 修改按钮操作 */
function handleUpdate(row?: any) {
  const id = row?.id || ids.value[0]
  router.push({
    path: '/ca/profile/form',
    query: { id }
  })
}

/** 详情按钮操作 */
async function handleDetail(row: any) {
  try {
    const { data } = await getProfile(row.id)
    detailDialog.data = data
    
    // 解析conf字段
    if (data.conf) {
      const conf = typeof data.conf === 'string' ? JSON.parse(data.conf) : data.conf
      detailDialog.confData = conf
    }
    
    detailDialog.visible = true
  } catch (error) {
    ElMessage.error('获取证书模板详情失败')
  }
}

/** 提交按钮 */
async function submitForm() {
  profileFormRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      try {
        // 构建conf对象
        const conf = {
          subject: {
            rdns: form.value.subjectItems || []
          },
          extensions: form.value.extensions || []
        }

        const submitData = {
          ...form.value,
          conf: JSON.stringify(conf)
        }

        if (form.value.id) {
          await modifyProfile(submitData)
        } else {
          await saveProfile(submitData)
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

/** 文件上传前校验 */
const beforeUpload: UploadProps['beforeUpload'] = (file) => {
  const isJson = file.name.endsWith('.json') || file.name.endsWith('.xml')
  if (!isJson) {
    ElMessage.error('只支持上传JSON或XML文件')
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
            <el-form-item label="模板名称" prop="name">
              <el-input v-model="queryParams.name" placeholder="请输入模板名称" clearable @keyup.enter="handleQuery" />
            </el-form-item>
            <el-form-item label="模板类型" prop="type">
              <el-select v-model="queryParams.type" placeholder="模板类型" clearable>
                <el-option label="RootCA" value="RootCA" />
                <el-option label="IntermediateCA" value="IntermediateCA" />
                <el-option label="EndEntity" value="EndEntity" />
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

      <el-table v-loading="loading" border :data="profileList" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="50" align="center" />
        <el-table-column label="模板名称" align="center" prop="name" width="200" :show-overflow-tooltip="true" />
        <el-table-column label="模板类型" align="center" prop="type" width="150">
          <template #default="scope">
            <el-tag v-if="scope.row.type === 'RootCA'" type="danger">根CA</el-tag>
            <el-tag v-else-if="scope.row.type === 'IntermediateCA'" type="warning">中间CA</el-tag>
            <el-tag v-else-if="scope.row.type === 'EndEntity'" type="success">终端实体</el-tag>
            <el-tag v-else type="info">{{ scope.row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="描述" align="center" prop="description" :show-overflow-tooltip="true" />
        <el-table-column label="操作" fixed="right" width="200" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-tooltip content="详情" placement="top">
              <el-button link type="primary" icon="View" @click="handleDetail(scope.row)"></el-button>
            </el-tooltip>
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

    <!-- 添加或修改证书模板对话框 -->
    <el-dialog ref="formDialogRef" v-model="dialog.visible" :title="dialog.title" width="800px" append-to-body
               @close="cancel">
      <el-form ref="profileFormRef" :model="form" :rules="profileRules" label-width="120px">
        <el-tabs v-model="activeTab" type="border-card">
          <!-- 基本信息 -->
          <el-tab-pane label="基本信息" name="basic">
            <el-row>
              <el-col :span="24">
                <el-form-item label="模板名称" prop="name">
                  <el-input v-model="form.name" placeholder="请输入模板名称" :disabled="!!form.id" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row>
              <el-col :span="24">
                <el-form-item label="模板类型" prop="type">
                  <el-select v-model="form.type" placeholder="请选择模板类型" style="width: 100%">
                    <el-option label="RootCA" value="RootCA" />
                    <el-option label="IntermediateCA" value="IntermediateCA" />
                    <el-option label="EndEntity" value="EndEntity" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            <el-row>
              <el-col :span="24">
                <el-form-item label="描述">
                  <el-input v-model="form.description" type="textarea" placeholder="请输入描述" />
                </el-form-item>
              </el-col>
            </el-row>
          </el-tab-pane>

          <!-- 主题信息 -->
          <el-tab-pane label="主题信息" name="subject">
            <div class="subject-container">
              <div class="subject-header">
                <span>主题字段列表（RDNs）</span>
                <el-button type="primary" size="small" icon="Plus" @click="addRdn">添加字段</el-button>
              </div>
              
              <div v-if="form.subjectItems && form.subjectItems.length > 0" class="rdn-list">
                <div v-for="(rdn, index) in form.subjectItems" :key="index" class="rdn-item">
                  <el-card shadow="hover">
                    <template #header>
                      <div class="rdn-header">
                        <span class="rdn-title">{{ rdn.type?.description || '未命名字段' }}</span>
                        <div class="rdn-actions">
                          <el-button type="primary" size="small" icon="Top" @click="moveUp(index)" :disabled="index === 0">上移</el-button>
                          <el-button type="primary" size="small" icon="Bottom" @click="moveDown(index)" :disabled="index === form.subjectItems.length - 1">下移</el-button>
                          <el-button type="danger" size="small" icon="Delete" @click="removeRdn(index)">删除</el-button>
                        </div>
                      </div>
                    </template>
                    
                    <el-row :gutter="20">
                      <el-col :span="12">
                        <el-form-item label="OID" :prop="`subjectItems.${index}.type.oid`">
                          <el-input v-model="rdn.type.oid" placeholder="请输入OID，如：2.5.4.6" />
                        </el-form-item>
                      </el-col>
                      <el-col :span="12">
                        <el-form-item label="描述" :prop="`subjectItems.${index}.type.description`">
                          <el-input v-model="rdn.type.description" placeholder="请输入描述，如：C" />
                        </el-form-item>
                      </el-col>
                    </el-row>
                    
                    <el-row :gutter="20">
                      <el-col :span="12">
                        <el-form-item label="最小出现次数">
                          <el-input-number 
                            v-model="rdn.minOccurs" 
                            :min="0" 
                            :max="10" 
                            controls-position="right" 
                            style="width: 100%"
                          />
                          <div class="field-tip">默认为1，0表示可选</div>
                        </el-form-item>
                      </el-col>
                      <el-col :span="12">
                        <el-form-item label="最大出现次数">
                          <el-input-number 
                            v-model="rdn.maxOccurs" 
                            :min="1" 
                            :max="10" 
                            controls-position="right" 
                            style="width: 100%"
                          />
                          <div class="field-tip">默认为1，可重复字段可设置大于1</div>
                        </el-form-item>
                      </el-col>
                    </el-row>
                  </el-card>
                </div>
              </div>
              
              <el-empty v-else description="暂无主题字段，请点击上方按钮添加" />
              
              <!-- 常用OID快捷添加 -->
              <div class="quick-add-section">
                <div class="quick-add-title">常用OID快捷添加：</div>
                <el-space wrap>
                  <el-tag 
                    v-for="common in commonOIDs" 
                    :key="common.oid"
                    type="info"
                    effect="plain"
                    style="cursor: pointer"
                    @click="addCommonRdn(common)"
                  >
                    {{ common.description }} ({{ common.oid }})
                  </el-tag>
                </el-space>
              </div>
            </div>
          </el-tab-pane>

          <!-- 扩展信息 -->
          <el-tab-pane label="扩展信息" name="extensions">
            <div class="extensions-container">
              <div v-if="form.extensions && form.extensions.length > 0">
                <div v-for="(ext, index) in form.extensions" :key="index" class="extension-item">
                  <el-card shadow="hover">
                    <template #header>
                      <div class="extension-header">
                        <span>{{ getExtensionLabel(ext.type) }}</span>
                        <el-button type="danger" size="small" icon="Delete" @click="removeExtension(index)">删除
                        </el-button>
                      </div>
                    </template>
                    <el-form-item label="扩展类型">
                      <el-select v-model="ext.type" placeholder="请选择扩展类型" style="width: 100%">
                        <el-option v-for="item in extensionTypes" :key="item.value" :label="item.label"
                                   :value="item.value" />
                      </el-select>
                    </el-form-item>
                    <el-form-item label="是否必须">
                      <el-switch v-model="ext.required" />
                    </el-form-item>
                    <el-form-item label="是否关键">
                      <el-switch v-model="ext.critical" />
                    </el-form-item>
                    <el-form-item label="配置JSON">
                      <el-input v-model="ext.config" type="textarea" :rows="4" placeholder="请输入扩展配置JSON" />
                    </el-form-item>
                  </el-card>
                </div>
              </div>
              <el-empty v-else description="暂无扩展信息" />
              <el-button type="primary" icon="Plus" @click="addExtension" style="margin-top: 10px">添加扩展</el-button>
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 导入证书模板对话框 -->
    <el-dialog v-model="uploadDialog.visible" title="导入证书模板" width="600px" append-to-body>
      <el-upload
        drag
        :auto-upload="false"
        :file-list="uploadDialog.fileList"
        :on-change="handleFileChange"
        :before-upload="beforeUpload"
        multiple
        accept=".json,.xml"
      >
        <el-icon class="el-icon--upload">
          <upload-filled />
        </el-icon>
        <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
        <template #tip>
          <div class="el-upload__tip">支持 .json, .xml 格式的证书模板文件</div>
        </template>
      </el-upload>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" :loading="uploadDialog.loading" @click="submitImport">确 定</el-button>
          <el-button @click="uploadDialog.visible = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 查看详情对话框 -->
    <el-dialog v-model="detailDialog.visible" title="证书模板详情" width="1000px" append-to-body>
      <el-descriptions :column="2" border v-if="detailDialog.data">
        <el-descriptions-item label="模板名称">{{ detailDialog.data.name }}</el-descriptions-item>
        <el-descriptions-item label="模板类型">
          <el-tag v-if="detailDialog.data.type === 'RootCA'" type="danger">根CA</el-tag>
          <el-tag v-else-if="detailDialog.data.type === 'IntermediateCA'" type="warning">中间CA</el-tag>
          <el-tag v-else-if="detailDialog.data.type === 'EndEntity'" type="success">终端实体</el-tag>
          <el-tag v-else type="info">{{ detailDialog.data.type }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="描述" :span="2">{{ detailDialog.data.description || '-' }}</el-descriptions-item>
      </el-descriptions>

      <CertProfile v-if="detailDialog.confData" :profile="detailDialog.confData" />

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="detailDialog.visible = false">关 闭</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.extensions-container {
  padding: 10px;

  .extension-item {
    margin-bottom: 15px;

    &:last-child {
      margin-bottom: 0;
    }

    .extension-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 600;
    }
  }
}

.subject-container {
  padding: 10px;

  .subject-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    padding-bottom: 10px;
    border-bottom: 1px solid #ebeef5;
    font-size: 16px;
    font-weight: 600;
  }

  .rdn-list {
    margin-bottom: 20px;

    .rdn-item {
      margin-bottom: 15px;

      &:last-child {
        margin-bottom: 0;
      }

      .rdn-header {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .rdn-title {
          font-weight: 600;
          color: #303133;
        }

        .rdn-actions {
          display: flex;
          gap: 5px;
        }
      }

      .field-tip {
        font-size: 12px;
        color: #909399;
        margin-top: 5px;
      }
    }
  }

  .quick-add-section {
    margin-top: 20px;
    padding: 15px;
    background-color: #f5f7fa;
    border-radius: 4px;

    .quick-add-title {
      font-size: 14px;
      font-weight: 600;
      color: #606266;
      margin-bottom: 10px;
    }
  }
}

.detail-section {
  margin-bottom: 20px;
}
</style>
