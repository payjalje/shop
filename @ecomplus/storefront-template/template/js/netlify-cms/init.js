import * as merge from 'lodash.merge'
import axios from 'axios'
import getBaseConfig from './base-config/'
import './pages-preview'

const initCms = config => {
  const identityUrl = config.backend.identity_url
  if (identityUrl && window.netlifyIdentity) {
    const fixGotrueApi = () => {
      const { api } = window.netlifyIdentity.gotrue
      api.apiURL = identityUrl
      api._sameOrigin = identityUrl.includes(window.location.host)
    }
    if (document.readyState !== 'loading') {
      fixGotrueApi()
    }
    document.addEventListener('DOMContentLoaded', fixGotrueApi)
  }
  window.CMS.init({ config })
}

export default (customConfig, options) => new Promise(resolve => {
  let config = merge(getBaseConfig(options), customConfig)

  axios.get('/admin/config.json')
    .then(({ data }) => {
      if (typeof data === 'object' && data) {
        if (Array.isArray(data.collections)) {
          const upsertFields = (config, data, prop) => {
            data[prop].forEach(obj => {
              const originalObj = config[prop].find(({ name }) => name === obj.name)
              if (originalObj) {
                if (Array.isArray(originalObj.files)) {
                  if (Array.isArray(obj.files)) {
                    upsertFields(originalObj, obj, 'files')
                  }
                } else if (Array.isArray(obj.fields)) {
                  upsertFields(originalObj, obj, 'fields')
                }
                Object.assign(originalObj, obj)
              } else {
                config[prop].push(obj)
              }
            })
            delete data[prop]
          }
          upsertFields(config, data, 'collections')
        }
        config = merge(config, data)
      }
    })

    .catch(() => console.log('No custom config file at /admin/config.json'))
    .finally(() => {
      initCms(config)
      resolve(config)
    })
})
