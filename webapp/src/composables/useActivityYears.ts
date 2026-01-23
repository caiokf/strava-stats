import { computed, type Ref, type ComputedRef } from 'vue'
import type { Activity } from '@/types/activity'

export function useActivityYears(activities: Ref<Activity[]> | ComputedRef<Activity[]>) {
  const years = computed(() => {
    const yearSet = new Set<number>()
    activities.value.forEach((activity) => {
      const date = new Date(activity.start_date)
      yearSet.add(date.getFullYear())
    })
    return Array.from(yearSet).sort((a, b) => b - a)
  })

  const filterByYear = (year: number | null) => {
    if (year === null) {
      return activities.value
    }
    return activities.value.filter((activity) => {
      const date = new Date(activity.start_date)
      return date.getFullYear() === year
    })
  }

  return {
    years,
    filterByYear,
  }
}
