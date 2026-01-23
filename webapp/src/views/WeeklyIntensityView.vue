<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import * as d3 from 'd3'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import ChartContainer from '@/components/charts/ChartContainer.vue'
import YearSelector from '@/components/YearSelector.vue'
import { useActivitiesStore } from '@/stores/activities'
import { useActivityYears } from '@/composables/useActivityYears'
import { groupByWeekWithGaps, formatDuration, formatDistance, type WeekSummary } from '@/lib/aggregations'

const activitiesStore = useActivitiesStore()

// Year selector
const selectedYear = ref<number | null>(null)
const allActivities = computed(() => activitiesStore.allActivities)
const { years } = useActivityYears(allActivities)

// Filter activities by year
const yearFilteredActivities = computed(() => {
  if (!activitiesStore.hasAllActivities) return []
  if (selectedYear.value === null) return activitiesStore.allActivities
  return activitiesStore.allActivities.filter((a) => {
    const date = new Date(a.start_date)
    return date.getFullYear() === selectedYear.value
  })
})

const svgRef = ref<SVGSVGElement | null>(null)
const containerDimensions = ref({ width: 0, height: 0 })
const selectedWeek = ref<WeekSummary | null>(null)

const weekCount = ref<12 | 26 | 52>(12)
const weekCountOptions = [
  { value: 12, label: '12 Weeks' },
  { value: 26, label: '26 Weeks' },
  { value: 52, label: '52 Weeks' },
]

const weeklySummaries = computed(() => {
  if (yearFilteredActivities.value.length === 0 && !activitiesStore.hasAllActivities) return []

  // When a year is selected, show all weeks of that year
  if (selectedYear.value !== null) {
    return groupByWeekWithGaps(yearFilteredActivities.value, 52)
  }

  // Use groupByWeekWithGaps to include empty weeks in the range
  return groupByWeekWithGaps(yearFilteredActivities.value, weekCount.value)
})

