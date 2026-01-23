<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as d3 from 'd3'
import * as L from 'leaflet'
import polyline from '@mapbox/polyline'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import { getActivityById } from '@/services/activitiesService'
import { formatDistance, formatDuration, formatElevation, formatPace } from '@/lib/aggregations'
import type { Activity } from '@/types/activity'
import 'leaflet/dist/leaflet.css'

interface RawLap {
  id: number
  name: string
  lap_index: number
  distance: number
  moving_time: number
  elapsed_time: number
  average_speed: number
  max_speed: number
  average_watts?: number
  average_cadence?: number
  average_heartrate?: number
  max_heartrate?: number
  total_elevation_gain?: number
}

interface RawSplit {
  split: number
  distance: number
  moving_time: number
  elapsed_time: number
  average_speed: number
  elevation_difference?: number
  average_heartrate?: number
}

const route = useRoute()
const router = useRouter()

const activity = ref<Activity | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const mapContainer = ref<HTMLDivElement | null>(null)
let map: L.Map | null = null

const lapsChartRef = ref<SVGSVGElement | null>(null)
const lapsChartDimensions = ref({ width: 0, height: 0 })

const selectedLapsMetric = ref<'power' | 'speed' | 'heartrate'>('power')

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

// Extract laps from raw_data
const laps = computed((): RawLap[] => {
  if (!activity.value?.raw_data) return []
  const rawData = activity.value.raw_data as { laps?: RawLap[] }
  return rawData.laps || []
})

// Extract splits from raw_data
const splits = computed((): RawSplit[] => {
  if (!activity.value?.raw_data) return []
  const rawData = activity.value.raw_data as { splits_metric?: RawSplit[] }
  return rawData.splits_metric || []
})

const hasLaps = computed(() => laps.value.length > 1)
const hasSplits = computed(() => splits.value.length > 1)

// Check if laps have power data
const lapsHavePower = computed(() => laps.value.some((lap) => lap.average_watts !== undefined))
const lapsHaveHeartrate = computed(() => laps.value.some((lap) => lap.average_heartrate !== undefined))

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
      // Set default metric based on available data
      if (data.raw_data) {
        const rawData = data.raw_data as { laps?: RawLap[] }
        const rawLaps = rawData.laps || []
        if (rawLaps.some((l) => l.average_watts)) {
          selectedLapsMetric.value = 'power'
        } else if (rawLaps.some((l) => l.average_heartrate)) {
          selectedLapsMetric.value = 'heartrate'
        } else {
          selectedLapsMetric.value = 'speed'
        }
      }
      await nextTick()
      initMap()
      onLapsChartResize()
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

function onLapsChartResize() {
  if (!lapsChartRef.value) return
  const rect = lapsChartRef.value.parentElement?.getBoundingClientRect()
  if (rect) {
    lapsChartDimensions.value = { width: rect.width, height: 200 }
    renderLapsChart()
  }
}

