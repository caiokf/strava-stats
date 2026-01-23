<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as L from 'leaflet'
import polyline from '@mapbox/polyline'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import { getActivityById } from '@/services/activitiesService'
import { formatDistance, formatDuration, formatElevation, formatPace } from '@/lib/aggregations'
import type { Activity } from '@/types/activity'
import 'leaflet/dist/leaflet.css'

const route = useRoute()
const router = useRouter()

const activity = ref<Activity | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const mapContainer = ref<HTMLDivElement | null>(null)
let map: L.Map | null = null

const elevationSvgRef = ref<SVGSVGElement | null>(null)
const elevationDimensions = ref({ width: 0, height: 0 })

const activityId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' ? parseInt(id, 10) : null
})

const formattedDate = computed(() => {
  if (!activity.value) return ''
  const date = new Date(activity.value.start_date_local || activity.value.start_date)
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})

const formattedStartTime = computed(() => {
  if (!activity.value) return ''
  const date = new Date(activity.value.start_date_local || activity.value.start_date)
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
})

const sportIcon = computed(() => {
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
  return icons[activity.value?.sport_type || activity.value?.type || ''] || '🏃'
})

const decodedPolyline = computed(() => {
  const polylineData = activity.value?.map_summary_polyline || activity.value?.map_polyline
  if (!polylineData) return null
  try {
    return polyline.decode(polylineData)
  } catch {
    return null
  }
})

const hasMap = computed(() => decodedPolyline.value && decodedPolyline.value.length > 0)

