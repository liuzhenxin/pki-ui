<template>
  <div :class="{ 'has-logo': showLogo, 'ocsp-sidebar': isOcspTenant }" :style="{ backgroundColor: bgColor }">
    <router-link
      v-if="showLogo && isOcspTenant"
      class="ocsp-brand"
      :class="{ 'is-dark': sideTheme === 'theme-dark' }"
      to="/"
      aria-label="OCSP 在线证书状态服务"
      ><span>OCSP</span><b v-if="!isCollapse">在线状态服务</b></router-link
    >
    <logo v-else-if="showLogo" :collapse="isCollapse" />
    <el-scrollbar :class="sideTheme" wrap-class="scrollbar-wrapper">
      <transition :enter-active-class="proxy?.animate.menuSearchAnimate.enter" mode="out-in">
        <el-menu
          :default-active="activeMenu"
          :collapse="isCollapse"
          :background-color="bgColor"
          :text-color="textColor"
          :unique-opened="true"
          :active-text-color="theme"
          :collapse-transition="false"
          :popper-offset="12"
          mode="vertical"
        >
          <sidebar-item v-for="(r, index) in sidebarRouters" :key="r.path + index" :item="r" :base-path="r.path" />
        </el-menu>
      </transition>
    </el-scrollbar>
  </div>
</template>

<script setup lang="ts">
import Logo from './Logo.vue';
import { useUserStore } from '@/store/modules/user';
import SidebarItem from './SidebarItem.vue';
import variables from '@/assets/styles/variables.module.scss';
import { useAppStore } from '@/store/modules/app';
import { useSettingsStore } from '@/store/modules/settings';
import { usePermissionStore } from '@/store/modules/permission';
import { RouteRecordRaw } from 'vue-router';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const route = useRoute();
const userStore = useUserStore();
const isOcspTenant = computed(() => String(userStore.tenantId) === '6');
const appStore = useAppStore();
const settingsStore = useSettingsStore();
const permissionStore = usePermissionStore();
const sidebarRouters = computed<RouteRecordRaw[]>(() => permissionStore.getSidebarRoutes());
const showLogo = computed(() => settingsStore.sidebarLogo);
const sideTheme = computed(() => settingsStore.sideTheme);
const theme = computed(() => settingsStore.theme);
const isCollapse = computed(() => !appStore.sidebar.opened);

const activeMenu = computed(() => {
  const { meta, path } = route;
  // if set path, the sidebar will highlight the path you set
  if (meta.activeMenu) {
    return meta.activeMenu;
  }
  return path;
});

const bgColor = computed(() => (sideTheme.value === 'theme-dark' ? variables.menuBackground : variables.menuLightBackground));
const textColor = computed(() => (sideTheme.value === 'theme-dark' ? variables.menuColor : variables.menuLightColor));
</script>

<style scoped lang="scss">
.ocsp-brand {
  height: 50px;
  display: flex !important;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--el-text-color-primary);
}
.ocsp-brand span {
  padding: 2px 5px;
  border: 1px solid var(--el-color-primary-light-5);
  border-radius: 5px;
  font-size: 12px;
  font-weight: 700;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.ocsp-brand.is-dark {
  color: #f4f7fb;
}
.ocsp-brand b {
  font-size: 14px;
  font-weight: 600;
}

.ocsp-sidebar :deep(.el-menu-item.is-active) {
  box-shadow: inset 3px 0 0 currentColor;
  font-weight: 600;
}
.ocsp-sidebar :deep(.el-menu-item),
.ocsp-sidebar :deep(.el-sub-menu__title) {
  font-size: 14px;
  letter-spacing: 0.2px;
}
.ocsp-sidebar :deep(a:focus-visible),
.ocsp-sidebar :deep(.el-sub-menu__title:focus-visible) {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -3px;
  border-radius: 8px;
}
.ocsp-sidebar :deep(.el-sub-menu.is-active > .el-sub-menu__title) {
  font-weight: 600;
}
</style>
