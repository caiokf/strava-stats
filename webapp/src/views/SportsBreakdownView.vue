<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import * as d3 from 'd3'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import ChartContainer from '@/components/charts/ChartContainer.vue'
import { useActivitiesStore } from '@/stores/activities'
import {
  calculateSportBreakdown,
  formatDistance,
  formatDuration,
  formatElevation,
  type SportStats,
} from '@/lib/aggregations'

const activitiesStore = useActivitiesStore()

const svgRef = ref<SVGSVGElement | null>(null)
const containerDimensions = ref({ width: 0, height: 0 })
const selectedSport = ref<SportStats | null>(null)

const metricType = ref<'duration' | 'distance' | 'count'>('duration')
const metricOptions = [
  { value: 'duration', label: 'Time Spent' },
  { value: 'distance', label: 'Distance' },
  { value: 'count', label: 'Activity Count' },
]

const sportsBreakdown = computed(() => {
  if (!activitiesStore.hasAllActivities) return []
  return calculateSportBreakdown(activitiesStore.allActivities)
})

const totals = computed(() => ({
  activities: activitiesStore.allActivities.length,
  duration: activitiesStore.allActivities.reduce((sum, a) => sum + (a.moving_time || 0), 0),
  distance: activitiesStore.allActivities.reduce((sum, a) => sum + (a.distance || 0), 0),
}))

const colorScale = d3
  .scaleOrdinal<string>()
  .domain([
    'Run',
    'Ride',
    'VirtualRide',
    'Swim',
    'Walk',
    'Hike',
    'WeightTraining',
    'Yoga',
    'Workout',
  ])
  .range([
    '#fc4c02',
    '#1a73e8',
    '#34a853',
    '#00bcd4',
    '#9c27b0',
    '#ff9800',
    '#607d8b',
    '#e91e63',
    '#795548',
  ])

function getSportIcon(sportType: string): string {
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
  return icons[sportType] || '🏃'
}

function getMetricValue(sport: SportStats): number {
  switch (metricType.value) {
    case 'distance':
      return sport.totalDistance
    case 'count':
      return sport.activityCount
    case 'duration':
    default:
      return sport.totalDuration
  }
}

function formatMetricValue(value: number): string {
  switch (metricType.value) {
    case 'distance':
      return formatDistance(value)
    case 'count':
      return `${value} activities`
    case 'duration':
    default:
      return formatDuration(value)
  }
}

onMounted(async () => {
  if (!activitiesStore.hasAllActivities) {
    await activitiesStore.loadAllActivities()
  }
})

function onResize(dimensions: { width: number; height: number }) {
  containerDimensions.value = dimensions
  renderChart()
}

watch([sportsBreakdown, containerDimensions, metricType], () => {
  renderChart()
})

