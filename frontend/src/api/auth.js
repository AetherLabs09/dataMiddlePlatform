import request from './request'

export const authApi = {
  login(data) {
    return request.post('/auth/login', data)
  },

  logout() {
    return request.post('/auth/logout')
  },

  getMe() {
    return request.get('/auth/me')
  },

  changePassword(data) {
    return request.post('/auth/change-password', data)
  }
}
