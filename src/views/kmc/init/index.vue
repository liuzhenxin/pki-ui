<template>
  <div class="p-2">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>KMC 初始化</span>
          <el-button icon="Refresh" @click="loadInitInfo">刷新状态</el-button>
        </div>
      </template>

      <el-steps :active="activeStep" finish-status="success" align-center>
        <el-step title="协议确认" />
        <el-step title="环境检查" />
        <el-step title="账号初始化" />
        <el-step title="完成" />
      </el-steps>

      <div class="init-body">
        <section v-show="activeStep === 0" class="step-panel">
          <h3>密钥管理中心初始化</h3>
          <p class="muted">初始化将检查 KMC 运行环境，并提交管理员、审计员账号的初始化参数。</p>
          <el-alert
            title="请确认当前操作在受控环境中执行，初始化参数会影响 KMC 后续管理入口。"
            type="warning"
            :closable="false"
            show-icon
          />
          <el-checkbox v-model="agree" class="mt-4">我已确认初始化操作要求</el-checkbox>
        </section>

        <section v-show="activeStep === 1" class="step-panel">
          <div class="toolbar-line">
            <span class="section-title">环境检查</span>
            <el-button type="primary" plain icon="Refresh" :loading="envLoading" @click="loadEnvInfo">重新检测</el-button>
          </div>
          <el-table v-loading="envLoading" :data="envRows" border>
            <el-table-column prop="name" label="检测项" min-width="160" />
            <el-table-column prop="value" label="当前值" min-width="220" show-overflow-tooltip />
            <el-table-column prop="message" label="说明" min-width="220" show-overflow-tooltip />
            <el-table-column label="状态" width="120" align="center">
              <template #default="{ row }">
                <el-tag :type="row.ok ? 'success' : 'danger'">{{ row.ok ? '正常' : '异常' }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </section>

        <section v-show="activeStep === 2" class="step-panel">
          <el-form ref="formRef" :model="form" :rules="rules" label-width="120px" class="init-form">
            <el-divider content-position="left">管理员账号</el-divider>
            <el-form-item label="用户名" prop="adminUsername">
              <el-input v-model="form.adminUsername" />
            </el-form-item>
            <el-form-item label="登录密码" prop="adminPassword">
              <el-input v-model="form.adminPassword" type="password" show-password />
            </el-form-item>
            <el-form-item label="证书 PEM" prop="adminCertPem">
              <el-input v-model="form.adminCertPem" type="textarea" :rows="4" placeholder="可粘贴管理员证书 PEM，后端未强制时可留空" />
            </el-form-item>

            <el-divider content-position="left">审计员账号</el-divider>
            <el-form-item label="用户名" prop="auditorUsername">
              <el-input v-model="form.auditorUsername" />
            </el-form-item>
            <el-form-item label="登录密码" prop="auditorPassword">
              <el-input v-model="form.auditorPassword" type="password" show-password />
            </el-form-item>
            <el-form-item label="证书 PEM" prop="auditorCertPem">
              <el-input v-model="form.auditorCertPem" type="textarea" :rows="4" placeholder="可粘贴审计员证书 PEM，后端未强制时可留空" />
            </el-form-item>
          </el-form>
        </section>

        <section v-show="activeStep === 3" class="step-panel">
          <el-result icon="success" title="初始化流程已完成" sub-title="请重新登录后进入 KMC 管理功能。" />
        </section>
      </div>

      <div class="wizard-actions">
        <el-button :disabled="activeStep === 0 || submitLoading" @click="activeStep--">上一步</el-button>
        <el-button v-if="activeStep < 2" type="primary" :disabled="!canGoNext" @click="handleNext">下一步</el-button>
        <el-button v-else-if="activeStep === 2" type="primary" :loading="submitLoading" @click="submitInit">提交初始化</el-button>
        <el-button v-else type="primary" @click="router.push('/')">进入系统</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup name="KmcInit" lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import { getEnvInfo, getInitStatus, initAdmin } from '@/api/kmc/init';
import { unwrapKmcData } from '@/api/kmc/common';

interface EnvRow {
  name: string;
  value: string;
  message?: string;
  ok: boolean;
}

const router = useRouter();
const formRef = ref<FormInstance>();
const activeStep = ref(0);
const agree = ref(false);
const envLoading = ref(false);
const submitLoading = ref(false);
const initialized = ref(false);
const envRows = ref<EnvRow[]>([]);

const form = reactive({
  adminUsername: 'admin',
  adminPassword: '',
  adminCertPem: '',
  auditorUsername: 'auditor',
  auditorPassword: '',
  auditorCertPem: ''
});

const rules = reactive<FormRules>({
  adminUsername: [{ required: true, message: '请输入管理员用户名', trigger: 'blur' }],
  adminPassword: [{ required: true, message: '请输入管理员密码', trigger: 'blur' }],
  auditorUsername: [{ required: true, message: '请输入审计员用户名', trigger: 'blur' }],
  auditorPassword: [{ required: true, message: '请输入审计员密码', trigger: 'blur' }]
});

const normalizeEnvRows = (data: any): EnvRow[] => {
  if (Array.isArray(data)) {
    return data.map((item, index) => ({
      name: item.name ?? item.item ?? `检测项 ${index + 1}`,
      value: String(item.value ?? '-'),
      message: item.message ?? item.remark,
      ok: item.ok ?? item.status === 'success' ?? item.status === true
    }));
  }
  return Object.entries(data ?? {}).map(([name, value]: [string, any]) => ({
    name,
    value: String(value?.value ?? value ?? '-'),
    message: value?.message ?? value?.remark,
    ok: value?.ok ?? value?.status === 'success' ?? value === true
  }));
};

const allEnvOk = computed(() => envRows.value.length === 0 || envRows.value.every((item) => item.ok));
const canGoNext = computed(() => (activeStep.value === 0 ? agree.value : allEnvOk.value));

const loadInitInfo = async () => {
  try {
    const res = await getInitStatus();
    const data: any = unwrapKmcData(res);
    initialized.value = Boolean(data?.initialized ?? data?.init ?? data);
  } catch (error) {
    initialized.value = false;
  }
  await loadEnvInfo();
};

const loadEnvInfo = async () => {
  envLoading.value = true;
  try {
    const res = await getEnvInfo();
    envRows.value = normalizeEnvRows(unwrapKmcData(res));
  } catch (error) {
    envRows.value = [
      {
        name: 'KMC 初始化接口',
        value: '/kmc/v1/init/env',
        message: '接口暂不可用，请确认后端是否已启用初始化控制器。',
        ok: false
      }
    ];
  } finally {
    envLoading.value = false;
  }
};

const handleNext = async () => {
  if (activeStep.value === 0) {
    activeStep.value = 1;
    await loadEnvInfo();
    return;
  }
  activeStep.value++;
};

const submitInit = async () => {
  if (!formRef.value) {
    return;
  }
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) {
    return;
  }
  submitLoading.value = true;
  try {
    await initAdmin({
      admin: {
        username: form.adminUsername,
        password: form.adminPassword,
        certPem: form.adminCertPem
      },
      auditor: {
        username: form.auditorUsername,
        password: form.auditorPassword,
        certPem: form.auditorCertPem
      }
    });
    ElMessage.success('初始化提交成功');
    activeStep.value = 3;
  } finally {
    submitLoading.value = false;
  }
};

onMounted(loadInitInfo);
</script>

<style scoped lang="scss">
.card-header,
.toolbar-line,
.wizard-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.init-body {
  min-height: 460px;
  padding: 24px 0;
}

.step-panel {
  max-width: 960px;
  margin: 0 auto;
}

.muted {
  color: var(--el-text-color-secondary);
}

.section-title {
  font-size: 16px;
  font-weight: 600;
}

.init-form {
  max-width: 720px;
  margin: 0 auto;
}

.wizard-actions {
  justify-content: center;
  gap: 12px;
}

.mt-4 {
  margin-top: 16px;
}
</style>
