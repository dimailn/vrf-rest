module.exports = {
  get: (args...) ->
    this.$http.get(args...).then(({data}) -> data)
  post: (args...) ->
    this.$http.post(args...).then(({data}) -> data)
  patch: (args...) ->
    this.$http.patch(args...).then(({data}) -> data)
}
