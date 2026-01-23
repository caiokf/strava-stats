<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import * as L from 'leaflet'
import polyline from '@mapbox/polyline'
import 'leaflet/dist/leaflet.css'

interface Props {
  polylineData: string | null
  width?: number
  height?: number
}

const props = withDefaults(defineProps<Props>(), {
  width: 120,
  height: 80,
})

const mapContainer = ref<HTMLDivElement | null>(null)
let map: L.Map | null = null

const decodedPolyline = computed(() => {
  if (!props.polylineData) return null
  try {
    return polyline.decode(props.polylineData)
  } catch {
    return null
  }
})

const hasMap = computed(() => decodedPolyline.value && decodedPolyline.value.length > 0)

function initMap() {
  if (!hasMap.value || !mapContainer.value) return

  // Clean up existing map
  if (map) {
    map.remove()
    map = null
  }

  const coordinates = decodedPolyline.value!

  // Create map with minimal controls
  map = L.map(mapContainer.value, {
    attributionControl: false,
    zoomControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    touchZoom: false,
    boxZoom: false,
    keyboard: false,
  })

  // Add light tiles
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
  }).addTo(map)

  // Create polyline from coordinates
  const latLngs: L.LatLngTuple[] = coordinates.map(([lat, lng]) => [lat, lng])
  const routeLine = L.polyline(latLngs, {
    color: '#fc4c02',
    weight: 2,
    opacity: 0.9,
  }).addTo(map)

  // Fit map to route bounds
  map.fitBounds(routeLine.getBounds(), { padding: [5, 5] })
}

onMounted(() => {
  if (hasMap.value) {
    initMap()
  }
})

onUnmounted(() => {
  if (map) {
    map.remove()
    map = null
  }
})

watch(() => props.polylineData, () => {
  if (hasMap.value) {
    initMap()
  }
})
</script>

<template>
  <div
    class="mini-map-container"
    :style="{ width: `${width}px`, height: `${height}px` }"
  >
    <div v-if="hasMap" ref="mapContainer" class="mini-map"></div>
    <div v-else class="mini-map-placeholder">
      <span class="placeholder-icon">📍</span>
    </div>
  </div>
</template>

<style scoped>
.mini-map-container {
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
}

.mini-map {
  width: 100%;
  height: 100%;
}

.mini-map-placeholder {
  width: 100%;
  height: 100%;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-icon {
  font-size: 1.5rem;
  opacity: 0.4;
}
</style>
