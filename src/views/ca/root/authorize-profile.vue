<template>
  <div class="p-2">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>授权模板</span>
          <el-button @click="goBack" icon="Back">返回</el-button>
        </div>
      </template>

      <!-- 根证书基本信息 -->
      <div class="cert-info-section">
        <h3>根证书信息</h3>
        <div class="cert-header">
          <div class="cert-name">
            <span class="label">证书名称：</span>
            <span class="value">{{ rootCertInfo.name || '-' }}</span>
          </div>
          <el-button type="primary" icon="View" @click="toggleCertInfo">
            {{ showCertInfo ? '隐藏证书信息' : '查看证书信息' }}
          </el-button>
        </div>
        <el-collapse-transition>
          <div v-show="showCertInfo" class="cert-detail">
            <X509Cert v-if="rootCertInfo.cert" :certPem="rootCertInfo.cert" />
            <el-empty v-else description="暂无证书信息" />
          </div>
        </el-collapse-transition>
      </div>

      <!-- 模板列表 -->
      <div class="template-section">
        <div class="section-header">
          <h3>模板列表</h3>
          <el-button type="primary" icon="Check" :loading="loading" @click="handleSubmitAuthorize">保存授权</el-button>
        </div>
        <el-table v-loading="loading" border :data="profileList">
          <el-table-column type="index" label="序号" width="60" align="center" />
          <el-table-column label="模板名称" align="center" prop="name" />
          <el-table-column label="类型" align="center">
            <template #default="scope">
              <el-tag v-if="scope.row.type === 'RootCA' || scope.row.certLevel === 'RootCA'" type="danger">根CA</el-tag>
              <el-tag v-else-if="scope.row.type === 'IntermediateCA' || scope.row.certLevel === 'IntermediateCA'" type="warning">中间CA</el-tag>
              <el-tag v-else-if="scope.row.type === 'EndEntity' || scope.row.certLevel === 'EndEntity'" type="success">终端实体</el-tag>
              <el-tag v-else>{{ scope.row.type || scope.row.certLevel || '-' }}</el-tag>
            </template>
          </el-table-column>

          <el-table-column label="授权状态" align="center" width="120">
            <template #default="scope">
              <el-checkbox v-model="scope.row.authorized" @change="handleAuthorizeChange(scope.row)" />
            </template>
          </el-table-column>
          <el-table-column label="操作" align="center" width="150">
            <template #default="scope">
              <el-button link type="primary" icon="View" @click="handleViewProfile(scope.row)">查看</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>

    <!-- 模板详情对话框 -->
    <el-dialog v-model="showDetailDialog" title="模板详情" width="60%" append-to-body>
      <CertProfile v-if="currentProfile" :profile="currentProfile" />
      
      <!-- 如果CertProfile没有显示数据，显示原始数据用于调试 -->
      <el-collapse v-if="currentProfile" style="margin-top: 20px">
        <el-collapse-item title="原始数据（调试用）">
          <pre>{{ JSON.stringify(currentProfile, null, 2) }}</pre>
        </el-collapse-item>
      </el-collapse>
    </el-dialog>
  </div>
</template>

<script setup name="AuthorizeProfile" lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Check } from '@element-plus/icons-vue';
import { listProfile, getProfile } from '@/api/ca/profile';
import { getRootCa, authorizeProfile } from '@/api/ca/root';
import X509Cert from '@/components/X509Cert/index.vue';
import CertProfile from '@/components/CertProfile/index.vue';

const route = useRoute();
const router = useRouter();

const rootId = ref<string | number>('');
const rootCertInfo = ref<any>({});
const profileList = ref<any[]>([]);
const loading = ref(false);
const showDetailDialog = ref(false);
const showCertInfo = ref(false);
const currentProfile = ref<any>(null);
const allProfiles = ref<any[]>([]);
const hasChanges = ref(false);
const authorizedProfileIds = ref<(string | number)[]>([]);

/** 返回上一页 */
function goBack() {
  router.back();
}

/** 切换证书信息显示 */
function toggleCertInfo() {
  showCertInfo.value = !showCertInfo.value;
}

/** 获取根证书信息 */
async function getRootCertInfo() {
  try {
    const res = await getRootCa(rootId.value);
    const cert = res.data;
    if (cert) {
      rootCertInfo.value = {
        id: cert.id,
        name: cert.name,
        cert: cert.cert || cert.pem || '', // 获取证书PEM数据
        issuer: cert.issuer || '-',
        subject: cert.subject || '-',
        notBefore: cert.notBefore || '-',
        notAfter: cert.notAfter || '-',
        status: cert.status || '0'
      };
      
      // 保存已授权的模板ID列表
      authorizedProfileIds.value = cert.profileIds || [];
      
      console.log('根证书信息:', rootCertInfo.value);
      console.log('已授权的模板ID:', authorizedProfileIds.value);
    }
  } catch (error) {
    console.error('获取根证书信息失败', error);
    ElMessage.error('获取根证书信息失败');
  }
}

/** 获取所有模板 */
async function getAllProfiles() {
  try {
    const res = await listProfile();
    console.log('所有模板数据:', res.data);
    // 过滤掉 RootCA 类型的模板，只保留 IntermediateCA 和 EndEntity
    allProfiles.value = (res.data || []).filter((profile: any) => {
      const type = profile.type || profile.certLevel;
      return type !== 'RootCA';
    });
    console.log('过滤后的模板列表长度:', allProfiles.value.length);
  } catch (error) {
    console.error('获取模板列表失败', error);
    ElMessage.error('获取模板列表失败');
  }
}

