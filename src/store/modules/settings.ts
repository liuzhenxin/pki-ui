import { defineStore } from 'pinia';
import defaultSettings from '@/settings';
import { useDynamicTitle } from '@/utils/dynamicTitle';
import { useStorage } from '@vueuse/core';
import { ref, watch } from 'vue';

export const useSettingsStore = defineStore('setting', () => {
  const storageSetting = useStorage('layout-setting', {
    topNav: defaultSettings.topNav,
    tagsView: defaultSettings.tagsView,
    tagsIcon: defaultSettings.tagsIcon,
    fixedHeader: defaultSettings.fixedHeader,
    sidebarLogo: defaultSettings.sidebarLogo,
    dynamicTitle: defaultSettings.dynamicTitle,
    sideTheme: defaultSettings.sideTheme,
    theme: defaultSettings.theme,
    dark: defaultSettings.dark
  });
  const title = ref<string>(defaultSettings.title);
  const appTitle = ref<string>(import.meta.env.VITE_APP_TITLE);
  const theme = ref<string>(storageSetting.value.theme);
  const sideTheme = ref<string>(storageSetting.value.sideTheme);
  const showSettings = ref<boolean>(defaultSettings.showSettings);
  const topNav = ref<boolean>(storageSetting.value.topNav);
  const tagsView = ref<boolean>(storageSetting.value.tagsView);
  const tagsIcon = ref<boolean>(storageSetting.value.tagsIcon);
  const fixedHeader = ref<boolean>(storageSetting.value.fixedHeader);
  const sidebarLogo = ref<boolean>(storageSetting.value.sidebarLogo);
  const dynamicTitle = ref<boolean>(storageSetting.value.dynamicTitle);
  const animationEnable = ref<boolean>(defaultSettings.animationEnable);
  const dark = ref<boolean>(storageSetting.value.dark);

  const setTitle = (value: string) => {
    title.value = value;
    useDynamicTitle();
  };

  const setAppTitle = (value: string) => {
    appTitle.value = value;
    useDynamicTitle();
  };

  watch(dark, (val) => {
    storageSetting.value.dark = val;
  });

  return {
    title,
    appTitle,
    theme,
    sideTheme,
    showSettings,
    topNav,
    tagsView,
    tagsIcon,
    fixedHeader,
    sidebarLogo,
    dynamicTitle,
    animationEnable,
    dark,
    setTitle,
    setAppTitle
  };
});
