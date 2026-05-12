<template>
  <div class="dashboard">
    <el-row :gutter="20" class="stat-cards">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <el-icon class="stat-icon" style="color: #409eff;"><Download /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ stats.dataSources }}</div>
              <div class="stat-label">数据源</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <el-icon class="stat-icon" style="color: #67c23a;"><Document /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ stats.rawData }}</div>
              <div class="stat-label">原始数据</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <el-icon class="stat-icon" style="color: #e6a23c;"><TrendCharts /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ stats.indicators }}</div>
              <div class="stat-label">统计指标</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <el-icon class="stat-icon" style="color: #f56c6c;"><Connection /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ stats.apiServices }}</div>
              <div class="stat-label">API服务</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="16">
        <el-card>
          <template #header>
            <span>数据趋势</span>
          </template>
          <div ref="chartRef" style="height: 350px;"></div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header>
            <span>数据源分布</span>
          </template>
          <div ref="pieChartRef" style="height: 350px;"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>最近采集任务</span>
          </template>
          <el-table :data="recentTasks" style="width: 100%">
            <el-table-column prop="name" label="任务名称" />
            <el-table-column prop="status" label="状态">
              <template #default="{ row }">
                <el-tag :type="getTaskStatusType(row.status)">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="last_run_time" label="最后执行时间" width="180" />
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>质量检查报告</span>
          </template>
          <el-table :data="qualityReports" style="width: 100%">
            <el-table-column prop="rule_type" label="规则类型" />
            <el-table-column prop="check_count" label="检查次数" width="100" />
            <el-table-column prop="passed_count" label="通过次数" width="100" />
            <el-table-column prop="failed_count" label="失败次数" width="100" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import * as echarts from 'echarts'
import { collectionApi } from '@/api/collection'
import { statisticsApi } from '@/api/statistics'
import { governanceApi } from '@/api/governance'
import { serviceApi } from '@/api/service'

const chartRef = ref(null)
const pieChartRef = ref(null)

const stats = ref({
  dataSources: 0,
  rawData: 0,
  indicators: 0,
  apiServices: 0
})

const recentTasks = ref([])
const qualityReports = ref([])

const getTaskStatusType = (status) => {
  const types = {
    completed: 'success',
    running: 'primary',
    failed: 'danger',
    pending: 'info',
    stopped: 'warning'
  }
  return types[status] || 'info'
}

onMounted(async () => {
  try {
    const [sources, indicators, services, tasks, quality] = await Promise.all([
      collectionApi.getSources(),
      statisticsApi.getIndicators(),
      serviceApi.getServices(),
      collectionApi.getTasks(),
      governanceApi.getQualityReport({})
    ])

    stats.value.dataSources = sources.length
    stats.value.indicators = indicators.length
    stats.value.apiServices = services.length
    recentTasks.value = tasks.slice(0, 5)
    qualityReports.value = quality.slice(0, 5)

    initCharts()
  } catch (e) {
    console.error(e)
  }
})

const initCharts = () => {
  const chart = echarts.init(chartRef.value)
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['数据量', '清洗量'] },
    xAxis: {
      type: 'category',
      data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: '数据量',
        type: 'line',
        data: [120, 200, 150, 80, 70, 110, 130],
        smooth: true
      },
      {
        name: '清洗量',
        type: 'line',
        data: [100, 180, 130, 70, 60, 100, 120],
        smooth: true
      }
    ]
  })

  const pieChart = echarts.init(pieChartRef.value)
  pieChart.setOption({
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', left: 'left' },
    series: [
      {
        name: '数据源',
        type: 'pie',
        radius: '50%',
        data: [
          { value: 3, name: '数据库' },
          { value: 2, name: 'API接口' },
          { value: 1, name: '文件' },
          { value: 1, name: '日志' }
        ]
      }
    ]
  })
}
</script>

<style scoped>
.dashboard {
  padding: 0;
}

.stat-cards {
  margin-bottom: 20px;
}

.stat-card {
  cursor: pointer;
  transition: all 0.3s;
}

.stat-card:hover {
  transform: translateY(-5px);
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 20px;
}

.stat-icon {
  font-size: 48px;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 5px;
}
</style>
