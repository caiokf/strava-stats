<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import { useActivitiesStore } from '@/stores/activities'
import { formatDistance, formatDuration, formatElevation, formatPace } from '@/lib/aggregations'

const activitiesStore = useActivitiesStore()

const searchQuery = ref('')
const selectedSportType = ref<string>('all')
const sortBy = ref<'date' | 'distance' | 'duration' | 'elevation'>('date')
const sortOrder = ref<'asc' | 'desc'>('desc')
const currentPage = ref(1)
const perPage = 20

const sportTypes = computed(() => {
  if (!activitiesStore.hasAllActivities) return []

  const types = new Set<string>()
  activitiesStore.allActivities.forEach((a) => {
    const type = a.sport_type || a.type
    if (type) types.add(type)
  })

  return Array.from(types).sort()
})

const filteredActivities = computed(() => {
  if (!activitiesStore.hasAllActivities) return []

  let activities = [...activitiesStore.allActivities]

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    activities = activities.filter(
      (a) =>
        a.name.toLowerCase().includes(query) ||
        (a.description && a.description.toLowerCase().includes(query)),
    )
  }

  // Filter by sport type
  if (selectedSportType.value !== 'all') {
    activities = activities.filter(
      (a) => a.sport_type === selectedSportType.value || a.type === selectedSportType.value,
    )
  }

  // Sort
  activities.sort((a, b) => {
    let comparison = 0

    switch (sortBy.value) {
      case 'date':
        comparison = new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
        break
      case 'distance':
        comparison = (a.distance || 0) - (b.distance || 0)
        break
      case 'duration':
        comparison = (a.moving_time || 0) - (b.moving_time || 0)
        break
      case 'elevation':
        comparison = (a.total_elevation_gain || 0) - (b.total_elevation_gain || 0)
        break
    }

    return sortOrder.value === 'asc' ? comparison : -comparison
  })

  return activities
})

const paginatedActivities = computed(() => {
  const start = (currentPage.value - 1) * perPage
  return filteredActivities.value.slice(start, start + perPage)
})

const totalPages = computed(() => Math.ceil(filteredActivities.value.length / perPage))

const stats = computed(() => ({
  total: filteredActivities.value.length,
  totalDistance: filteredActivities.value.reduce((sum, a) => sum + (a.distance || 0), 0),
  totalDuration: filteredActivities.value.reduce((sum, a) => sum + (a.moving_time || 0), 0),
}))

watch([searchQuery, selectedSportType, sortBy, sortOrder], () => {
  currentPage.value = 1
})

onMounted(async () => {
  if (!activitiesStore.hasAllActivities) {
    await activitiesStore.loadAllActivities()
  }
})

function getSportIcon(sportType: string | null): string {
  const icons: Record<string, string> = {
    Run: '🏃',
    Ride: '🚴',
    VirtualRide: '🚴',
    Swim: '🏊',
    Walk: '🚶',
    Hike: '🥾',
    WeightTraining: '🏋️',
    Yoga: '🧘',
    Workout: '💪',
  }
  return icons[sportType || ''] || '🏃'
}

function goToPage(page: number) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}
</script>