function renderLapsChart() {
  if (!lapsChartRef.value || laps.value.length === 0) return

  const { width, height } = lapsChartDimensions.value
  if (width === 0 || height === 0) return

  const svg = d3.select(lapsChartRef.value)
  svg.selectAll('*').remove()

  svg.attr('width', width).attr('height', height)

  const margin = { top: 20, right: 20, bottom: 40, left: 50 }
  const chartWidth = width - margin.left - margin.right
  const chartHeight = height - margin.top - margin.bottom

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  // Get metric values
  const getMetricValue = (lap: RawLap): number => {
    switch (selectedLapsMetric.value) {
      case 'power':
        return lap.average_watts || 0
      case 'heartrate':
        return lap.average_heartrate || 0
      case 'speed':
        return lap.average_speed * 3.6 // Convert m/s to km/h
      default:
        return 0
    }
  }

  const data = laps.value.map((lap, i) => ({
    index: i + 1,
    value: getMetricValue(lap),
    lap,
  }))

  // Scales
  const x = d3
    .scaleBand()
    .domain(data.map((d) => d.index.toString()))
    .range([0, chartWidth])
    .padding(0.2)

  const maxVal = d3.max(data, (d) => d.value) || 0
  const y = d3.scaleLinear().domain([0, maxVal * 1.1]).range([chartHeight, 0])

  // Bars
  g.selectAll('.bar')
    .data(data)
    .enter()
    .append('rect')
    .attr('class', 'bar')
    .attr('x', (d) => x(d.index.toString()) || 0)
    .attr('y', (d) => y(d.value))
    .attr('width', x.bandwidth())
    .attr('height', (d) => chartHeight - y(d.value))
    .attr('fill', '#fc4c02')
    .attr('rx', 2)

  // Value labels on bars
  g.selectAll('.bar-label')
    .data(data)
    .enter()
    .append('text')
    .attr('class', 'bar-label')
    .attr('x', (d) => (x(d.index.toString()) || 0) + x.bandwidth() / 2)
    .attr('y', (d) => y(d.value) - 5)
    .attr('text-anchor', 'middle')
    .attr('font-size', '10px')
    .attr('fill', '#666')
    .text((d) => {
      if (d.value === 0) return ''
      if (selectedLapsMetric.value === 'power') return `${Math.round(d.value)}W`
      if (selectedLapsMetric.value === 'heartrate') return `${Math.round(d.value)}`
      return `${d.value.toFixed(1)}`
    })

  // X axis
  g.append('g')
    .attr('transform', `translate(0,${chartHeight})`)
    .call(d3.axisBottom(x).tickFormat((d) => `Lap ${d}`))
    .selectAll('text')
    .attr('font-size', '10px')
    .attr('transform', 'rotate(-45)')
    .attr('text-anchor', 'end')
    .attr('dx', '-0.5em')
    .attr('dy', '0.5em')

  // Y axis
  g.append('g')
    .call(
      d3.axisLeft(y).ticks(5).tickFormat((d) => {
        if (selectedLapsMetric.value === 'power') return `${d}W`
        if (selectedLapsMetric.value === 'heartrate') return `${d}`
        return `${d} km/h`
      }),
    )
    .selectAll('text')
    .attr('font-size', '10px')
}

watch(selectedLapsMetric, () => {
  renderLapsChart()
})

