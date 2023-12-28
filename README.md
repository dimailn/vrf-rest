[![Node.js CI](https://github.com/dimailn/vrf-rest/actions/workflows/node.js.yml/badge.svg)](https://github.com/dimailn/vrf-rest/actions/workflows/node.js.yml)


# vrf-rest

REST API for [vrf](https://github.com/dimailn/vrf).

It implements REST contract for resource, for example

```vue
<rf-form
  name="Todo"
  auto 
/>
```

For this form vrf-rest uses following http requests:

```GET /todos/:id``` - on load

```POST /todos``` - on create

```PATCH /todos/:id``` - on update


Id may be calculated through the url using ```idFromRoute``` vrf helper, or passed directly using ```rf-id``` prop.

For the form in single mode

```vue
<rf-form
  name="Todo"
  single
  auto 
/>
```

It serves like that:


```GET /todos``` - on load

```PATCH /todos``` - on update


Sometimes you need to execute action on resource without getting data, for this purpose you may use action mode:

```vue
<rf-form
  name="Todo#addComment"
  :rf-id="1"
  auto 
>
  <rf-input name="message" />
  <rf-submit />
</rf-form>
```

This form sends ```POST``` request to ```/todos/1/add_comment```. 


If a form contains files ```vrf-rest``` uses multiplaylod format which allows to send files and keep data types of other form elements at the same time. Example of a mixin for rails controller to support the format


```ruby

module MultipayloadController
  def params
    ActionController::Parameters.new(JSON.parse(super[:_json] || '{}').deep_merge(super.except(:_json)))
  end
end

```





