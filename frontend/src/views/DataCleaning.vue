<template>
  <div class="data-cleaning">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>原始数据</span>
          <el-button type="primary" @click="cleanData">
            <el-icon><Brush /></el-icon>
            执行清洗
          </el-button>
        </div>
      </template>
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="表名">
          <el-input v-model="searchForm.tableName" placeholder="请输入表名" clearable />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadRawData">查询</el-button>
        </el-form-item>
      </el-form>
      <el-table :data="rawData.data" style="width: 100%">
        <el-table-column prop="table_name" label="表名" />
        <el-table-column prop="hash" label="数据哈希" width="200" />
        <el-table-column prop="created_at" label="创建时间" width="180" />
        <el-table-column label="数据预览">
          <template #default="{ row }">
            <el-button link type="primary" @click="showDataPreview(row.data)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="searchForm.page"
        v-model:page-size="searchForm.pageSize"
        :total="rawData.total"
        layout="total, sizes, prev, pager, next"
        @size-change="loadRawData"
        @current-change="loadRawData"
        style="margin-top: 20px; justify-content: flex-end;"
      />
    </el-card>

    <el-card style="margin-top: 20px;">
      <template #header>
        <div class="card-header">
          <span>清洗后数据</span>
          <el-button type="success" @click="showAggregateDialog">
            <el-icon><DataAnalysis /></el-icon>
            数据汇总
          </el-button>
        </div>
      </template>
      <el-form :inline="true" :model="cleanedSearchForm" class="search-form">
        <el-form-item label="表名">
          <el-input v-model="cleanedSearchForm.tableName" placeholder="请输入表名" clearable />
        </el-form-item>
        <el-form-item label="数据层">
          <el-select v-model="cleanedSearchForm.layer" clearable>
            <el-option label="明细层" value="detail" />
            <el-option label="汇总层" value="summary" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadCleanedData">查询</el-button>
        </el-form-item>
      </el-form>
      <el-table :data="cleanedData.data" style="width: 100%">
        <el-table-column prop="table_name" label="表名" />
        <el-table-column prop="layer" label="数据层">
          <template #default="{ row }">
            <el-tag :type="row.layer === 'detail' ? 'primary' : 'success'">
              {{ row.layer === 'detail' ? '明细层' : '汇总层' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="quality_score" label="质量评分" width="120">
          <template #default="{ row }">
            <el-progress :percentage="row.quality_score * 100" :stroke-width="15" />
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180" />
        <el-table-column label="数据预览">
          <template #default="{ row }">
            <el-button link type="primary" @click="showDataPreview(row.data)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="previewDialogVisible" title="数据预览" width="600px">
      <el-input type="textarea" :model-value="previewData" :rows="15" readonly />
    </el-dialog>

    <el-dialog v-model="aggregateDialogVisible" title="数据汇总配置" width="500px">
      <el-form :model="aggregateForm" label-width="100px">
        <el-form-item label="表名">
          <el-input v-model="aggregateForm.tableName" />
        </el-form-item>
        <el-form-item label="分组字段">
          <el-select v-model="aggregateForm.groupBy" multiple style="width: 100%">
            <el-option label="日期" value="date" />
            <el-option label="类型" value="type" />
            <el-option label="用户" value="user_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="聚合方式">
          <el-select v-model="aggregateForm.aggregation" style="width: 100%">
            <el-option label="求和" value="sum" />
            <el-option label="平均值" value="avg" />
            <el-option label="计数" value="count" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="aggregateDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="executeAggregate">执行汇总</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { cleaningApi } from '@/api/cleaning'

const searchForm = ref({ tableName: '', page: 1, pageSize: 20 })
const cleanedSearchForm = ref({ tableName: '', layer: '', page: 1, pageSize: 20 })

const rawData = ref({ data: [], total: 0 })
const cleanedData = ref({ data: [], total: 0 })

const previewDialogVisible = ref(false)
const previewData = ref('')

const aggregateDialogVisible = ref(false)
const aggregateForm = ref({
  tableName: '',
  groupBy: [],
  aggregation: 'sum'
})

const loadRawData = async () => {
  try {
    rawData.value = await cleaningApi.getRawData(searchForm.value)
  } catch (e) {
    console.error(e)
  }
}

const loadCleanedData = async () => {
  try {
    cleanedData.value = await cleaningApi.getCleanedData(cleanedSearchForm.value)
  } catch (e) {
    console.error(e)
  }
}

const cleanData = async () => {
  try {
    const res = await cleaningApi.cleanData({
      tableName: searchForm.value.tableName,
      rules: {
        removeDuplicates: true,
        fillMissing: true,
        removeInvalid: true
      }
    })
    ElMessage.success(res.message)
    loadCleanedData()
  } catch (e) {
    console.error(e)
  }
}

const showDataPreview = (data) => {
  previewData.value = JSON.stringify(data, null, 2)
  previewDialogVisible.value = true
}

const showAggregateDialog = () => {
  aggregateForm.value = { tableName: '', groupBy: [], aggregation: 'sum' }
  aggregateDialogVisible.value = true
}

const executeAggregate = async () => {
  try {
    const aggregations = aggregateForm.value.groupBy.map(field => ({
      field: 'value',
      type: aggregateForm.value.aggregation,
      alias: `${field}_${aggregateForm.value.aggregation}`
    }))

    await cleaningApi.aggregateData({
      tableName: aggregateForm.value.tableName,
      groupBy: aggregateForm.value.groupBy,
      aggregations
    })
    ElMessage.success('汇总完成')
    aggregateDialogVisible.value = false
    loadCleanedData()
  } catch (e) {
    console.error(e)
  }
}

onMounted(() => {
  loadRawData()
  loadCleanedData()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-form {
  margin-bottom: 20px;
}
</style>