function formatSplitPace(speedMps: number): string {
  // Convert m/s to min/km
  if (speedMps <= 0) return '-'
  const paceSecondsPerKm = 1000 / speedMps
  const minutes = Math.floor(paceSecondsPerKm / 60)
  const seconds = Math.round(paceSecondsPerKm % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

onMounted(() => {
  loadActivity()
  window.addEventListener('resize', onLapsChartResize)
})

onUnmounted(() => {
  if (map) {
    map.remove()
    map = null
  }
  window.removeEventListener('resize', onLapsChartResize)
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

        <!-- Elevation Summary -->
        <div v-if="activity.elev_high != null || activity.total_elevation_gain" class="section">
          <h2 class="section-title">Elevation</h2>
          <div class="elevation-summary">
            <div class="elevation-stat" v-if="activity.total_elevation_gain">
              <span class="elevation-value">{{ formatElevation(activity.total_elevation_gain) }}</span>
              <span class="elevation-label">Total Gain</span>
            </div>
            <div class="elevation-stat" v-if="activity.elev_high != null">
              <span class="elevation-value">{{ formatElevation(activity.elev_high!) }}</span>
              <span class="elevation-label">Max Elevation</span>
            </div>
            <div class="elevation-stat" v-if="activity.elev_low != null">
              <span class="elevation-value">{{ formatElevation(activity.elev_low!) }}</span>
              <span class="elevation-label">Min Elevation</span>
            </div>
            <div class="elevation-stat" v-if="activity.elev_high != null && activity.elev_low != null">
              <span class="elevation-value">{{ formatElevation(activity.elev_high! - activity.elev_low!) }}</span>
              <span class="elevation-label">Elevation Range</span>
            </div>
          </div>
        </div>

        <!-- Laps Chart -->
        <div v-if="hasLaps" class="section">
          <div class="section-header">
            <h2 class="section-title">Laps</h2>
            <div class="metric-selector">
              <button
                v-if="lapsHavePower"
                class="metric-btn"
                :class="{ active: selectedLapsMetric === 'power' }"
                @click="selectedLapsMetric = 'power'"
              >
                Power
              </button>
              <button
                class="metric-btn"
                :class="{ active: selectedLapsMetric === 'speed' }"
                @click="selectedLapsMetric = 'speed'"
              >
                Speed
              </button>
              <button
                v-if="lapsHaveHeartrate"
                class="metric-btn"
                :class="{ active: selectedLapsMetric === 'heartrate' }"
                @click="selectedLapsMetric = 'heartrate'"
              >
                Heart Rate
              </button>
            </div>
          </div>
          <div class="laps-chart-container">
            <svg ref="lapsChartRef"></svg>
          </div>
          <div class="laps-table">
            <table>
              <thead>
                <tr>
                  <th>Lap</th>
                  <th>Distance</th>
                  <th>Time</th>
                  <th>Speed</th>
                  <th v-if="lapsHavePower">Power</th>
                  <th v-if="lapsHaveHeartrate">HR</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="lap in laps" :key="lap.id">
                  <td>{{ lap.lap_index }}</td>
                  <td>{{ formatDistance(lap.distance) }}</td>
                  <td>{{ formatDuration(lap.moving_time) }}</td>
                  <td>{{ (lap.average_speed * 3.6).toFixed(1) }} km/h</td>
                  <td v-if="lapsHavePower">{{ lap.average_watts ? `${Math.round(lap.average_watts)}W` : '-' }}</td>
                  <td v-if="lapsHaveHeartrate">{{ lap.average_heartrate ? `${Math.round(lap.average_heartrate)} bpm` : '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Splits -->
        <div v-if="hasSplits" class="section">
          <h2 class="section-title">Splits (per km)</h2>
          <div class="splits-table">
            <table>
              <thead>
                <tr>
                  <th>km</th>
                  <th>Pace</th>
                  <th>Elev</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="split in splits" :key="split.split">
                  <td>{{ split.split }}</td>
                  <td class="pace-cell">{{ formatSplitPace(split.average_speed) }} /km</td>
                  <td :class="{ 'elev-up': (split.elevation_difference || 0) > 0, 'elev-down': (split.elevation_difference || 0) < 0 }">
                    {{ split.elevation_difference !== undefined ? `${split.elevation_difference > 0 ? '+' : ''}${split.elevation_difference.toFixed(0)}m` : '-' }}
                  </td>
                  <td>{{ formatDuration(split.moving_time) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
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
            <div v-if="activity.elev_high != null" class="detail-item">
              <span class="detail-label">Max Elevation</span>
              <span class="detail-value">{{ formatElevation(activity.elev_high!) }}</span>
            </div>
            <div v-if="activity.elev_low != null" class="detail-item">
              <span class="detail-label">Min Elevation</span>
              <span class="detail-value">{{ formatElevation(activity.elev_low!) }}</span>
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
  width: 100%;
  max-width: 1200px;
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

/* Elevation Summary */
.elevation-summary {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 1rem;
}

.elevation-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1rem;
  background: #f9f9f9;
  border-radius: 8px;
}

.elevation-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1a1a2e;
}

.elevation-label {
  font-size: 0.75rem;
  color: #666;
  text-transform: uppercase;
  margin-top: 0.25rem;
}

/* Section Header */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.section-header .section-title {
  margin: 0;
}

/* Metric Selector */
.metric-selector {
  display: flex;
  gap: 0.25rem;
}

.metric-btn {
  padding: 0.375rem 0.75rem;
  border: 1px solid #e0e0e0;
  background: #fff;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.metric-btn:hover {
  border-color: #fc4c02;
}

.metric-btn.active {
  background: #fc4c02;
  border-color: #fc4c02;
  color: #fff;
}

/* Laps Chart */
.laps-chart-container {
  width: 100%;
  height: 200px;
  margin-bottom: 1rem;
}

.laps-chart-container svg {
  width: 100%;
  height: 100%;
}

/* Tables */
.laps-table,
.splits-table {
  overflow-x: auto;
}

.laps-table table,
.splits-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.laps-table th,
.splits-table th {
  text-align: left;
  padding: 0.75rem 0.5rem;
  border-bottom: 2px solid #e0e0e0;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  font-size: 0.75rem;
}

.laps-table td,
.splits-table td {
  padding: 0.75rem 0.5rem;
  border-bottom: 1px solid #f0f0f0;
  color: #1a1a2e;
}

.laps-table tr:hover,
.splits-table tr:hover {
  background: #f9f9f9;
}

.pace-cell {
  font-weight: 600;
  font-family: monospace;
}

.elev-up {
  color: #4caf50;
}

.elev-down {
  color: #f44336;
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
