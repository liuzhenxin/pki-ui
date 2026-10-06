<template>
  <div class="svs-init-page">
    <h1>修改口令</h1>
    <p>当前账号必须先修改口令，之后才能进入签名验签服务器菜单。</p>
    <el-card shadow="never">
      <el-form label-width="96px" @submit.prevent>
        <el-form-item label="用户名">
          <el-input :model-value="username" disabled />
        </el-form-item>
        <el-form-item label="新口令">
          <el-input v-model="password" type="password" show-password autocomplete="new-password" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="submitting" @click="submit">保存</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { changeSvsPassword, clearMustChangePassword, responseText } from '@/api/svs/init';

const router = useRouter();
const username = sessionStorage.getItem('svs.username') || '';
const password = ref('');
const submitting = ref(false);
const mustChangePassword = true;

async function submit() {
  if (!username || !password.value) {
    ElMessage.warning('请输入新口令');
    return;
  }
  submitting.value = true;
  try {
    await changeSvsPassword(username, password.value);
    clearMustChangePassword(username);
    if (!mustChangePassword) {
      return;
    }
    await router.replace('/');
  } catch (error) {
    ElMessage.error(responseText(error) || '口令修改失败');
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.svs-init-page {
  padding: 20px;
}

.svs-init-page h1 {
  margin: 0 0 20px;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.2;
}
</style>
