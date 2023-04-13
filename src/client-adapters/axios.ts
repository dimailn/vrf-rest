import {ClientAdapter} from './types'
import mapStatus from '../map-status'

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
  statusesAndDataFromException(e) {
    if(e.toJSON().message === 'Network Error') {
      return {
        status: undefined,
        data: undefined,
        statusHandle: 'NETWORK_FAILURE'
      }
    }

    if (!e.response) {
      return {}
    }

    return {
      status: e.response.status,
      data: e.response.data,
      statusHandle: mapStatus(e.response.status)
    }
  },
  executeAction: function(url, {method, data, params}) {
    return this.$http({method, url, data, params}).then((response) => ({...response, statusHandle: 'SUCCESSFUL'}))
  }
} as ClientAdapter
