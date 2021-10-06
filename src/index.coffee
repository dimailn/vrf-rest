import camelCase from 'lodash.camelcase'
import cloneDeep from 'lodash.clonedeep'
import pluralize from 'pluralize'
import {decamelize} from 'humps'
import serializeDates from 'rails-serialize-dates'
import parseDates     from 'rails-parse-dates'
import urljoin from 'url-join'
import clientAdapters from './client-adapters'


export default (
  {
    showErrorMessage = console.error
    showSuccessMessage = console.log
    baseUrl = '/'
    idFromRoute = (form) -> form.$route.params.id
    redirectTo = (path, form) -> form.$router.push(path)
    client = 'axios'
    clientAdapter = clientAdapters[client]
    useJsonPostfix = true
  } = {}
) -> class VrfRest
  # We can always generate a request for REST
  @accepts: ({name, namespace, api}) -> true

  isSingleResource: ->
    @form.single

  constructor: (@name, @form) ->
    @errors = {}

  rfId: ->
    @form.resource?.id || @form.rfId

  id: ->
    if @form.implicit
      idFromRoute(@form)
    else
      @rfId()

  isNew: ->
    return false if @isSingleResource()

    !@id()

  clientAdapterInstance: ->
    clientAdapterContext = {
      $http: @form.$http
    }

    Object.keys(clientAdapter).reduce(
      (clientAdapterWithContext, method) ->
        clientAdapterWithContext[method] = clientAdapter[method].bind(clientAdapterContext)
        clientAdapterWithContext
      {}
    )

  load: (id) ->
    return Promise.resolve(@form.$resource) if !id && @isNew()

    id ||= @id()

    @clientAdapterInstance().get(@resourceUrlWithJson(id)).then((body) => @transformPlain body)

  loadSources: (names) ->
    # TODO: implement batching

    sources = await Promise.all(
      names.map((name) => [name, await @loadSource(name)])
    )

    sources.reduce(
      (index, [name, source]) =>
        index[name] = source
        index
      {}
    )


  loadSource: (name) ->
    name = decamelize(name)

    sourceUrl = urljoin(baseUrl, name)
    sourceUrl += ".json" if useJsonPostfix

    @clientAdapterInstance().get(sourceUrl).then((body) => body.map(@transformPlain))

  resourceName: ->
    camelCase @name.split("::")[0]

  baseUrlWithNamespace: ->
    return baseUrl unless @form.namespace

    urljoin(baseUrl, @form.namespace)

  resourceUrl: (id = @id()) ->
    urljoin(
      @baseUrlWithNamespace()

      if @isSingleResource()
        @_resourceName()
      else
        urljoin(@_resourcesName(), id.toString())
    )

  resourceUrlWithJson: (id = @id()) ->
    return @resourceUrl(id) unless useJsonPostfix

    @resourceUrl(id) + '.json'

  collectionUrl: ->
    collectionUrl = urljoin(
      @baseUrlWithNamespace()
      @_resourcesName()
    )
    return collectionUrl unless useJsonPostfix

    collectionUrl + '.json'

  _resourcesName: ->
    pluralize @_resourceName()

  _resourceName: ->
    decamelize @name.split("::")[0]

  save: ->
    try
      resource = @transformResource(@form.preserialize())
      body           = "#{(@form.rootName || decamelize(@name))}": resource

      if @isNew()
        {id} = await @clientAdapterInstance().post(@collectionUrl(), body)

        if @form.implicit
          redirectTo("/#{@_resourcesName()}/#{id}", @form)
        else
          unless @form.noFetch
            resource = await @load(id)
            @form.setSyncProp 'resource', resource
      else
        await @clientAdapterInstance().patch(@resourceUrlWithJson(), body)

        unless @form.noFetch
          resource = await @load(id)
          @form.setSyncProp 'resource', resource

      return [true, null]
    catch e
      {status, data} = @clientAdapterInstance().statusAndDataFromException(e)
      if status
        return [false, @handleErrors(data?.errors || ["HTTP error #{status}"])]
      else
        throw e

  transformResource: (resource) -> serializeDates(resource)

  transformPlain: (object) -> parseDates(object)

  showErrorMessage: (errors) ->
    showErrorMessage(errors.join(";"))

  handleErrors: (errors) ->
    errorsHash = {}
    baseErrors = []

    if Array.isArray(errors)
      @showErrorMessage(errors)
      return errorsHash

    for field, error of errors
      if field is 'base' then baseErrors.push error

      @form.$set errorsHash, field, [] unless errorsHash[field]?
      errorsHash[field].push error[0]

    @showErrorMessage(baseErrors) if baseErrors.length

    errorsHash

  executeAction: (name, {params, data, method, url}) ->
    actionUrl = @resourceUrl()

    postfix = url || name

    actionUrl = urljoin(actionUrl, decamelize(postfix)) if postfix

    @clientAdapterInstance().executeAction(actionUrl, {method, data, params})
      .then(
        ({status, data}) =>
          showSuccessMessage(data.$message) if data?.$message
          {status, data}
      )
      .catch(
        (e) =>
          {status, data} = @clientAdapterInstance().statusAndDataFromException(e)

          showErrorMessage(data.$message) if data?.$message

          Promise.reject({status, data})
      )


