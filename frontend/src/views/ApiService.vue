<template>
  <div class="api-service">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>API服务管理</span>
          <el-button type="primary" @click="showServiceDialog()">
            <el-icon><Plus /></el-icon>
            新增服务
          </el-button>
        </div>
      </template>
      <el-table :data="services" style="width: 100%">
        <el-table-column prop="name" label="服务名称" />
        <el-table-column prop="path" label="路径" />
        <el-table-column prop="method" label="方法" width="80">
          <template #default="{ row }">
            <el-tag :type="getMethodType(row.method)">{{ row.method }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="rate_limit" label="限流" width="100" />
        <el-table-column prop="is_active" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'info'">
              {{ row.is_active ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="250">
          <template #default="{ row }">
            <el-button link type="success" @click="testService(row)">测试</el-button>
            <el-button link type="primary" @click="showServiceDialog(row)">编辑</el-button>
            <el-button link type="danger" @click="deleteService(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card style="margin-top: 20px;">
      <template #header>
        <span>操作日志</span>
      </template>
      <el-form :inline="true" :model="logSearchForm" class="search-form">
        <el-form-item label="用户">
          <el-input v-model="logSearchForm.userId" placeholder="用户ID" clearable />
        </el-form-item>
        <el-form-item label="模块">
          <el-input v-model="logSearchForm.module" placeholder="模块名" clearable />
        </el-form-item>
        <el-form-item label="操作">
          <el-input v-model="logSearchForm.action" placeholder="操作类型" clearable />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadLogs">查询</el-button>
        </el-form-item>
      </el-form>
      <el-table :data="logs" style="width: 100%">
        <el-table-column prop="username" label="用户" width="120" />
        <el-table-column prop="module" label="模块" width="120" />
        <el-table-column prop="action" label="操作" width="120" />
        <el-table-column prop="ip" label="IP地址" width="140" />
        <el-table-column prop="created_at" label="时间" width="180" />
        <el-table-column label="详情">
          <template #default="{ row }">
            <el-button link type="primary" @click="showLogDetail(row)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="serviceDialogVisible" :title="serviceForm.id ? '编辑服务' : '新增服务'" width="600px">
      <el-form :model="serviceForm" label-width="100px">
        <el-form-item label="服务名称">
          <el-input v-model="serviceForm.name" />
        </el-form-item>
        <el-form-item label="路径">
          <el-input v-model="serviceForm.path" placeholder="/api/xxx" />
        </el-form-item>
        <el-form-item label="请求方法">
          <el-select v-model="serviceForm.method" style="width: 100%">
            <el-option label="GET" value="GET" />
            <el-option label="POST" value="POST" />
          </el-select>
        </el-form-item>
        <el-form-item label="SQL查询">
          <el-input v-model="serviceForm.sqlQuery" type="textarea" :rows="5" placeholder="SELECT * FROM table WHERE condition" />
        </el-form-item>
        <el-form-item label="限流">
          <el-input-number v-model="serviceForm.rateLimit" :min="1" :max="1000" />
          <span style="margin-left: 10px; color: #909399;">次/分钟</span>
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="serviceForm.isActive" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="serviceDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveService">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="testDialogVisible" title="API测试" width="600px">
      <el-form label-width="80px">
        <el-form-item label="请求路径">
          <el-input :model-value="testPath" readonly />
        </el-form-item>
        <el-form-item label="响应结果">
          <el-input type="textarea" :model-value="testResult" :rows="15" readonly />
        </el-form-item>
      </el-form>
    </el-dialog>

    <el-dialog v-model="logDetailVisible" title="日志详情" width="600px">
      <el-input type="textarea" :model-value="logDetail" :rows="10" readonly />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { serviceApi } from '@/api/service'

const services = ref([])
const logs = ref([])

const serviceDialogVisible = ref(false)
const testDialogVisible = ref(false)
const logDetailVisible = ref(false)

const serviceForm = ref({
  id: null,
  name: '',
  path: '',
  method: 'GET',
  sqlQuery: '',
  rateLimit: 100,
  isActive: true
})

const logSearchForm = ref({
  userId: '',
  module: '',
  action: ''
})

const testPath = ref('')
const testResult = ref('')
const logDetail = ref('')

const getMethodType = (method) => {
  const types = { GET: 'success', POST: 'primary', PUT: 'warning', DELETE: 'danger' }
  return types[method] || 'info'
}

const loadData = async () => {
  try {
    services.value = await serviceApi.getServices()
    logs.value = await serviceApi.getLogs({ limit: 50 })
  } catch (e) {
    console.error(e)
  }
}

const showServiceDialog = (row = null) => {
  if (row) {
    serviceForm.value = {
      ...row,
      sqlQuery: row.sql_query,
      rateLimit: row.rate_limit,
      isActive: row.is_active === 1
    }
  } else {
    serviceForm.value = {
      id: null,
      name: '',
      path: '',
      method: 'GET',
      sqlQuery: '',
      rateLimit: 100,
      isActive: true
    }
  }
  serviceDialogVisible.value = true
}

const saveService = async () => {
  try {
    if (serviceForm.value.id) {
      await serviceApi.updateService(serviceForm.value.id, serviceForm.value)
      ElMessage.success('更新成功')
    } else {
      await serviceApi.createService(serviceForm.value)
      ElMessage.success('创建成功')
    }
    serviceDialogVisible.value = false
    loadData()
  } catch (e) {
    console.error(e)
  }
}

const deleteService = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除？', '提示', { type: 'warning' })
    await serviceApi.deleteService(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}

const testService = async (row) => {
  try {
    testPath.value = `/api/service/call${row.path}`
    const result = row.method === 'GET'
      ? await serviceApi.callGet(row.path.substring(1), {})
      : await serviceApi.callPost(row.path.substring(1), {})
    testResult.value = JSON.stringify(result, null, 2)
    testDialogVisible.value = true
  } catch (e) {
    testResult.value = `错误: ${e.message}`
    testDialogVisible.value = true
  }
}

const loadLogs = async () => {
  try {
    const params = { ...logSearchForm.value, limit: 50 }
    logs.value = await serviceApi.getLogs(params)
  } catch (e) {
    console.error(e)
  }
}

const showLogDetail = (row) => {
  logDetail.value = JSON.stringify({
    user: row.username,
    module: row.module,
    action: row.action,
    ip: row.ip,
    time: row.created_at,
    detail: row.detail
  }, null, 2)
  logDetailVisible.value = true
}

onMounted(() => {
  loadData()
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
