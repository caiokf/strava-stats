<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import * as d3 from 'd3'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import ChartContainer from '@/components/charts/ChartContainer.vue'
import YearSelector from '@/components/YearSelector.vue'
import { useActivitiesStore } from '@/stores/activities'
import { useActivityYears } from '@/composables/useActivityYears'
import { calculateCalendarData, formatDate, type CalendarDay } from '@/lib/aggregations'

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

const dateRange = ref<'3m' | '6m' | '1y'>('6m')

const dateRangeOptions = [
  { value: '3m', label: '3 Months' },
  { value: '6m', label: '6 Months' },
  { value: '1y', label: '1 Year' },
]

const dateRangeDays = computed(() => {
  switch (dateRange.value) {
    case '3m':
      return 90
    case '6m':
      return 180
    case '1y':
      return 365
    default:
      return 180
  }
})

const calendarData = computed(() => {
  if (yearFilteredActivities.value.length === 0 && !activitiesStore.hasAllActivities) return []

  let endDate: Date
  let startDate: Date

  if (selectedYear.value !== null) {
    // Show full year when a year is selected
    endDate = new Date(selectedYear.value, 11, 31)
    startDate = new Date(selectedYear.value, 0, 1)
  } else {
    // Use date range when "All" is selected
    endDate = new Date()
    startDate = new Date()
    startDate.setDate(startDate.getDate() - dateRangeDays.value)
  }

  return calculateCalendarData(yearFilteredActivities.value, startDate, endDate)
})

