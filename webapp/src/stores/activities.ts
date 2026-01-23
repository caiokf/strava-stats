import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Activity, ActivityFilters, ActivitySummary } from '@/types'
import {
  getActivities as fetchActivities,
  getActivityById as fetchActivityById,
  getAllActivities as fetchAllActivities,
  getDistinctSportTypes as fetchSportTypes,
  type PaginatedResult,
} from '@/services/activitiesService'

export const useActivitiesStore = defineStore('activities', () => {
  // State
  const activities = ref<ActivitySummary[]>([])
  const currentActivity = ref<Activity | null>(null)
  const allActivities = ref<Activity[]>([])
  const sportTypes = ref<string[]>([])

  const loading = ref(false)
  const loadingActivity = ref(false)
  const loadingAll = ref(false)
  const error = ref<string | null>(null)

  const filters = ref<ActivityFilters>({})
  const currentPage = ref(1)
  const pageSize = ref(50)
  const totalCount = ref(0)
  const hasMore = ref(false)

  // Computed
  const hasActivities = computed(() => activities.value.length > 0)
  const hasAllActivities = computed(() => allActivities.value.length > 0)

  const activitiesByDate = computed(() => {
    const grouped: Record<string, ActivitySummary[]> = {}
    activities.value.forEach((activity) => {
      const dateStr = activity.start_date_local ?? activity.start_date
      const date = dateStr.split('T')[0]
      if (date) {
        if (!grouped[date]) {
          grouped[date] = []
        }
        grouped[date].push(activity)
      }
    })
    return grouped
  })

  const activitiesBySport = computed(() => {
    const grouped: Record<string, Activity[]> = {}
    allActivities.value.forEach((activity) => {
      const sport = activity.sport_type || activity.type || 'Unknown'
      if (!grouped[sport]) {
        grouped[sport] = []
      }
      grouped[sport].push(activity)
    })
    return grouped
  })

  const totalDistance = computed((): number => {
    return allActivities.value.reduce((sum: number, a) => sum + (a.distance || 0), 0)
  })

  const totalDuration = computed((): number => {
    return allActivities.value.reduce((sum: number, a) => sum + (a.moving_time || 0), 0)
  })

  const totalElevation = computed((): number => {
    return allActivities.value.reduce((sum: number, a) => sum + (a.total_elevation_gain || 0), 0)
  })

  // Actions
  async function loadActivities(resetPage = true): Promise<void> {
    if (resetPage) {
      currentPage.value = 1
      activities.value = []
    }

    loading.value = true
    error.value = null

    try {
      const result: PaginatedResult<ActivitySummary> = await fetchActivities(
        filters.value,
        currentPage.value,
        pageSize.value,
      )

      if (resetPage) {
        activities.value = result.data
      } else {
        activities.value = [...activities.value, ...result.data]
      }

      totalCount.value = result.count
      hasMore.value = result.hasMore
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load activities'
    } finally {
      loading.value = false
    }
  }

  async function loadMoreActivities(): Promise<void> {
    if (!hasMore.value || loading.value) return

    currentPage.value++
    await loadActivities(false)
  }

  async function loadActivity(id: number): Promise<void> {
    loadingActivity.value = true
    error.value = null

    try {
      currentActivity.value = await fetchActivityById(id)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load activity'
      currentActivity.value = null
    } finally {
      loadingActivity.value = false
    }
  }

  async function loadAllActivities(): Promise<void> {
    if (loadingAll.value) return

    loadingAll.value = true
    error.value = null

    try {
      allActivities.value = await fetchAllActivities()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load all activities'
    } finally {
      loadingAll.value = false
    }
  }

  async function loadSportTypes(): Promise<void> {
    try {
      sportTypes.value = await fetchSportTypes()
    } catch (e) {
      console.error('Failed to load sport types:', e)
    }
  }

  function setFilters(newFilters: ActivityFilters): void {
    filters.value = { ...newFilters }
  }

  function clearFilters(): void {
    filters.value = {}
  }

  function clearCurrentActivity(): void {
    currentActivity.value = null
  }

  return {
    // State
    activities,
    currentActivity,
    allActivities,
    sportTypes,
    loading,
    loadingActivity,
    loadingAll,
    error,
    filters,
    currentPage,
    pageSize,
    totalCount,
    hasMore,

    // Computed
    hasActivities,
    hasAllActivities,
    activitiesByDate,
    activitiesBySport,
    totalDistance,
    totalDuration,
    totalElevation,

    // Actions
    loadActivities,
    loadMoreActivities,
    loadActivity,
    loadAllActivities,
    loadSportTypes,
    setFilters,
    clearFilters,
    clearCurrentActivity,
  }
})
