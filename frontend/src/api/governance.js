import request from './request'

export const governanceApi = {
  getMetadata(params) {
    return request.get('/governance/metadata', { params })
  },

  createMetadata(data) {
    return request.post('/governance/metadata', data)
  },

  updateMetadata(id, data) {
    return request.put(`/governance/metadata/${id}`, data)
  },

  deleteMetadata(id) {
    return request.delete(`/governance/metadata/${id}`)
  },

  getDictionary(params) {
    return request.get('/governance/dictionary', { params })
  },

  createDictionary(data) {
    return request.post('/governance/dictionary', data)
  },

  updateDictionary(id, data) {
    return request.put(`/governance/dictionary/${id}`, data)
  },

  deleteDictionary(id) {
    return request.delete(`/governance/dictionary/${id}`)
  },

  getQualityRules(params) {
    return request.get('/governance/quality-rules', { params })
  },

  createQualityRule(data) {
    return request.post('/governance/quality-rules', data)
  },

  updateQualityRule(id, data) {
    return request.put(`/governance/quality-rules/${id}`, data)
  },

  deleteQualityRule(id) {
    return request.delete(`/governance/quality-rules/${id}`)
  },

  qualityCheck(data) {
    return request.post('/governance/quality-check', data)
  },

  getQualityChecks(params) {
    return request.get('/governance/quality-checks', { params })
  },

  getQualityReport(params) {
    return request.get('/governance/quality-report', { params })
  }
}
