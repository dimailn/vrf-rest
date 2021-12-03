import {
  decamelize
} from 'humps';

import serializeDates from 'rails-serialize-dates'

import parseDates from 'rails-parse-dates'

import urljoin from 'url-join'

import clientAdapters from './client-adapters'
import {ClientAdapter, Id} from './client-adapters/types'


import {Effect} from 'vrf'

export default (
  {
    baseUrl = '/', 
    idFromRoute = (form) => form.$route.params.id,
    client = 'axios',
    clientAdapter = clientAdapters[client],
    useJsonPostfix = true
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

      const transformResource = (resource) => serializeDates(resource)
  
      const transformPlain = (object) => parseDates(object)

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
        return clientAdapterInstance().get(sourceUrl).then((body: Array<any>) => {
          return body.map(transformPlain)
        })
      }

      const aroundSave = async <T>(saver: (body: object) => Promise<T>) : Promise<[boolean, any]> => {
        try {
          const resource = transformResource(form.preserialize())
          const body = {
            [`${form.rootName || decamelize(form.name)}`]: resource
          }

          return [true, await saver(body)]
        } catch (e) {
          const {status, data} = clientAdapterInstance().statusAndDataFromException(e)
          if (status) {
            return [false, handleErrors(data?.errors || [`HTTP error ${status}`])]
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
    
        return clientAdapterInstance().get(resourceUrlWithJson(id)).then((body) => {
          return transformPlain(body);
        })
      })

      onCreate(async () => {
        return aroundSave<Id>(async (body: object) => {
          const {id} = await clientAdapterInstance().post(collectionUrl(), body)

          return id
        })
      })

      onUpdate(async () => {
        return aroundSave<object>(async (body: object) => {
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