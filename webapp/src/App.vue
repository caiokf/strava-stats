<script setup lang="ts">
import { RouterView } from 'vue-router'
import ErrorBoundary from '@/components/ErrorBoundary.vue'
import ToastNotification from '@/components/ToastNotification.vue'
</script>

<template>
  <ErrorBoundary>
    <RouterView />
    <ToastNotification />
  </ErrorBoundary>
</template>

<style>
html,
body,
#app {
  margin: 0;
  padding: 0;
  min-height: 100vh;
  width: 100%;
}
</style>
