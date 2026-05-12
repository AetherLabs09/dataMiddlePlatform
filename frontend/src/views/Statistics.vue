<template>
  <div class="statistics">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>指标管理</span>
          <el-button type="primary" @click="showIndicatorDialog()">
            <el-icon><Plus /></el-icon>
            新增指标
          </el-button>
        </div>
      </template>
      <el-table :data="indicators" style="width: 100%">
        <el-table-column prop="name" label="指标名称" />
        <el-table-column prop="code" label="指标编码" />
        <el-table-column prop="category" label="分类" />
        <el-table-column prop="unit" label="单位" />
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button link type="primary" @click="calculateIndicator(row)">计算</el-button>
            <el-button link type="primary" @click="showIndicatorDialog(row)">编辑</el-button>
            <el-button link type="danger" @click="deleteIndicator(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card style="margin-top: 20px;">
      <template #header>
        <span>可视化分析</span>
      </template>
      <el-form :inline="true" :model="chartForm" class="chart-form">
        <el-form-item label="选择指标">
          <el-select v-model="chartForm.indicatorIds" multiple placeholder="请选择指标" style="width: 300px">
            <el-option v-for="i in indicators" :key="i.id" :label="i.name" :value="i.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="时间范围">
          <el-date-picker v-model="chartForm.dateRange" type="daterange" range-separator="至" start-placeholder="开始" end-placeholder="结束" />
        </el-form-item>
        <el-form-item label="图表类型">
          <el-select v-model="chartForm.chartType" style="width: 120px">
            <el-option label="折线图" value="line" />
            <el-option label="柱状图" value="bar" />
            <el-option label="饼图" value="pie" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadChartData">生成图表</el-button>
          <el-button type="success" @click="exportData">导出数据</el-button>
        </el-form-item>
      </el-form>
      <div ref="chartRef" style="height: 400px; margin-top: 20px;"></div>
    </el-card>

    <el-card style="margin-top: 20px;">
      <template #header>
        <span>同比环比分析</span>
      </template>
      <el-form :inline="true" :model="comparisonForm">
        <el-form-item label="选择指标">
          <el-select v-model="comparisonForm.indicatorId" placeholder="请选择指标" style="width: 200px">
            <el-option v-for="i in indicators" :key="i.id" :label="i.name" :value="i.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="时间周期">
          <el-input v-model="comparisonForm.timePeriod" placeholder="如: 2024-01" style="width: 150px" />
        </el-form-item>
        <el-form-item label="对比类型">
          <el-select v-model="comparisonForm.comparisonType" style="width: 120px">
            <el-option label="同比" value="yoy" />
            <el-option label="环比" value="mom" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadComparison">分析</el-button>
        </el-form-item>
      </el-form>
      <el-descriptions v-if="comparisonData" :column="4" border style="margin-top: 20px;">
        <el-descriptions-item label="当前值">{{ comparisonData.current }}</el-descriptions-item>
        <el-descriptions-item label="对比值">{{ comparisonData.previous }}</el-descriptions-item>
        <el-descriptions-item label="变化值">{{ comparisonData.change }}</el-descriptions-item>
        <el-descriptions-item label="变化率">{{ comparisonData.changeRate }}%</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-dialog v-model="indicatorDialogVisible" :title="indicatorForm.id ? '编辑指标' : '新增指标'" width="500px">
      <el-form :model="indicatorForm" label-width="100px">
        <el-form-item label="指标名称">
          <el-input v-model="indicatorForm.name" />
        </el-form-item>
        <el-form-item label="指标编码">
          <el-input v-model="indicatorForm.code" />
        </el-form-item>
        <el-form-item label="分类">
          <el-input v-model="indicatorForm.category" />
        </el-form-item>
        <el-form-item label="单位">
          <el-input v-model="indicatorForm.unit" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="indicatorForm.description" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="indicatorDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveIndicator">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as echarts from 'echarts'
import { statisticsApi } from '@/api/statistics'

