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
    showErrorMessage
    baseUrl = '/'
    idFromRoute = (form) -> form.$route.params.id
    client = 'axios'
    clientAdapter = clientAdapters[client]
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
    @rfId() || idFromRoute(@form)

  isNew: ->
    return false if @isSingleResource()

    if @form.implicit
      ///#{decamelize pluralize @name.split("::")[0]}\/new///.test(location.pathname)
    else
      !@rfId()

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
    @clientAdapterInstance().get(@resourceUrl(id)).then((body) => @transformPlain body)

  loadSources: ->
    # TODO: implement
    Promise.resolve()

  resourceName: ->
    camelCase @name.split("::")[0]

  baseUrlWithNamespace: ->
    return baseUrl unless @form.namespace

    urljoin(baseUrl, @form.namespace)

  resourceUrl: (id = @id()) ->
    urljoin(
      @baseUrlWithNamespace()

      if @isSingleResource()
        @_resourcesName()
      else
        urljoin(@_resourcesName(), id.toString())
    ) + '.json'

  collectionUrl: ->
    urljoin(
      @baseUrlWithNamespace()
      @_resourcesName()
    ) + '.json'

  _resourcesName: ->
    pluralize decamelize @name.split("::")[0]

  save: ->
    try
      resource = @transformResource(@form.preserialize())
      body           = "#{(@form.rootName || decamelize(@name))}": resource

      if @isNew()
        {id} = await @clientAdapterInstance().post(@collectionUrl(), body)

        if @implicit
          @form.router.push("/#{@_resourcesName()}/#{id}")
        else
          unless @form.noFetch
            resource = await @load(id)
            @form.setSyncProp 'resource', resource
      else
        await @clientAdapterInstance().patch(@resourceUrl(), body)

        unless @form.noFetch
          resource = await @load(id)
          @form.setSyncProp 'resource', resource

      return [true, null]
    catch e
      if e.status
        return [false, @handleErrors(e.body.errors)]
      else
        throw e

  transformResource: (resource) -> serializeDates(resource)

  transformPlain: (object) -> parseDates(object)

  showErrorMessage: (errors) ->
    if showErrorMessage?
      showErrorMessage(errors)
    else
      console.error(errors)

  handleErrors: (errors) ->
    errorsHash = {}
    baseErrors = []

    if Array.isArray(errors)
      @showErrorMessage(errors)
      return errorsHash

    for field, error of errors
      if field is 'base' then baseErrors.push error

      @form.$set $errors, field, [] unless $errorsHash[field]?
      $errorsHash[field].push error[0]

    @showErrorMessage(baseErrors) if baseErrors.length

    errorsHash
