<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import * as d3 from 'd3'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import ChartContainer from '@/components/charts/ChartContainer.vue'
import { useActivitiesStore } from '@/stores/activities'
import { formatDate, formatDuration } from '@/lib/aggregations'

interface PowerDataPoint {
  date: Date
  avgPower: number
  maxPower: number
  normalizedPower: number
  duration: number
  activityName: string
  activityId: number
}

const activitiesStore = useActivitiesStore()

const svgRef = ref<SVGSVGElement | null>(null)
const containerDimensions = ref({ width: 0, height: 0 })
const hoveredPoint = ref<PowerDataPoint | null>(null)

const timeRange = ref<'3m' | '6m' | '1y' | 'all'>('6m')
const timeRangeOptions = [
  { value: '3m', label: '3 Months' },
  { value: '6m', label: '6 Months' },
  { value: '1y', label: '1 Year' },
  { value: 'all', label: 'All Time' },
]

const metricType = ref<'avg' | 'normalized' | 'max'>('avg')
const metricOptions = [
  { value: 'avg', label: 'Average Power' },
  { value: 'normalized', label: 'Normalized Power' },
  { value: 'max', label: 'Max Power' },
]

const cyclingActivities = computed(() => {
  if (!activitiesStore.hasAllActivities) return []

  return activitiesStore.allActivities.filter(
    (a) =>
      (a.type === 'Ride' || a.sport_type === 'Ride' || a.sport_type === 'VirtualRide') &&
      (a.average_watts || a.weighted_average_watts),
  )
})

