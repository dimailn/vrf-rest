
export default (status) => {
  if (status >= 200 && status < 300) {
    return 'SUCCESSFUL'
  } else if (status === 422 || status === 429) {
    return 'SOFT_FAILURE'
  } else if (status >= 500) {
    return 'SERVER_FAILURE'
  } else {
    return 'OTHER_FAILURE'
  }
}
