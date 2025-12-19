<template>
  <div class="app-container">
    <el-card>
      <el-steps :active="active" finish-status="success" simple>
        <el-step title="协议" />
        <el-step title="环境监测" />
        <el-step title="管理员设置" />
        <el-step title="审计员设置" />
        <el-step title="完成" />
      </el-steps>

      <div class="wizard-content">
        <div v-if="active === 0" class="step-content">
          <h2>欢迎使用 KMC</h2>
          <div class="agreement-text">
            <p>请在使用前阅读并同意以下协议...</p>
            <p>这里是协议的具体内容，可以放置很长的文本。</p>
          </div>
          <el-checkbox v-model="agree" class="agree-checkbox">我已阅读并同意用户协议</el-checkbox>
        </div>

        <div v-if="active === 1" class="step-content">
          <h2>环境监测</h2>
          <el-table :data="envData" style="width: 80%" v-loading="envLoading">
            <el-table-column prop="name" label="检测项" />
            <el-table-column prop="value" label="当前值" />
            <el-table-column label="状态">
              <template #default="{ row }">
                <el-tag :type="row.status === 'success' ? 'success' : 'danger'">
                  {{ row.status === 'success' ? '正常' : '异常' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div v-if="active === 2" class="step-content">
          <h2>管理员设置</h2>
          <el-form :model="adminForm" :rules="adminRules" ref="adminFormRef" label-width="100px" style="width: 400px">
            <el-form-item label="用户名" prop="username">
              <el-input v-model="adminForm.username" disabled />
            </el-form-item>
            <el-form-item label="密码" prop="password">
              <el-input v-model="adminForm.password" type="password" show-password placeholder="请输入密码" />
            </el-form-item>
            <el-form-item label="确认密码" prop="confirmPassword">
              <el-input v-model="adminForm.confirmPassword" type="password" show-password placeholder="请再次输入密码" />
            </el-form-item>
            <el-form-item label="上传证书">
              <el-upload
                ref="adminUploadRef"
                action="#"
                :limit="1"
                :on-exceed="handleAdminExceed"
                :auto-upload="false"
                v-model:file-list="adminFileList"
                accept=".cer,.crt,.pem"
              >
                <el-button type="primary">点击上传</el-button>
                <template #tip>
                  <div class="el-upload__tip">
                    请上传 .cer, .crt, 或 .pem 格式的 X.509 证书文件。
                  </div>
                </template>
              </el-upload>
            </el-form-item>
          </el-form>
        </div>

        <div v-if="active === 3" class="step-content">
          <h2>审计员设置</h2>
          <el-form :model="auditorForm" :rules="auditorRules" ref="auditorFormRef" label-width="100px" style="width: 400px">
            <el-form-item label="用户名" prop="username">
              <el-input v-model="auditorForm.username" disabled />
            </el-form-item>
            <el-form-item label="密码" prop="password">
              <el-input v-model="auditorForm.password" type="password" show-password placeholder="请输入密码" />
            </el-form-item>
            <el-form-item label="确认密码" prop="confirmPassword">
              <el-input v-model="auditorForm.confirmPassword" type="password" show-password placeholder="请再次输入密码" />
            </el-form-item>
            <el-form-item label="上传证书">
              <el-upload
                ref="auditorUploadRef"
                action="#"
                :limit="1"
                :on-exceed="handleAuditorExceed"
                :auto-upload="false"
                v-model:file-list="auditorFileList"
                accept=".cer,.crt,.pem"
              >
                <el-button type="primary">点击上传</el-button>
                 <template #tip>
                  <div class="el-upload__tip">
                    请上传 .cer, .crt, 或 .pem 格式的 X.509 证书文件。
                  </div>
                </template>
              </el-upload>
            </el-form-item>
          </el-form>
        </div>

        <div v-if="active === 4" class="step-content">
          <h2>安装完成</h2>
          <el-result icon="success" title="初始化成功" sub-title="您可以点击下方按钮进入系统">
          </el-result>
        </div>
      </div>

      <div class="wizard-actions">
        <el-button @click="prev" :disabled="active === 0 || active === 4">上一步</el-button>
        <el-button type="primary" @click="next" :disabled="!canNext">{{ nextButtonText }}</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue';
import { ElMessage, FormInstance, FormRules, UploadInstance, UploadUserFile, UploadProps, UploadRawFile, genFileId } from 'element-plus';
import { useRouter } from 'vue-router';
import { getEnvInfo, initAdmin } from '@/api/system/tenant';
import { usePermissionStore } from '@/store/modules/permission';

const router = useRouter();
const permissionStore = usePermissionStore();
const active = ref(0);
const agree = ref(false);

// 环境监测
const envLoading = ref(false);
const envData = ref([]);
const allEnvOk = computed(() => envData.value.every(item => item.status === 'success'));

const loadEnvInfo = async () => {
  envLoading.value = true;
  try {
    const res = await getEnvInfo();
    envData.value = Object.values(res.data);
  } catch (error) {
    ElMessage.error('获取环境信息失败');
  } finally {
    envLoading.value = false;
  }
};

watch(active, (newActive) => {
  if (newActive === 1) {
    loadEnvInfo();
  }
});


// 管理员设置
const adminFormRef = ref<FormInstance>();
const adminUploadRef = ref<UploadInstance>();
const adminFileList = ref<UploadUserFile[]>([]);
const adminForm = reactive({
  username: 'admin',
  password: '',
  confirmPassword: ''
});
const adminRules = reactive<FormRules>({
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== adminForm.password) {
          callback(new Error('两次输入的密码不一致'));
        } else {
          callback();
        }
      },
      trigger: 'blur'
    }
  ]
});