function renderChart() {
  if (!svgRef.value || sportsBreakdown.value.length === 0) return

  const { width, height } = containerDimensions.value
  if (width === 0 || height === 0) return

  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()

  svg.attr('width', width).attr('height', height)

  // Prepare data for treemap
  interface TreemapNode {
    name: string
    value: number
    sport: SportStats
  }

  interface TreemapData {
    name: string
    children: TreemapNode[]
  }

  const data: TreemapData = {
    name: 'sports',
    children: sportsBreakdown.value.map((sport) => ({
      name: sport.sportType,
      value: getMetricValue(sport),
      sport,
    })),
  }

  // Create treemap layout
  const root = d3
    .hierarchy(data)
    .sum((d) => (d as unknown as TreemapNode).value ?? 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

  const treemapLayout = d3.treemap<TreemapData>().size([width, height]).padding(3).round(true)
  treemapLayout(root)

  // Get leaves with rectangle properties
  type TreemapLeaf = d3.HierarchyRectangularNode<TreemapData>
  const leaves = root.leaves() as TreemapLeaf[]

  // Create cell groups
  const cell = svg
    .selectAll('g')
    .data(leaves)
    .enter()
    .append('g')
    .attr('transform', (d) => `translate(${d.x0},${d.y0})`)

  // Add rectangles
  cell
    .append('rect')
    .attr('width', (d) => d.x1 - d.x0)
    .attr('height', (d) => d.y1 - d.y0)
    .attr('fill', (d) => colorScale((d.data as unknown as TreemapNode).name))
    .attr('fill-opacity', 0.85)
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)
    .attr('rx', 4)
    .style('cursor', 'pointer')
    .on('mouseover', function (event, d) {
      d3.select(this).attr('fill-opacity', 1)
      const sportData = (d.data as unknown as TreemapNode).sport
      if (sportData) {
        selectedSport.value = sportData
      }
    })
    .on('mouseout', function () {
      d3.select(this).attr('fill-opacity', 0.85)
      selectedSport.value = null
    })

  // Add sport name labels
  cell
    .append('text')
    .attr('x', 8)
    .attr('y', 20)
    .attr('fill', '#fff')
    .attr('font-size', (d) => {
      const cellWidth = d.x1 - d.x0
      const cellHeight = d.y1 - d.y0
      if (cellWidth < 60 || cellHeight < 40) return '0px'
      if (cellWidth < 100) return '10px'
      return '12px'
    })
    .attr('font-weight', 'bold')
    .text((d) => {
      const cellWidth = d.x1 - d.x0
      if (cellWidth < 60) return ''
      return (d.data as unknown as TreemapNode).name
    })
    .style('pointer-events', 'none')

  // Add value labels
  cell
    .append('text')
    .attr('x', 8)
    .attr('y', 38)
    .attr('fill', '#fff')
    .attr('fill-opacity', 0.8)
    .attr('font-size', (d) => {
      const cellWidth = d.x1 - d.x0
      const cellHeight = d.y1 - d.y0
      if (cellWidth < 80 || cellHeight < 50) return '0px'
      return '10px'
    })
    .text((d) => {
      const cellWidth = d.x1 - d.x0
      if (cellWidth < 80) return ''
      return formatMetricValue((d.data as unknown as TreemapNode).value)
    })
    .style('pointer-events', 'none')

  // Icons removed from treemap per user request
}
</script>

<template>
  <DashboardLayout>
    <div class="sports-breakdown">
      <div class="page-header">
        <h1 class="page-title">Sports Breakdown</h1>
        <div class="metric-selector">
          <button
            v-for="option in metricOptions"
            :key="option.value"
            class="metric-btn"
            :class="{ active: metricType === option.value }"
            @click="metricType = option.value as 'duration' | 'distance' | 'count'"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <!-- Summary Stats -->
      <div class="stats-row">
        <div class="stat-item">
          <span class="stat-value">{{ sportsBreakdown.length }}</span>
          <span class="stat-label">Sports</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ totals.activities }}</span>
          <span class="stat-label">Activities</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ formatDuration(totals.duration) }}</span>
          <span class="stat-label">Total Time</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ formatDistance(totals.distance) }}</span>
          <span class="stat-label">Total Distance</span>
        </div>
      </div>

      <!-- Treemap Chart -->
      <ChartContainer
        title="Sport Distribution"
        :loading="activitiesStore.loadingAll"
        :error="activitiesStore.error"
        height="400px"
        @resize="onResize"
      >
        <template #default>
          <svg ref="svgRef"></svg>
        </template>
        <template #footer>
          <div v-if="selectedSport" class="sport-details">
            <strong>{{ getSportIcon(selectedSport.sportType) }} {{ selectedSport.sportType }}</strong>
            <div class="sport-stats">
              <span>{{ selectedSport.activityCount }} activities</span>
              <span>{{ formatDistance(selectedSport.totalDistance) }}</span>
              <span>{{ formatDuration(selectedSport.totalDuration) }}</span>
              <span>{{ formatElevation(selectedSport.totalElevation) }} elevation</span>
            </div>
          </div>
          <div v-else class="sport-placeholder">
            Hover over a sport to see details
          </div>
        </template>
      </ChartContainer>

      <!-- Sports List -->
      <div class="section">
        <h2 class="section-title">By Sport</h2>
        <div class="sports-grid">
          <div
            v-for="sport in sportsBreakdown"
            :key="sport.sportType"
            class="sport-card"
            :style="{ borderLeftColor: colorScale(sport.sportType) }"
          >
            <div class="sport-header">
              <span class="sport-icon">{{ getSportIcon(sport.sportType) }}</span>
              <span class="sport-name">{{ sport.sportType }}</span>
              <span class="sport-count">{{ sport.activityCount }} activities</span>
            </div>
            <div class="sport-metrics">
              <div class="metric">
                <span class="metric-value">{{ formatDuration(sport.totalDuration) }}</span>
                <span class="metric-label">Total Time</span>
              </div>
              <div class="metric">
                <span class="metric-value">{{ formatDistance(sport.totalDistance) }}</span>
                <span class="metric-label">Distance</span>
              </div>
              <div class="metric">
                <span class="metric-value">{{ formatElevation(sport.totalElevation) }}</span>
                <span class="metric-label">Elevation</span>
              </div>
            </div>
            <div class="sport-averages">
              <span>Avg: {{ formatDistance(sport.averageDistance) }} / {{ formatDuration(sport.averageDuration) }}</span>
            </div>
            <div v-if="sport.bestEfforts.longestActivity" class="best-effort">
              <span class="best-label">Longest:</span>
              <RouterLink
                :to="`/activity/${sport.bestEfforts.longestActivity.id}`"
                class="best-link"
              >
                {{ sport.bestEfforts.longestActivity.name }}
                ({{ formatDistance(sport.bestEfforts.longestActivity.distance || 0) }})
              </RouterLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>

