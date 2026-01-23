<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import * as d3 from 'd3'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import ChartContainer from '@/components/charts/ChartContainer.vue'
import YearSelector from '@/components/YearSelector.vue'
import { useActivitiesStore } from '@/stores/activities'
import { useActivityYears } from '@/composables/useActivityYears'
import {
  calculatePowerCurve,
  calculatePowerCurveSync,
  filterActivitiesByPeriod,
  filterActivitiesByYear,
  estimateFTP,
  POWER_CURVE_INTERVALS,
  type PowerCurvePoint,
  type PowerCurve,
} from '@/lib/powerCurve'
import { formatDate } from '@/lib/aggregations'

const activitiesStore = useActivitiesStore()

const svgRef = ref<SVGSVGElement | null>(null)
const containerDimensions = ref({ width: 0, height: 0 })
const hoveredPoint = ref<PowerCurvePoint | null>(null)

// Period selectors
const selectedYear = ref<number | null>(null)
const primaryPeriod = ref<'all' | '1y' | '6m' | '3m' | '90d'>('1y')
const comparisonPeriod = ref<'all' | '1y' | '6m' | '3m' | '90d' | 'none'>('none')
const showComparison = ref(false)

// Power curves (async computed)
const primaryCurve = ref<PowerCurve>({ points: [], period: '' })
const comparisonCurve = ref<PowerCurve | null>(null)
const calculatingPrimary = ref(false)
const calculatingComparison = ref(false)

const periodOptions = [
  { value: '90d', label: '90 Days' },
  { value: '3m', label: '3 Months' },
  { value: '6m', label: '6 Months' },
  { value: '1y', label: '1 Year' },
  { value: 'all', label: 'All Time' },
]

// Year selector
const allActivities = computed(() => activitiesStore.allActivities)
const { years } = useActivityYears(allActivities)

// Filter activities by year first, then by period
const yearFilteredActivities = computed(() => {
  if (!activitiesStore.hasAllActivities) return []
  if (selectedYear.value === null) return activitiesStore.allActivities
  return filterActivitiesByYear(activitiesStore.allActivities, selectedYear.value)
})

// Compute primary power curve (async)
async function computePrimaryCurve() {
  if (yearFilteredActivities.value.length === 0) {
    primaryCurve.value = { points: [], period: '' }
    return
  }

  const filtered = filterActivitiesByPeriod(yearFilteredActivities.value, primaryPeriod.value)
  const label = selectedYear.value
    ? `${selectedYear.value} - ${periodOptions.find((o) => o.value === primaryPeriod.value)?.label}`
    : periodOptions.find((o) => o.value === primaryPeriod.value)?.label || ''

  // Show estimated values immediately
  primaryCurve.value = calculatePowerCurveSync(filtered, label)
  renderChart()

  // Then compute with actual stream data
  calculatingPrimary.value = true
  try {
    primaryCurve.value = await calculatePowerCurve(filtered, label)
  } finally {
    calculatingPrimary.value = false
  }
}

// Compute comparison power curve (async)
async function computeComparisonCurve() {
  if (!showComparison.value || comparisonPeriod.value === 'none') {
    comparisonCurve.value = null
    return
  }

  if (yearFilteredActivities.value.length === 0) {
    comparisonCurve.value = null
    return
  }

  const filtered = filterActivitiesByPeriod(yearFilteredActivities.value, comparisonPeriod.value)
  const label = periodOptions.find((o) => o.value === comparisonPeriod.value)?.label || ''

  // Show estimated values immediately
  comparisonCurve.value = calculatePowerCurveSync(filtered, label)
  renderChart()

  // Then compute with actual stream data
  calculatingComparison.value = true
  try {
    comparisonCurve.value = await calculatePowerCurve(filtered, label)
  } finally {
    calculatingComparison.value = false
  }
}

// Watch for changes that require recomputation
watch(
  [yearFilteredActivities, primaryPeriod, selectedYear],
  () => {
    computePrimaryCurve()
  },
  { immediate: true },
)

watch([showComparison, comparisonPeriod, yearFilteredActivities], () => {
  computeComparisonCurve()
})