const stats = computed(() => {
  if (weeklySummaries.value.length === 0) {
    return { avgIntensity: 0, maxIntensity: 0, trend: 0, activeWeeks: 0 }
  }

  // Only count weeks with activity for average calculation
  const activeWeeks = weeklySummaries.value.filter((w) => w.activityCount > 0)
  const intensities = activeWeeks.map((w) => w.intensity)
  const avgIntensity = intensities.length > 0
    ? intensities.reduce((a, b) => a + b, 0) / intensities.length
    : 0

  const maxIntensity = intensities.length > 0 ? Math.max(...intensities) : 0

  // Trend: compare last 4 weeks to previous 4 weeks (including empty weeks for accurate timeline)
  const recent = weeklySummaries.value.slice(-4)
  const previous = weeklySummaries.value.slice(-8, -4)

  let trend = 0
  if (recent.length >= 4 && previous.length >= 4) {
    const recentAvg = recent.reduce((sum, w) => sum + w.intensity, 0) / 4
    const prevAvg = previous.reduce((sum, w) => sum + w.intensity, 0) / 4
    trend = prevAvg > 0 ? ((recentAvg - prevAvg) / prevAvg) * 100 : 0
  }

  return {
    avgIntensity: Math.round(avgIntensity * 10) / 10,
    maxIntensity: Math.round(maxIntensity * 10) / 10,
    trend: Math.round(trend),
    activeWeeks: activeWeeks.length,
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

watch([weeklySummaries, containerDimensions], () => {
  renderChart()
})

function renderChart() {
  if (!svgRef.value || weeklySummaries.value.length === 0) return

  const { width, height } = containerDimensions.value
  if (width === 0 || height === 0) return

  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()

  const margin = { top: 20, right: 20, bottom: 40, left: 50 }
  const chartWidth = width - margin.left - margin.right
  const chartHeight = height - margin.top - margin.bottom

  svg.attr('width', width).attr('height', height)

  const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`)

  // Scales
  const xScale = d3
    .scaleBand<string>()
    .domain(weeklySummaries.value.map((w) => w.weekStart))
    .range([0, chartWidth])
    .padding(0.2)

  const maxIntensity = Math.max(...weeklySummaries.value.map((w) => w.intensity), 1)
  const yScale = d3.scaleLinear().domain([0, maxIntensity * 1.1]).range([chartHeight, 0])

  // Color scale based on intensity (empty weeks get a light grey)
  const colorScale = (intensity: number) => {
    if (intensity === 0) return '#e8e8e8' // Light grey for rest weeks
    const scale = d3
      .scaleLinear<string>()
      .domain([0, maxIntensity / 2, maxIntensity])
      .range(['#c6e48b', '#7bc96f', '#196127'])
    return scale(intensity)
  }

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

  // Bars - show a minimum height for rest weeks so they're visible
  const minBarHeight = 4

  g.selectAll('.bar')
    .data(weeklySummaries.value)
    .enter()
    .append('rect')
    .attr('class', 'bar')
    .attr('x', (d) => xScale(d.weekStart) || 0)
    .attr('y', (d) => {
      const barHeight = d.intensity === 0 ? minBarHeight : chartHeight - yScale(d.intensity)
      return chartHeight - barHeight
    })
    .attr('width', xScale.bandwidth())
    .attr('height', (d) => {
      if (d.intensity === 0) return minBarHeight
      return chartHeight - yScale(d.intensity)
    })
    .attr('fill', (d) => colorScale(d.intensity))
    .attr('rx', 3)
    .style('cursor', 'pointer')
    .on('mouseover', function (event, d) {
      d3.select(this).attr('opacity', 0.8)
      selectedWeek.value = d
    })
    .on('mouseout', function () {
      d3.select(this).attr('opacity', 1)
      selectedWeek.value = null
    })

  // X axis
  const xAxis = g
    .append('g')
    .attr('transform', `translate(0, ${chartHeight})`)
    .call(
      d3.axisBottom(xScale).tickFormat((d) => {
        const date = new Date(d)
        return `${date.getMonth() + 1}/${date.getDate()}`
      }),
    )

  xAxis.selectAll('text').attr('font-size', '10px').attr('fill', '#666')

  // Only show every nth label if too many weeks
  if (weeklySummaries.value.length > 20) {
    xAxis.selectAll('text').each(function (_, i) {
      if (i % 2 !== 0) {
        d3.select(this).remove()
      }
    })
  }

  xAxis.select('.domain').attr('stroke', '#e0e0e0')

  // Y axis
  const yAxis = g.append('g').call(d3.axisLeft(yScale).ticks(5))

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
    .text('Intensity Score')
}
</script>

<template>
  <DashboardLayout>
    <div class="weekly-intensity">
      <div class="page-header">
        <h1 class="page-title">Weekly Intensity</h1>
        <div class="header-controls">
          <YearSelector
            :years="years"
            :selected-year="selectedYear"
            @update:selected-year="selectedYear = $event"
          />
          <div v-if="selectedYear === null" class="week-selector">
            <button
              v-for="option in weekCountOptions"
              :key="option.value"
              class="week-btn"
              :class="{ active: weekCount === option.value }"
              @click="weekCount = option.value as 12 | 26 | 52"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- Stats Summary -->
      <div class="stats-row">
        <div class="stat-item">
          <span class="stat-value">{{ stats.avgIntensity }}</span>
          <span class="stat-label">Avg Intensity</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ stats.maxIntensity }}</span>
          <span class="stat-label">Peak Week</span>
        </div>
        <div class="stat-item">
          <span class="stat-value" :class="{ positive: stats.trend > 0, negative: stats.trend < 0 }">
            {{ stats.trend > 0 ? '+' : '' }}{{ stats.trend }}%
          </span>
          <span class="stat-label">4-Week Trend</span>
        </div>
      </div>

      <!-- Weekly Chart -->
      <ChartContainer
        title="Training Load by Week"
        :loading="activitiesStore.loadingAll"
        :error="activitiesStore.error"
        height="350px"
        @resize="onResize"
      >
        <template #default>
          <svg ref="svgRef"></svg>
        </template>
        <template #footer>
          <div v-if="selectedWeek" class="week-details">
            <strong>Week of {{ selectedWeek.weekStart }}</strong>
            <div v-if="selectedWeek.activityCount === 0" class="week-stats rest-week">
              <span>Rest week - No activities</span>
            </div>
            <div v-else class="week-stats">
              <span>{{ selectedWeek.activityCount }} activities</span>
              <span>{{ formatDistance(selectedWeek.totalDistance) }}</span>
              <span>{{ formatDuration(selectedWeek.totalDuration) }}</span>
            </div>
          </div>
          <div v-else class="week-details-placeholder">Hover over bars to see week details</div>
        </template>
      </ChartContainer>

      <!-- Week List -->
      <div class="section">
        <h2 class="section-title">Recent Weeks</h2>
        <div class="weeks-list">
          <div
            v-for="week in weeklySummaries.slice().reverse().slice(0, 16)"
            :key="week.weekStart"
            class="week-card"
            :class="{ 'rest-week-card': week.activityCount === 0 }"
          >
            <div class="week-date">
              {{ new Date(week.weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }}
              -
              {{ new Date(week.weekEnd).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }}
            </div>
            <div class="week-intensity-bar">
              <div
                class="intensity-fill"
                :class="{ 'rest-fill': week.activityCount === 0 }"
                :style="{
                  width: week.activityCount === 0 ? '100%' : `${Math.min(100, (week.intensity / (stats.maxIntensity || 1)) * 100)}%`,
                }"
              ></div>
            </div>
            <div class="week-summary">
              <span v-if="week.activityCount === 0" class="rest-label">Rest week</span>
              <span v-else>{{ week.activityCount }} activities</span>
              <span class="intensity-value" :class="{ 'rest-intensity': week.activityCount === 0 }">{{ week.intensity.toFixed(1) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>

<style scoped>
.weekly-intensity {
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

.week-selector {
  display: flex;
  gap: 0.5rem;
}

.week-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #e0e0e0;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.week-btn:hover {
  border-color: #fc4c02;
}

.week-btn.active {
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

.stat-value.positive {
  color: #196127;
}

.stat-value.negative {
  color: #d32f2f;
}

.stat-label {
  font-size: 0.75rem;
  color: #666;
  text-transform: uppercase;
}

.week-details,
.week-details-placeholder {
  font-size: 0.875rem;
  color: #666;
}

.week-stats {
  display: flex;
  gap: 1rem;
  margin-top: 0.25rem;
}

.week-details-placeholder {
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

.weeks-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.week-card {
  background: #f9f9f9;
  border-radius: 8px;
  padding: 1rem;
}

.week-date {
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 0.5rem;
}

.week-intensity-bar {
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.intensity-fill {
  height: 100%;
  background: linear-gradient(90deg, #7bc96f, #196127);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.week-summary {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  color: #666;
}

.intensity-value {
  font-weight: 600;
  color: #196127;
}

.intensity-value.rest-intensity {
  color: #999;
}

/* Rest week styles */
.rest-week-card {
  opacity: 0.7;
}

.rest-fill {
  background: #e8e8e8 !important;
}

.rest-label {
  color: #999;
  font-style: italic;
}

.rest-week {
  color: #999;
  font-style: italic;
}

@media (max-width: 768px) {
  .stats-row {
    flex-direction: column;
  }

  .stat-item {
    min-width: 100%;
  }
}
</style>
