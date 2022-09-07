import {
  decamelize,
  decamelizeKeys
} from 'humps';

import urljoin from 'url-join'

import clientAdapters from './client-adapters'
import {ClientAdapter, Id} from './client-adapters/types'


import {Effect} from 'vrf'

import {serialize} from 'object-to-formdata'

function objectContains(obj, predicate) {
  const isObject = val =>
    val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date) && !(val instanceof File);

  const contains = (obj = {}) => {
    for (let pair of Object.entries(obj)) {
      const [key, value] = pair

      if(value instanceof Array){
        for(let object of value){
          if(contains(object)){
            return true
          }
        }
      }

      else if(isObject(value)){
        if(contains(value)){
          return true
        }
      }

      else if(predicate(key, value)){
        return true
      }

    }

    return false
  }

  return contains(obj)
}

export default (
  {
    baseUrl = '',
    client = 'axios',
    clientAdapter = clientAdapters[client],
    useJsonPostfix = true,
    extractErrors = (data) => data?.errors,
    useFormDataAlways = false
  } = {}
) : Effect => {
  return {
    name: 'rest',
    api: true,
    effect({
      form,
      onLoad,
      onCreate,
      onUpdate,
      onLoadSource,
      onLoadSources,
      onExecuteAction,
      showMessage,
      strings: {
        urlResourceName,
        urlResourceCollectionName
      }
    }){
      const showErrorMessage = (text: string) => showMessage({
        type: 'error',
        text
      })

      const showSuccessMessage = (text: string) => showMessage({
        type: 'error',
        text
      })

      const baseUrlWithNamespace = () => form.namespace ? urljoin(baseUrl, form.namespace) : baseUrl

      const resourceUrl = (id: string | number) => urljoin(
        baseUrlWithNamespace(),
        isSingleResource() ? urlResourceName() : urljoin(urlResourceCollectionName(), id.toString())
      )

      const resourceUrlWithJson = (id: string | number) => useJsonPostfix ? resourceUrl(id) + '.json' : resourceUrl(id)

      const collectionUrl = () => {
        const collectionUrl = urljoin(baseUrlWithNamespace(), urlResourceCollectionName())
        if (!useJsonPostfix) {
          return collectionUrl
        }
        return collectionUrl + '.json'
      }

      const concatAndShowErrorMessage = (errors) => showErrorMessage(errors.join(";"))

      const clientAdapterInstance = () => {
        const clientAdapterContext = {
          $http: form.$http
        }
        return Object.keys(clientAdapter).reduce(function(clientAdapterWithContext, method) {
          clientAdapterWithContext[method] = clientAdapter[method].bind(clientAdapterContext);
          return clientAdapterWithContext
        }, {} as ClientAdapter)
      }

      const handleErrors = (errors) => {
        const errorsHash = {}
        const baseErrors = []

        if (Array.isArray(errors)) {
          concatAndShowErrorMessage(errors)
          return errorsHash;
        }

        for (let field in errors) {
          const error = errors[field]
          if (field === 'base') {
            baseErrors.push(error)
          }
          if (errorsHash[field] == null) {
            form.$set(errorsHash, field, [])
          }
          errorsHash[field].push(error[0])
        }
        if (baseErrors.length) {
          concatAndShowErrorMessage(baseErrors)
        }
        return errorsHash
      }

      const isSingleResource = () => form.single

      const loadSource = (name) => {
        name = decamelize(name)
        let sourceUrl = urljoin(baseUrl, name)

        if (useJsonPostfix) {
          sourceUrl += ".json"
        }
        return clientAdapterInstance().get(sourceUrl)
      }

      const aroundSave = async <T>(resource: object, saver: (body: object) => Promise<T>) : Promise<[boolean, any]> => {
        try {
          let body : any = {
            [`${form.rootName || decamelize(form.name)}`]: resource
          }

          if(useFormDataAlways || objectContains(resource, (_, value) => value instanceof File)){
            body = serialize(decamelizeKeys(body))
          }

          return [true, await saver(body)]
        } catch (e) {
          const {status, data} = clientAdapterInstance().statusAndDataFromException(e)
          if (status) {
            return [false, handleErrors(extractErrors(data) || [`HTTP error ${status}`])]
          } else {
            throw e
          }
        }
      }

      onLoadSource(loadSource)

      onLoadSources(async (names) => {
        const sources : Array<[string, Array<any>]> = await Promise.all(names.map(async(name: string) => [name, await loadSource(name)]))

        return sources.reduce((index, [name, source]) => {
          index[name] = source
          return index;
        }, {} as Record<string, Array<any>>)
      })

      onLoad((id) => {
        if (!id && form.isNew()) {
          return Promise.resolve({})
        }

        return clientAdapterInstance().get(resourceUrlWithJson(id))
      })

      onCreate(async (resource) => {
        return aroundSave<Id>(resource, async (body: object) => {
          const {id} = await clientAdapterInstance().post(collectionUrl(), body)

          return id
        })
      })

      onUpdate(async (resource) => {
        return aroundSave<object>(resource, async (body: object) => {
          return clientAdapterInstance().patch(resourceUrlWithJson(form.resourceId()), body)
        })
      })

      onExecuteAction((name, {params, data, method, url}) => {
        let actionUrl = resourceUrl(form.resourceId())
        const postfix = url || name

        if (postfix) {
          actionUrl = urljoin(actionUrl, decamelize(postfix))
        }

        return clientAdapterInstance().executeAction(actionUrl, {method, data, params}).then(({status, data}) => {
          if (data && data.$message) {
            showSuccessMessage(data.$message)
          }
          return {status, data}
        }).catch((e) => {
          const {status, data} = clientAdapterInstance().statusAndDataFromException(e)
          if (data != null ? data.$message : void 0) {
            showErrorMessage(data.$message);
          }
          return Promise.reject({status, data})
        })
      })
    }
  }
}
