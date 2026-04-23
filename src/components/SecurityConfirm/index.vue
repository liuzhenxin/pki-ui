<template>
  <el-dialog
    :title="title"
    v-model="visible"
    width="400px"
    append-to-body
    :close-on-click-modal="false"
    @close="handleCancel"
  >
    <div class="security-confirm-content">
      <el-alert
        v-if="action"
        :title="`正在执行敏感操作: ${action}`"
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom: 20px"
      />
      <p style="margin-bottom: 15px; color: #606266">为了您的账户安全，请验证登录密码以继续：</p>
      <el-form ref="confirmFormRef" :model="form" :rules="rules" label-width="0" @submit.prevent>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入登录密码"
            show-password
            auto-complete="off"
            @keyup.enter="handleConfirm"
          >
            <template #prefix>
              <el-icon><Lock /></el-icon>
            </template>
          </el-input>
        </el-form-item>
      </el-form>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleCancel">取 消</el-button>
        <el-button type="primary" :loading="loading" @click="handleConfirm">确 定</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { Lock } from '@element-plus/icons-vue';
import { verifyPassword } from '@/api/login';
import { ElMessage } from 'element-plus';
import type { FormInstance } from 'element-plus';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: '安全确认'
  },
  action: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel']);

const visible = ref(false);
const loading = ref(false);
const confirmFormRef = ref<FormInstance>();

const form = reactive({
  password: ''
});

const rules = {
  password: [{ required: true, message: '密码不能为空', trigger: 'blur' }]
};

watch(() => props.modelValue, (val) => {
  visible.value = val;
  if (val) {
    form.password = '';
  }
});

watch(() => visible.value, (val) => {
  emit('update:modelValue', val);
});

async function handleConfirm() {
  if (!confirmFormRef.value) return;
  
  await confirmFormRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true;
      try {
        const success = await verifyPassword(form.password);
        if (success) {
          emit('confirm');
          visible.value = false;
        } else {
          ElMessage.error('密码验证失败，请重新输入');
        }
      } catch (error: any) {
        ElMessage.error(error.message || '验证过程发生错误');
      } finally {
        loading.value = false;
      }
    }
  });
}

function handleCancel() {
  visible.value = false;
  emit('cancel');
}
</script>

<style scoped lang="scss">
.security-confirm-content {
  padding: 10px 0;
}
</style>
