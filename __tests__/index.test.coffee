import VrfRest from '../src'
import axios from "axios"
import MockAdapter from "axios-mock-adapter"


mock = new MockAdapter(axios)

mock.onGet("/todos/1.json").reply(200,  { id: 1, title: 'Something' })
mock.onGet("/todos/2.json").reply(200,  { id: 2, title: 'Test' })
mock.onPost("/todos.json").reply((config) ->
  title = JSON.parse(config.data).todo.title
  return [
    200
    {
      id: 2
      title
    }
  ]
)

mock.onGet("/types.json").reply(200, [
  {
    id: 0,
    title: 'type 1'
  }
  {
    id: 1
    title: 'type 2'
  }
])

mock.onGet("/categories.json").reply(200, [
  {
    id: 1
    title: 'category 1'
  }
])

vrfRest = null
FormMock = {
  $http: axios
  name: 'Todo'
}

beforeEach ->
  VrfRestMiddleware = VrfRest(
    idFromRoute: -> 1
  )

  vrfRest = new VrfRestMiddleware('Todo', FormMock)


describe 'VrfRest', ->
  it 'loads data', ->
    resource = await vrfRest.load()

    expect(resource).toEqual({ id: 1, title: 'Something' })

  it 'loads sources', ->
    sources = await vrfRest.loadSources(['types', 'categories'])

    expect(sources.types.length).toBe 2
    expect(sources.categories.length).toBe 1

  it 'doesnt load data if new entity', ->
    VrfRestMiddleware = VrfRest(
      idFromRoute: -> null
    )

    getSpy = jest.spyOn(axios, 'get')

    CreateFormMock = {
      ...FormMock
      setSyncProp: jest.fn()
      $resource: {
        title: ''
      }
    }

    vrfRest = new VrfRestMiddleware('Todo', CreateFormMock)

    result = await vrfRest.load()

    expect(result).toBe(CreateFormMock.$resource)
    expect(CreateFormMock.setSyncProp).not.toBeCalled()
    expect(getSpy).not.toBeCalled()

  it 'creates resource', ->
    VrfRestMiddleware = VrfRest(
      idFromRoute: -> null
    )

    CreateFormMock = {
      ...FormMock
      preserialize: ->
        {
          title: 'Test'
        }
      setSyncProp: jest.fn()
    }

    vrfRest = new VrfRestMiddleware('Todo', CreateFormMock)

    await vrfRest.save()

    expect(CreateFormMock.setSyncProp).toBeCalledWith('resource', {id: 2, title: 'Test'})

  it 'updates resource', ->
    VrfRestMiddleware = VrfRest(
      idFromRoute: -> 1
    )

    CreateFormMock = {
      ...FormMock
      resource: {
        id: 1
        title: 'Test2'
      }
      preserialize: -> @resource
      setSyncProp: jest.fn()
    }

    vrfRest = new VrfRestMiddleware('Todo', CreateFormMock)

    mock.onGet("/todos/1.json").reply(200,  { id: 1, title: 'Test2' })
    mock.onPatch("/todos/1.json").reply(200,  { id: 1, title: 'Test2' })


    await vrfRest.save()

    expect(CreateFormMock.setSyncProp).toBeCalledWith('resource', {id: 1, title: 'Test2'})

  it 'handles errors', ->
    VrfRestMiddleware = VrfRest(
      idFromRoute: -> 1
    )

    CreateFormMock = {
      ...FormMock
      resource: {
        id: 1
        title: 'Test2'
      }
      preserialize: -> @resource
      setSyncProp: jest.fn()
      $set: (obj, field, value) -> obj[field] = value
    }

    vrfRest = new VrfRestMiddleware('Todo', CreateFormMock)

    mock.onGet("/todos/1.json").reply(200,  { id: 1, title: 'Test2' })
    mock.onPatch("/todos/1.json").reply(422,  errors: { title: ['Is incorrect'] })


    [ok, errors] = await vrfRest.save()

    expect(ok).toBe false
    expect(errors).toEqual(title: ['Is incorrect'])


