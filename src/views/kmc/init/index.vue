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
            <p>版权所有（C ）2025 北京国富安电子商务安全认证有限公司</p>
            <p><strong>导言</strong></p>
            <p>
              密码管理中心，系北京国富安电子商务安全认证有限公司独立开发软件，北京国富安电子商务安全认证有限公司依法独立享有该软件之所有权利，此软件为商业软件提供付费使用。
            </p>
            <p>
              该软件使用者（含个人、法人或其它组织）：的一般性、特殊性、意外性或间接性损失，不负任何责任（包括但不限于，资料损失，资料执行不精确，或
              应由您或第三人承担的损失，或本程序无法与其他程序运作等），即便该版权所有者或其他组织已经被告知程序有此类损失的可能性也是如此。
            </p>
            <p>非经北京国富安电子商务安全认证有限公司授权许可，不得将之用于盈利或非盈利性的任何用途。</p>
            <p>
              为适应实际的计算机应用环境，对其功能、性能、界面，可以进行必要的修改
              ，但不得去除北京国富安电子商务安全认证有限公司的版本标示；未经北京国富安电子商务安全认证有限公司书面授权许可，不得向任何第三方提供修改后的软件。
            </p>
            <p>
              使用该软件必须保留北京国富安电子商务安全认证有限公司的版权声明，将该软件从原有自然语言文字转换成另一自然语言文字的，仍应注明出处，并不得向任何第三方提供修改后的软件。
            </p>
            <p>不得有其他侵犯北京国富安电子商务安全认证有限公司软件版权之行为。</p>
            <p>
              凡有上述侵权行为的个人、法人或其它组织，必须立即停止侵权并对其侵权造成的一切不良后果承担全部责任。对此前，尤其是此后侵犯北京国富安电子商务安全认证有限公司版权的行为，北京国富安电子商务安全认证有限公司将依据《著作权法》、《计算机软件保护条例》
              等相关法律、法规追究其经济责任和法律责任。
            </p>
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
            <el-form-item label="上传证书" prop="cert">
              <el-upload
                ref="adminUploadRef"
                action="#"
                :limit="1"
                :on-exceed="handleAdminExceed"
                :auto-upload="false"
                :on-change="handleAdminFileChange"
                :on-remove="handleAdminRemove"
                v-model:file-list="adminFileList"
                accept=".cer,.crt,.pem"
              >
                <el-button type="primary">点击上传</el-button>
                <template #tip>
                  <div class="el-upload__tip">请上传 .cer, .crt, 或 .pem 格式的 X.509 证书文件。</div>
                </template>
              </el-upload>
              <el-button v-if="adminCertPem" type="text" @click="showAdminCertDialog = true">查看证书详情</el-button>
            </el-form-item>
            <el-form-item label="设置密码" prop="password">
              <el-input v-model="adminForm.password" type="password" show-password placeholder="请输入新密码" />
            </el-form-item>
            <el-form-item label="确认密码" prop="confirmPassword">
              <el-input v-model="adminForm.confirmPassword" type="password" show-password placeholder="请再次输入新密码" />
            </el-form-item>
          </el-form>
        </div>

        <div v-if="active === 3" class="step-content">
          <h2>审计员设置</h2>
          <el-form :model="auditorForm" :rules="auditorRules" ref="auditorFormRef" label-width="100px" style="width: 400px">
            <el-form-item label="用户名" prop="username">
              <el-input v-model="auditorForm.username" disabled />
            </el-form-item>
            <el-form-item label="上传证书" prop="cert">
              <el-upload
                ref="auditorUploadRef"
                action="#"
                :limit="1"
                :on-exceed="handleAuditorExceed"
                :auto-upload="false"
                :on-change="handleAuditorFileChange"
                :on-remove="handleAuditorRemove"
                v-model:file-list="auditorFileList"
                accept=".cer,.crt,.pem"
              >
                <el-button type="primary">点击上传</el-button>
                <template #tip>
                  <div class="el-upload__tip">请上传 .cer, .crt, 或 .pem 格式的 X.509 证书文件。</div>
                </template>
              </el-upload>
              <el-button v-if="auditorCertPem" type="text" @click="showAuditorCertDialog = true">查看证书详情</el-button>
            </el-form-item>
            <el-form-item label="设置密码" prop="password">
              <el-input v-model="auditorForm.password" type="password" show-password placeholder="请输入新密码" />
            </el-form-item>
            <el-form-item label="确认密码" prop="confirmPassword">
              <el-input v-model="auditorForm.confirmPassword" type="password" show-password placeholder="请再次输入新密码" />
            </el-form-item>
          </el-form>
        </div>

        <div v-if="active === 4" class="step-content">
          <h2>安装完成</h2>
          <el-result icon="success" title="初始化成功" sub-title="您可以点击下方按钮进入系统"> </el-result>
        </div>
      </div>

      <div class="wizard-actions">
        <el-button @click="prev" :disabled="active === 0 || active === 4">上一步</el-button>
        <el-button type="primary" @click="next" :disabled="!canNext">{{ nextButtonText }}</el-button>
      </div>
    </el-card>

    <!-- 管理员证书详情弹窗 -->
    <el-dialog v-model="showAdminCertDialog" title="管理员证书详情" width="60%">
      <X509Cert v-if="showAdminCertDialog" :certPem="adminCertPem" />
    </el-dialog>

    <!-- 审计员证书详情弹窗 -->
    <el-dialog v-model="showAuditorCertDialog" title="审计员证书详情" width="60%">
      <X509Cert v-if="showAuditorCertDialog" :certPem="auditorCertPem" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue';