const indicators = ref([])
const chartRef = ref(null)

const chartForm = ref({
  indicatorIds: [],
  dateRange: [],
  chartType: 'line'
})

const comparisonForm = ref({
  indicatorId: null,
  timePeriod: '',
  comparisonType: 'yoy'
})

const comparisonData = ref(null)

const indicatorDialogVisible = ref(false)
const indicatorForm = ref({
  id: null,
  name: '',
  code: '',
  category: '',
  unit: '',
  description: ''
})

const loadIndicators = async () => {
  try {
    indicators.value = await statisticsApi.getIndicators()
  } catch (e) {
    console.error(e)
  }
}

const showIndicatorDialog = (row = null) => {
  if (row) {
    indicatorForm.value = { ...row }
  } else {
    indicatorForm.value = { id: null, name: '', code: '', category: '', unit: '', description: '' }
  }
  indicatorDialogVisible.value = true
}

const saveIndicator = async () => {
  try {
    if (indicatorForm.value.id) {
      await statisticsApi.updateIndicator(indicatorForm.value.id, indicatorForm.value)
      ElMessage.success('更新成功')
    } else {
      await statisticsApi.createIndicator(indicatorForm.value)
      ElMessage.success('创建成功')
    }
    indicatorDialogVisible.value = false
    loadIndicators()
  } catch (e) {
    console.error(e)
  }
}

const deleteIndicator = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除？', '提示', { type: 'warning' })
    await statisticsApi.deleteIndicator(row.id)
    ElMessage.success('删除成功')
    loadIndicators()
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}

const calculateIndicator = async (row) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const res = await statisticsApi.calculateIndicator({
      indicatorId: row.id,
      timePeriod: today
    })
    ElMessage.success(`计算完成: ${res.value}`)
  } catch (e) {
    console.error(e)
  }
}

const loadChartData = async () => {
  if (chartForm.value.indicatorIds.length === 0) {
    ElMessage.warning('请选择至少一个指标')
    return
  }

  try {
    const params = {
      indicatorIds: chartForm.value.indicatorIds.join(','),
      chartType: chartForm.value.chartType
    }

    if (chartForm.value.dateRange && chartForm.value.dateRange.length === 2) {
      params.startDate = chartForm.value.dateRange[0]
      params.endDate = chartForm.value.dateRange[1]
    }

    const res = await statisticsApi.getChartData(params)
    renderChart(res)
  } catch (e) {
    console.error(e)
  }
}

const renderChart = (data) => {
  const chart = echarts.init(chartRef.value)
  const option = {
    tooltip: { trigger: 'axis' },
    legend: { data: data.indicators.map(i => i.name) },
    xAxis: {
      type: 'category',
      data: data.data[0]?.values.map(v => v.timePeriod) || []
    },
    yAxis: { type: 'value' },
    series: data.data.map((d, index) => ({
      name: d.indicatorName,
      type: chartForm.value.chartType,
      data: d.values.map(v => v.value),
      smooth: chartForm.value.chartType === 'line'
    }))
  }
  chart.setOption(option)
}

const loadComparison = async () => {
  if (!comparisonForm.value.indicatorId || !comparisonForm.value.timePeriod) {
    ElMessage.warning('请选择指标和时间周期')
    return
  }

  try {
    comparisonData.value = await statisticsApi.getComparison(comparisonForm.value)
  } catch (e) {
    console.error(e)
  }
}

const exportData = async () => {
  if (chartForm.value.indicatorIds.length === 0) {
    ElMessage.warning('请选择至少一个指标')
    return
  }

  try {
    const data = await statisticsApi.exportData({
      indicatorIds: chartForm.value.indicatorIds.join(','),
      format: 'json'
    })

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'statistics_export.json'
    a.click()
    URL.revokeObjectURL(url)

    ElMessage.success('导出成功')
  } catch (e) {
    console.error(e)
  }
}

onMounted(() => {
  loadIndicators()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chart-form {
  margin-bottom: 20px;
}
</style>