// Stats
const stats = computed(() => {
  const curve = primaryCurve.value
  if (curve.points.length === 0) {
    return {
      ftp: null,
      maxPower: 0,
      peak5s: 0,
      peak1m: 0,
      peak5m: 0,
      peak20m: 0,
    }
  }

  const ftp = estimateFTP(curve)
  const maxPower = Math.max(...curve.points.map((p) => p.power))
  const peak5s = curve.points.find((p) => p.duration === 5)?.power || 0
  const peak1m = curve.points.find((p) => p.duration === 60)?.power || 0
  const peak5m = curve.points.find((p) => p.duration === 300)?.power || 0
  const peak20m = curve.points.find((p) => p.duration === 1200)?.power || 0

  return { ftp, maxPower, peak5s, peak1m, peak5m, peak20m }
})

// Check if any points are from actual stream data
const hasStreamData = computed(() => {
  return primaryCurve.value.points.some((p) => p.fromStream)
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

watch([primaryCurve, comparisonCurve, containerDimensions], () => {
  renderChart()
}, { deep: true })

function renderChart() {
  if (!svgRef.value || primaryCurve.value.points.length === 0) return

  const { width, height } = containerDimensions.value
  if (width === 0 || height === 0) return

  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()

  const margin = { top: 20, right: 30, bottom: 50, left: 60 }
  const chartWidth = width - margin.left - margin.right
  const chartHeight = height - margin.top - margin.bottom

  svg.attr('width', width).attr('height', height)

  const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`)

  const primaryData = primaryCurve.value.points
  const comparisonData = comparisonCurve.value?.points || []

  // Combine data for scale calculation
  const allData = [...primaryData, ...comparisonData]

  // Log scale for x-axis (time)
  const xScale = d3
    .scaleLog()
    .domain([5, 7200]) // 5 seconds to 2 hours
    .range([0, chartWidth])

  const yMax = Math.max(...allData.map((d) => d.power)) * 1.1
  const yScale = d3.scaleLinear().domain([0, yMax]).range([chartHeight, 0])

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

  // Line generator
  const line = d3
    .line<PowerCurvePoint>()
    .x((d) => xScale(d.duration))
    .y((d) => yScale(d.power))
    .curve(d3.curveMonotoneX)

  // Draw comparison curve first (behind)
  if (comparisonData.length > 0) {
    g.append('path')
      .datum(comparisonData)
      .attr('fill', 'none')
      .attr('stroke', '#999')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5')
      .attr('d', line)

    // Comparison points
    g.selectAll('.comparison-point')
      .data(comparisonData)
      .enter()
      .append('circle')
      .attr('class', 'comparison-point')
      .attr('cx', (d) => xScale(d.duration))
      .attr('cy', (d) => yScale(d.power))
      .attr('r', 4)
      .attr('fill', '#999')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
  }

  // Draw primary curve
  g.append('path')
    .datum(primaryData)
    .attr('fill', 'none')
    .attr('stroke', '#fc4c02')
    .attr('stroke-width', 3)
    .attr('d', line)

  // Primary points (interactive)
  g.selectAll('.primary-point')
    .data(primaryData)
    .enter()
    .append('circle')
    .attr('class', 'primary-point')
    .attr('cx', (d) => xScale(d.duration))
    .attr('cy', (d) => yScale(d.power))
    .attr('r', 6)
    .attr('fill', '#fc4c02')
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)
    .style('cursor', 'pointer')
    .on('mouseover', function (event, d) {
      d3.select(this).attr('r', 8)
      hoveredPoint.value = d
    })
    .on('mouseout', function () {
      d3.select(this).attr('r', 6)
      hoveredPoint.value = null
    })

  // FTP line if available
  if (stats.value.ftp) {
    g.append('line')
      .attr('x1', 0)
      .attr('x2', chartWidth)
      .attr('y1', yScale(stats.value.ftp))
      .attr('y2', yScale(stats.value.ftp))
      .attr('stroke', '#2196f3')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '8,4')

    g.append('text')
      .attr('x', chartWidth - 5)
      .attr('y', yScale(stats.value.ftp) - 5)
      .attr('text-anchor', 'end')
      .attr('font-size', '10px')
      .attr('fill', '#2196f3')
      .text(`FTP: ${stats.value.ftp}W`)
  }

  // X axis with custom tick format
  const xTicks = POWER_CURVE_INTERVALS.map((i) => i.seconds)
  const xAxis = g
    .append('g')
    .attr('transform', `translate(0, ${chartHeight})`)
    .call(
      d3
        .axisBottom(xScale)
        .tickValues(xTicks)
        .tickFormat((d) => {
          const interval = POWER_CURVE_INTERVALS.find((i) => i.seconds === d)
          return interval?.label || ''
        }),
    )

  xAxis.selectAll('text').attr('font-size', '10px').attr('fill', '#666')
  xAxis.select('.domain').attr('stroke', '#e0e0e0')

  // X axis label
  g.append('text')
    .attr('x', chartWidth / 2)
    .attr('y', chartHeight + 40)
    .attr('text-anchor', 'middle')
    .attr('font-size', '12px')
    .attr('fill', '#666')
    .text('Duration')

  // Y axis
  const yAxis = g.append('g').call(d3.axisLeft(yScale).ticks(6).tickFormat((d) => `${d}W`))

  yAxis.selectAll('text').attr('font-size', '11px').attr('fill', '#666')
  yAxis.select('.domain').remove()

  // Y axis label
  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('y', -45)
    .attr('x', -chartHeight / 2)
    .attr('text-anchor', 'middle')
    .attr('font-size', '12px')
    .attr('fill', '#666')
    .text('Power (Watts)')

  // Legend
  const legend = svg.append('g').attr('transform', `translate(${margin.left + 10}, ${margin.top + 10})`)

  legend
    .append('line')
    .attr('x1', 0)
    .attr('x2', 20)
    .attr('y1', 0)
    .attr('y2', 0)
    .attr('stroke', '#fc4c02')
    .attr('stroke-width', 3)

  legend
    .append('text')
    .attr('x', 25)
    .attr('y', 4)
    .attr('font-size', '11px')
    .attr('fill', '#666')
    .text(primaryCurve.value.period)

  if (comparisonData.length > 0 && comparisonCurve.value) {
    const compLegend = legend.append('g').attr('transform', 'translate(0, 18)')

    compLegend
      .append('line')
      .attr('x1', 0)
      .attr('x2', 20)
      .attr('y1', 0)
      .attr('y2', 0)
      .attr('stroke', '#999')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5')

    compLegend
      .append('text')
      .attr('x', 25)
      .attr('y', 4)
      .attr('font-size', '11px')
      .attr('fill', '#999')
      .text(comparisonCurve.value.period)
  }
}

function toggleComparison() {
  showComparison.value = !showComparison.value
  if (!showComparison.value) {
    comparisonPeriod.value = 'none'
  } else if (comparisonPeriod.value === 'none') {
    // Default to previous period
    comparisonPeriod.value = primaryPeriod.value === '1y' ? 'all' : '1y'
  }
}
</script>

<template>
  <DashboardLayout>
    <div class="power-chart">
      <div class="page-header">
        <h1 class="page-title">Power Curve</h1>
        <div class="header-controls">
          <YearSelector
            :years="years"
            :selected-year="selectedYear"
            @update:selected-year="selectedYear = $event"
          />
        </div>
      </div>

      <!-- Stats Summary -->
      <div class="stats-row">
        <div class="stat-item" v-if="stats.ftp">
          <span class="stat-value">{{ stats.ftp }}W</span>
          <span class="stat-label">Estimated FTP</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ stats.peak5s }}W</span>
          <span class="stat-label">Peak 5s</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ stats.peak1m }}W</span>
          <span class="stat-label">Peak 1min</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ stats.peak5m }}W</span>
          <span class="stat-label">Peak 5min</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ stats.peak20m }}W</span>
          <span class="stat-label">Peak 20min</span>
        </div>
      </div>

      <!-- Period Selectors -->
      <div class="period-controls">
        <div class="period-row">
          <span class="period-label">Period:</span>
          <div class="period-selector">
            <button
              v-for="option in periodOptions"
              :key="option.value"
              class="period-btn"
              :class="{ active: primaryPeriod === option.value }"
              @click="primaryPeriod = option.value as typeof primaryPeriod"
            >
              {{ option.label }}
            </button>
          </div>
          <button
            class="compare-btn"
            :class="{ active: showComparison }"
            @click="toggleComparison"
          >
            {{ showComparison ? 'Hide Compare' : 'Compare' }}
          </button>
        </div>

        <div v-if="showComparison" class="period-row comparison-row">
          <span class="period-label">Compare to:</span>
          <div class="period-selector">
            <button
              v-for="option in periodOptions"
              :key="option.value"
              class="period-btn comparison"
              :class="{ active: comparisonPeriod === option.value }"
              @click="comparisonPeriod = option.value as typeof comparisonPeriod"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- Power Curve Chart -->
      <ChartContainer
        title="Best Efforts Power Curve"
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
            <strong>{{ hoveredPoint.durationLabel }} Best: {{ hoveredPoint.power }}W</strong>
            <span v-if="hoveredPoint.fromStream" class="data-source stream">from activity data</span>
            <span v-else class="data-source estimated">estimated</span>
            <div class="hover-stats">
              <RouterLink :to="`/activity/${hoveredPoint.activityId}`" class="activity-link">
                {{ hoveredPoint.activityName }}
              </RouterLink>
              <span>{{ formatDate(new Date(hoveredPoint.activityDate)) }}</span>
            </div>
          </div>
          <div v-else-if="primaryCurve.points.length === 0" class="hover-placeholder">
            No cycling activities with power data found
          </div>
          <div v-else class="hover-placeholder">
            <span v-if="calculatingPrimary">Calculating from activity data...</span>
            <span v-else-if="hasStreamData">
              Power values calculated from actual ride data. Hover over points for details.
            </span>
            <span v-else>
              Power values estimated from activity averages. Sync activities with stream data for accurate values.
            </span>
          </div>
        </template>
      </ChartContainer>

      <!-- Best Efforts Table -->
      <div v-if="primaryCurve.points.length > 0" class="section">
        <h2 class="section-title">Best Efforts</h2>
        <div class="efforts-table">
          <table>
            <thead>
              <tr>
                <th>Duration</th>
                <th>Power</th>
                <th>Activity</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="point in primaryCurve.points" :key="point.duration">
                <td class="duration-cell">{{ point.durationLabel }}</td>
                <td class="power-cell">{{ point.power }}W</td>
                <td>
                  <RouterLink :to="`/activity/${point.activityId}`" class="activity-link">
                    {{ point.activityName }}
                  </RouterLink>
                </td>
                <td class="date-cell">{{ formatDate(new Date(point.activityDate)) }}</td>
              </tr>
            </tbody>
          </table>
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

.header-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
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

.period-controls {
  background: #fff;
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.period-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.comparison-row {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e0e0e0;
}

.period-label {
  font-size: 0.875rem;
  color: #666;
  min-width: 80px;
}

.period-selector {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.period-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #e0e0e0;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.period-btn:hover {
  border-color: #fc4c02;
}

.period-btn.active {
  background: #fc4c02;
  border-color: #fc4c02;
  color: #fff;
}

.period-btn.comparison {
  border-color: #999;
}

.period-btn.comparison:hover {
  border-color: #666;
}

.period-btn.comparison.active {
  background: #666;
  border-color: #666;
  color: #fff;
}

.compare-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #2196f3;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  color: #2196f3;
  transition: all 0.2s;
  margin-left: auto;
}

.compare-btn:hover {
  background: #e3f2fd;
}

.compare-btn.active {
  background: #2196f3;
  color: #fff;
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

.data-source {
  font-size: 0.75rem;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  margin-left: 0.5rem;
}

.data-source.stream {
  background: #e8f5e9;
  color: #2e7d32;
}

.data-source.estimated {
  background: #fff3e0;
  color: #ef6c00;
}

.activity-link {
  color: #fc4c02;
  text-decoration: none;
}

.activity-link:hover {
  text-decoration: underline;
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

.efforts-table {
  overflow-x: auto;
}

.efforts-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.efforts-table th {
  text-align: left;
  padding: 0.75rem 0.5rem;
  border-bottom: 2px solid #e0e0e0;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  font-size: 0.75rem;
}

.efforts-table td {
  padding: 0.75rem 0.5rem;
  border-bottom: 1px solid #f0f0f0;
  color: #1a1a2e;
}

.efforts-table tr:hover {
  background: #f9f9f9;
}

.duration-cell {
  font-weight: 600;
  color: #fc4c02;
}

.power-cell {
  font-weight: 700;
  font-family: monospace;
}

.date-cell {
  color: #999;
}

@media (max-width: 768px) {
  .stats-row {
    flex-direction: column;
  }

  .stat-item {
    min-width: 100%;
  }

  .period-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .compare-btn {
    margin-left: 0;
  }
}
</style>