import { ElMessage, FormInstance, FormRules, UploadInstance, UploadUserFile, UploadProps, UploadRawFile, genFileId, UploadFile } from 'element-plus';
import { useRouter } from 'vue-router';
import { getEnvInfo, initAdmin } from '@/api/kmc/init';
import { uploadUserCert } from '@/api/system/user';
import { getTenant, updateTenant } from '@/api/system/tenant';
import { usePermissionStore } from '@/store/modules/permission';
import { useUserStore } from '@/store/modules/user';
import X509Cert from '@/components/X509Cert/index.vue';
const { proxy } = getCurrentInstance() as ComponentInternalInstance;
import * as forge from 'node-forge';

const router = useRouter();
const permissionStore = usePermissionStore();
const userStore = useUserStore();
const active = ref(0);
const agree = ref(false);

// 环境监测
const envLoading = ref(false);
const envData = ref([]);
const allEnvOk = computed(() => envData.value.every((item) => item.status === 'success'));

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

// 证书解析相关
const readFileContent = async (file: File): Promise<string | null> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        // 检查是否是 PEM 格式
        if (content.includes('-----BEGIN CERTIFICATE-----')) {
          resolve(content);
        } else {
          // 尝试将 DER 转换为 PEM
          try {
            const derBuffer = forge.util.createBuffer(content, 'binary');
            const asn1 = forge.asn1.fromDer(derBuffer);
            const cert = forge.pki.certificateFromAsn1(asn1);
            const pem = forge.pki.certificateToPem(cert);
            resolve(pem);
          } catch (derError) {
            // 如果 forge 无法解析（如 SM2），尝试手动包装成 PEM
            const base64 = forge.util.encode64(content);
            const pem = `-----BEGIN CERTIFICATE-----\n${base64.match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----`;
            resolve(pem);
          }
        }
      } catch (error) {
        console.error('File reading error:', error);
        resolve(null);
      }
    };
    // 读取为二进制字符串以兼容 DER
    reader.readAsBinaryString(file);
    reader.onerror = () => reject(null);
  });
};

