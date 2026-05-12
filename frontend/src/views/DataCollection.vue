<template>
  <div class="data-collection">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>数据源管理</span>
          <el-button type="primary" @click="showSourceDialog()">
            <el-icon><Plus /></el-icon>
            新增数据源
          </el-button>
        </div>
      </template>
      <el-table :data="sources" style="width: 100%">
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="type" label="类型">
          <template #default="{ row }">
            <el-tag>{{ getSourceTypeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sync_mode" label="同步模式" />
        <el-table-column prop="last_sync_time" label="最后同步时间" width="180" />
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-switch v-model="row.status" :active-value="1" :inactive-value="0" @change="updateSourceStatus(row)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button link type="primary" @click="showSourceDialog(row)">编辑</el-button>
            <el-button link type="danger" @click="deleteSource(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card style="margin-top: 20px;">
      <template #header>
        <div class="card-header">
          <span>采集任务</span>
          <el-button type="primary" @click="showTaskDialog()">
            <el-icon><Plus /></el-icon>
            新增任务
          </el-button>
        </div>
      </template>
      <el-table :data="tasks" style="width: 100%">
        <el-table-column prop="name" label="任务名称" />
        <el-table-column prop="source_name" label="数据源" />
        <el-table-column prop="type" label="类型" />
        <el-table-column prop="status" label="状态">
          <template #default="{ row }">
            <el-tag :type="getTaskStatusType(row.status)">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="last_run_time" label="最后执行时间" width="180" />
        <el-table-column label="操作" width="250">
          <template #default="{ row }">
            <el-button link type="success" @click="startTask(row)" v-if="row.status !== 'running'">启动</el-button>
            <el-button link type="warning" @click="stopTask(row)" v-else>停止</el-button>
            <el-button link type="primary" @click="showTaskDialog(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="sourceDialogVisible" :title="sourceForm.id ? '编辑数据源' : '新增数据源'" width="500px">
      <el-form :model="sourceForm" label-width="100px">
        <el-form-item label="名称">
          <el-input v-model="sourceForm.name" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="sourceForm.type" style="width: 100%">
            <el-option label="数据库" value="database" />
            <el-option label="API接口" value="api" />
            <el-option label="文件" value="file" />
            <el-option label="日志" value="log" />
          </el-select>
        </el-form-item>
        <el-form-item label="同步模式">
          <el-select v-model="sourceForm.syncMode" style="width: 100%">
            <el-option label="手动" value="manual" />
            <el-option label="定时" value="schedule" />
            <el-option label="实时" value="realtime" />
          </el-select>
        </el-form-item>
        <el-form-item label="同步间隔" v-if="sourceForm.syncMode === 'schedule'">
          <el-input-number v-model="sourceForm.syncInterval" :min="60" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="sourceDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveSource">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="taskDialogVisible" :title="taskForm.id ? '编辑任务' : '新增任务'" width="500px">
      <el-form :model="taskForm" label-width="100px">
        <el-form-item label="任务名称">
          <el-input v-model="taskForm.name" />
        </el-form-item>
        <el-form-item label="数据源">
          <el-select v-model="taskForm.sourceId" style="width: 100%">
            <el-option v-for="s in sources" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="任务类型">
          <el-select v-model="taskForm.type" style="width: 100%">
            <el-option label="全量同步" value="full" />
            <el-option label="增量同步" value="incremental" />
          </el-select>
        </el-form-item>
        <el-form-item label="文件上传" v-if="taskForm.type === 'file'">
          <el-upload :show-file-list="false" :before-upload="handleFileUpload">
            <el-button type="primary">选择文件</el-button>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="taskDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveTask">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { collectionApi } from '@/api/collection'

const sources = ref([])
const tasks = ref([])

const sourceDialogVisible = ref(false)
const taskDialogVisible = ref(false)

const sourceForm = ref({
  id: null,
  name: '',
  type: 'database',
  syncMode: 'manual',
  syncInterval: 3600
})

const taskForm = ref({
  id: null,
  name: '',
  sourceId: null,
  type: 'full'
})

const getSourceTypeLabel = (type) => {
  const labels = { database: '数据库', api: 'API接口', file: '文件', log: '日志' }
  return labels[type] || type
}

const getTaskStatusType = (status) => {
  const types = { completed: 'success', running: 'primary', failed: 'danger', pending: 'info', stopped: 'warning' }
  return types[status] || 'info'
}

const loadData = async () => {
  try {
    sources.value = await collectionApi.getSources()
    tasks.value = await collectionApi.getTasks()
  } catch (e) {
    console.error(e)
  }
}

const showSourceDialog = (row = null) => {
  if (row) {
    sourceForm.value = { ...row, syncMode: row.sync_mode, syncInterval: row.sync_interval }
  } else {
    sourceForm.value = { id: null, name: '', type: 'database', syncMode: 'manual', syncInterval: 3600 }
  }
  sourceDialogVisible.value = true
}

const saveSource = async () => {
  try {
    if (sourceForm.value.id) {
      await collectionApi.updateSource(sourceForm.value.id, sourceForm.value)
      ElMessage.success('更新成功')
    } else {
      await collectionApi.createSource(sourceForm.value)
      ElMessage.success('创建成功')
    }
    sourceDialogVisible.value = false
    loadData()
  } catch (e) {
    console.error(e)
  }
}

const deleteSource = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除该数据源？', '提示', { type: 'warning' })
    await collectionApi.deleteSource(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}

const updateSourceStatus = async (row) => {
  try {
    await collectionApi.updateSource(row.id, { ...row, status: row.status })
    ElMessage.success('状态更新成功')
  } catch (e) {
    console.error(e)
  }
}

const showTaskDialog = (row = null) => {
  if (row) {
    taskForm.value = { ...row, sourceId: row.source_id }
  } else {
    taskForm.value = { id: null, name: '', sourceId: null, type: 'full' }
  }
  taskDialogVisible.value = true
}

const saveTask = async () => {
  try {
    if (taskForm.value.id) {
      ElMessage.info('任务更新功能待实现')
    } else {
      await collectionApi.createTask(taskForm.value)
      ElMessage.success('创建成功')
    }
    taskDialogVisible.value = false
    loadData()
  } catch (e) {
    console.error(e)
  }
}

const startTask = async (row) => {
  try {
    await collectionApi.startTask(row.id)
    ElMessage.success('任务已启动')
    loadData()
  } catch (e) {
    console.error(e)
  }
}

const stopTask = async (row) => {
  try {
    await collectionApi.stopTask(row.id)
    ElMessage.success('任务已停止')
    loadData()
  } catch (e) {
    console.error(e)
  }
}

const handleFileUpload = async (file) => {
  try {
    const res = await collectionApi.uploadFile(file)
    taskForm.value.config = { filePath: res.filePath }
    ElMessage.success('文件上传成功')
  } catch (e) {
    console.error(e)
  }
  return false
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
</style>
