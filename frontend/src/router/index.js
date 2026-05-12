import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    component: () => import('@/layout/MainLayout.vue'),
    redirect: '/dashboard',
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '仪表盘', icon: 'Odometer' }
      },
      {
        path: 'collection',
        name: 'DataCollection',
        component: () => import('@/views/DataCollection.vue'),
        meta: { title: '数据采集', icon: 'Download' }
      },
      {
        path: 'cleaning',
        name: 'DataCleaning',
        component: () => import('@/views/DataCleaning.vue'),
        meta: { title: '数据清洗', icon: 'Brush' }
      },
      {
        path: 'governance',
        name: 'DataGovernance',
        component: () => import('@/views/DataGovernance.vue'),
        meta: { title: '数据治理', icon: 'Grid' }
      },
      {
        path: 'statistics',
        name: 'Statistics',
        component: () => import('@/views/Statistics.vue'),
        meta: { title: '统计分析', icon: 'TrendCharts' }
      },
      {
        path: 'api-service',
        name: 'ApiService',
        component: () => import('@/views/ApiService.vue'),
        meta: { title: 'API服务', icon: 'Connection' }
      },
      {
        path: 'user',
        name: 'UserManagement',
        component: () => import('@/views/UserManagement.vue'),
        meta: { title: '用户管理', icon: 'User' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const userStore = useUserStore()

  if (to.meta.requiresAuth !== false && !userStore.token) {
    next('/login')
  } else if (to.path === '/login' && userStore.token) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router
