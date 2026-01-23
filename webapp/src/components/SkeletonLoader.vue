<script setup lang="ts">
defineProps<{
  width?: string
  height?: string
  borderRadius?: string
  variant?: 'text' | 'rectangular' | 'circular'
}>()
</script>

<template>
  <div
    class="skeleton"
    :class="variant"
    :style="{
      width: width || '100%',
      height: height || (variant === 'text' ? '1em' : '100px'),
      borderRadius: borderRadius || (variant === 'circular' ? '50%' : variant === 'text' ? '4px' : '8px'),
    }"
  />
</template>

<style scoped>
.skeleton {
  background: linear-gradient(
    90deg,
    #f0f0f0 25%,
    #e0e0e0 50%,
    #f0f0f0 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.text {
  display: inline-block;
}

.circular {
  flex-shrink: 0;
}
</style>
