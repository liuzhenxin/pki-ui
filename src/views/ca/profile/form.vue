<script setup name="ProfileForm" lang="ts">
import { ref, reactive, toRefs, getCurrentInstance, ComponentInternalInstance, onMounted, computed } from 'vue'
import { ElMessage, FormInstance, FormRules } from 'element-plus'
import { useRouter, useRoute } from 'vue-router'
import { Plus, Delete, Top, Bottom, Postcard, CollectionTag, Timer, Calendar, EditPen, Key } from '@element-plus/icons-vue'
import { getProfile, saveProfile, modifyProfile } from '@/api/ca/profile'
import { ProfileForm } from '@/api/ca/profile/types'

const { proxy } = getCurrentInstance() as ComponentInternalInstance
const router = useRouter()
const route = useRoute()

const loading = ref(false)
const activeTab = ref('basic')
const profileFormRef = ref<FormInstance>()
const isEdit = ref(false)

const initFormData: ProfileForm = {
  id: undefined,
  name: '',
  type: '',
  certLevel: '',
  description: '',
  metadata: {
    category: '',
    details: ''
  },
  maxSize: 8400,
  validity: '1y',
  notBeforeTime: 'current',
  keyAlgorithms: ['RSA-2048'],
  conf: '',
  subjectItems: [] as any[],
  extensions: [] as any[]
}

// 密钥算法选项
const keyAlgorithmOptions = [
  { value: 'RSA-2048', label: 'RSA-2048' },
  { value: 'RSA-4096', label: 'RSA-4096' },
  { value: 'SM2P256V1', label: 'SM2P256V1' }
]

const form = reactive<ProfileForm>({ ...initFormData })

// 计算属性：解析validity字符串为数值和单位
const validityValue = computed(() => {
  const validity = form.validity || '1y'
  const match = validity.match(/^(\d+)([dy])$/)
  return match ? parseInt(match[1]) : 1
})

const validityUnit = computed({
  get() {
    const validity = form.validity || '1y'
    const match = validity.match(/^(\d+)([dy])$/)
    return match ? (match[2] === 'y' ? 'year' : 'day') : 'year'
  },
  set(value: string) {
    const numValue = value === 'year' ? 1 : 365
    form.validity = `${numValue}${value === 'year' ? 'y' : 'd'}`
  }
})

// 更新validity字符串
function updateValidity(numValue?: number) {
  const value = numValue ?? validityValue.value
  form.validity = `${value}${validityUnit.value === 'year' ? 'y' : 'd'}`
}

// 跟踪每个扩展选中的密钥用法
const selectedKeyUsages = ref<string[][]>([])

// 跟踪每个扩展选中的增强密钥用法
const selectedExtendedKeyUsages = ref<string[][]>([])

// 跟踪每个扩展选中的主体备用名称模式
const selectedSubjectAltNameModes = ref<string[][]>([])

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

// 常用字段列表
const commonOIDs = [
  { value: 'country', label: '国家(C)' },
  { value: 'organization', label: '组织(O)' },
  { value: 'organizationalUnit', label: '组织单位(OU)' },
  { value: 'commonName', label: '通用名称(CN)' },
  { value: 'stateOrProvince', label: '省/州(ST)' },
  { value: 'locality', label: '城市(L)' },
  { value: 'serialNumber', label: '序列号(SN)' },
  { value: 'emailAddress', label: '邮箱(E)' },
  { value: 'givenName', label: '名字(GN)' },
  { value: 'surname', label: '姓氏(SN)' },
  { value: 'title', label: '头衔(T)' },
  { value: 'userId', label: '用户ID(UID)' }
]

// 字段标签映射
const subjectLabelMap: Record<string, string> = {
  country: '国家(C)',
  organization: '组织(O)',
  organizationalUnit: '组织单位(OU)',
  commonName: '通用名称(CN)',
  stateOrProvince: '省/州(ST)',
  locality: '城市(L)',
  serialNumber: '序列号(SN)',
  emailAddress: '邮箱(E)',
  givenName: '名字(GN)',
  surname: '姓氏(SN)',
  title: '头衔(T)',
  userId: '用户ID(UID)',
  domainComponent: '域名组件(DC)',
  description: '描述'
}

