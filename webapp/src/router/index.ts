import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import LoginView from '@/views/LoginView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/login',
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { requiresAuth: false },
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/training-log',
      name: 'training-log',
      component: () => import('@/views/TrainingLogView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/power-chart',
      name: 'power-chart',
      component: () => import('@/views/PowerChartView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/weekly-intensity',
      name: 'weekly-intensity',
      component: () => import('@/views/WeeklyIntensityView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/monthly-fitness',
      name: 'monthly-fitness',
      component: () => import('@/views/MonthlyFitnessView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/activities',
      name: 'activities',
      component: () => import('@/views/ActivitiesListView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/sports',
      name: 'sports',
      component: () => import('@/views/SportsBreakdownView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/activity/:id',
      name: 'activity-detail',
      component: () => import('@/views/ActivityDetailView.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach((to, _from, next) => {
  const auth = useAuthStore()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    next({ name: 'login' })
  } else if (to.name === 'login' && auth.isAuthenticated) {
    next({ name: 'dashboard' })
  } else {
    next()
  }
})

export default router
