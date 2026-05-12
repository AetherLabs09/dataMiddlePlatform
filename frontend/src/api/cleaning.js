import request from './request'

export const cleaningApi = {
  getRawData(params) {
    return request.get('/cleaning/raw-data', { params })
  },

  cleanData(data) {
    return request.post('/cleaning/clean', data)
  },

  getCleanedData(params) {
    return request.get('/cleaning/cleaned-data', { params })
  },

  aggregateData(data) {
    return request.post('/cleaning/aggregate', data)
  },

  getLineage(params) {
    return request.get('/cleaning/lineage', { params })
  },

  createLineage(data) {
    return request.post('/cleaning/lineage', data)
  }
}