/** 获取已授权的模板 */
async function getAuthorizedProfiles() {
  loading.value = true;
  try {
    console.log('allProfiles:', allProfiles.value);
    console.log('已授权的模板ID:', authorizedProfileIds.value);
    console.log('已授权模板ID类型:', typeof authorizedProfileIds.value[0]);
    
    // 使用类型安全的比较方式，并创建深拷贝确保响应式
    profileList.value = allProfiles.value.map(profile => {
      const profileId = profile.id;
      const profileIdType = typeof profileId;
      console.log(`模板ID: ${profileId}, 类型: ${profileIdType}`);
      
      // 转换为字符串进行比较，确保类型一致
      const authorized = authorizedProfileIds.value.some(authId => 
        String(authId) === String(profileId)
      );
      
      // 使用深拷贝创建独立的响应式对象
      return JSON.parse(JSON.stringify({
        ...profile,
        authorized
      }));
    });
    
    console.log('profileList:', profileList.value);
  } catch (error) {
    console.error('获取授权模板失败', error);
  } finally {
    loading.value = false;
  }
}

/** 授权状态变更 */
async function handleAuthorizeChange(profile: any) {
  hasChanges.value = true;
  
  // 记录变更前的状态，用于错误恢复
  const previousState = !profile.authorized;
  
  try {
    // TODO: 调用后端API更新授权状态
    if (profile.authorized) {
      ElMessage.success(`已授权模板: ${profile.name}`);
    } else {
      ElMessage.success(`已取消授权: ${profile.name}`);
    }
  } catch (error) {
    // 失败时恢复状态
    console.error('授权状态变更失败:', error);
    profile.authorized = previousState;
    hasChanges.value = false;
    ElMessage.error('操作失败，请重试');
  }
}

/** 提交授权 */
async function handleSubmitAuthorize() {
  if (!hasChanges.value) {
    ElMessage.info('没有需要保存的更改');
    return;
  }

  loading.value = true;
  try {
    // 收集所有已授权的模板ID
    const profileIds = profileList.value
      .filter(p => p.authorized)
      .map(p => p.id);

    // 检查是否至少选择了一个模板
    if (profileIds.length === 0) {
      ElMessage.warning('请至少选择一个模板进行授权');
      return;
    }

    // 调用后端API保存授权状态
    await authorizeProfile({
      rootId: rootId.value,
      profileIds: profileIds
    });
    
    hasChanges.value = false;
    ElMessage.success('授权保存成功');
  } catch (error: any) {
    console.error('保存授权失败', error);
    const errMsg = error.response?.data?.msg || error.message || '保存授权失败';
    ElMessage.error(errMsg);
  } finally {
    loading.value = false;
  }
}



/** 查看模板详情 */
async function handleViewProfile(profile: any) {
  try {
    const res = await getProfile(profile.id);
    const profileData = res.data;
    
    console.log('原始profile数据:', profileData);
    
    // 解析conf字段，生成CertProfile组件需要的数据结构
    const conf = typeof profileData.conf === 'string' 
      ? JSON.parse(profileData.conf) 
      : profileData.conf;
    
    console.log('解析后的conf:', conf);
    
    const parsedProfile = {
      ...profileData,
      metadata: {
        category: profileData.type || conf.certLevel || '证书模板',
        details: profileData.description || conf.description || ''
      },
      certLevel: conf.certLevel || profileData.type || profileData.certLevel || '',
      maxSize: conf.maxSize || '-',
      validity: conf.validity || '-',
      notBeforeTime: conf.notBeforeTime || '-',
      keypairGeneration: conf.keypairGeneration || '-',
      keyAlgorithms: conf.keyAlgorithms || [],
      subject: conf.subject || [],
      extensions: conf.extensions || []
    };
    
    console.log('传递给CertProfile的数据:', parsedProfile);
    
    currentProfile.value = parsedProfile;
    showDetailDialog.value = true;
  } catch (error) {
    console.error('获取模板详情失败', error);
    ElMessage.error('获取模板详情失败');
  }
}

onMounted(async () => {
  rootId.value = route.query.id as string | number;
  if (!rootId.value) {
    ElMessage.error('缺少根证书ID');
    goBack();
    return;
  }
  
  await getRootCertInfo();
  await getAllProfiles();
  await getAuthorizedProfiles();
});
</script>

<style scoped lang="scss">
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.cert-info-section {
  margin-bottom: 20px;

  h3 {
    margin: 0 0 15px 0;
    font-size: 16px;
    font-weight: 600;
    color: #303133;
  }

  .cert-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px;
    background-color: #f5f7fa;
    border-radius: 4px;
    margin-bottom: 0;

    .cert-name {
      display: flex;
      align-items: center;
      font-size: 14px;

      .label {
        color: #909399;
        margin-right: 8px;
      }

      .value {
        color: #303133;
        font-weight: 500;
      }
    }
  }

  .cert-detail {
    margin-top: 15px;
    border: 1px solid #ebeef5;
    border-radius: 4px;
    padding: 20px;
    background-color: #fff;
  }
}

.template-section {
  margin-top: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }
}

pre {
  background-color: #f5f5f5;
  padding: 10px;
  border-radius: 4px;
  max-height: 400px;
  overflow-y: auto;
}
</style>