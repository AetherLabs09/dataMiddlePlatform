<template>
  <div class="data-governance">
    <el-tabs v-model="activeTab">
      <el-tab-pane label="元数据管理" name="metadata">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>元数据列表</span>
              <el-button type="primary" @click="showMetadataDialog()">
                <el-icon><Plus /></el-icon>
                新增
              </el-button>
            </div>
          </template>
          <el-table :data="metadataList" style="width: 100%">
            <el-table-column prop="table_name" label="表名" />
            <el-table-column prop="column_name" label="字段名" />
            <el-table-column prop="data_type" label="数据类型" />
            <el-table-column prop="description" label="描述" />
            <el-table-column label="操作" width="150">
              <template #default="{ row }">
                <el-button link type="primary" @click="showMetadataDialog(row)">编辑</el-button>
                <el-button link type="danger" @click="deleteMetadata(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="数据字典" name="dictionary">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>数据字典</span>
              <el-button type="primary" @click="showDictionaryDialog()">
                <el-icon><Plus /></el-icon>
                新增
              </el-button>
            </div>
          </template>
          <el-table :data="dictionaryList" style="width: 100%">
            <el-table-column prop="category" label="分类" />
            <el-table-column prop="code" label="编码" />
            <el-table-column prop="name" label="名称" />
            <el-table-column prop="description" label="描述" />
            <el-table-column label="操作" width="150">
              <template #default="{ row }">
                <el-button link type="primary" @click="showDictionaryDialog(row)">编辑</el-button>
                <el-button link type="danger" @click="deleteDictionary(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="质量规则" name="quality">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>质量规则</span>
              <div>
                <el-button type="success" @click="executeQualityCheck">
                  <el-icon><Check /></el-icon>
                  执行检查
                </el-button>
                <el-button type="primary" @click="showQualityRuleDialog()">
                  <el-icon><Plus /></el-icon>
                  新增
                </el-button>
              </div>
            </div>
          </template>
          <el-table :data="qualityRules" style="width: 100%">
            <el-table-column prop="table_name" label="表名" />
            <el-table-column prop="rule_type" label="规则类型">
              <template #default="{ row }">
                <el-tag>{{ getRuleTypeLabel(row.rule_type) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="severity" label="严重程度">
              <template #default="{ row }">
                <el-tag :type="getSeverityType(row.severity)">{{ row.severity }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="is_active" label="状态">
              <template #default="{ row }">
                <el-tag :type="row.is_active ? 'success' : 'info'">
                  {{ row.is_active ? '启用' : '禁用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150">
              <template #default="{ row }">
                <el-button link type="primary" @click="showQualityRuleDialog(row)">编辑</el-button>
                <el-button link type="danger" @click="deleteQualityRule(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-card style="margin-top: 20px;">
          <template #header>
            <span>质量检查记录</span>
          </template>
          <el-table :data="qualityChecks" style="width: 100%">
            <el-table-column prop="rule_type" label="规则类型" />
            <el-table-column prop="result" label="结果">
              <template #default="{ row }">
                <el-tag :type="row.result === 'passed' ? 'success' : 'danger'">
                  {{ row.result === 'passed' ? '通过' : '失败' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="error_count" label="错误数" />
            <el-table-column prop="total_count" label="总数" />
            <el-table-column prop="check_time" label="检查时间" width="180" />
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="metadataDialogVisible" :title="metadataForm.id ? '编辑元数据' : '新增元数据'" width="500px">
      <el-form :model="metadataForm" label-width="100px">
        <el-form-item label="表名">
          <el-input v-model="metadataForm.tableName" />
        </el-form-item>
        <el-form-item label="字段名">
          <el-input v-model="metadataForm.columnName" />
        </el-form-item>
        <el-form-item label="数据类型">
          <el-select v-model="metadataForm.dataType" style="width: 100%">
            <el-option label="字符串" value="string" />
            <el-option label="整数" value="integer" />
            <el-option label="浮点数" value="float" />
            <el-option label="日期" value="date" />
            <el-option label="布尔" value="boolean" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="metadataForm.description" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="metadataDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveMetadata">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="dictionaryDialogVisible" :title="dictionaryForm.id ? '编辑字典' : '新增字典'" width="500px">
      <el-form :model="dictionaryForm" label-width="100px">
        <el-form-item label="分类">
          <el-input v-model="dictionaryForm.category" />
        </el-form-item>
        <el-form-item label="编码">
          <el-input v-model="dictionaryForm.code" />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="dictionaryForm.name" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="dictionaryForm.description" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dictionaryDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveDictionary">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="qualityRuleDialogVisible" :title="qualityRuleForm.id ? '编辑规则' : '新增规则'" width="500px">
      <el-form :model="qualityRuleForm" label-width="100px">
        <el-form-item label="表名">
          <el-input v-model="qualityRuleForm.tableName" />
        </el-form-item>
        <el-form-item label="规则类型">
          <el-select v-model="qualityRuleForm.ruleType" style="width: 100%">
            <el-option label="完整性" value="completeness" />
            <el-option label="唯一性" value="uniqueness" />
            <el-option label="一致性" value="consistency" />
          </el-select>
        </el-form-item>
        <el-form-item label="严重程度">
          <el-select v-model="qualityRuleForm.severity" style="width: 100%">
            <el-option label="错误" value="error" />
            <el-option label="警告" value="warning" />
            <el-option label="信息" value="info" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="qualityRuleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveQualityRule">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { governanceApi } from '@/api/governance'

const activeTab = ref('metadata')

const metadataList = ref([])
const dictionaryList = ref([])
const qualityRules = ref([])
const qualityChecks = ref([])

const metadataDialogVisible = ref(false)
const dictionaryDialogVisible = ref(false)
const qualityRuleDialogVisible = ref(false)

const metadataForm = ref({ id: null, tableName: '', columnName: '', dataType: 'string', description: '' })
const dictionaryForm = ref({ id: null, category: '', code: '', name: '', description: '' })
const qualityRuleForm = ref({ id: null, tableName: '', ruleType: 'completeness', severity: 'warning' })

const getRuleTypeLabel = (type) => {
  const labels = { completeness: '完整性', uniqueness: '唯一性', consistency: '一致性' }
  return labels[type] || type
}

const getSeverityType = (severity) => {
  const types = { error: 'danger', warning: 'warning', info: 'info' }
  return types[severity] || 'info'
}

const loadData = async () => {
  try {
    metadataList.value = await governanceApi.getMetadata()
    dictionaryList.value = await governanceApi.getDictionary()
    qualityRules.value = await governanceApi.getQualityRules()
    qualityChecks.value = await governanceApi.getQualityChecks({ limit: 20 })
  } catch (e) {
    console.error(e)
  }
}

const showMetadataDialog = (row = null) => {
  if (row) {
    metadataForm.value = { ...row, tableName: row.table_name, columnName: row.column_name, dataType: row.data_type }
  } else {
    metadataForm.value = { id: null, tableName: '', columnName: '', dataType: 'string', description: '' }
  }
  metadataDialogVisible.value = true
}

const saveMetadata = async () => {
  try {
    if (metadataForm.value.id) {
      await governanceApi.updateMetadata(metadataForm.value.id, metadataForm.value)
      ElMessage.success('更新成功')
    } else {
      await governanceApi.createMetadata(metadataForm.value)
      ElMessage.success('创建成功')
    }
    metadataDialogVisible.value = false
    loadData()
  } catch (e) {
    console.error(e)
  }
}

const deleteMetadata = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除？', '提示', { type: 'warning' })
    await governanceApi.deleteMetadata(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}

const showDictionaryDialog = (row = null) => {
  if (row) {
    dictionaryForm.value = { ...row }
  } else {
    dictionaryForm.value = { id: null, category: '', code: '', name: '', description: '' }
  }
  dictionaryDialogVisible.value = true
}

const saveDictionary = async () => {
  try {
    if (dictionaryForm.value.id) {
      await governanceApi.updateDictionary(dictionaryForm.value.id, dictionaryForm.value)
      ElMessage.success('更新成功')
    } else {
      await governanceApi.createDictionary(dictionaryForm.value)
      ElMessage.success('创建成功')
    }
    dictionaryDialogVisible.value = false
    loadData()
  } catch (e) {
    console.error(e)
  }
}

const deleteDictionary = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除？', '提示', { type: 'warning' })
    await governanceApi.deleteDictionary(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}

const showQualityRuleDialog = (row = null) => {
  if (row) {
    qualityRuleForm.value = { ...row, tableName: row.table_name, ruleType: row.rule_type }
  } else {
    qualityRuleForm.value = { id: null, tableName: '', ruleType: 'completeness', severity: 'warning' }
  }
  qualityRuleDialogVisible.value = true
}

const saveQualityRule = async () => {
  try {
    if (qualityRuleForm.value.id) {
      await governanceApi.updateQualityRule(qualityRuleForm.value.id, qualityRuleForm.value)
      ElMessage.success('更新成功')
    } else {
      await governanceApi.createQualityRule(qualityRuleForm.value)
      ElMessage.success('创建成功')
    }
    qualityRuleDialogVisible.value = false
    loadData()
  } catch (e) {
    console.error(e)
  }
}

const deleteQualityRule = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除？', '提示', { type: 'warning' })
    await governanceApi.deleteQualityRule(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}

const executeQualityCheck = async () => {
  try {
    const res = await governanceApi.qualityCheck({ tableName: 'raw_data' })
    ElMessage.success(res.message)
    loadData()
  } catch (e) {
    console.error(e)
  }
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
