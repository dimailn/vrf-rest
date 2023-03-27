import vrfRest from '../src'
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



getEffectWrapper = (formFields = {}) ->
    form = {
      $http: axios
      name: 'Todo'
      ...formFields
    }
    listeners = {}
    context = {
      ...([
        'onLoadSources'
        'onLoadSource'
        'onLoad'
        'onCreate'
        'onUpdate'
        'onExecuteAction'
        'onSave'
      ].reduce(
        (subscribers, name) =>
          subscribers[name] = (listener) -> listeners[name] = listener
          subscribers
        {}
      ))
      showMessage: () =>
      form
      strings: {
        urlResourceName: () => 'todo'
        urlResourceCollectionName: () => 'todos'
      }
    }

    {
      instance: vrfRest().effect(context)
      listeners
    }

describe 'VrfRest', ->
  it 'loads data', ->
    wrapper = getEffectWrapper()

    resource = await wrapper.listeners.onLoad(1)

    expect(resource).toEqual({ id: 1, title: 'Something' })

  it 'loads sources', ->
    wrapper = getEffectWrapper()

    sources = await wrapper.listeners.onLoadSources(['types', 'categories'])

    expect(sources.types.length).toBe 2
    expect(sources.categories.length).toBe 1


  it 'creates resource', ->
    wrapper = getEffectWrapper()

    id = await wrapper.listeners.onCreate({title: 'Test'})

    expect(id).toEqual([true, 2])


  it 'updates resource', ->
    wrapper = getEffectWrapper(resourceId: -> 1)

    mock.onGet("/todos/1.json").reply(200,  { id: 1, title: 'Test2' })
    mock.onPatch("/todos/1.json").reply(200,  { id: 1, title: 'Test2' })


    result = await wrapper.listeners.onUpdate(
      {
        id: 1
        title: 'Test2'
      }
    )

    expect(result).toEqual([ true, { id: 1, title: 'Test2' } ])
  it 'handles errors', ->
    wrapper = getEffectWrapper(
      resourceId: -> 1
      $set: (object, name, value) -> object[name] = value
    )

    mock.onGet("/todos/1.json").reply(200,  { id: 1, title: 'Test2' })
    mock.onPatch("/todos/1.json").reply(422,  errors: { title: ['Is incorrect'] })

    [ok, errors] = await wrapper.listeners.onUpdate({
      id: 1
      title: 'Test2'
    })

    expect(ok).toBe false
    expect(errors).toEqual(title: ['Is incorrect'])


