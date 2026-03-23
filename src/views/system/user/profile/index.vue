<template>
  <div class="p-2">
    <el-row :gutter="20">
      <el-col :span="6" :xs="24">
        <el-card class="box-card">
          <template #header>
            <div class="clearfix">
              <span>个人信息</span>
            </div>
          </template>
          <div>
            <div class="text-center">
              <userAvatar />
            </div>
            <ul class="list-group list-group-striped">
              <li class="list-group-item">
                <svg-icon icon-class="user" />用户名称
                <div class="pull-right">{{ state.user.userName || state.user.username || '-' }}</div>
              </li>
              <li class="list-group-item" v-if="state.user.phonenumber">
                <svg-icon icon-class="phone" />手机号码
                <div class="pull-right">{{ state.user.phonenumber || state.user.mobile || '-' }}</div>
              </li>
              <li class="list-group-item" v-if="state.user.email">
                <svg-icon icon-class="email" />用户邮箱
                <div class="pull-right">{{ state.user.email || state.user.mail || '-' }}</div>
              </li>
              <li class="list-group-item" v-if="state.user.deptName || state.roleGroup">
                <svg-icon icon-class="tree" />所属部门
                <div v-if="state.user.deptName" class="pull-right">{{ state.user.deptName }} / {{ state.postGroup }}</div>
                <div v-else-if="state.roleGroup" class="pull-right">{{ state.roleGroup }}</div>
              </li>
              <li class="list-group-item" v-if="state.roleGroup">
                <svg-icon icon-class="peoples" />所属角色
                <div class="pull-right">{{ state.roleGroup }}</div>
              </li>
              <li class="list-group-item" v-if="state.user.createTime">
                <svg-icon icon-class="date" />创建日期
                <div class="pull-right">{{ state.user.createTime }}</div>
              </li>
              <li class="list-group-item" v-if="state.user.id">
                <svg-icon icon-class="peoples" />用户ID
                <div class="pull-right">{{ state.user.id }}</div>
              </li>
            </ul>
          </div>
        </el-card>
      </el-col>
      <el-col :span="18" :xs="24">
        <el-card>
          <template #header>
            <div class="clearfix">
              <span>基本资料</span>
            </div>
          </template>
          <el-tabs v-model="activeTab">
            <el-tab-pane label="基本资料" name="userinfo">
              <userInfo :user="userForm" />
            </el-tab-pane>
            <el-tab-pane label="修改密码" name="resetPwd">
              <resetPwd />
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup name="Profile" lang="ts">
import UserAvatar from './userAvatar.vue';
import UserInfo from './userInfo.vue';
import ResetPwd from './resetPwd.vue';
import { getUserProfile } from '@/api/system/user';
import { UserVO } from '@/api/system/user/types';

const activeTab = ref('userinfo');
interface State {
  user: Partial<UserVO>;
  roleGroup: string;
  postGroup: string;
}
const state = ref<State>({
  user: {},
  roleGroup: '',
  postGroup: ''
});

const userForm = ref({});

const getUser = async () => {
  const res = await getUserProfile();
  // 兼容新旧两种数据结构
  if (res.data.user) {
    // 旧格式：{ user: {...}, roles: [...], roleGroup: "...", postGroup: "..." }
    state.value.user = res.data.user;
    userForm.value = {
      ...res.data.user,
      nickName: res.data.user.nickName || res.data.user.userName || '',
      phonenumber: res.data.user.phonenumber || res.data.user.mobile || '',
      email: res.data.user.email || res.data.user.mail || ''
    };
    state.value.roleGroup = res.data.roleGroup || '';
    state.value.postGroup = res.data.postGroup || '';
  } else {
    // 新格式：直接是用户对象 {...}
    state.value.user = res.data;
    userForm.value = {
      ...res.data,
      nickName: res.data.nickName || res.data.userName || res.data.username || '',
      phonenumber: res.data.phonenumber || res.data.mobile || '',
      email: res.data.email || res.data.mail || ''
    };
    state.value.roleGroup = '';
    state.value.postGroup = '';
  }
};

onMounted(() => {
  getUser();
});
</script>
