import request from './request'

export const serviceApi = {
  getServices() {
    return request.get('/service/services')
  },

  createService(data) {
    return request.post('/service/services', data)
  },

  updateService(id, data) {
    return request.put(`/service/services/${id}`, data)
  },

  deleteService(id) {
    return request.delete(`/service/services/${id}`)
  },

  callGet(path, params) {
    return request.get(`/service/call/${path}`, { params })
  },

  callPost(path, data) {
    return request.post(`/service/call/${path}`, data)
  },

  getLogs(params) {
    return request.get('/service/logs', { params })
  },

  getLogStatistics(params) {
    return request.get('/service/logs/statistics', { params })
  }
}

export const userApi = {
  getUserList() {
    return request.get('/user/list')
  },

  createUser(data) {
    return request.post('/user/create', data)
  },

  updateUser(id, data) {
    return request.put(`/user/${id}`, data)
  },

  deleteUser(id) {
    return request.delete(`/user/${id}`)
  },

  resetPassword(id, data) {
    return request.post(`/user/${id}/reset-password`, data)
  },

  getRoles() {
    return request.get('/user/roles')
  },

  createRole(data) {
    return request.post('/user/roles', data)
  },

  updateRole(id, data) {
    return request.put(`/user/roles/${id}`, data)
  },

  deleteRole(id) {
    return request.delete(`/user/roles/${id}`)
  },

  getPermissions() {
    return request.get('/user/permissions')
  }
}
