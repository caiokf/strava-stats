<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import * as d3 from 'd3'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import ChartContainer from '@/components/charts/ChartContainer.vue'
import { useActivitiesStore } from '@/stores/activities'
import {
  activitiesToDailyLoads,
  calculateFitnessMetrics,
  getCurrentFitness,
  getCurrentForm,
  getFitnessTrend,
  type FitnessMetrics,
} from '@/lib/fitnessModel'

const activitiesStore = useActivitiesStore()

const svgRef = ref<SVGSVGElement | null>(null)
const containerDimensions = ref({ width: 0, height: 0 })
const hoveredPoint = ref<FitnessMetrics | null>(null)

const timeRange = ref<'3m' | '6m' | '1y' | 'all'>('6m')
const timeRangeOptions = [
  { value: '3m', label: '3 Months' },
  { value: '6m', label: '6 Months' },
  { value: '1y', label: '1 Year' },
  { value: 'all', label: 'All Time' },
]

const fitnessMetrics = computed(() => {
  if (!activitiesStore.hasAllActivities) return []

  const dailyLoads = activitiesToDailyLoads(activitiesStore.allActivities)
  return calculateFitnessMetrics(dailyLoads)
})

const filteredMetrics = computed(() => {
  if (fitnessMetrics.value.length === 0) return []

  const now = new Date()
  let cutoffDate: Date

  switch (timeRange.value) {
    case '3m':
      cutoffDate = new Date(now.setMonth(now.getMonth() - 3))
      break
    case '6m':
      cutoffDate = new Date(now.setMonth(now.getMonth() - 6))
      break
    case '1y':
      cutoffDate = new Date(now.setFullYear(now.getFullYear() - 1))
      break
    case 'all':
    default:
      return fitnessMetrics.value
  }

  return fitnessMetrics.value.filter((m) => new Date(m.date) >= cutoffDate)
})

const stats = computed(() => {
  const metrics = fitnessMetrics.value
  if (metrics.length === 0) {
    return {
      currentFitness: 0,
      currentForm: 0,
      fitnessTrend: 0,
      peakFitness: 0,
    }
  }

  const peakFitness = Math.max(...metrics.map((m) => m.ctl))

  return {
    currentFitness: getCurrentFitness(metrics),
    currentForm: getCurrentForm(metrics),
    fitnessTrend: getFitnessTrend(metrics, 28),
    peakFitness: Math.round(peakFitness * 10) / 10,
  }
})