<template>
  <DashboardLayout>
    <div class="activities-list">
      <div class="page-header">
        <h1 class="page-title">My Activities</h1>
        <div class="stats-summary">
          <span>{{ stats.total }} activities</span>
          <span>{{ formatDistance(stats.totalDistance) }}</span>
          <span>{{ formatDuration(stats.totalDuration) }}</span>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters">
        <div class="search-box">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search activities..."
            class="search-input"
          />
        </div>

        <div class="filter-group">
          <label class="filter-label">Sport:</label>
          <select v-model="selectedSportType" class="filter-select">
            <option value="all">All Sports</option>
            <option v-for="type in sportTypes" :key="type" :value="type">
              {{ type }}
            </option>
          </select>
        </div>

        <div class="filter-group">
          <label class="filter-label">Sort:</label>
          <select v-model="sortBy" class="filter-select">
            <option value="date">Date</option>
            <option value="distance">Distance</option>
            <option value="duration">Duration</option>
            <option value="elevation">Elevation</option>
          </select>
          <button
            class="sort-order-btn"
            @click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'"
            :title="sortOrder === 'asc' ? 'Ascending' : 'Descending'"
          >
            {{ sortOrder === 'asc' ? '↑' : '↓' }}
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="activitiesStore.loadingAll" class="loading-state">
        <div class="spinner"></div>
        <p>Loading activities...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="activitiesStore.error" class="error-state">
        <p>{{ activitiesStore.error }}</p>
        <button @click="activitiesStore.loadAllActivities()">Try Again</button>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredActivities.length === 0" class="empty-state">
        <p v-if="searchQuery || selectedSportType !== 'all'">
          No activities match your filters. Try adjusting your search.
        </p>
        <p v-else>No activities found. Connect your Strava account to get started.</p>
      </div>

      <!-- Activities List -->
      <div v-else class="activities-grid">
        <RouterLink
          v-for="activity in paginatedActivities"
          :key="activity.id"
          :to="`/activity/${activity.id}`"
          class="activity-card"
        >
          <div class="activity-icon">{{ getSportIcon(activity.sport_type || activity.type) }}</div>
          <div class="activity-content">
            <div class="activity-header">
              <span class="activity-type">{{ activity.sport_type || activity.type }}</span>
              <span class="activity-date">
                {{ new Date(activity.start_date).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                }) }}
              </span>
            </div>
            <h3 class="activity-name">{{ activity.name }}</h3>
            <div class="activity-stats">
              <span v-if="activity.distance" class="stat">
                <span class="stat-value">{{ formatDistance(activity.distance) }}</span>
                <span class="stat-label">Distance</span>
              </span>
              <span v-if="activity.moving_time" class="stat">
                <span class="stat-value">{{ formatDuration(activity.moving_time) }}</span>
                <span class="stat-label">Time</span>
              </span>
              <span v-if="activity.total_elevation_gain" class="stat">
                <span class="stat-value">{{ formatElevation(activity.total_elevation_gain) }}</span>
                <span class="stat-label">Elevation</span>
              </span>
              <span v-if="activity.average_speed && activity.distance" class="stat">
                <span class="stat-value">{{ formatPace(activity.average_speed) }}</span>
                <span class="stat-label">Pace</span>
              </span>
            </div>
          </div>
        </RouterLink>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="pagination">
        <button
          class="page-btn"
          :disabled="currentPage === 1"
          @click="goToPage(currentPage - 1)"
        >
          Previous
        </button>
        <div class="page-numbers">
          <button
            v-for="page in Math.min(5, totalPages)"
            :key="page"
            class="page-num"
            :class="{ active: currentPage === page }"
            @click="goToPage(page)"
          >
            {{ page }}
          </button>
          <span v-if="totalPages > 5" class="page-ellipsis">...</span>
          <button
            v-if="totalPages > 5"
            class="page-num"
            :class="{ active: currentPage === totalPages }"
            @click="goToPage(totalPages)"
          >
            {{ totalPages }}
          </button>
        </div>
        <button
          class="page-btn"
          :disabled="currentPage === totalPages"
          @click="goToPage(currentPage + 1)"
        >
          Next
        </button>
      </div>
    </div>
  </DashboardLayout>
</template>

<style scoped>
.activities-list {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0;
}

.stats-summary {
  display: flex;
  gap: 1.5rem;
  font-size: 0.875rem;
  color: #666;
}

.filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  background: #fff;
  padding: 1rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.search-box {
  flex: 1;
  min-width: 200px;
}

.search-input {
  width: 100%;
  padding: 0.625rem 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 0.875rem;
  transition: border-color 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #fc4c02;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-label {
  font-size: 0.875rem;
  color: #666;
}

.filter-select {
  padding: 0.625rem 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 0.875rem;
  background: #fff;
  cursor: pointer;
}

.filter-select:focus {
  outline: none;
  border-color: #fc4c02;
}

.sort-order-btn {
  padding: 0.625rem 0.875rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
}

.sort-order-btn:hover {
  border-color: #fc4c02;
  background: #fff8f5;
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e0e0e0;
  border-top-color: #fc4c02;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-state button {
  margin-top: 1rem;
  padding: 0.75rem 1.5rem;
  background: #fc4c02;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.activities-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.activity-card {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.25rem;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  text-decoration: none;
  color: inherit;
  transition: all 0.2s;
}

.activity-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

.activity-icon {
  font-size: 2rem;
  padding: 0.5rem;
  background: #f9f9f9;
  border-radius: 8px;
}

.activity-content {
  flex: 1;
  min-width: 0;
}

.activity-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}

.activity-type {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: #fc4c02;
  font-weight: 600;
}

.activity-date {
  font-size: 0.75rem;
  color: #999;
}

.activity-name {
  font-size: 1rem;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0 0 0.75rem 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.activity-stats {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.stat {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1a1a2e;
}

.stat-label {
  font-size: 0.625rem;
  color: #999;
  text-transform: uppercase;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 2rem;
  padding: 1rem;
}

.page-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #e0e0e0;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  border-color: #fc4c02;
  color: #fc4c02;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-numbers {
  display: flex;
  gap: 0.25rem;
}

.page-num {
  width: 36px;
  height: 36px;
  border: 1px solid #e0e0e0;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.page-num:hover {
  border-color: #fc4c02;
}

.page-num.active {
  background: #fc4c02;
  border-color: #fc4c02;
  color: #fff;
}

.page-ellipsis {
  display: flex;
  align-items: center;
  padding: 0 0.5rem;
  color: #666;
}

@media (max-width: 768px) {
  .filters {
    flex-direction: column;
  }

  .filter-group {
    width: 100%;
    flex-wrap: wrap;
  }

  .filter-select {
    flex: 1;
  }

  .activity-card {
    flex-direction: column;
    align-items: stretch;
  }

  .activity-icon {
    align-self: flex-start;
  }

  .activity-stats {
    gap: 1rem;
  }
}
</style>
