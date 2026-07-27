<script setup lang="ts">
/**
 * BaseIcon —— 统一的 SVG 图标组件。
 *
 * @bdd EF-NAME-001 组件使用多单词 PascalCase 命名
 * 以 `Base` 前缀 + 多单词 PascalCase 命名，避免与 HTML 内置元素（如 <icon>）混淆，
 * 符合 Vue 官方风格指南对基础组件的命名约定。
 */
defineProps<{
  name: string
  size?: number
  strokeWidth?: number
}>()
</script>

<template>
  <svg
    class="icon"
    :width="size ?? 18"
    :height="size ?? 18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth ?? 1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'grid'">
      <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.5" />
      <rect x="14" y="14" width="6.5" height="6.5" rx="1.5" />
    </template>
    <template v-else-if="name === 'clock'">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5l3.2 2" />
    </template>
    <template v-else-if="name === 'check'">
      <path d="m5 12.5 4.2 4.2L19.5 6.8" />
    </template>
    <template v-else-if="name === 'folder'">
      <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8.2a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
      <path d="M3.8 10h16.5" />
    </template>
    <template v-else-if="name === 'plus'">
      <path d="M12 5v14M5 12h14" />
    </template>
    <template v-else-if="name === 'upload'">
      <path d="M12 16V4" />
      <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
      <path d="M5 15.5v2.4a2.1 2.1 0 0 0 2.1 2.1h9.8a2.1 2.1 0 0 0 2.1-2.1v-2.4" />
    </template>
    <template v-else-if="name === 'search'">
      <circle cx="10.8" cy="10.8" r="6.7" />
      <path d="m16 16 4.2 4.2" />
    </template>
    <template v-else-if="name === 'filter'">
      <path d="M4 6h16M7 12h10M10 18h4" />
    </template>
    <template v-else-if="name === 'chevron-down'">
      <path d="m6.5 9 5.5 5.5L17.5 9" />
    </template>
    <template v-else-if="name === 'chevron-right'">
      <path d="m9 5.5 6.5 6.5L9 18.5" />
    </template>
    <template v-else-if="name === 'trash'">
      <path d="M4.5 7.5h15" />
      <path d="M9.5 7.5V5.3h5v2.2M7 7.5l.8 12h8.4l.8-12" />
      <path d="M10 11v5.2M14 11v5.2" />
    </template>
    <template v-else-if="name === 'edit'">
      <path d="m14.5 5.5 4 4" />
      <path d="M5 19h4l10-10a2.8 2.8 0 0 0-4-4L5 15z" />
      <path d="m13.5 6.5 4 4" />
    </template>
    <template v-else-if="name === 'spark'">
      <path d="m12 3 1.1 5.6L18.5 10l-5.4 1.4L12 17l-1.1-5.6L5.5 10l5.4-1.4z" />
      <path d="m19 15 .5 2.5L22 18l-2.5.5L19 21l-.5-2.5L16 18l2.5-.5z" />
    </template>
    <template v-else-if="name === 'sun'">
      <circle cx="12" cy="12" r="3.6" />
      <path d="M12 2.8v2M12 19.2v2M21.2 12h-2M4.8 12h-2M18.5 5.5 17 7M7 17l-1.5 1.5M18.5 18.5 17 17M7 7 5.5 5.5" />
    </template>
    <template v-else-if="name === 'moon'">
      <path d="M19.5 15.5A7.7 7.7 0 0 1 8.5 4.5 7.8 7.8 0 1 0 19.5 15.5Z" />
    </template>
    <template v-else-if="name === 'calendar'">
      <rect x="4" y="5.5" width="16" height="15" rx="2" />
      <path d="M8 3.5v4M16 3.5v4M4 10h16" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" />
    </template>
    <template v-else-if="name === 'target'">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'file'">
      <path d="M6 3.5h7l5 5v12H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" />
      <path d="M13 3.5v5h5M8 13h8M8 16.5h6" />
    </template>
    <template v-else-if="name === 'close'">
      <path d="m6 6 12 12M18 6 6 18" />
    </template>
    <template v-else-if="name === 'arrow-up'">
      <path d="M12 19V5" />
      <path d="m6.5 10.5 5.5-5.5 5.5 5.5" />
    </template>
    <template v-else-if="name === 'inbox'">
      <path d="M4 5.5h16l1 9.5h-5l-1.6 2h-4.8L8 15H3z" />
      <path d="M4 5.5 3 19h18L20 5.5M8 11h8" />
    </template>
    <template v-else-if="name === 'menu'">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </template>
    <template v-else-if="name === 'refresh'">
      <path d="M20 11a8 8 0 0 0-14.8-4L4 9" />
      <path d="M4 4v5h5M4 13a8 8 0 0 0 14.8 4L20 15" />
      <path d="M20 20v-5h-5" />
    </template>
    <template v-else-if="name === 'download'">
      <path d="M12 4v11" />
      <path d="m7.5 11 4.5 4.5 4.5-4.5" />
      <path d="M5 19.5h14" />
    </template>
    <template v-else-if="name === 'dots'">
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'link'">
      <path d="M9 12h6" />
      <path d="M10 8H7.5a3.5 3.5 0 0 0 0 7H10" />
      <path d="M14 8h2.5a3.5 3.5 0 0 1 0 7H14" />
    </template>
    <template v-else-if="name === 'unlink'">
      <path d="M10 8H7.5a3.5 3.5 0 0 0 0 7H10" />
      <path d="M14 8h2.5a3.5 3.5 0 0 1 0 7H14" />
      <path d="m5 4 14 16" />
    </template>
    <template v-else-if="name === 'save'">
      <path d="M5 4.5h11l3 3v12H5z" />
      <path d="M8 4.5v5h6v-5M8 19v-5h8v5" />
    </template>
    <template v-else>
      <circle cx="12" cy="12" r="8.5" />
    </template>

  </svg>
</template>
