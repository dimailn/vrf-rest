interface StatusAndData {
  status: number
  data: any
  statusHandle: string
}


export type Id = string | number

export interface ClientAdapter {
  get: (...args) => Promise<any>
  post: (...args) => Promise<{id: Id}>
  patch: (...args) => Promise<object>
  statusesAndDataFromException: (e) => StatusAndData
  executeAction: (url, {method, data, params}) => Promise<any>
}