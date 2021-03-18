VrfRest = require '../src'
axios = require "axios"
MockAdapter = require "axios-mock-adapter"


mock = new MockAdapter(axios)

mock.onGet("/todos/1.json").reply(200,  { id: 1, title: 'Something' })
mock.onGet("/todos/2.json").reply(200,  { id: 2, title: 'Test' })
mock.onPost("/todos.json").reply((config) ->
  console.log config
  title = JSON.parse(config.data).todo.title
  return [
    200
    {
      id: 2
      title
    }
  ]
)


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

  it 'creates resource', ->
    VrfRestMiddleware = VrfRest(
      idFromRoute: -> null
    )

    setSyncProp = jest.fn()

    CreateFormMock = {
      ...FormMock
      preserialize: ->
        {
          title: 'Test'
        }
      setSyncProp
    }

    vrfRest = new VrfRestMiddleware('Todo', CreateFormMock)

    await vrfRest.save()

    expect(setSyncProp).toBeCalledWith('resource', {id: 2, title: 'Test'})

  it 'updates resource', ->
    VrfRestMiddleware = VrfRest(
      idFromRoute: -> 1
    )

    setSyncProp = jest.fn()

    resource = {
      id: 1
      title: 'Test2'
    }

    CreateFormMock = {
      ...FormMock
      resource
      preserialize: -> resource
      setSyncProp
    }

    vrfRest = new VrfRestMiddleware('Todo', CreateFormMock)

    mock.onGet("/todos/1.json").reply(200,  { id: 1, title: 'Test2' })
    mock.onPatch("/todos/1.json").reply(200,  { id: 1, title: 'Test2' })


    resource = await vrfRest.save()

    expect(setSyncProp).toBeCalledWith('resource', {id: 1, title: 'Test2'})


