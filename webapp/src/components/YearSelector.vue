<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  years: number[]
  selectedYear: number | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:selectedYear', year: number | null): void
}>()

const sortedYears = computed(() => {
  return [...props.years].sort((a, b) => b - a)
})

function selectYear(year: number | null) {
  emit('update:selectedYear', year)
}

function isSelected(year: number | null): boolean {
  return props.selectedYear === year
}
</script>

<template>
  <div class="year-selector">
    <button
      class="year-btn"
      :class="{ active: isSelected(null) }"
      @click="selectYear(null)"
    >
      All
    </button>
    <button
      v-for="year in sortedYears"
      :key="year"
      class="year-btn"
      :class="{ active: isSelected(year) }"
      @click="selectYear(year)"
    >
      {{ year }}
    </button>
  </div>
</template>

<style scoped>
.year-selector {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.year-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #e0e0e0;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
  color: #666;
}

.year-btn:hover {
  border-color: #009688;
  color: #009688;
}

.year-btn.active {
  background: #009688;
  border-color: #009688;
  color: #fff;
}
</style>