// 密钥用法选项列表
const keyUsageOptions = [
  { value: 'digitalSignature', label: '数字签名' },
  { value: 'nonRepudiation', label: '不可否认性' },
  { value: 'keyEncipherment', label: '密钥加密' },
  { value: 'dataEncipherment', label: '数据加密' },
  { value: 'keyAgreement', label: '密钥协商' },
  { value: 'keyCertSign', label: '证书签名' },
  { value: 'cRLSign', label: 'CRL签名' },
  { value: 'encipherOnly', label: '仅加密' },
  { value: 'decipherOnly', label: '仅解密' }
]

// 增强密钥用法选项列表
const extendedKeyUsageOptions = [
  { value: 'serverAuth', label: '服务器身份验证' },
  { value: 'clientAuth', label: '客户端身份验证' },
  { value: 'codeSigning', label: '代码签名' },
  { value: 'emailProtection', label: '电子邮件保护' },
  { value: 'timeStamping', label: '时间戳' },
  { value: 'OCSPSigning', label: 'OCSP签名' },
  { value: 'ipsecEndSystem', label: 'IPSec终端系统' },
  { value: 'ipsecTunnel', label: 'IPSec隧道' },
  { value: 'ipsecUser', label: 'IPSec用户' },
  { value: 'anyExtendedKeyUsage', label: '任意增强密钥用法' }
]

// 主体备用名称模式选项列表
const subjectAltNameModeOptions = [
  { value: 'rfc822Name', label: '电子邮件地址' },
  { value: 'dNSName', label: 'DNS名称' },
  { value: 'directoryName', label: '目录名称' },
  { value: 'ediPartyName', label: 'EDI参与方名称' },
  { value: 'uniformResourceIdentifier', label: 'URI' },
  { value: 'iPAddress', label: 'IP地址' },
  { value: 'registeredID', label: '注册ID' }
]

const profileRules: FormRules = {
  name: [{ required: true, message: '模板名称不能为空', trigger: 'blur' }],
  type: [{ required: true, message: '模板类型不能为空', trigger: 'change' }]
}

/** 获取扩展标签 */
function getExtensionLabel(type: string): string {
  const ext = extensionTypes.find(e => e.value === type)
  return ext ? ext.label : type
}

/** 获取主题字段标签 */
function getSubjectLabel(type: string): string {
  return subjectLabelMap[type] || type
}

/** 添加扩展 */
function addExtension() {
  if (!form.extensions) {
    form.extensions = []
  }
  form.extensions.push({
    type: '',
    required: false,
    critical: false,
    config: '',
    keyUsage: null,
    extendedKeyUsage: null,
    subjectAltName: null
  })
  selectedKeyUsages.value.push([])
  selectedExtendedKeyUsages.value.push([])
  selectedSubjectAltNameModes.value.push([])
}

/** 删除扩展 */
function removeExtension(index: number) {
  form.extensions.splice(index, 1)
  selectedKeyUsages.value.splice(index, 1)
  selectedExtendedKeyUsages.value.splice(index, 1)
  selectedSubjectAltNameModes.value.splice(index, 1)
}

/** 添加RDN */
function addRdn() {
  if (!form.subjectItems) {
    form.subjectItems = []
  }
  form.subjectItems.push({
    type: ''
  })
}

/** 删除RDN */
function removeRdn(index: number) {
  form.subjectItems.splice(index, 1)
}

/** 上移RDN */
function moveUp(index: number) {
  if (index > 0) {
    const temp = form.subjectItems[index]
    form.subjectItems[index] = form.subjectItems[index - 1]
    form.subjectItems[index - 1] = temp
  }
}

/** 下移RDN */
function moveDown(index: number) {
  if (index < form.subjectItems.length - 1) {
    const temp = form.subjectItems[index]
    form.subjectItems[index] = form.subjectItems[index + 1]
    form.subjectItems[index + 1] = temp
  }
}

/** 添加常用字段 */
function addCommonRdn(common: { value: string; label: string }) {
  if (!form.subjectItems) {
    form.subjectItems = []
  }
  form.subjectItems.push({
    type: common.value
  })
}

/** 判断密钥用法是否被选中 */
function isKeyUsageSelected(extIndex: number, value: string): boolean {
  return selectedKeyUsages.value[extIndex]?.includes(value) || false
}