<style scoped>
.sports-breakdown {
  width: 100%;
  max-width: 1400px;
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

.metric-selector {
  display: flex;
  gap: 0.5rem;
}

.metric-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #e0e0e0;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
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

.stats-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.stat-item {
  flex: 1;
  min-width: 120px;
  background: #fff;
  border-radius: 12px;
  padding: 1rem 1.25rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.stat-value {
  display: block;
  font-size: 1.5rem;
  font-weight: 700;
  color: #fc4c02;
}

.stat-label {
  font-size: 0.75rem;
  color: #666;
  text-transform: uppercase;
}

.sport-details,
.sport-placeholder {
  font-size: 0.875rem;
  color: #666;
}

.sport-stats {
  display: flex;
  gap: 1.5rem;
  margin-top: 0.25rem;
  flex-wrap: wrap;
}

.sport-placeholder {
  font-style: italic;
}

.section {
  background: #fff;
  border-radius: 12px;
  padding: 1.5rem;
  margin-top: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0 0 1rem 0;
}

.sports-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.sport-card {
  background: #f9f9f9;
  border-radius: 8px;
  padding: 1rem;
  border-left: 4px solid #fc4c02;
}

.sport-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.sport-icon {
  font-size: 1.5rem;
}

.sport-name {
  font-weight: 600;
  color: #1a1a2e;
  flex: 1;
}

.sport-count {
  font-size: 0.75rem;
  color: #666;
  background: #e0e0e0;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.sport-metrics {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.metric {
  display: flex;
  flex-direction: column;
}

.metric-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1a1a2e;
}

.metric-label {
  font-size: 0.625rem;
  color: #999;
  text-transform: uppercase;
}

.sport-averages {
  font-size: 0.75rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.best-effort {
  font-size: 0.75rem;
  color: #666;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #e0e0e0;
}

.best-label {
  font-weight: 500;
}

.best-link {
  color: #fc4c02;
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.best-link:hover {
  text-decoration: underline;
}

@media (max-width: 768px) {
  .stats-row {
    flex-direction: column;
  }

  .stat-item {
    min-width: 100%;
  }

  .sports-grid {
    grid-template-columns: 1fr;
  }

  .sport-stats {
    flex-direction: column;
    gap: 0.25rem;
  }
}
</style>
