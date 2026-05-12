<template>
  <div class="user-management">
    <el-tabs v-model="activeTab">
      <el-tab-pane label="用户管理" name="users">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>用户列表</span>
              <el-button type="primary" @click="showUserDialog()">
                <el-icon><Plus /></el-icon>
                新增用户
              </el-button>
            </div>
          </template>
          <el-table :data="users" style="width: 100%">
            <el-table-column prop="username" label="用户名" />
            <el-table-column prop="real_name" label="姓名" />
            <el-table-column prop="role" label="角色">
              <template #default="{ row }">
                <el-tag>{{ getRoleLabel(row.role) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="email" label="邮箱" />
            <el-table-column prop="department" label="部门" />
            <el-table-column prop="status" label="状态">
              <template #default="{ row }">
                <el-tag :type="row.status === 1 ? 'success' : 'danger'">
                  {{ row.status === 1 ? '正常' : '禁用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="250">
              <template #default="{ row }">
                <el-button link type="primary" @click="showUserDialog(row)">编辑</el-button>
                <el-button link type="warning" @click="resetPassword(row)">重置密码</el-button>
                <el-button link type="danger" @click="deleteUser(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="角色管理" name="roles">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>角色列表</span>
              <el-button type="primary" @click="showRoleDialog()">
                <el-icon><Plus /></el-icon>
                新增角色
              </el-button>
            </div>
          </template>
          <el-table :data="roles" style="width: 100%">
            <el-table-column prop="name" label="角色名" />
            <el-table-column prop="description" label="描述" />
            <el-table-column label="权限">
              <template #default="{ row }">
                <el-tag v-for="p in parsePermissions(row.permissions)" :key="p" style="margin-right: 5px;">
                  {{ p }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150">
              <template #default="{ row }">
                <el-button link type="primary" @click="showRoleDialog(row)">编辑</el-button>
                <el-button link type="danger" @click="deleteRole(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="userDialogVisible" :title="userForm.id ? '编辑用户' : '新增用户'" width="500px">
      <el-form :model="userForm" :rules="userRules" ref="userFormRef" label-width="100px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="userForm.username" :disabled="!!userForm.id" />
        </el-form-item>
        <el-form-item label="密码" prop="password" v-if="!userForm.id">
          <el-input v-model="userForm.password" type="password" show-password />
        </el-form-item>
        <el-form-item label="姓名" prop="realName">
          <el-input v-model="userForm.realName" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="userForm.role" style="width: 100%">
            <el-option v-for="r in roles" :key="r.name" :label="r.name" :value="r.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="userForm.email" />
        </el-form-item>
        <el-form-item label="电话">
          <el-input v-model="userForm.phone" />
        </el-form-item>
        <el-form-item label="部门">
          <el-input v-model="userForm.department" />
        </el-form-item>
        <el-form-item label="状态" v-if="userForm.id">
          <el-switch v-model="userForm.status" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="userDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveUser">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="roleDialogVisible" :title="roleForm.id ? '编辑角色' : '新增角色'" width="500px">
      <el-form :model="roleForm" label-width="100px">
        <el-form-item label="角色名">
          <el-input v-model="roleForm.name" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="roleForm.description" type="textarea" />
        </el-form-item>
        <el-form-item label="权限">
          <el-checkbox-group v-model="roleForm.permissionList">
            <el-checkbox v-for="p in permissions" :key="p.code" :label="p.code">
              {{ p.name }}
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveRole">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { userApi } from '@/api/service'

const activeTab = ref('users')

const users = ref([])
const roles = ref([])
const permissions = ref([])

const userDialogVisible = ref(false)
const roleDialogVisible = ref(false)

const userFormRef = ref(null)
const userForm = ref({
  id: null,
  username: '',
  password: '',
  realName: '',
  role: 'user',
  email: '',
  phone: '',
  department: '',
  status: 1
})

const userRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  realName: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }]
}

const roleForm = ref({
  id: null,
  name: '',
  description: '',
  permissionList: []
})

const getRoleLabel = (role) => {
  const labels = { admin: '管理员', analyst: '分析师', operator: '运维', user: '普通用户' }
  return labels[role] || role
}

const parsePermissions = (permissionsStr) => {
  try {
    const p = JSON.parse(permissionsStr || '{}')
    return p.permissions || []
  } catch (e) {
    return []
  }
}

const loadData = async () => {
  try {
    users.value = await userApi.getUserList()
    roles.value = await userApi.getRoles()
    permissions.value = await userApi.getPermissions()
  } catch (e) {
    console.error(e)
  }
}

const showUserDialog = (row = null) => {
  if (row) {
    userForm.value = {
      ...row,
      realName: row.real_name
    }
  } else {
    userForm.value = {
      id: null,
      username: '',
      password: '',
      realName: '',
      role: 'user',
      email: '',
      phone: '',
      department: '',
      status: 1
    }
  }
  userDialogVisible.value = true
}

const saveUser = async () => {
  const valid = await userFormRef.value.validate().catch(() => false)
  if (!valid) return

  try {
    if (userForm.value.id) {
      await userApi.updateUser(userForm.value.id, userForm.value)
      ElMessage.success('更新成功')
    } else {
      await userApi.createUser(userForm.value)
      ElMessage.success('创建成功')
    }
    userDialogVisible.value = false
    loadData()
  } catch (e) {
    console.error(e)
  }
}

const deleteUser = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除该用户？', '提示', { type: 'warning' })
    await userApi.deleteUser(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}

const resetPassword = async (row) => {
  try {
    const { value } = await ElMessageBox.prompt('请输入新密码', '重置密码', {
      inputPattern: /^.{6,}$/,
      inputErrorMessage: '密码长度不能少于6位'
    })
    await userApi.resetPassword(row.id, { newPassword: value })
    ElMessage.success('密码重置成功')
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}

const showRoleDialog = (row = null) => {
  if (row) {
    const perms = parsePermissions(row.permissions)
    roleForm.value = {
      ...row,
      permissionList: perms
    }
  } else {
    roleForm.value = {
      id: null,
      name: '',
      description: '',
      permissionList: []
    }
  }
  roleDialogVisible.value = true
}

const saveRole = async () => {
  try {
    const data = {
      ...roleForm.value,
      permissions: { permissions: roleForm.value.permissionList }
    }

    if (roleForm.value.id) {
      await userApi.updateRole(roleForm.value.id, data)
      ElMessage.success('更新成功')
    } else {
      await userApi.createRole(data)
      ElMessage.success('创建成功')
    }
    roleDialogVisible.value = false
    loadData()
  } catch (e) {
    console.error(e)
  }
}

const deleteRole = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除该角色？', '提示', { type: 'warning' })
    await userApi.deleteRole(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch (e) {
    if (e !== 'cancel') console.error(e)
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
