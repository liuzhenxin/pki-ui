<template>
  <div
    class="sidebar-logo-container"
    :class="{ collapse: collapse }"
    :style="{ backgroundColor: sideTheme === 'theme-dark' ? variables.menuBackground : variables.menuLightBackground }"
  >
    <transition :enter-active-class="proxy?.animate.logoAnimate.enter" mode="out-in">
      <router-link v-if="collapse" key="collapse" class="sidebar-logo-link" to="/">
        <span class="sidebar-logo">{{ logoText }}</span>
      </router-link>
      <router-link v-else key="expand" class="sidebar-logo-link" to="/">
        <span class="sidebar-logo">{{ logoText }}</span>
        <h1 class="sidebar-title" :style="{ color: sideTheme === 'theme-dark' ? variables.logoTitleColor : variables.logoLightTitleColor }">
          {{ name }}
        </h1>
      </router-link>
    </transition>
  </div>
</template>

<script setup lang="ts">
import variables from '@/assets/styles/variables.module.scss';
import { useSettingsStore } from '@/store/modules/settings';
import { useUserStore } from '@/store/modules/user';
import { getTenant } from '@/api/system/tenant';
import { useRoute } from 'vue-router';
const { proxy } = getCurrentInstance() as ComponentInternalInstance;

defineProps({
  collapse: {
    type: Boolean,
    required: true
  }
});

const title = ref(import.meta.env.VITE_APP_LOGO_TITLE);
const name = ref(import.meta.env.VITE_APP_TITLE);
const logoText = ref('CA');
const settingsStore = useSettingsStore();
const userStore = useUserStore();
const route = useRoute();
const sideTheme = computed(() => settingsStore.sideTheme);

function syncLogoText(tenantId?: string | number | null) {
  const idStr = String(tenantId || '');
  if (idStr === '2' || route.path.startsWith('/license')) {
    logoText.value = 'LIC';
  } else if (idStr === '3') {
    logoText.value = 'KMC';
  } else if (idStr === '10') {
    logoText.value = 'NAS';
  } else if (idStr === '5') {
    logoText.value = 'RA';
  } else if (idStr === '4' || !idStr) {
    logoText.value = 'CA';
  } else {
    logoText.value = 'CA';
  }
}

onMounted(() => {
  const tenantId = userStore.tenantId || localStorage.getItem('tenantId');
  syncLogoText(tenantId);
  if (tenantId) {
    getTenant(tenantId).then((res) => {
      if (res.data) {
        name.value = res.data.name;
        // 动态设置 Logo 标题
        const idStr = String(tenantId);
        if (idStr === '2') {
          title.value = 'License授权系统';
          name.value = '授权系统';
        } else if (idStr === '3') {
          title.value = 'KMC密钥管理中心';
        } else if (idStr === '10') {
          title.value = 'NAS网络存储管理系统';
        } else if (idStr === '5') {
          title.value = 'RA注册认证系统';
        } else if (idStr === '4') {
          title.value = 'CA证书认证系统';
        } else {
          title.value = 'CA证书认证系统';
        }
        syncLogoText(idStr);
      }
    });
  }
});
</script>

<style lang="scss" scoped>
.sidebarLogoFade-enter-active {
  transition: opacity 1.5s;
}

.sidebarLogoFade-enter,
.sidebarLogoFade-leave-to {
  opacity: 0;
}

.sidebar-logo-container {
  position: relative;
  width: 100%;
  height: 50px;
  line-height: 50px;
  background: #2b2f3a;
  text-align: center;
  overflow: hidden;

  & .sidebar-logo-link {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;

    & .sidebar-logo {
      min-width: 34px;
      height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      margin-right: 12px;
      padding: 0 6px;
      border: 1px solid #409eff;
      border-radius: 5px;
      background: rgba(64, 158, 255, 0.12);
      color: #409eff;
      font-size: 13px;
      line-height: 22px;
      font-weight: 700;
      letter-spacing: 0;
    }

    & .sidebar-title {
      display: inline-block;
      margin: 0;
      color: #fff;
      font-weight: 600;
      line-height: 50px;
      font-size: 20px;
      font-family:
        Avenir,
        Helvetica Neue,
        Arial,
        Helvetica,
        sans-serif;
      vertical-align: middle;
    }
  }

  &.collapse {
    .sidebar-logo {
      margin-right: 0px;
    }
  }
}
</style>