// 管理员设置
const adminFormRef = ref<FormInstance>();
const adminUploadRef = ref<UploadInstance>();
const adminFileList = ref<UploadUserFile[]>([]);
const adminCertPem = ref<string>('');
const showAdminCertDialog = ref(false);
const adminForm = reactive({
  username: 'admin',
  password: '',
  confirmPassword: ''
});
const adminRules = reactive<FormRules>({
  password: [{ required: true, message: '请输入新密码', trigger: 'blur' }],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
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
  adminUploadRef.value!.clearFiles();
  const file = files[0] as UploadRawFile;
  file.uid = genFileId();
  adminUploadRef.value!.handleStart(file);
};

const handleAdminFileChange: UploadProps['onChange'] = async (uploadFile, uploadFiles) => {
  if (uploadFile.raw) {
    const pem = await readFileContent(uploadFile.raw);
    if (pem) {
      adminCertPem.value = pem;
      showAdminCertDialog.value = true; // 上传成功后自动弹出详情
    } else {
      ElMessage.error('上传文件必须是x509证书文件');
      adminCertPem.value = '';
      adminUploadRef.value!.clearFiles(); // 清除错误文件
    }
  } else {
    adminCertPem.value = '';
  }
};

const handleAdminRemove: UploadProps['onRemove'] = () => {
  adminCertPem.value = '';
};

// 审计员设置
const auditorFormRef = ref<FormInstance>();
const auditorUploadRef = ref<UploadInstance>();
const auditorFileList = ref<UploadUserFile[]>([]);
const auditorCertPem = ref<string>('');
const showAuditorCertDialog = ref(false);
const auditorForm = reactive({
  username: 'auditor',
  password: '',
  confirmPassword: ''
});
const auditorRules = reactive<FormRules>({
  password: [{ required: true, message: '请输入新密码', trigger: 'blur' }],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
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
  auditorUploadRef.value!.clearFiles();
  const file = files[0] as UploadRawFile;
  file.uid = genFileId();
  auditorUploadRef.value!.handleStart(file);
};

const handleAuditorFileChange: UploadProps['onChange'] = async (uploadFile, uploadFiles) => {
  if (uploadFile.raw) {
    const pem = await readFileContent(uploadFile.raw);
    if (pem) {
      auditorCertPem.value = pem;
      showAuditorCertDialog.value = true; // 上传成功后自动弹出详情
    } else {
      ElMessage.error('上传文件必须是x509证书文件');
      auditorCertPem.value = '';
      auditorUploadRef.value!.clearFiles(); // 清除错误文件
    }
  } else {
    auditorCertPem.value = '';
  }
};

const handleAuditorRemove: UploadProps['onRemove'] = () => {
  auditorCertPem.value = '';
};

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
    return adminForm.password && adminForm.confirmPassword && adminCertPem.value;
  }
  if (active.value === 3) {
    return auditorForm.password && auditorForm.confirmPassword && auditorCertPem.value;
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
            // 上传证书 (包含密码)
            if (adminFileList.value.length > 0 && adminFileList.value[0].raw) {
              const formData = new FormData();
              formData.append('file', adminFileList.value[0].raw);
              formData.append('id', '301'); // 管理员ID
              formData.append('password', adminForm.password); // 新增密码字段
              await uploadUserCert(formData);
            }

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
            // 上传证书 (包含密码)
            if (auditorFileList.value.length > 0 && auditorFileList.value[0].raw) {
              const formData = new FormData();
              formData.append('file', auditorFileList.value[0].raw);
              formData.append('id', '302'); // 审计员ID
              formData.append('password', auditorForm.password); // 新增密码字段
              await uploadUserCert(formData);
            }

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
    // 完成向导
    try {
      // 1. 获取租户信息
      const tenantId = import.meta.env.VITE_TENANT_ID;
      const tenantRes = await getTenant(tenantId);
      if (tenantRes.data) {
        const tenantInfo = tenantRes.data;

        // 2. 调用修改租户接口 (如果需要更新其他信息，或者仅仅是为了触发某些逻辑)
        const updateData = {
          co: {
            ...tenantInfo,
            status: '1' // 确保状态是1
          }
        };
        await updateTenant(updateData);
      }

      ElMessage.success('初始化完成，请重新登录');

      // 3. 登出并跳转到登录页
      userStore.logout().then(() => {
        router.replace({
          path: '/login',
          query: {
            redirect: encodeURIComponent(router.currentRoute.value.fullPath || '/')
          }
        });
        proxy?.$tab.closeAllPage();
      });

    } catch (error) {
      console.error('初始化后续操作失败', error);
      ElMessage.error('初始化后续操作失败，请联系管理员');
    }
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
  height: 460px;
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

.cert-info {
  margin-top: 10px;
  padding: 10px;
  background-color: #f0f9eb;
  border: 1px solid #e1f3d8;
  border-radius: 4px;
  width: 100%;
  font-size: 12px;
  color: #67c23a;

  p {
    margin: 5px 0;
    word-break: break-all;
  }
}
</style>