/** 判断密钥用法是否设置为必须 */
function isKeyUsageRequired(extIndex: number, value: string): boolean {
  const ext = form.extensions[extIndex]
  if (!ext.keyUsage || !ext.keyUsage.usages) {
    return false
  }
  const usage = ext.keyUsage.usages.find((u: any) => u.value === value)
  return usage ? usage.required : false
}

/** 处理密钥用法复选框组变化 */
function handleKeyUsageGroupChange(extIndex: number, values: string[]) {
  const ext = form.extensions[extIndex]
  
  if (!ext.keyUsage) {
    ext.keyUsage = { usages: [] }
  }
  
  // 清空现有的usages
  const oldUsages = [...ext.keyUsage.usages]
  ext.keyUsage.usages = []
  
  // 重新构建usages，保留之前的required设置
  values.forEach(value => {
    const oldUsage = oldUsages.find((u: any) => u.value === value)
    ext.keyUsage.usages.push({
      required: oldUsage?.required || false,
      value: value
    })
  })
}

/** 处理密钥用法必须属性变化 */
function handleKeyUsageRequiredChange(extIndex: number, value: string, required: boolean) {
  const ext = form.extensions[extIndex]
  if (ext.keyUsage && ext.keyUsage.usages) {
    const usage = ext.keyUsage.usages.find((u: any) => u.value === value)
    if (usage) {
      usage.required = required
    }
  }
}

/** 处理扩展类型变化 */
function handleExtensionTypeChange(index: number) {
  const ext = form.extensions[index]
  // 如果切换扩展类型，清理之前的数据
  if (ext.type !== 'KeyUsage') {
    ext.keyUsage = null
    selectedKeyUsages.value[index] = []
  }
  if (ext.type === 'KeyUsage') {
    ext.keyUsage = { usages: [] }
    selectedKeyUsages.value[index] = []
  }

  if (ext.type !== 'ExtendedKeyUsage') {
    ext.extendedKeyUsage = null
    selectedExtendedKeyUsages.value[index] = []
  }
  if (ext.type === 'ExtendedKeyUsage') {
    ext.extendedKeyUsage = { usages: [] }
    selectedExtendedKeyUsages.value[index] = []
  }

  if (ext.type !== 'SubjectAlternativeName') {
    ext.subjectAltName = null
    selectedSubjectAltNameModes.value[index] = []
  }
  if (ext.type === 'SubjectAlternativeName') {
    ext.subjectAltName = { modes: [] }
    selectedSubjectAltNameModes.value[index] = []
  }
}

/** 判断增强密钥用法是否被选中 */
function isExtendedKeyUsageSelected(extIndex: number, value: string): boolean {
  return selectedExtendedKeyUsages.value[extIndex]?.includes(value) || false
}

/** 判断增强密钥用法是否设置为必须 */
function isExtendedKeyUsageRequired(extIndex: number, value: string): boolean {
  const ext = form.extensions[extIndex]
  if (!ext.extendedKeyUsage || !ext.extendedKeyUsage.usages) {
    return false
  }
  const usage = ext.extendedKeyUsage.usages.find((u: any) => u.value === value)
  return usage ? usage.required : false
}

/** 处理增强密钥用法复选框组变化 */
function handleExtendedKeyUsageGroupChange(extIndex: number, values: string[]) {
  const ext = form.extensions[extIndex]
  
  if (!ext.extendedKeyUsage) {
    ext.extendedKeyUsage = { usages: [] }
  }
  
  // 清空现有的usages
  const oldUsages = [...ext.extendedKeyUsage.usages]
  ext.extendedKeyUsage.usages = []
  
  // 重新构建usages，保留之前的required设置
  values.forEach(value => {
    const oldUsage = oldUsages.find((u: any) => u.value === value)
    ext.extendedKeyUsage.usages.push({
      required: oldUsage?.required || false,
      value: value
    })
  })
}

/** 处理增强密钥用法必须属性变化 */
function handleExtendedKeyUsageRequiredChange(extIndex: number, value: string, required: boolean) {
  const ext = form.extensions[extIndex]
  if (ext.extendedKeyUsage && ext.extendedKeyUsage.usages) {
    const usage = ext.extendedKeyUsage.usages.find((u: any) => u.value === value)
    if (usage) {
      usage.required = required
    }
  }
}

