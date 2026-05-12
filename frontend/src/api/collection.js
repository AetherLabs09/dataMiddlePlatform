import request from './request'

export const collectionApi = {
  getSources() {
    return request.get('/collection/sources')
  },

  createSource(data) {
    return request.post('/collection/sources', data)
  },

  updateSource(id, data) {
    return request.put(`/collection/sources/${id}`, data)
  },

  deleteSource(id) {
    return request.delete(`/collection/sources/${id}`)
  },

  getTasks() {
    return request.get('/collection/tasks')
  },

  createTask(data) {
    return request.post('/collection/tasks', data)
  },

  startTask(id) {
    return request.post(`/collection/tasks/${id}/start`)
  },

  stopTask(id) {
    return request.post(`/collection/tasks/${id}/stop`)
  },

  uploadFile(file) {
    const formData = new FormData()
    formData.append('file', file)
    return request.post('/collection/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  getSyncRecords(params) {
    return request.get('/collection/sync-records', { params })
  }
}
