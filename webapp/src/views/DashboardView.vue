<script setup lang="ts">
import { onMounted, computed } from 'vue'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import { useActivitiesStore } from '@/stores/activities'
import { formatDistance, formatDuration, formatElevation } from '@/lib/aggregations'

const activitiesStore = useActivitiesStore()

onMounted(async () => {
  await activitiesStore.loadActivities()
  await activitiesStore.loadAllActivities()
})

const recentActivities = computed(() => activitiesStore.activities.slice(0, 5))

const stats = computed(() => ({
  totalActivities: activitiesStore.allActivities.length,
  totalDistance: activitiesStore.totalDistance,
  totalDuration: activitiesStore.totalDuration,
  totalElevation: activitiesStore.totalElevation,
}))
</script>

<template>
  <DashboardLayout>
    <div class="dashboard">
      <h1 class="page-title">Dashboard</h1>

      <!-- Loading State -->
      <div v-if="activitiesStore.loadingAll" class="loading-state">
        <div class="spinner"></div>
        <p>Loading your activities...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="activitiesStore.error" class="error-state">
        <p>{{ activitiesStore.error }}</p>
        <button @click="activitiesStore.loadAllActivities()">Try Again</button>
      </div>

      <!-- Dashboard Content -->
      <template v-else>
        <!-- Stats Cards -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ stats.totalActivities }}</div>
            <div class="stat-label">Total Activities</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ formatDistance(stats.totalDistance) }}</div>
            <div class="stat-label">Total Distance</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ formatDuration(stats.totalDuration) }}</div>
            <div class="stat-label">Total Time</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ formatElevation(stats.totalElevation) }}</div>
            <div class="stat-label">Total Elevation</div>
          </div>
        </div>

        <!-- Two-column layout for Recent Activities and Quick Links -->
        <div class="content-grid">
          <!-- Recent Activities -->
          <div class="section activities-section">
            <h2 class="section-title">Recent Activities</h2>
            <div v-if="recentActivities.length === 0" class="empty-state">
              <p>No activities yet. Connect your Strava account to get started.</p>
            </div>
            <div v-else class="activities-list">
              <RouterLink
                v-for="activity in recentActivities"
                :key="activity.id"
                :to="`/activity/${activity.id}`"
                class="activity-card"
              >
                <div class="activity-header">
                  <span class="activity-type">{{ activity.sport_type || activity.type }}</span>
                  <span class="activity-date">{{
                    new Date(activity.start_date).toLocaleDateString()
                  }}</span>
                </div>
                <div class="activity-name">{{ activity.name }}</div>
                <div class="activity-stats">
                  <span v-if="activity.distance">{{
                    formatDistance(activity.distance)
                  }}</span>
                  <span v-if="activity.moving_time">{{
                    formatDuration(activity.moving_time)
                  }}</span>
                  <span v-if="activity.total_elevation_gain">{{
                    formatElevation(activity.total_elevation_gain)
                  }}</span>
                </div>
              </RouterLink>
            </div>
            <RouterLink v-if="recentActivities.length > 0" to="/activities" class="view-all-link">
              View All Activities →
            </RouterLink>
          </div>

          <!-- Quick Links -->
          <div class="section quick-links-section">
            <h2 class="section-title">Quick Links</h2>
            <div class="quick-links">
              <RouterLink to="/training-log" class="quick-link">
                <span class="quick-link-icon">📅</span>
                <span class="quick-link-text">Training Log</span>
              </RouterLink>
              <RouterLink to="/weekly-intensity" class="quick-link">
                <span class="quick-link-icon">📊</span>
                <span class="quick-link-text">Weekly Intensity</span>
              </RouterLink>
              <RouterLink to="/monthly-fitness" class="quick-link">
                <span class="quick-link-icon">❤️</span>
                <span class="quick-link-text">Monthly Fitness</span>
              </RouterLink>
              <RouterLink to="/sports" class="quick-link">
                <span class="quick-link-icon">🏆</span>
                <span class="quick-link-text">Sports Breakdown</span>
              </RouterLink>
            </div>
          </div>
        </div>
      </template>
    </div>
  </DashboardLayout>
</template>

<style scoped>
.dashboard {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0 0 1.5rem 0;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
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

/* Stats Grid - 4 columns on desktop */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 1.5rem 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: #fc4c02;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.875rem;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Content Grid - Two columns on desktop */
.content-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1.5rem;
}

/* Sections */
.section {
  background: #fff;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.activities-section {
  min-height: 400px;
}

.quick-links-section {
  height: fit-content;
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0 0 1rem 0;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #666;
}

/* Activities List */
.activities-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.activity-card {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto;
  gap: 0.25rem 1rem;
  padding: 1rem 1.25rem;
  background: #f9f9f9;
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  transition: background 0.2s;
}

.activity-card:hover {
  background: #f0f0f0;
}

.activity-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  grid-column: 1 / -1;
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
  font-weight: 600;
  color: #1a1a2e;
  grid-column: 1;
}

.activity-stats {
  display: flex;
  gap: 1.5rem;
  font-size: 0.875rem;
  color: #666;
  grid-column: 1 / -1;
  margin-top: 0.25rem;
}

.view-all-link {
  display: block;
  text-align: center;
  padding: 0.75rem;
  margin-top: 1rem;
  color: #fc4c02;
  text-decoration: none;
  font-weight: 500;
}

.view-all-link:hover {
  text-decoration: underline;
}

/* Quick Links - 2x2 grid */
.quick-links {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.quick-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.5rem 1rem;
  background: #f9f9f9;
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  transition: all 0.2s;
  min-height: 100px;
}

.quick-link:hover {
  background: #fc4c02;
  color: #fff;
}

.quick-link-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.quick-link-text {
  font-size: 0.875rem;
  font-weight: 500;
  text-align: center;
}

/* Tablet breakpoint */
@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .content-grid {
    grid-template-columns: 1fr;
  }
}

/* Mobile breakpoint */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  .stat-card {
    padding: 1rem 1.25rem;
  }

  .stat-value {
    font-size: 1.5rem;
  }

  .content-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .quick-links {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