/** 处理主体备用名称模式复选框组变化 */
function handleSubjectAltNameModeGroupChange(extIndex: number, values: string[]) {
  const ext = form.extensions[extIndex]

  if (!ext.subjectAltName) {
    ext.subjectAltName = { modes: [] }
  }

  ext.subjectAltName.modes = values
}

/** 提交按钮 */
async function submitForm() {
  profileFormRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      loading.value = true
      try {
        console.log('开始提交表单数据...')

        // 构建最终JSON格式的conf对象
        const conf = {
          metadata: {
            category: form.name || '',
            details: form.metadata?.details || ''
          },
          certLevel: form.certLevel || form.type || 'EndEntity',
          maxSize: form.maxSize || 8400,
          validity: form.validity || '1y',
          notBeforeTime: form.notBeforeTime || 'current',
          keyAlgorithms: form.keyAlgorithms || ['RSA-2048'],
          subject: form.subjectItems || [],
          extensions: form.extensions
            .filter(ext => {
              // 必须有 type
              if (!ext.type || !ext.type.trim()) {
                return false
              }

              // 对于 KeyUsage，必须有 keyUsage 配置
              if (ext.type === 'KeyUsage' && !ext.keyUsage) {
                return false
              }

              // 对于 ExtendedKeyUsage，必须有 extendedKeyUsage 配置
              if (ext.type === 'ExtendedKeyUsage' && !ext.extendedKeyUsage) {
                return false
              }

              // 对于 SubjectAlternativeName，必须有 subjectAltName 配置
              if (ext.type === 'SubjectAlternativeName' && !ext.subjectAltName) {
                return false
              }

              // 对于 BasicConstraints，必须有 config 配置
              if (ext.type === 'BasicConstraints' && !ext.config) {
                return false
              }

              // 对于 AuthorityInfoAccess，必须有 config 配置
              if (ext.type === 'AuthorityInfoAccess' && !ext.config) {
                return false
              }

              return true
            })
            .map(ext => {
            const extConfig: any = {
              type: ext.type,
              required: ext.required
            }

            // 设置critical属性
            if (ext.critical !== undefined) {
              extConfig.critical = ext.critical
            }

            // 对于KeyUsage，添加keyUsage配置
            if (ext.type === 'KeyUsage' && ext.keyUsage) {
              extConfig.critical = true
              extConfig.required = true
              extConfig.inRequest = 'optional'
              extConfig.keyUsage = ext.keyUsage
            }

            // 对于ExtendedKeyUsage，添加extendedKeyUsage配置
            if (ext.type === 'ExtendedKeyUsage' && ext.extendedKeyUsage) {
              extConfig.inRequest = 'optional'
              extConfig.extendedKeyUsage = ext.extendedKeyUsage
            }

            // 对于SubjectAlternativeName，添加subjectAltName配置
            if (ext.type === 'SubjectAlternativeName' && ext.subjectAltName) {
              extConfig.inRequest = 'optional'
              extConfig.subjectAltName = ext.subjectAltName
            }

            // 对于BasicConstraints，添加basicConstraints配置
            if (ext.type === 'BasicConstraints' && ext.config) {
              try {
                const config = typeof ext.config === 'string' ? JSON.parse(ext.config) : ext.config
                extConfig.basicConstraints = config
              } catch (e) {
                console.error('解析BasicConstraints配置失败', e)
              }
            }

            // 对于AuthorityInfoAccess，添加authorityInfoAccess配置
            if (ext.type === 'AuthorityInfoAccess' && ext.config) {
              try {
                const config = typeof ext.config === 'string' ? JSON.parse(ext.config) : ext.config
                extConfig.authorityInfoAccess = config
              } catch (e) {
                console.error('解析AuthorityInfoAccess配置失败', e)
              }
            }

            return extConfig
          })
        }

        console.log('构建的conf对象:', conf)

        // 只提交必要的字段，避免包含原始的 subjectItems 和 extensions
        const submitData = {
          id: form.id,
          name: form.name,
          type: form.type,
          certLevel: form.certLevel,
          description: form.description,
          maxSize: form.maxSize,
          validity: form.validity,
          notBeforeTime: form.notBeforeTime,
          keyAlgorithms: form.keyAlgorithms,
          conf: JSON.stringify(conf)
        }

        console.log('提交的数据:', submitData)

        // 将数据包装在 co 字段中以匹配后端 ProfileSaveCmd 结构
        const commandData = {
          co: submitData
        }

        console.log('最终提交的命令数据:', commandData)

        if (form.id) {
          console.log('调用 modifyProfile API')
          await modifyProfile(commandData)
        } else {
          console.log('调用 saveProfile API')
          await saveProfile(commandData)
        }
        ElMessage.success('操作成功')
        router.back()
      } catch (error: any) {
        console.error('操作失败', error)
        ElMessage.error(error?.message || '操作失败，请检查数据')
      } finally {
        loading.value = false
      }
    } else {
      console.log('表单验证失败')
      ElMessage.warning('请检查表单填写是否完整')
    }
  })
}

