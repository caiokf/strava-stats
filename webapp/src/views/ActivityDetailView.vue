<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as d3 from 'd3'
import maplibregl from 'maplibre-gl'
import polyline from '@mapbox/polyline'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import { getActivityById } from '@/services/activitiesService'
import { formatDistance, formatDuration, formatElevation, formatPace } from '@/lib/aggregations'
import type { Activity } from '@/types/activity'
import 'maplibre-gl/dist/maplibre-gl.css'

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
let map: maplibregl.Map | null = null

const mapStyle = ref<'outdoors' | 'satellite'>('outdoors')
const isMapFullscreen = ref(false)

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

// Free map styles - using OpenFreeMap (completely free, no signup)
function getMapStyle(): string {
  if (mapStyle.value === 'satellite') {
    // For satellite, we'll use a simple style with ESRI imagery
    return 'https://api.maptiler.com/maps/hybrid/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL'
  }
  // OpenFreeMap - completely free vector tiles, no API key needed
  return 'https://tiles.openfreemap.org/styles/liberty'
}

function initMap() {
  if (!hasMap.value || !mapContainer.value) {
    console.log('initMap: no map data or container', { hasMap: hasMap.value, container: !!mapContainer.value })
    return
  }

  // Clean up existing map
  if (map) {
    map.remove()
    map = null
  }

  const coordinates = decodedPolyline.value!
  console.log('initMap: coordinates', coordinates.length, 'points')

  // Create map with free tiles
  map = new maplibregl.Map({
    container: mapContainer.value,
    style: getMapStyle(),
    center: coordinates[0] ? [coordinates[0][1], coordinates[0][0]] : [0, 0],
    zoom: 12,
  })

  map.on('error', (e) => {
    console.error('Map error:', e)
  })

  map.on('load', () => {
    console.log('Map loaded successfully')
    if (!map) return

    // Convert coordinates to GeoJSON format [lng, lat]
    const geoJsonCoords = coordinates.map(([lat, lng]) => [lng, lat])
    console.log('Adding route with', geoJsonCoords.length, 'coordinates')

    // Add route line
    map.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: geoJsonCoords,
        },
      },
    })

    // Route outline (for better visibility)
    map.addLayer({
      id: 'route-outline',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': '#ffffff',
        'line-width': 6,
      },
    })

    // Main route line
    map.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': '#fc4c02',
        'line-width': 4,
      },
    })

    // Add start marker
    if (geoJsonCoords.length > 0 && geoJsonCoords[0]) {
      const startEl = document.createElement('div')
      startEl.className = 'map-marker start-marker'
      startEl.innerHTML = '<div class="marker-inner"></div>'

      new maplibregl.Marker(startEl)
        .setLngLat(geoJsonCoords[0] as [number, number])
        .setPopup(new maplibregl.Popup({ offset: 25 }).setText('Start'))
        .addTo(map)
    }

    // Add end marker (if different from start)
    if (geoJsonCoords.length > 1) {
      const endCoord = geoJsonCoords[geoJsonCoords.length - 1]
      const startCoord = geoJsonCoords[0]
      if (endCoord && startCoord && (endCoord[0] !== startCoord[0] || endCoord[1] !== startCoord[1])) {
        const endEl = document.createElement('div')
        endEl.className = 'map-marker end-marker'
        endEl.innerHTML = '<div class="marker-inner"></div>'

        new maplibregl.Marker(endEl)
          .setLngLat(endCoord as [number, number])
          .setPopup(new maplibregl.Popup({ offset: 25 }).setText('Finish'))
          .addTo(map)
      }
    }

    // Fit map to route bounds
    const bounds = new maplibregl.LngLatBounds()
    geoJsonCoords.forEach((coord) => {
      if (coord) bounds.extend(coord as [number, number])
    })
    map.fitBounds(bounds, { padding: 50 })
  })

  // Add navigation controls
  map.addControl(new maplibregl.NavigationControl(), 'top-right')
}