async function loadActivity() {
  if (!activityId.value) {
    error.value = 'Invalid activity ID'
    loading.value = false
    return
  }

  loading.value = true
  error.value = null

  try {
    const data = await getActivityById(activityId.value)
    if (!data) {
      error.value = 'Activity not found'
    } else {
      activity.value = data
      await nextTick()
      initMap()
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load activity'
  } finally {
    loading.value = false
  }
}

function initMap() {
  if (!hasMap.value || !mapContainer.value) return

  // Clean up existing map
  if (map) {
    map.remove()
    map = null
  }

  const coordinates = decodedPolyline.value!

  // Create map
  map = L.map(mapContainer.value, {
    scrollWheelZoom: false,
    attributionControl: true,
  })

  // Add OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map)

  // Create polyline from coordinates
  const latLngs: L.LatLngTuple[] = coordinates.map(([lat, lng]) => [lat, lng])
  const routeLine = L.polyline(latLngs, {
    color: '#fc4c02',
    weight: 4,
    opacity: 0.8,
  }).addTo(map)

  // Add start/end markers
  if (latLngs.length > 0) {
    const startLatLng = latLngs[0]
    const endLatLng = latLngs[latLngs.length - 1]

    if (startLatLng) {
      L.circleMarker(startLatLng, {
        radius: 8,
        fillColor: '#4caf50',
        color: '#fff',
        weight: 2,
        fillOpacity: 1,
      })
        .addTo(map)
        .bindPopup('Start')
    }

    if (endLatLng && (startLatLng![0] !== endLatLng[0] || startLatLng![1] !== endLatLng[1])) {
      L.circleMarker(endLatLng, {
        radius: 8,
        fillColor: '#f44336',
        color: '#fff',
        weight: 2,
        fillOpacity: 1,
      })
        .addTo(map)
        .bindPopup('Finish')
    }
  }

  // Fit map to route bounds
  map.fitBounds(routeLine.getBounds(), { padding: [20, 20] })
}

function onElevationResize() {
  if (!elevationSvgRef.value) return
  const rect = elevationSvgRef.value.parentElement?.getBoundingClientRect()
  if (rect) {
    elevationDimensions.value = { width: rect.width, height: 150 }
    renderElevationChart()
  }
}

function renderElevationChart() {
  // This would be enhanced with actual elevation data from streams
  // For now we show a placeholder or skip
}

onMounted(() => {
  loadActivity()
  window.addEventListener('resize', onElevationResize)
})

onUnmounted(() => {
  if (map) {
    map.remove()
    map = null
  }
  window.removeEventListener('resize', onElevationResize)
})

watch(activityId, () => {
  loadActivity()
})

function goBack() {
  router.back()
}
</script>

<template>
  <DashboardLayout>
    <div class="activity-detail">
      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading activity...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="error-state">
        <p>{{ error }}</p>
        <button @click="loadActivity">Try Again</button>
        <button class="secondary" @click="goBack">Go Back</button>
      </div>

      <!-- Activity Content -->
      <template v-else-if="activity">
        <!-- Header -->
        <div class="header">
          <button class="back-btn" @click="goBack">← Back</button>
          <div class="header-content">
            <div class="activity-meta">
              <span class="sport-icon">{{ sportIcon }}</span>
              <span class="sport-type">{{ activity.sport_type || activity.type }}</span>
              <span class="separator">•</span>
              <span class="date">{{ formattedDate }}</span>
              <span class="separator">•</span>
              <span class="time">{{ formattedStartTime }}</span>
            </div>
            <h1 class="activity-name">{{ activity.name }}</h1>
            <p v-if="activity.description" class="activity-description">
              {{ activity.description }}
            </p>
          </div>
        </div>

        <!-- Main Stats Grid -->
        <div class="stats-grid">
          <div v-if="activity.distance" class="stat-card primary">
            <span class="stat-value">{{ formatDistance(activity.distance) }}</span>
            <span class="stat-label">Distance</span>
          </div>
          <div v-if="activity.moving_time" class="stat-card primary">
            <span class="stat-value">{{ formatDuration(activity.moving_time) }}</span>
            <span class="stat-label">Moving Time</span>
          </div>
          <div v-if="activity.total_elevation_gain" class="stat-card primary">
            <span class="stat-value">{{ formatElevation(activity.total_elevation_gain) }}</span>
            <span class="stat-label">Elevation Gain</span>
          </div>
          <div v-if="activity.average_speed" class="stat-card">
            <span class="stat-value">{{ formatPace(activity.average_speed) }}</span>
            <span class="stat-label">Avg Pace</span>
          </div>
          <div v-if="activity.elapsed_time" class="stat-card">
            <span class="stat-value">{{ formatDuration(activity.elapsed_time) }}</span>
            <span class="stat-label">Elapsed Time</span>
          </div>
          <div v-if="activity.average_heartrate" class="stat-card">
            <span class="stat-value">{{ Math.round(activity.average_heartrate) }} bpm</span>
            <span class="stat-label">Avg Heart Rate</span>
          </div>
          <div v-if="activity.max_heartrate" class="stat-card">
            <span class="stat-value">{{ Math.round(activity.max_heartrate) }} bpm</span>
            <span class="stat-label">Max Heart Rate</span>
          </div>
          <div v-if="activity.average_watts" class="stat-card">
            <span class="stat-value">{{ Math.round(activity.average_watts) }}W</span>
            <span class="stat-label">Avg Power</span>
          </div>
          <div v-if="activity.max_watts" class="stat-card">
            <span class="stat-value">{{ activity.max_watts }}W</span>
            <span class="stat-label">Max Power</span>
          </div>
          <div v-if="activity.average_cadence" class="stat-card">
            <span class="stat-value">{{ Math.round(activity.average_cadence) }}</span>
            <span class="stat-label">Avg Cadence</span>
          </div>
          <div v-if="activity.calories" class="stat-card">
            <span class="stat-value">{{ activity.calories }}</span>
            <span class="stat-label">Calories</span>
          </div>
          <div v-if="activity.suffer_score" class="stat-card">
            <span class="stat-value">{{ activity.suffer_score }}</span>
            <span class="stat-label">Suffer Score</span>
          </div>
        </div>

        <!-- Map -->
        <div v-if="hasMap" class="section">
          <h2 class="section-title">Route Map</h2>
          <div ref="mapContainer" class="map-container"></div>
        </div>
        <div v-else class="section no-map">
          <h2 class="section-title">Route Map</h2>
          <p class="no-map-text">No route data available for this activity</p>
        </div>

        <!-- Additional Details -->
        <div class="section">
          <h2 class="section-title">Activity Details</h2>
          <div class="details-grid">
            <div v-if="activity.gear_name" class="detail-item">
              <span class="detail-label">Gear</span>
              <span class="detail-value">{{ activity.gear_name }}</span>
            </div>
            <div v-if="activity.device_name" class="detail-item">
              <span class="detail-label">Device</span>
              <span class="detail-value">{{ activity.device_name }}</span>
            </div>
            <div v-if="activity.kudos_count !== undefined" class="detail-item">
              <span class="detail-label">Kudos</span>
              <span class="detail-value">{{ activity.kudos_count }}</span>
            </div>
            <div v-if="activity.comment_count !== undefined" class="detail-item">
              <span class="detail-label">Comments</span>
              <span class="detail-value">{{ activity.comment_count }}</span>
            </div>
            <div v-if="activity.achievement_count !== undefined" class="detail-item">
              <span class="detail-label">Achievements</span>
              <span class="detail-value">{{ activity.achievement_count }}</span>
            </div>
            <div v-if="activity.pr_count !== undefined" class="detail-item">
              <span class="detail-label">PRs</span>
              <span class="detail-value">{{ activity.pr_count }}</span>
            </div>
            <div v-if="activity.elev_high !== undefined" class="detail-item">
              <span class="detail-label">Max Elevation</span>
              <span class="detail-value">{{ formatElevation(activity.elev_high) }}</span>
            </div>
            <div v-if="activity.elev_low !== undefined" class="detail-item">
              <span class="detail-label">Min Elevation</span>
              <span class="detail-value">{{ formatElevation(activity.elev_low) }}</span>
            </div>
            <div v-if="activity.weighted_average_watts" class="detail-item">
              <span class="detail-label">Normalized Power</span>
              <span class="detail-value">{{ activity.weighted_average_watts }}W</span>
            </div>
            <div v-if="activity.kilojoules" class="detail-item">
              <span class="detail-label">Work</span>
              <span class="detail-value">{{ activity.kilojoules }} kJ</span>
            </div>
          </div>
        </div>

        <!-- View on Strava -->
        <div class="strava-link-section">
          <a
            :href="`https://www.strava.com/activities/${activity.id}`"
            target="_blank"
            rel="noopener noreferrer"
            class="strava-link"
          >
            View on Strava →
          </a>
        </div>
      </template>
    </div>
  </DashboardLayout>
</template>

<style scoped>
.activity-detail {
  max-width: 1000px;
  margin: 0 auto;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
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
  margin-right: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: #fc4c02;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.error-state button.secondary {
  background: #fff;
  color: #666;
  border: 1px solid #e0e0e0;
}

/* Header */
.header {
  margin-bottom: 1.5rem;
}

.back-btn {
  background: none;
  border: none;
  color: #666;
  font-size: 0.875rem;
  cursor: pointer;
  padding: 0.5rem 0;
  margin-bottom: 0.5rem;
}

.back-btn:hover {
  color: #fc4c02;
}

.header-content {
  background: #fff;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.activity-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #666;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}

.sport-icon {
  font-size: 1.5rem;
}

.sport-type {
  color: #fc4c02;
  font-weight: 600;
  text-transform: uppercase;
}

.separator {
  color: #ccc;
}

.activity-name {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0;
}

.activity-description {
  color: #666;
  margin: 0.75rem 0 0 0;
  font-size: 0.875rem;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 1rem 1.25rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.stat-card.primary {
  background: linear-gradient(135deg, #fc4c02 0%, #ff7043 100%);
  color: #fff;
}

.stat-card.primary .stat-value {
  color: #fff;
}

.stat-card.primary .stat-label {
  color: rgba(255, 255, 255, 0.85);
}

.stat-value {
  display: block;
  font-size: 1.25rem;
  font-weight: 700;
  color: #1a1a2e;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.75rem;
  color: #666;
  text-transform: uppercase;
}

/* Sections */
.section {
  background: #fff;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0 0 1rem 0;
}

/* Map */
.map-container {
  width: 100%;
  height: 400px;
  border-radius: 8px;
  overflow: hidden;
}

.no-map {
  text-align: center;
  padding: 2rem;
}

.no-map-text {
  color: #999;
  font-style: italic;
  margin: 0;
}

/* Details Grid */
.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.detail-label {
  font-size: 0.75rem;
  color: #999;
  text-transform: uppercase;
}

.detail-value {
  font-size: 0.875rem;
  font-weight: 500;
  color: #1a1a2e;
}

/* Strava Link */
.strava-link-section {
  text-align: center;
  margin-bottom: 2rem;
}

.strava-link {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  background: #fc4c02;
  color: #fff;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 500;
  transition: background 0.2s;
}

.strava-link:hover {
  background: #e04400;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .map-container {
    height: 300px;
  }

  .details-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
