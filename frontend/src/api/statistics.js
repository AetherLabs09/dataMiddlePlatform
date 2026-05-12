import request from './request'

export const statisticsApi = {
  getIndicators() {
    return request.get('/statistics/indicators')
  },

  createIndicator(data) {
    return request.post('/statistics/indicators', data)
  },

  updateIndicator(id, data) {
    return request.put(`/statistics/indicators/${id}`, data)
  },

  deleteIndicator(id) {
    return request.delete(`/statistics/indicators/${id}`)
  },

  getIndicatorValues(params) {
    return request.get('/statistics/indicator-values', { params })
  },

  createIndicatorValue(data) {
    return request.post('/statistics/indicator-values', data)
  },

  calculateIndicator(data) {
    return request.post('/statistics/calculate', data)
  },

  getChartData(params) {
    return request.get('/statistics/chart-data', { params })
  },

  getComparison(params) {
    return request.get('/statistics/comparison', { params })
  },

  exportData(params) {
    return request.get('/statistics/export', { params })
  }
}