const formStatus = computed(() => {
  const form = stats.value.currentForm
  if (form >= 25) return { label: 'Transition', color: '#9c27b0' }
  if (form >= 5) return { label: 'Fresh', color: '#4caf50' }
  if (form >= -10) return { label: 'Grey Zone', color: '#ff9800' }
  if (form >= -25) return { label: 'Optimal', color: '#2196f3' }
  return { label: 'Overreaching', color: '#f44336' }
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

watch([filteredMetrics, containerDimensions], () => {
  renderChart()
})

function renderChart() {
  if (!svgRef.value || filteredMetrics.value.length === 0) return

  const { width, height } = containerDimensions.value
  if (width === 0 || height === 0) return

  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()

  const margin = { top: 20, right: 80, bottom: 40, left: 50 }
  const chartWidth = width - margin.left - margin.right
  const chartHeight = height - margin.top - margin.bottom

  svg.attr('width', width).attr('height', height)

  const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`)

  const data = filteredMetrics.value

  // Scales
  const xScale = d3
    .scaleTime()
    .domain(d3.extent(data, (d) => new Date(d.date)) as [Date, Date])
    .range([0, chartWidth])

  const allValues = data.flatMap((d) => [d.ctl, d.atl, d.tsb])
  const yMin = Math.min(...allValues, 0)
  const yMax = Math.max(...allValues)
  const yPadding = (yMax - yMin) * 0.1

  const yScale = d3
    .scaleLinear()
    .domain([yMin - yPadding, yMax + yPadding])
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

  // Zero line
  if (yMin < 0 && yMax > 0) {
    g.append('line')
      .attr('x1', 0)
      .attr('x2', chartWidth)
      .attr('y1', yScale(0))
      .attr('y2', yScale(0))
      .attr('stroke', '#999')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4')
  }

  // Line generators
  const ctlLine = d3
    .line<FitnessMetrics>()
    .x((d) => xScale(new Date(d.date)))
    .y((d) => yScale(d.ctl))
    .curve(d3.curveMonotoneX)

  const atlLine = d3
    .line<FitnessMetrics>()
    .x((d) => xScale(new Date(d.date)))
    .y((d) => yScale(d.atl))
    .curve(d3.curveMonotoneX)

  const tsbLine = d3
    .line<FitnessMetrics>()
    .x((d) => xScale(new Date(d.date)))
    .y((d) => yScale(d.tsb))
    .curve(d3.curveMonotoneX)

  // Draw CTL (Fitness) line
  g.append('path')
    .datum(data)
    .attr('fill', 'none')
    .attr('stroke', '#2196f3')
    .attr('stroke-width', 2)
    .attr('d', ctlLine)

  // Draw ATL (Fatigue) line
  g.append('path')
    .datum(data)
    .attr('fill', 'none')
    .attr('stroke', '#f44336')
    .attr('stroke-width', 2)
    .attr('d', atlLine)

  // Draw TSB (Form) line
  g.append('path')
    .datum(data)
    .attr('fill', 'none')
    .attr('stroke', '#4caf50')
    .attr('stroke-width', 2)
    .attr('d', tsbLine)

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
  const yAxis = g.append('g').call(d3.axisLeft(yScale).ticks(6))

  yAxis.selectAll('text').attr('font-size', '11px').attr('fill', '#666')
  yAxis.select('.domain').remove()

  // Legend
  const legend = svg.append('g').attr('transform', `translate(${width - 70}, ${margin.top})`)

  const legendItems = [
    { label: 'Fitness (CTL)', color: '#2196f3' },
    { label: 'Fatigue (ATL)', color: '#f44336' },
    { label: 'Form (TSB)', color: '#4caf50' },
  ]

  legendItems.forEach((item, i) => {
    const legendItem = legend.append('g').attr('transform', `translate(0, ${i * 20})`)

    legendItem
      .append('line')
      .attr('x1', 0)
      .attr('x2', 20)
      .attr('y1', 0)
      .attr('y2', 0)
      .attr('stroke', item.color)
      .attr('stroke-width', 2)

    legendItem
      .append('text')
      .attr('x', 25)
      .attr('y', 4)
      .attr('font-size', '10px')
      .attr('fill', '#666')
      .text(item.label)
  })

  // Hover interaction
  const bisect = d3.bisector<FitnessMetrics, Date>((d) => new Date(d.date)).left

  const hoverGroup = g.append('g').style('display', 'none')

  hoverGroup
    .append('line')
    .attr('class', 'hover-line')
    .attr('y1', 0)
    .attr('y2', chartHeight)
    .attr('stroke', '#999')
    .attr('stroke-dasharray', '3,3')

  const ctlCircle = hoverGroup.append('circle').attr('r', 4).attr('fill', '#2196f3')

  const atlCircle = hoverGroup.append('circle').attr('r', 4).attr('fill', '#f44336')

  const tsbCircle = hoverGroup.append('circle').attr('r', 4).attr('fill', '#4caf50')

  svg
    .append('rect')
    .attr('transform', `translate(${margin.left}, ${margin.top})`)
    .attr('width', chartWidth)
    .attr('height', chartHeight)
    .attr('fill', 'transparent')
    .on('mousemove', function (event) {
      const [mouseX] = d3.pointer(event)
      const x0 = xScale.invert(mouseX)
      const i = bisect(data, x0, 1)
      const d0 = data[i - 1]
      const d1 = data[i]

      if (!d0) return

      const d =
        d1 && x0.getTime() - new Date(d0.date).getTime() > new Date(d1.date).getTime() - x0.getTime()
          ? d1
          : d0

      const x = xScale(new Date(d.date))

      hoverGroup.style('display', null)
      hoverGroup.select('.hover-line').attr('x1', x).attr('x2', x)
      ctlCircle.attr('cx', x).attr('cy', yScale(d.ctl))
      atlCircle.attr('cx', x).attr('cy', yScale(d.atl))
      tsbCircle.attr('cx', x).attr('cy', yScale(d.tsb))

      hoveredPoint.value = d
    })
    .on('mouseleave', function () {
      hoverGroup.style('display', 'none')
      hoveredPoint.value = null
    })
}
</script>

<template>
  <DashboardLayout>
    <div class="monthly-fitness">
      <div class="page-header">
        <h1 class="page-title">Monthly Fitness</h1>
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

      <!-- Stats Summary -->
      <div class="stats-row">
        <div class="stat-item">
          <span class="stat-value">{{ stats.currentFitness }}</span>
          <span class="stat-label">Current Fitness (CTL)</span>
        </div>
        <div class="stat-item">
          <span
            class="stat-value"
            :style="{ color: formStatus.color }"
          >
            {{ stats.currentForm }}
          </span>
          <span class="stat-label">Form (TSB) - {{ formStatus.label }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-value" :class="{ positive: stats.fitnessTrend > 0, negative: stats.fitnessTrend < 0 }">
            {{ stats.fitnessTrend > 0 ? '+' : '' }}{{ stats.fitnessTrend }}
          </span>
          <span class="stat-label">28-Day Trend</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ stats.peakFitness }}</span>
          <span class="stat-label">Peak Fitness</span>
        </div>
      </div>

      <!-- Fitness Chart -->
      <ChartContainer
        title="Performance Management Chart"
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
            <strong>{{ hoveredPoint.date }}</strong>
            <div class="hover-stats">
              <span class="ctl">CTL: {{ hoveredPoint.ctl }}</span>
              <span class="atl">ATL: {{ hoveredPoint.atl }}</span>
              <span class="tsb">TSB: {{ hoveredPoint.tsb }}</span>
              <span class="load">Load: {{ hoveredPoint.load }}</span>
            </div>
          </div>
          <div v-else class="hover-placeholder">
            Hover over the chart to see daily metrics
          </div>
        </template>
      </ChartContainer>

      <!-- Form Zones Explanation -->
      <div class="section">
        <h2 class="section-title">Understanding Your Form</h2>
        <div class="form-zones">
          <div class="zone-item">
            <span class="zone-color" style="background: #9c27b0"></span>
            <div class="zone-info">
              <strong>Transition (TSB &gt; 25)</strong>
              <span>Losing fitness, too much rest</span>
            </div>
          </div>
          <div class="zone-item">
            <span class="zone-color" style="background: #4caf50"></span>
            <div class="zone-info">
              <strong>Fresh (TSB 5 to 25)</strong>
              <span>Well recovered, ready for hard efforts</span>
            </div>
          </div>
          <div class="zone-item">
            <span class="zone-color" style="background: #ff9800"></span>
            <div class="zone-info">
              <strong>Grey Zone (TSB -10 to 5)</strong>
              <span>Moderate fatigue, training normally</span>
            </div>
          </div>
          <div class="zone-item">
            <span class="zone-color" style="background: #2196f3"></span>
            <div class="zone-info">
              <strong>Optimal (TSB -25 to -10)</strong>
              <span>Building fitness, manageable fatigue</span>
            </div>
          </div>
          <div class="zone-item">
            <span class="zone-color" style="background: #f44336"></span>
            <div class="zone-info">
              <strong>Overreaching (TSB &lt; -25)</strong>
              <span>High fatigue, risk of overtraining</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>

<style scoped>
.monthly-fitness {
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

.time-range-selector {
  display: flex;
  gap: 0.5rem;
}

.range-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #e0e0e0;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.range-btn:hover {
  border-color: #fc4c02;
}

.range-btn.active {
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

.hover-details,
.hover-placeholder {
  font-size: 0.875rem;
  color: #666;
}

.hover-stats {
  display: flex;
  gap: 1.5rem;
  margin-top: 0.25rem;
}

.hover-stats .ctl {
  color: #2196f3;
}

.hover-stats .atl {
  color: #f44336;
}

.hover-stats .tsb {
  color: #4caf50;
}

.hover-stats .load {
  color: #666;
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

.form-zones {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.zone-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  background: #f9f9f9;
  border-radius: 8px;
}

.zone-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  flex-shrink: 0;
  margin-top: 2px;
}

.zone-info {
  display: flex;
  flex-direction: column;
}

.zone-info strong {
  font-size: 0.875rem;
  color: #1a1a2e;
}

.zone-info span {
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

  .hover-stats {
    flex-wrap: wrap;
    gap: 0.75rem;
  }
}
</style>