const powerData = computed((): PowerDataPoint[] => {
  if (cyclingActivities.value.length === 0) return []

  const now = new Date()
  let cutoffDate: Date | null = null

  switch (timeRange.value) {
    case '3m':
      cutoffDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
      break
    case '6m':
      cutoffDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
      break
    case '1y':
      cutoffDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
      break
    case 'all':
    default:
      cutoffDate = null
  }

  return cyclingActivities.value
    .filter((a) => !cutoffDate || new Date(a.start_date) >= cutoffDate)
    .map((a) => ({
      date: new Date(a.start_date),
      avgPower: a.average_watts || 0,
      maxPower: a.max_watts || 0,
      normalizedPower: a.weighted_average_watts || a.average_watts || 0,
      duration: a.moving_time || 0,
      activityName: a.name,
      activityId: a.id,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
})

const stats = computed(() => {
  if (powerData.value.length === 0) {
    return {
      avgPower: 0,
      maxAvgPower: 0,
      maxPower: 0,
      recentTrend: 0,
      totalRides: 0,
    }
  }

  const avgPowers = powerData.value.map((d) => d.avgPower)
  const avgPower = Math.round(avgPowers.reduce((a, b) => a + b, 0) / avgPowers.length)
  const maxAvgPower = Math.max(...avgPowers)
  const maxPower = Math.max(...powerData.value.map((d) => d.maxPower))

  // Calculate 30-day trend
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

  const recentRides = powerData.value.filter((d) => d.date >= thirtyDaysAgo)
  const previousRides = powerData.value.filter((d) => d.date >= sixtyDaysAgo && d.date < thirtyDaysAgo)

  let recentTrend = 0
  if (recentRides.length > 0 && previousRides.length > 0) {
    const recentAvg = recentRides.reduce((sum, d) => sum + d.avgPower, 0) / recentRides.length
    const prevAvg = previousRides.reduce((sum, d) => sum + d.avgPower, 0) / previousRides.length
    recentTrend = prevAvg > 0 ? Math.round(((recentAvg - prevAvg) / prevAvg) * 100) : 0
  }

  return {
    avgPower,
    maxAvgPower,
    maxPower,
    recentTrend,
    totalRides: powerData.value.length,
  }
})

onMounted(async () => {
  if (!activitiesStore.hasAllActivities) {
    await activitiesStore.loadAllActivities()
  }
})

function onResize(dimensions: { width: number; height: number }) {
  containerDimensions.value = dimensions
  renderChart()
}

watch([powerData, containerDimensions, metricType], () => {
  renderChart()
})

function getMetricValue(d: PowerDataPoint): number {
  switch (metricType.value) {
    case 'normalized':
      return d.normalizedPower
    case 'max':
      return d.maxPower
    case 'avg':
    default:
      return d.avgPower
  }
}

function renderChart() {
  if (!svgRef.value || powerData.value.length === 0) return

  const { width, height } = containerDimensions.value
  if (width === 0 || height === 0) return

  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()

  const margin = { top: 20, right: 30, bottom: 40, left: 50 }
  const chartWidth = width - margin.left - margin.right
  const chartHeight = height - margin.top - margin.bottom

  svg.attr('width', width).attr('height', height)

  const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`)

  const data = powerData.value

  // Scales
  const xScale = d3
    .scaleTime()
    .domain(d3.extent(data, (d) => d.date) as [Date, Date])
    .range([0, chartWidth])

  const yMax = Math.max(...data.map((d) => getMetricValue(d)))
  const yScale = d3
    .scaleLinear()
    .domain([0, yMax * 1.1])
    .range([chartHeight, 0])

  // Grid lines
  g.append('g')
    .attr('class', 'grid')
    .call(
      d3
        .axisLeft(yScale)
        .tickSize(-chartWidth)
        .tickFormat(() => ''),
    )
    .selectAll('line')
    .attr('stroke', '#e0e0e0')
    .attr('stroke-dasharray', '2,2')

  g.select('.grid').select('.domain').remove()

  // Trend line (moving average)
  if (data.length >= 7) {
    const windowSize = Math.min(7, Math.floor(data.length / 3))
    const movingAvg: { date: Date; value: number }[] = []

    for (let i = windowSize - 1; i < data.length; i++) {
      const window = data.slice(i - windowSize + 1, i + 1)
      const avg = window.reduce((sum, d) => sum + getMetricValue(d), 0) / windowSize
      const lastPoint = window[window.length - 1]
      if (lastPoint) {
        movingAvg.push({ date: lastPoint.date, value: avg })
      }
    }

    const trendLine = d3
      .line<{ date: Date; value: number }>()
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.value))
      .curve(d3.curveMonotoneX)

    g.append('path')
      .datum(movingAvg)
      .attr('fill', 'none')
      .attr('stroke', '#fc4c02')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.8)
      .attr('d', trendLine)
  }

  // Data points
  g.selectAll('.point')
    .data(data)
    .enter()
    .append('circle')
    .attr('class', 'point')
    .attr('cx', (d) => xScale(d.date))
    .attr('cy', (d) => yScale(getMetricValue(d)))
    .attr('r', 5)
    .attr('fill', '#fc4c02')
    .attr('fill-opacity', 0.6)
    .attr('stroke', '#fff')
    .attr('stroke-width', 1)
    .style('cursor', 'pointer')
    .on('mouseover', function (event, d) {
      d3.select(this).attr('r', 7).attr('fill-opacity', 1)
      hoveredPoint.value = d
    })
    .on('mouseout', function () {
      d3.select(this).attr('r', 5).attr('fill-opacity', 0.6)
      hoveredPoint.value = null
    })

  // X axis
  const xAxis = g.append('g').attr('transform', `translate(0, ${chartHeight})`).call(
    d3
      .axisBottom(xScale)
      .ticks(width > 600 ? 8 : 4)
      .tickFormat((d) => d3.timeFormat('%b %d')(d as Date)),
  )

  xAxis.selectAll('text').attr('font-size', '10px').attr('fill', '#666')
  xAxis.select('.domain').attr('stroke', '#e0e0e0')

  // Y axis
  const yAxis = g.append('g').call(d3.axisLeft(yScale).ticks(6).tickFormat((d) => `${d}W`))

  yAxis.selectAll('text').attr('font-size', '11px').attr('fill', '#666')
  yAxis.select('.domain').remove()

  // Y axis label
  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('y', -40)
    .attr('x', -chartHeight / 2)
    .attr('text-anchor', 'middle')
    .attr('font-size', '12px')
    .attr('fill', '#666')
    .text('Power (Watts)')
}
</script>

<template>
  <DashboardLayout>
    <div class="power-chart">
      <div class="page-header">
        <h1 class="page-title">Cycling Power</h1>
        <div class="controls">
          <div class="time-range-selector">
            <button
              v-for="option in timeRangeOptions"
              :key="option.value"
              class="range-btn"
              :class="{ active: timeRange === option.value }"
              @click="timeRange = option.value as '3m' | '6m' | '1y' | 'all'"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- Stats Summary -->
      <div class="stats-row">
        <div class="stat-item">
          <span class="stat-value">{{ stats.avgPower }}W</span>
          <span class="stat-label">Avg Power</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ stats.maxAvgPower }}W</span>
          <span class="stat-label">Best Avg Power</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ stats.maxPower }}W</span>
          <span class="stat-label">Peak Power</span>
        </div>
        <div class="stat-item">
          <span class="stat-value" :class="{ positive: stats.recentTrend > 0, negative: stats.recentTrend < 0 }">
            {{ stats.recentTrend > 0 ? '+' : '' }}{{ stats.recentTrend }}%
          </span>
          <span class="stat-label">30-Day Trend</span>
        </div>
      </div>

      <!-- Metric Selector -->
      <div class="metric-selector">
        <span class="metric-label">Show:</span>
        <button
          v-for="option in metricOptions"
          :key="option.value"
          class="metric-btn"
          :class="{ active: metricType === option.value }"
          @click="metricType = option.value as 'avg' | 'normalized' | 'max'"
        >
          {{ option.label }}
        </button>
      </div>

      <!-- Power Chart -->
      <ChartContainer
        title="Power Over Time"
        :loading="activitiesStore.loadingAll"
        :error="activitiesStore.error"
        height="400px"
        @resize="onResize"
      >
        <template #default>
          <svg ref="svgRef"></svg>
        </template>
        <template #footer>
          <div v-if="hoveredPoint" class="hover-details">
            <strong>{{ hoveredPoint.activityName }}</strong>
            <div class="hover-stats">
              <span>{{ formatDate(hoveredPoint.date) }}</span>
              <span>Avg: {{ hoveredPoint.avgPower }}W</span>
              <span v-if="hoveredPoint.normalizedPower !== hoveredPoint.avgPower">
                NP: {{ hoveredPoint.normalizedPower }}W
              </span>
              <span>Max: {{ hoveredPoint.maxPower }}W</span>
              <span>{{ formatDuration(hoveredPoint.duration) }}</span>
            </div>
          </div>
          <div v-else-if="powerData.length === 0" class="hover-placeholder">
            No cycling activities with power data found
          </div>
          <div v-else class="hover-placeholder">
            Hover over points to see ride details. Orange line shows {{ stats.totalRides >= 7 ? '7-ride' : '' }} moving average.
          </div>
        </template>
      </ChartContainer>

      <!-- Recent Rides with Power -->
      <div v-if="powerData.length > 0" class="section">
        <h2 class="section-title">Recent Rides</h2>
        <div class="rides-list">
          <RouterLink
            v-for="ride in powerData.slice().reverse().slice(0, 10)"
            :key="ride.activityId"
            :to="`/activity/${ride.activityId}`"
            class="ride-card"
          >
            <div class="ride-header">
              <span class="ride-name">{{ ride.activityName }}</span>
              <span class="ride-date">{{ formatDate(ride.date) }}</span>
            </div>
            <div class="ride-power">
              <div class="power-bar">
                <div
                  class="power-fill"
                  :style="{ width: `${Math.min(100, (ride.avgPower / stats.maxAvgPower) * 100)}%` }"
                ></div>
              </div>
              <span class="power-value">{{ ride.avgPower }}W</span>
            </div>
            <div class="ride-stats">
              <span v-if="ride.normalizedPower !== ride.avgPower">NP: {{ ride.normalizedPower }}W</span>
              <span>Max: {{ ride.maxPower }}W</span>
              <span>{{ formatDuration(ride.duration) }}</span>
            </div>
          </RouterLink>
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>

<style scoped>
.power-chart {
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

.controls {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.time-range-selector {
  display: flex;
  gap: 0.5rem;
}

.range-btn,
.metric-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #e0e0e0;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.range-btn:hover,
.metric-btn:hover {
  border-color: #fc4c02;
}

.range-btn.active,
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
  min-width: 140px;
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

.stat-value.positive {
  color: #4caf50;
}

.stat-value.negative {
  color: #f44336;
}

.stat-label {
  font-size: 0.75rem;
  color: #666;
  text-transform: uppercase;
}

.metric-selector {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.metric-label {
  font-size: 0.875rem;
  color: #666;
}

.hover-details,
.hover-placeholder {
  font-size: 0.875rem;
  color: #666;
}

.hover-stats {
  display: flex;
  gap: 1rem;
  margin-top: 0.25rem;
  flex-wrap: wrap;
}

.hover-placeholder {
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

.rides-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.ride-card {
  display: block;
  padding: 1rem;
  background: #f9f9f9;
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  transition: background 0.2s;
}

.ride-card:hover {
  background: #f0f0f0;
}

.ride-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.ride-name {
  font-weight: 600;
  color: #1a1a2e;
}

.ride-date {
  font-size: 0.75rem;
  color: #999;
}

.ride-power {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.power-bar {
  flex: 1;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.power-fill {
  height: 100%;
  background: linear-gradient(90deg, #fc4c02, #ff7043);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.power-value {
  font-weight: 700;
  color: #fc4c02;
  min-width: 60px;
  text-align: right;
}

.ride-stats {
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  color: #666;
}

@media (max-width: 768px) {
  .stats-row {
    flex-direction: column;
  }

  .stat-item {
    min-width: 100%;
  }

  .metric-selector {
    flex-wrap: wrap;
  }

  .hover-stats {
    flex-direction: column;
    gap: 0.25rem;
  }
}
</style>
