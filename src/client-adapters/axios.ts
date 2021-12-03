import {ClientAdapter} from './types'

export default {
  get: function(...args) {
    return this.$http.get(...args).then(function({data}) {
      return data;
    })
  },
  post: function(...args) {
    return this.$http.post(...args).then(function({data}) {
      return data;
    })
  },
  patch: function(...args) {
    return this.$http.patch(...args).then(function({data}) {
      return data;
    })
  },
  statusAndDataFromException: function(e) {
    if (!e.response) {
      return {};
    }
    return {
      status: e.response.status,
      data: e.response.data
    }
  },
  executeAction: function(url, {method, data, params}) {
    return this.$http({method, url, data, params});
  }
} as ClientAdapter