/** 返回列表 */
function goBack() {
  router.back()
}

/** 获取模板详情 */
async function getProfileDetail(id: string | number) {
  try {
    loading.value = true
    const { data } = await getProfile(id)
    Object.assign(form, data)

    // 解析conf字段
    if (data.conf) {
      const conf = typeof data.conf === 'string' ? JSON.parse(data.conf) : data.conf
      
      // 解析新格式的字段
      form.metadata = conf.metadata || { category: '', details: '' }
      form.certLevel = conf.certLevel || conf.type || 'EndEntity'
      form.maxSize = conf.maxSize || 8400
      form.validity = conf.validity || '1y'
      form.notBeforeTime = conf.notBeforeTime || 'current'
      form.keyAlgorithms = conf.keyAlgorithms || ['RSA-2048']
      
      // 解析subject（新格式是直接数组）
      form.subjectItems = conf.subject || []
      
      // 解析扩展信息（新格式）
      if (conf.extensions && Array.isArray(conf.extensions)) {
        form.extensions = conf.extensions.map((ext: any) => {
          const extData: any = {
            type: ext.type,
            required: ext.required,
            critical: ext.critical,
            keyUsage: ext.keyUsage,
            extendedKeyUsage: ext.extendedKeyUsage,
            subjectAltName: ext.subjectAltName
          }

          // 对于BasicConstraints，将basicConstraints转为config字符串
          if (ext.type === 'BasicConstraints' && ext.basicConstraints) {
            extData.config = typeof ext.basicConstraints === 'object'
              ? JSON.stringify(ext.basicConstraints)
              : ext.basicConstraints
          }

          // 对于AuthorityInfoAccess，将authorityInfoAccess转为config字符串
          if (ext.type === 'AuthorityInfoAccess' && ext.authorityInfoAccess) {
            extData.config = typeof ext.authorityInfoAccess === 'object'
              ? JSON.stringify(ext.authorityInfoAccess)
              : ext.authorityInfoAccess
          }

          // 对于其他扩展，如果有config字段，转换为JSON字符串
          if (ext.type !== 'BasicConstraints' && ext.type !== 'KeyUsage' && ext.type !== 'SubjectKeyIdentifier' && ext.type !== 'ExtendedKeyUsage' && ext.type !== 'SubjectAlternativeName' && ext.type !== 'AuthorityKeyIdentifier' && ext.config) {
            extData.config = typeof ext.config === 'object' ? JSON.stringify(ext.config) : ext.config
          }

          return extData
        })

        // 初始化selectedKeyUsages、selectedExtendedKeyUsages和selectedSubjectAltNameModes
        selectedKeyUsages.value = form.extensions.map((ext: any) => {
          if (ext.type === 'KeyUsage' && ext.keyUsage && ext.keyUsage.usages) {
            return ext.keyUsage.usages.map((u: any) => u.value)
          }
          return []
        })

        selectedExtendedKeyUsages.value = form.extensions.map((ext: any) => {
          if (ext.type === 'ExtendedKeyUsage' && ext.extendedKeyUsage && ext.extendedKeyUsage.usages) {
            return ext.extendedKeyUsage.usages.map((u: any) => u.value)
          }
          return []
        })

        selectedSubjectAltNameModes.value = form.extensions.map((ext: any) => {
          if (ext.type === 'SubjectAlternativeName' && ext.subjectAltName && ext.subjectAltName.modes) {
            return ext.subjectAltName.modes
          }
          return []
        })
      }
    }
  } catch (error) {
    ElMessage.error('获取证书模板信息失败')
    router.back()
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  const id = route.query.id
  if (id) {
    isEdit.value = true
    getProfileDetail(id as string)
  }
})
</script>

