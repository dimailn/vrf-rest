module.exports = {
  get: (args...) ->
    this.$http.get(args...).then(({body}) -> body)
  post: (args...) ->
    this.$http.post(args...).then(({body}) -> body)
  patch: (args...) ->
    this.$http.patch(args...).then(({body}) -> body)

  statusAndDataFromException: (e) ->
    {
      status: e.status
      data: e.body
    }
}