function toggleMapStyle() {
  mapStyle.value = mapStyle.value === 'outdoors' ? 'satellite' : 'outdoors'
  if (map) {
    map.setStyle(getMapStyle())
    // Re-add route after style change
    map.once('style.load', () => {
      if (!map || !decodedPolyline.value) return
      const geoJsonCoords = decodedPolyline.value.map(([lat, lng]) => [lng, lat])

      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: geoJsonCoords,
          },
        },
      })

      map.addLayer({
        id: 'route-outline',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 6 },
      })

      map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#fc4c02', 'line-width': 4 },
      })
    })
  }
}

function toggleMapFullscreen() {
  isMapFullscreen.value = !isMapFullscreen.value
  nextTick(() => {
    if (map) map.resize()
  })
}

function exportGPX() {
  if (!activity.value || !decodedPolyline.value) return

  const coordinates = decodedPolyline.value
  const name = activity.value.name || 'Activity'
  const time = activity.value.start_date_local || activity.value.start_date

  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Strava Stats"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${name}</name>
    <time>${time}</time>
  </metadata>
  <trk>
    <name>${name}</name>
    <trkseg>
`

  coordinates.forEach(([lat, lng]) => {
    gpx += `      <trkpt lat="${lat}" lon="${lng}"></trkpt>\n`
  })

  gpx += `    </trkseg>
  </trk>
</gpx>`

  const blob = new Blob([gpx], { type: 'application/gpx+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name.replace(/[^a-z0-9]/gi, '_')}.gpx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
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
        <!-- Strava-style Header -->
        <div class="activity-header">
          <button class="back-btn" @click="goBack">
            <span class="back-icon">←</span>
            <span class="back-text">Back</span>
          </button>

          <div class="header-main">
            <div class="header-top">
              <div class="activity-type-badge">
                <span class="sport-icon">{{ sportIcon }}</span>
                <span class="sport-type">{{ activity.sport_type || activity.type }}</span>
              </div>
              <div class="activity-datetime">
                <span class="date">{{ formattedDate }}</span>
                <span class="time">at {{ formattedStartTime }}</span>
              </div>
            </div>

            <h1 class="activity-title">{{ activity.name }}</h1>

            <p v-if="activity.description" class="activity-description">
              {{ activity.description }}
            </p>

            <!-- Inline Stats Row - Strava Style -->
            <div class="stats-row">
              <div v-if="activity.distance" class="stat-item">
                <span class="stat-value">{{ formatDistance(activity.distance) }}</span>
                <span class="stat-label">Distance</span>
              </div>
              <div v-if="activity.moving_time" class="stat-item">
                <span class="stat-value">{{ formatDuration(activity.moving_time) }}</span>
                <span class="stat-label">Moving Time</span>
              </div>
              <div v-if="activity.total_elevation_gain" class="stat-item">
                <span class="stat-value">{{ formatElevation(activity.total_elevation_gain) }}</span>
                <span class="stat-label">Elevation</span>
              </div>
              <div v-if="activity.average_speed" class="stat-item">
                <span class="stat-value">{{ formatPace(activity.average_speed) }}</span>
                <span class="stat-label">Pace</span>
              </div>
              <div v-if="activity.average_heartrate" class="stat-item">
                <span class="stat-value">{{ Math.round(activity.average_heartrate) }}</span>
                <span class="stat-label">Avg HR</span>
              </div>
              <div v-if="activity.average_watts" class="stat-item">
                <span class="stat-value">{{ Math.round(activity.average_watts) }}W</span>
                <span class="stat-label">Avg Power</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Map Section -->
        <div v-if="hasMap" class="map-section" :class="{ fullscreen: isMapFullscreen }">
          <div class="map-toolbar">
            <div class="map-title">Route Map</div>
            <div class="map-controls">
              <button class="map-btn" @click="toggleMapStyle" :title="mapStyle === 'outdoors' ? 'Switch to Satellite' : 'Switch to Map'">
                <span v-if="mapStyle === 'outdoors'">🛰️</span>
                <span v-else>🗺️</span>
              </button>
              <button class="map-btn" @click="exportGPX" title="Export GPX">
                📥
              </button>
              <button class="map-btn" @click="toggleMapFullscreen" :title="isMapFullscreen ? 'Exit Fullscreen' : 'Fullscreen'">
                <span v-if="isMapFullscreen">⛶</span>
                <span v-else>⛶</span>
              </button>
            </div>
          </div>
          <div ref="mapContainer" class="map-container"></div>
        </div>

        <div v-else class="no-map-section">
          <div class="no-map-content">
            <span class="no-map-icon">🗺️</span>
            <p>No route data available for this activity</p>
          </div>
        </div>

        <!-- Secondary Stats Grid -->
        <div class="secondary-stats">
          <div class="stats-grid">
            <div v-if="activity.elapsed_time && activity.elapsed_time !== activity.moving_time" class="stat-card">
              <span class="stat-value">{{ formatDuration(activity.elapsed_time) }}</span>
              <span class="stat-label">Elapsed Time</span>
            </div>
            <div v-if="activity.max_heartrate" class="stat-card">
              <span class="stat-value">{{ Math.round(activity.max_heartrate) }} bpm</span>
              <span class="stat-label">Max Heart Rate</span>
            </div>
            <div v-if="activity.max_watts" class="stat-card">
              <span class="stat-value">{{ activity.max_watts }}W</span>
              <span class="stat-label">Max Power</span>
            </div>
            <div v-if="activity.weighted_average_watts" class="stat-card">
              <span class="stat-value">{{ activity.weighted_average_watts }}W</span>
              <span class="stat-label">Normalized Power</span>
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
              <span class="stat-label">Relative Effort</span>
            </div>
            <div v-if="activity.kilojoules" class="stat-card">
              <span class="stat-value">{{ activity.kilojoules }} kJ</span>
              <span class="stat-label">Work</span>
            </div>
          </div>
        </div>

        <!-- Elevation Summary -->
        <div v-if="activity.elev_high != null || activity.total_elevation_gain" class="section elevation-section">
          <h2 class="section-title">Elevation</h2>
          <div class="elevation-grid">
            <div class="elevation-stat" v-if="activity.total_elevation_gain">
              <span class="elevation-icon">↗</span>
              <div class="elevation-data">
                <span class="elevation-value">{{ formatElevation(activity.total_elevation_gain) }}</span>
                <span class="elevation-label">Total Gain</span>
              </div>
            </div>
            <div class="elevation-stat" v-if="activity.elev_high != null">
              <span class="elevation-icon">⛰</span>
              <div class="elevation-data">
                <span class="elevation-value">{{ formatElevation(activity.elev_high!) }}</span>
                <span class="elevation-label">Max Elevation</span>
              </div>
            </div>
            <div class="elevation-stat" v-if="activity.elev_low != null">
              <span class="elevation-icon">🏝</span>
              <div class="elevation-data">
                <span class="elevation-value">{{ formatElevation(activity.elev_low!) }}</span>
                <span class="elevation-label">Min Elevation</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Laps Section -->
        <div v-if="hasLaps" class="section laps-section">
          <div class="section-header">
            <h2 class="section-title">Laps</h2>
            <div class="metric-tabs">
              <button
                v-if="lapsHavePower"
                class="metric-tab"
                :class="{ active: selectedLapsMetric === 'power' }"
                @click="selectedLapsMetric = 'power'"
              >
                Power
              </button>
              <button
                class="metric-tab"
                :class="{ active: selectedLapsMetric === 'speed' }"
                @click="selectedLapsMetric = 'speed'"
              >
                Speed
              </button>
              <button
                v-if="lapsHaveHeartrate"
                class="metric-tab"
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
          <div class="laps-table-wrapper">
            <table class="laps-table">
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
                  <td class="lap-number">{{ lap.lap_index }}</td>
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

        <!-- Splits Section -->
        <div v-if="hasSplits" class="section splits-section">
          <h2 class="section-title">Splits</h2>
          <div class="splits-table-wrapper">
            <table class="splits-table">
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
                  <td class="split-number">{{ split.split }}</td>
                  <td class="pace-cell">{{ formatSplitPace(split.average_speed) }}/km</td>
                  <td :class="{ 'elev-up': (split.elevation_difference || 0) > 0, 'elev-down': (split.elevation_difference || 0) < 0 }">
                    {{ split.elevation_difference !== undefined ? `${split.elevation_difference > 0 ? '+' : ''}${split.elevation_difference.toFixed(0)}m` : '-' }}
                  </td>
                  <td>{{ formatDuration(split.moving_time) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Activity Details -->
        <div class="section details-section">
          <h2 class="section-title">Details</h2>
          <div class="details-grid">
            <div v-if="activity.gear_name" class="detail-item">
              <span class="detail-icon">🏋️</span>
              <div class="detail-content">
                <span class="detail-label">Gear</span>
                <span class="detail-value">{{ activity.gear_name }}</span>
              </div>
            </div>
            <div v-if="activity.device_name" class="detail-item">
              <span class="detail-icon">📱</span>
              <div class="detail-content">
                <span class="detail-label">Device</span>
                <span class="detail-value">{{ activity.device_name }}</span>
              </div>
            </div>
            <div v-if="activity.kudos_count !== undefined" class="detail-item">
              <span class="detail-icon">👍</span>
              <div class="detail-content">
                <span class="detail-label">Kudos</span>
                <span class="detail-value">{{ activity.kudos_count }}</span>
              </div>
            </div>
            <div v-if="activity.achievement_count != null && activity.achievement_count > 0" class="detail-item">
              <span class="detail-icon">🏆</span>
              <div class="detail-content">
                <span class="detail-label">Achievements</span>
                <span class="detail-value">{{ activity.achievement_count }}</span>
              </div>
            </div>
            <div v-if="activity.pr_count != null && activity.pr_count > 0" class="detail-item">
              <span class="detail-icon">🎖️</span>
              <div class="detail-content">
                <span class="detail-label">Personal Records</span>
                <span class="detail-value">{{ activity.pr_count }}</span>
              </div>
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
            <span class="strava-logo">S</span>
            View on Strava
          </a>
        </div>
      </template>
    </div>
  </DashboardLayout>
</template>

<style scoped>
.activity-detail {
  width: 100%;
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

/* Activity Header - Strava Style */
.activity-header {
  background: #fff;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  color: #666;
  font-size: 0.875rem;
  cursor: pointer;
  padding: 0.5rem 0;
  margin-bottom: 1rem;
  transition: color 0.2s;
}

.back-btn:hover {
  color: #fc4c02;
}

.back-icon {
  font-size: 1.25rem;
}

.header-main {
  /* Header content */
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.activity-type-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #f5f5f5;
  padding: 0.375rem 0.75rem;
  border-radius: 20px;
}

.sport-icon {
  font-size: 1.25rem;
}

.sport-type {
  font-size: 0.875rem;
  font-weight: 600;
  color: #fc4c02;
  text-transform: uppercase;
}

.activity-datetime {
  font-size: 0.875rem;
  color: #666;
}

.activity-datetime .time {
  margin-left: 0.5rem;
  color: #999;
}

.activity-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0 0 0.5rem 0;
  line-height: 1.3;
}

.activity-description {
  color: #666;
  margin: 0 0 1rem 0;
  font-size: 0.9rem;
  line-height: 1.5;
}

/* Stats Row - Inline Strava Style */
.stats-row {
  display: flex;
  gap: 2rem;
  padding-top: 1rem;
  border-top: 1px solid #f0f0f0;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
}

.stats-row .stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1a1a2e;
  line-height: 1.2;
}

.stats-row .stat-label {
  font-size: 0.75rem;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Map Section */
.map-section {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}

.map-section.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  border-radius: 0;
  margin: 0;
}

.map-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #f9f9f9;
  border-bottom: 1px solid #e0e0e0;
}

.map-title {
  font-weight: 600;
  color: #1a1a2e;
}

.map-controls {
  display: flex;
  gap: 0.5rem;
}

.map-btn {
  padding: 0.5rem 0.75rem;
  border: 1px solid #e0e0e0;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
}

.map-btn:hover {
  border-color: #fc4c02;
  background: #fff8f5;
}

.map-container {
  width: 100%;
  height: 400px;
}

.map-section.fullscreen .map-container {
  height: calc(100vh - 50px);
}

.no-map-section {
  background: #f9f9f9;
  border-radius: 12px;
  padding: 3rem;
  margin-bottom: 1rem;
  text-align: center;
}

.no-map-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.no-map-icon {
  font-size: 2.5rem;
  opacity: 0.5;
}

.no-map-content p {
  color: #999;
  margin: 0;
}

/* Mapbox Markers */
:deep(.map-marker) {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.start-marker) {
  background: #4caf50;
  border: 3px solid #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

:deep(.end-marker) {
  background: #f44336;
  border: 3px solid #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

:deep(.marker-inner) {
  width: 8px;
  height: 8px;
  background: #fff;
  border-radius: 50%;
}

/* Secondary Stats */
.secondary-stats {
  margin-bottom: 1rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.75rem;
}

.stat-card {
  background: #fff;
  border-radius: 10px;
  padding: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.stat-card .stat-value {
  display: block;
  font-size: 1.25rem;
  font-weight: 700;
  color: #1a1a2e;
}

.stat-card .stat-label {
  font-size: 0.7rem;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

/* Sections */
.section {
  background: #fff;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0 0 1rem 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.section-header .section-title {
  margin: 0;
}

/* Elevation Section */
.elevation-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.elevation-stat {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: #f9f9f9;
  border-radius: 10px;
}

.elevation-icon {
  font-size: 1.5rem;
}

.elevation-data {
  display: flex;
  flex-direction: column;
}

.elevation-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1a1a2e;
}

.elevation-label {
  font-size: 0.75rem;
  color: #666;
}

/* Metric Tabs */
.metric-tabs {
  display: flex;
  gap: 0.25rem;
  background: #f5f5f5;
  border-radius: 6px;
  padding: 0.25rem;
}

.metric-tab {
  padding: 0.5rem 1rem;
  border: none;
  background: transparent;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  color: #666;
  transition: all 0.2s;
}

.metric-tab:hover {
  color: #1a1a2e;
}

.metric-tab.active {
  background: #fff;
  color: #fc4c02;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* Laps Section */
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
.laps-table-wrapper,
.splits-table-wrapper {
  overflow-x: auto;
}

.laps-table,
.splits-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.laps-table th,
.splits-table th {
  text-align: left;
  padding: 0.75rem 1rem;
  border-bottom: 2px solid #e0e0e0;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  font-size: 0.7rem;
  letter-spacing: 0.5px;
}

.laps-table td,
.splits-table td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #f0f0f0;
  color: #1a1a2e;
}

.laps-table tr:hover,
.splits-table tr:hover {
  background: #f9f9f9;
}

.lap-number,
.split-number {
  font-weight: 600;
  color: #fc4c02;
}

.pace-cell {
  font-weight: 600;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', monospace;
}

.elev-up {
  color: #4caf50;
  font-weight: 500;
}

.elev-down {
  color: #f44336;
  font-weight: 500;
}

/* Details Section */
.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: #f9f9f9;
  border-radius: 10px;
}

.detail-icon {
  font-size: 1.5rem;
}

.detail-content {
  display: flex;
  flex-direction: column;
}

.detail-label {
  font-size: 0.7rem;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.detail-value {
  font-size: 0.9rem;
  font-weight: 500;
  color: #1a1a2e;
}

/* Strava Link */
.strava-link-section {
  text-align: center;
  margin: 1.5rem 0 2rem;
}

.strava-link {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1.75rem;
  background: #fc4c02;
  color: #fff;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.strava-link:hover {
  background: #e04400;
}

.strava-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  font-weight: 700;
}

/* Responsive */
@media (max-width: 768px) {
  .activity-header {
    padding: 1rem;
  }

  .activity-title {
    font-size: 1.4rem;
  }

  .stats-row {
    gap: 1rem;
  }

  .stats-row .stat-value {
    font-size: 1.25rem;
  }

  .map-container {
    height: 300px;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .elevation-grid {
    grid-template-columns: 1fr;
  }

  .details-grid {
    grid-template-columns: 1fr;
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
