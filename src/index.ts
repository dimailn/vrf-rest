import {
  decamelize,
  decamelizeKeys
} from 'humps';

import urljoin from 'url-join'

import clientAdapters from './client-adapters'
import {ClientAdapter, Id} from './client-adapters/types'


import {Effect} from 'vrf'

import RecursiveIterator from 'recursive-iterator'

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


const pathToFormDataKey = (path) => path.reduce((str, el, i) => {
  if(i === 0){
    return el
  }

  if(typeof el === 'string'){
    return str + `[${el}]`
  }

  if(typeof el === 'number'){
    return str + '[]'
  }

  throw 'Unknown path element type'
}, "")


export default (
  {
    baseUrl = '',
    client = 'axios',
    clientAdapter = clientAdapters[client],
    useJsonPostfix = true,
    extractErrors = (data) => data?.errors,
    useFormDataAlways = false,
    noWrapResource = false
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
      onSave,
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

      const resourceUrl = (id: string | number) => {
        if (!isSingleResource() && !id && !isAction()) {
          throw '[vrf-rest] For non-single resource you should specify id'
        }

        return urljoin(
          baseUrlWithNamespace(),
          isSingleResource() ? urlResourceName() : urljoin(urlResourceCollectionName(), id.toString())
        )
      }

      const withJson = (url) => useJsonPostfix ? `${url}.json` : url

      const resourceUrlWithJson = (id: string | number) => withJson(resourceUrl(id))

      const collectionUrl = () => withJson(
        urljoin(baseUrlWithNamespace(), urlResourceCollectionName())
      )

      const actionUrl = () => {
        const { name, single,  rfId } = form
        const [basePath, actionPath] = name.split('#').map(decamelize)
        const id = single ? null : rfId

        return withJson(urljoin(
          [
            baseUrlWithNamespace(),
            basePath,
            id,
            actionPath
          ]
            .filter(Boolean)
            .map(String)
        ))
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
          errorsHash[field] = [
            ...new Set(errorsHash[field].concat(typeof error === 'string' ? [error] : error))
          ]
        }
        if (baseErrors.length) {
          concatAndShowErrorMessage(baseErrors)
        }
        return errorsHash
      }

      const isSingleResource = () => form.single

      const isAction = () => form.name.includes("#")

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
          let body : any = noWrapResource ? resource : {
            [`${form.rootName || decamelize(form.name.split("#")[0])}`]: resource
          }

          if(useFormDataAlways || objectContains(resource, (_, value) => value instanceof File)){
            const formData = new FormData()
            const iterator = new RecursiveIterator(body)

            for(let {node, path} of iterator){
              const key = path[path.length - 1]

              if(node instanceof File) {
                formData.append(pathToFormDataKey(path), node)
              }
            }

            formData.append("_json", JSON.stringify(decamelizeKeys(body), (key, value) => {
              if(value instanceof File || value instanceof Blob){
                return
              }

              return value
            }))

            return [true, await saver(formData)]
          }

          return [true, await saver(body)]
        } catch (e) {
          const {status, data} = clientAdapterInstance().statusesAndDataFromException(e)
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

        if(isAction()) {
          return Promise.resolve(form.$resource)
        }

        return clientAdapterInstance().get(resourceUrlWithJson(id))
      })

      onSave((resource) => {
        if(!isAction()){
          return undefined
        }

        return aroundSave<Object>(resource, async (body: object) => {
          return await clientAdapterInstance().post(actionUrl(), body)
        })
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

        return clientAdapterInstance().executeAction(actionUrl, {method, data, params})
          .then(({status, data, statusHandle}) => {
            if (data && data.$message) {
              showSuccessMessage(data.$message)
            }
            return {status, data, statusHandle}
          }).catch((e) => {
            const {status, data, statusHandle} = clientAdapterInstance().statusesAndDataFromException(e)
            if (data != null ? data.$message : void 0) {
              showErrorMessage(data.$message);
            }
            return {status, data, statusHandle}
          })
        })
    }
  }
}