<template>
  <div class="profile-form-container">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <el-button icon="Back" @click="goBack">返回</el-button>
          <span class="title">{{ isEdit ? '修改证书模板' : '新增证书模板' }}</span>
          <el-button type="primary" icon="Check" :loading="loading" @click="submitForm">保存</el-button>
        </div>
      </template>

      <el-form ref="profileFormRef" :model="form" :rules="profileRules" label-width="120px">
        <el-tabs v-model="activeTab" type="border-card">
          <!-- 基本信息 -->
          <el-tab-pane label="基本信息" name="basic">
            <div class="basic-info-section">
              <div class="section-title">
                <el-icon><Postcard /></el-icon>
                <span>识别信息</span>
              </div>
              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item label="模板名称" prop="name">
                    <template #label>
                      <div class="custom-form-label">
                        <el-icon><EditPen /></el-icon>
                        <span>模板名称</span>
                      </div>
                    </template>
                    <el-input v-model="form.name" placeholder="请输入模板名称" :disabled="isEdit" clearable />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="模板类型" prop="type">
                    <template #label>
                      <div class="custom-form-label">
                        <el-icon><CollectionTag /></el-icon>
                        <span>模板类型</span>
                      </div>
                    </template>
                    <el-select v-model="form.type" placeholder="请选择模板类型" style="width: 100%" :disabled="isEdit">
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
                    <template #label>
                      <div class="custom-form-label">
                        <el-icon><EditPen /></el-icon>
                        <span>描述信息</span>
                      </div>
                    </template>
                    <el-input v-model="form.description" type="textarea" :rows="3" placeholder="请输入模板的详细用途描述..." />
                  </el-form-item>
                </el-col>
              </el-row>
            </div>

            <div class="basic-info-section">
              <div class="section-title">
                <el-icon><Key /></el-icon>
                <span>技术参数</span>
              </div>
              <el-row>
                <el-col :span="24">
                  <el-form-item label="密钥算法">
                    <template #label>
                      <div class="custom-form-label">
                        <el-icon><Key /></el-icon>
                        <span>密钥算法</span>
                      </div>
                    </template>
                    <div class="algo-selection-wrapper">
                      <el-checkbox-group v-model="form.keyAlgorithms" class="custom-checkbox-group">
                        <el-checkbox-button 
                          v-for="algo in keyAlgorithmOptions" 
                          :key="algo.value" 
                          :label="algo.value"
                        >
                          {{ algo.label }}
                        </el-checkbox-button>
                      </el-checkbox-group>
                    </div>
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item label="证书有效期">
                    <template #label>
                      <div class="custom-form-label">
                        <el-icon><Timer /></el-icon>
                        <span>证书有效期</span>
                      </div>
                    </template>
                    <div class="validity-input-group">
                      <el-input-number
                        :model-value="validityValue"
                        @update:model-value="updateValidity"
                        :min="1"
                        :max="100"
                        controls-position="right"
                        class="validity-num"
                      />
                      <el-select v-model="validityUnit" class="validity-unit">
                        <el-option label="天" value="day" />
                        <el-option label="年" value="year" />
                      </el-select>
                    </div>
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="生效时间">
                    <template #label>
                      <div class="custom-form-label">
                        <el-icon><Calendar /></el-icon>
                        <span>生效时间</span>
                      </div>
                    </template>
                    <el-select v-model="form.notBeforeTime" placeholder="请选择生效时间" style="width: 100%">
                      <el-option label="当前时间" value="current" />
                      <el-option label="指定时间" value="custom" />
                    </el-select>
                  </el-form-item>
                </el-col>
              </el-row>
            </div>
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
                        <span class="rdn-title">{{ getSubjectLabel(rdn.type) || rdn.type }}</span>
                        <div class="rdn-actions">
                          <el-button type="primary" size="small" icon="Top" @click="moveUp(index)" :disabled="index === 0">上移</el-button>
                          <el-button type="primary" size="small" icon="Bottom" @click="moveDown(index)" :disabled="index === form.subjectItems.length - 1">下移</el-button>
                          <el-button type="danger" size="small" icon="Delete" @click="removeRdn(index)">删除</el-button>
                        </div>
                      </div>
                    </template>
                    
                    <el-row :gutter="20">
                      <el-col :span="24">
                        <el-form-item label="字段类型" :prop="`subjectItems.${index}.type`">
                          <el-select v-model="rdn.type" placeholder="请选择字段类型" style="width: 100%">
                            <el-option label="国家(C)" value="country" />
                            <el-option label="组织(O)" value="organization" />
                            <el-option label="组织单位(OU)" value="organizationalUnit" />
                            <el-option label="通用名称(CN)" value="commonName" />
                            <el-option label="省/州(ST)" value="stateOrProvince" />
                            <el-option label="城市(L)" value="locality" />
                            <el-option label="序列号(SN)" value="serialNumber" />
                            <el-option label="邮箱(E)" value="emailAddress" />
                            <el-option label="域名组件(DC)" value="domainComponent" />
                            <el-option label="用户ID(UID)" value="userId" />
                            <el-option label="头衔(T)" value="title" />
                            <el-option label="姓氏(SN)" value="surname" />
                            <el-option label="名字(GN)" value="givenName" />
                          </el-select>
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
                <div class="quick-add-title">常用字段快捷添加：</div>
                <el-space wrap>
                  <el-tag 
                    v-for="common in commonOIDs" 
                    :key="common.value"
                    type="info"
                    effect="plain"
                    style="cursor: pointer"
                    @click="addCommonRdn(common)"
                  >
                    {{ common.label }}
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
                      <el-select v-model="ext.type" placeholder="请选择扩展类型" style="width: 100%" @change="handleExtensionTypeChange(index)">
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
                    
                    <!-- 密钥用法专门配置 -->
                    <template v-if="ext.type === 'KeyUsage'">
                      <el-divider content-position="left" style="margin: 15px 0;">密钥用法配置</el-divider>
                      <div class="keyusages-checkbox-list">
                        <el-checkbox-group v-model="selectedKeyUsages[index]" @change="handleKeyUsageGroupChange(index, $event)">
                          <div class="keyusage-grid">
                            <div v-for="opt in keyUsageOptions" :key="opt.value" class="keyusage-checkbox-item">
                              <el-row :gutter="8" align="middle">
                                <el-col :span="16">
                                  <el-checkbox :value="opt.value">
                                    {{ opt.label }}
                                  </el-checkbox>
                                </el-col>
                                <el-col :span="8">
                                  <el-checkbox
                                    :model-value="isKeyUsageRequired(index, opt.value)"
                                    :disabled="!selectedKeyUsages[index].includes(opt.value)"
                                    @change="handleKeyUsageRequiredChange(index, opt.value, $event)"
                                    size="small"
                                  >
                                    必须
                                  </el-checkbox>
                                </el-col>
                              </el-row>
                            </div>
                          </div>
                        </el-checkbox-group>
                      </div>
                    </template>
                    
                    <!-- 增强密钥用法专门配置 -->
                    <template v-if="ext.type === 'ExtendedKeyUsage'">
                      <el-divider content-position="left" style="margin: 15px 0;">增强密钥用法配置</el-divider>
                      <div class="keyusages-checkbox-list">
                        <el-checkbox-group v-model="selectedExtendedKeyUsages[index]" @change="handleExtendedKeyUsageGroupChange(index, $event)">
                          <div class="keyusage-grid">
                            <div v-for="opt in extendedKeyUsageOptions" :key="opt.value" class="keyusage-checkbox-item">
                              <el-row :gutter="8" align="middle">
                                <el-col :span="16">
                                  <el-checkbox :value="opt.value">
                                    {{ opt.label }}
                                  </el-checkbox>
                                </el-col>
                                <el-col :span="8">
                                  <el-checkbox
                                    :model-value="isExtendedKeyUsageRequired(index, opt.value)"
                                    :disabled="!selectedExtendedKeyUsages[index].includes(opt.value)"
                                    @change="handleExtendedKeyUsageRequiredChange(index, opt.value, $event)"
                                    size="small"
                                  >
                                    必须
                                  </el-checkbox>
                                </el-col>
                              </el-row>
                            </div>
                          </div>
                        </el-checkbox-group>
                      </div>
                    </template>

                    <!-- 主体备用名称专门配置 -->
                    <template v-if="ext.type === 'SubjectAlternativeName'">
                      <el-divider content-position="left" style="margin: 15px 0;">主体备用名称配置</el-divider>
                      <div class="keyusages-checkbox-list">
                        <el-checkbox-group v-model="selectedSubjectAltNameModes[index]" @change="handleSubjectAltNameModeGroupChange(index, $event)">
                          <div class="keyusage-grid">
                            <div v-for="opt in subjectAltNameModeOptions" :key="opt.value" class="keyusage-checkbox-item">
                              <el-checkbox :value="opt.value">
                                {{ opt.label }}
                              </el-checkbox>
                            </div>
                          </div>
                        </el-checkbox-group>
                      </div>
                    </template>
                  </el-card>
                </div>
              </div>
              <el-empty v-else description="暂无扩展信息" />
              <el-button type="primary" icon="Plus" @click="addExtension" style="margin-top: 10px">添加扩展</el-button>
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.profile-form-container {
  padding: 20px;

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .title {
      font-size: 20px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      position: relative;
      padding-left: 12px;

      &::before {
        content: '';
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 4px;
        height: 18px;
        background: linear-gradient(to bottom, var(--el-color-primary), var(--el-color-primary-light-3));
        border-radius: 2px;
      }
    }
  }

  /* 基本信息优化样式 */
  .basic-info-section {
    padding: 24px;
    margin-bottom: 24px;
    background: var(--el-fill-color-blank);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
      border-color: var(--el-color-primary-light-8);
      transform: translateY(-2px);
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 1px dashed var(--el-border-color-lighter);
      
      .el-icon {
        font-size: 20px;
        color: var(--el-color-primary);
      }
      
      span {
        font-size: 16px;
        font-weight: 600;
        color: var(--el-text-color-primary);
      }
    }

    .custom-form-label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--el-text-color-regular);
      
      .el-icon {
        font-size: 14px;
        color: var(--el-color-primary-light-3);
      }
    }

    .algo-selection-wrapper {
      .custom-checkbox-group {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        
        :deep(.el-checkbox-button__inner) {
          border: 1px solid var(--el-border-color);
          border-radius: 6px !important;
          box-shadow: none !important;
          transition: all 0.2s;
          padding: 8px 20px;
          min-width: 120px;
          text-align: center;
        }
        
        :deep(.el-checkbox-button.is-checked .el-checkbox-button__inner) {
          background-color: var(--el-color-primary-light-9);
          color: var(--el-color-primary);
          border-color: var(--el-color-primary);
          font-weight: 600;
        }
      }
    }

    .validity-input-group {
      display: flex;
      align-items: center;
      width: 100%;
      border: 1px solid var(--el-border-color);
      border-radius: var(--el-border-radius-base);
      overflow: hidden;
      transition: border-color 0.2s;

      &:focus-within {
        border-color: var(--el-color-primary);
      }

      .validity-num {
        flex: 1;
        :deep(.el-input__wrapper) {
          box-shadow: none !important;
          background: transparent;
        }
      }

      .validity-unit {
        width: 80px;
        :deep(.el-input__wrapper) {
          box-shadow: none !important;
          background: var(--el-fill-color-light);
          border-radius: 0;
          border-left: 1px solid var(--el-border-color);
        }
      }
    }
  }
}

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

    .keyusages-checkbox-list {
      padding: 5px 0;

      .keyusage-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;

        @media (max-width: 768px) {
          grid-template-columns: 1fr;
        }

        .keyusage-checkbox-item {
          padding: 6px 10px;
          margin: 0;
          background-color: #f5f7fa;
          border-radius: 4px;
          transition: all 0.3s;

          &:hover {
            background-color: #ecf5ff;
          }
        }
      }
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
</style>