const handleAdminExceed: UploadProps['onExceed'] = (files) => {
  adminUploadRef.value!.clearFiles()
  const file = files[0] as UploadRawFile
  file.uid = genFileId()
  adminUploadRef.value!.handleStart(file)
}

// 审计员设置
const auditorFormRef = ref<FormInstance>();
const auditorUploadRef = ref<UploadInstance>();
const auditorFileList = ref<UploadUserFile[]>([]);
const auditorForm = reactive({
  username: 'auditor',
  password: '',
  confirmPassword: ''
});
const auditorRules = reactive<FormRules>({
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== auditorForm.password) {
          callback(new Error('两次输入的密码不一致'));
        } else {
          callback();
        }
      },
      trigger: 'blur'
    }
  ]
});

const handleAuditorExceed: UploadProps['onExceed'] = (files) => {
  auditorUploadRef.value!.clearFiles()
  const file = files[0] as UploadRawFile
  file.uid = genFileId()
  auditorUploadRef.value!.handleStart(file)
}


const nextButtonText = computed(() => {
  if (active.value === 4) {
    return '进入系统';
  }
  return '下一步';
});

const canNext = computed(() => {
  if (active.value === 0) {
    return agree.value;
  }
  if (active.value === 1) {
    return allEnvOk.value;
  }
  if (active.value === 2) {
    return adminForm.password && adminForm.confirmPassword;
  }
  if (active.value === 3) {
    return auditorForm.password && auditorForm.confirmPassword;
  }
  return true;
});

const next = async () => {
  if (active.value < 4) {
    if (active.value === 2) {
      if (!adminFormRef.value) return;
      await adminFormRef.value.validate(async (valid) => {
        if (valid) {
          try {
            const formData = new FormData();
            formData.append('username', adminForm.username);
            formData.append('password', adminForm.password);
            if (adminFileList.value.length > 0 && adminFileList.value[0].raw) {
              formData.append('file', adminFileList.value[0].raw);
            }
            await initAdmin(formData);
            ElMessage.success('管理员设置成功');
            active.value++;
          } catch (error) {
            ElMessage.error('管理员设置失败');
          }
        }
      });
    } else if (active.value === 3) {
      if (!auditorFormRef.value) return;
      await auditorFormRef.value.validate(async (valid) => {
        if (valid) {
          try {
            const formData = new FormData();
            formData.append('username', auditorForm.username);
            formData.append('password', auditorForm.password);
            if (auditorFileList.value.length > 0 && auditorFileList.value[0].raw) {
              formData.append('file', auditorFileList.value[0].raw);
            }
            // 这里假设使用同一个接口，或者您可以添加一个新的 initAuditor 接口
            await initAdmin(formData);
            ElMessage.success('审计员设置成功');
            active.value++;
          } catch (error) {
            ElMessage.error('审计员设置失败');
          }
        }
      });
    } else {
      active.value++;
    }
  } else {
    // 完成向导，重新加载路由并跳转
    ElMessage.success('初始化完成，正在为您跳转...');
    await permissionStore.generateRoutes();
    router.push('/');
  }
};

const prev = () => {
  if (active.value > 0) {
    active.value--;
  }
};

onMounted(() => {
  // 可以在这里做一些初始化操作
});
</script>

<style scoped lang="scss">
.wizard-content {
  margin-top: 20px;
  padding: 40px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  min-height: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.step-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.agreement-text {
  width: 80%;
  height: 200px;
  overflow-y: auto;
  border: 1px solid #dcdfe6;
  padding: 10px;
  margin-bottom: 20px;
  border-radius: 4px;
  background-color: #f5f7fa;
}

.agree-checkbox {
  margin-top: 10px;
}

.wizard-actions {
  margin-top: 20px;
  text-align: center;
}
</style>