const stats = computed(() => {
  const activeDays = calendarData.value.filter((d) => d.activityCount > 0).length
  const totalDays = calendarData.value.length
  const totalActivities = calendarData.value.reduce((sum, d) => sum + d.activityCount, 0)

  // Calculate current streak
  let streak = 0
  const today = formatDate(new Date())
  const yesterday = formatDate(new Date(Date.now() - 24 * 60 * 60 * 1000))

  for (let i = calendarData.value.length - 1; i >= 0; i--) {
    const day = calendarData.value[i]
    if (!day) break

    if (i === calendarData.value.length - 1) {
      // Check if today or yesterday has activity
      if (day.date !== today && day.date !== yesterday) break
      if (day.activityCount === 0 && day.date === today) continue
    }

    if (day.activityCount > 0) {
      streak++
    } else {
      break
    }
  }

  return {
    activeDays,
    totalDays,
    totalActivities,
    streak,
    consistency: totalDays > 0 ? Math.round((activeDays / totalDays) * 100) : 0,
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

watch([calendarData, containerDimensions], () => {
  renderChart()
})

function renderChart() {
  if (!svgRef.value || calendarData.value.length === 0) return

  const { width } = containerDimensions.value
  if (width === 0) return

  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()

  const cellSize = Math.min(14, Math.max(8, (width - 80) / 53))
  const cellGap = 2
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]

  // Group data by week
  const weeks: CalendarDay[][] = []
  let currentWeek: CalendarDay[] = []

  calendarData.value.forEach((day, i) => {
    const date = new Date(day.date)
    const dayOfWeek = (date.getDay() + 6) % 7 // Monday = 0

    if (i === 0) {
      // Fill in empty days at start of first week
      for (let j = 0; j < dayOfWeek; j++) {
        currentWeek.push({
          date: '',
          activityCount: 0,
          totalDuration: 0,
          totalDistance: 0,
          intensity: -1,
        })
      }
    }

    currentWeek.push(day)

    if (dayOfWeek === 6 || i === calendarData.value.length - 1) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  })

  const chartWidth = weeks.length * (cellSize + cellGap)
  const chartHeight = 7 * (cellSize + cellGap)
  const marginLeft = 30
  const marginTop = 20

  svg
    .attr('width', chartWidth + marginLeft + 20)
    .attr('height', chartHeight + marginTop + 20)
    .attr('viewBox', `0 0 ${chartWidth + marginLeft + 20} ${chartHeight + marginTop + 20}`)

  const g = svg.append('g').attr('transform', `translate(${marginLeft}, ${marginTop})`)

  // Color scale
  const colorScale = d3
    .scaleOrdinal<number, string>()
    .domain([-1, 0, 1, 2, 3, 4])
    .range(['transparent', '#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127'])

  // Draw day labels
  weekDays.forEach((day, i) => {
    if (i % 2 === 0) {
      svg
        .append('text')
        .attr('x', marginLeft - 5)
        .attr('y', marginTop + i * (cellSize + cellGap) + cellSize / 2)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '10px')
        .attr('fill', '#666')
        .text(day)
    }
  })

  // Draw cells
  weeks.forEach((week, weekIndex) => {
    week.forEach((day, dayIndex) => {
      const rect = g
        .append('rect')
        .attr('x', weekIndex * (cellSize + cellGap))
        .attr('y', dayIndex * (cellSize + cellGap))
        .attr('width', cellSize)
        .attr('height', cellSize)
        .attr('rx', 2)
        .attr('fill', colorScale(day.intensity))

      if (day.intensity >= 0) {
        rect
          .style('cursor', 'pointer')
          .on('mouseover', function (event) {
            d3.select(this).attr('stroke', '#333').attr('stroke-width', 1)

            // Show tooltip
            const tooltip = d3.select('#calendar-tooltip')
            tooltip
              .style('display', 'block')
              .style('left', `${event.pageX + 10}px`)
              .style('top', `${event.pageY - 10}px`)
              .html(
                `
                <strong>${day.date}</strong><br/>
                ${day.activityCount} ${day.activityCount === 1 ? 'activity' : 'activities'}<br/>
                ${Math.round(day.totalDuration / 60)} min
              `,
              )
          })
          .on('mouseout', function () {
            d3.select(this).attr('stroke', 'none')
            d3.select('#calendar-tooltip').style('display', 'none')
          })
      }
    })

    // Draw month labels
    const firstDay = week[0]
    if (firstDay && firstDay.date) {
      const date = new Date(firstDay.date)
      if (date.getDate() <= 7) {
        const monthLabel = months[date.getMonth()]
        if (monthLabel) {
          g.append('text')
            .attr('x', weekIndex * (cellSize + cellGap))
            .attr('y', -5)
            .attr('font-size', '10px')
            .attr('fill', '#666')
            .text(monthLabel)
        }
      }
    }
  })
}
</script>

<template>
  <DashboardLayout>
    <div class="training-log">
      <div class="page-header">
        <h1 class="page-title">Training Log</h1>
        <div class="header-controls">
          <YearSelector
            :years="years"
            :selected-year="selectedYear"
            @update:selected-year="selectedYear = $event"
          />
          <div v-if="selectedYear === null" class="date-range-selector">
            <button
              v-for="option in dateRangeOptions"
              :key="option.value"
              class="range-btn"
              :class="{ active: dateRange === option.value }"
              @click="dateRange = option.value as '3m' | '6m' | '1y'"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- Stats Summary -->
      <div class="stats-row">
        <div class="stat-item">
          <span class="stat-value">{{ stats.activeDays }}</span>
          <span class="stat-label">Active Days</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ stats.totalActivities }}</span>
          <span class="stat-label">Activities</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ stats.consistency }}%</span>
          <span class="stat-label">Consistency</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ stats.streak }}</span>
          <span class="stat-label">Day Streak</span>
        </div>
      </div>

      <!-- Calendar Heatmap -->
      <ChartContainer
        title="Activity Calendar"
        :loading="activitiesStore.loadingAll"
        :error="activitiesStore.error"
        height="280px"
        @resize="onResize"
      >
        <template #default>
          <div class="calendar-wrapper">
            <svg ref="svgRef"></svg>
          </div>
        </template>
        <template #footer>
          <div class="legend">
            <span class="legend-label">Less</span>
            <div class="legend-cells">
              <span class="legend-cell" style="background: #ebedf0"></span>
              <span class="legend-cell" style="background: #c6e48b"></span>
              <span class="legend-cell" style="background: #7bc96f"></span>
              <span class="legend-cell" style="background: #239a3b"></span>
              <span class="legend-cell" style="background: #196127"></span>
            </div>
            <span class="legend-label">More</span>
          </div>
        </template>
      </ChartContainer>

      <!-- Tooltip -->
      <div id="calendar-tooltip" class="tooltip"></div>
    </div>
  </DashboardLayout>
</template>

<style scoped>
.training-log {
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

.date-range-selector {
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

.calendar-wrapper {
  width: 100%;
  overflow-x: auto;
  padding: 1rem;
}

.legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
}

.legend-label {
  font-size: 0.75rem;
  color: #666;
}

.legend-cells {
  display: flex;
  gap: 2px;
}

.legend-cell {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.tooltip {
  display: none;
  position: fixed;
  background: #1a1a2e;
  color: #fff;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  z-index: 1000;
  pointer-events: none;
}
</style>
