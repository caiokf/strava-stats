<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, type Ref } from 'vue'

const props = defineProps<{
  loading?: boolean
  error?: string | null
  title?: string
  height?: number | string
}>()

const emit = defineEmits<{
  resize: [{ width: number; height: number }]
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const chartRef = ref<HTMLDivElement | null>(null)
const dimensions = ref({ width: 0, height: 0 })

let resizeObserver: ResizeObserver | null = null

function updateDimensions() {
  if (chartRef.value) {
    const rect = chartRef.value.getBoundingClientRect()
    dimensions.value = {
      width: Math.floor(rect.width),
      height: Math.floor(rect.height),
    }
    emit('resize', dimensions.value)
  }
}

onMounted(() => {
  if (chartRef.value) {
    resizeObserver = new ResizeObserver(() => {
      updateDimensions()
    })
    resizeObserver.observe(chartRef.value)
    updateDimensions()
  }
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})

// Re-emit dimensions when chart content changes
watch(
  () => props.loading,
  (newLoading, oldLoading) => {
    if (oldLoading && !newLoading) {
      // Loading finished, update dimensions
      setTimeout(updateDimensions, 0)
    }
  },
)

defineExpose({
  dimensions,
  chartRef: chartRef as Ref<HTMLDivElement | null>,
  updateDimensions,
})
</script>

<template>
  <div ref="containerRef" class="chart-container" :style="{ height: typeof height === 'number' ? `${height}px` : height }">
    <div v-if="title" class="chart-header">
      <h3 class="chart-title">{{ title }}</h3>
      <slot name="header-actions"></slot>
    </div>

    <div class="chart-body">
      <!-- Loading State -->
      <div v-if="loading" class="chart-loading">
        <div class="spinner"></div>
        <span>Loading chart...</span>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="chart-error">
        <span class="error-icon">⚠️</span>
        <span class="error-message">{{ error }}</span>
        <slot name="error-actions"></slot>
      </div>

      <!-- Chart Content -->
      <div v-else ref="chartRef" class="chart-content">
        <slot :dimensions="dimensions"></slot>
      </div>
    </div>

    <div v-if="$slots.footer" class="chart-footer">
      <slot name="footer"></slot>
    </div>
  </div>
</template>

<style scoped>
.chart-container {
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  min-height: 200px;
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #f0f0f0;
}

.chart-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #1a1a2e;
}

.chart-body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  position: relative;
}

.chart-loading,
.chart-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem;
  color: #666;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e0e0e0;
  border-top-color: #fc4c02;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.chart-error {
  color: #d32f2f;
}

.error-icon {
  font-size: 2rem;
}

.error-message {
  text-align: center;
  max-width: 300px;
}

.chart-content {
  width: 100%;
  height: 100%;
  position: relative;
}

.chart-footer {
  padding: 0.75rem 1.25rem;
  border-top: 1px solid #f0f0f0;
  background: #fafafa;
}

/* Make SVG responsive */
.chart-content :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
