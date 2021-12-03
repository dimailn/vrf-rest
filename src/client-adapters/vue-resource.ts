import {ClientAdapter} from './types'

export default {
  get: function(...args) {
    return this.$http.get(...args).then(function({body}) {
      return body;
    }).promise
  },
  post: function(...args) {
    return this.$http.post(...args).then(function({body}) {
      return body;
    }).promise
  },
  patch: function(...args) {
    return this.$http.patch(...args).then(function({body}) {
      return body;
    }).promise
  },
  statusAndDataFromException: function(e) {
    return {
      status: e.status,
      data: e.body
    }
  }
} as ClientAdapter
