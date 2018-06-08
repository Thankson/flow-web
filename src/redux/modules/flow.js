import { handleActions } from 'redux-actions'
import { Map, OrderedMap, fromJS } from 'immutable'
import is from 'util/is'

import polling from 'polling'

import { handleHttp } from 'redux/util'
import { handleHttpActions } from 'redux-http'
import { defaultInitState, handlers } from 'redux/handler'

import Types from './flowType'
import JobTypes from './jobType'
import { generatorJobId } from './job'

/**
 * {
 *   status: { flowId: 'string' },
 *    yml: { flowId: 'string' },
 * }
 */
const initialState = defaultInitState.set('status', new Map())
  .set('yml', new Map())
  .set('editEnvs', new Map())

/**
 * 后端以 name 为 flow 的唯一标识，为统一将 name 值转至 id 字段
 * @param {object or array} data
 */
const transformResponse = function (data) {
  if (is.array(data)) {
    data.forEach((d) => {
      d.id = d.name
    })
  } else if (is.object(data) && data.name) {
    data.id = data.name
  }
  return data
}

function notifyLoadYml (flowId) {
  return {
    url: '/flows/:flowName/yml/load',
    params: {
      flowName: flowId,
    },
    name: Types.loadYml,
    transformResponse,
  }
}

function pollingTestResult (flowId) {
  const finishStatus = [
    'GIT_LOADING',
    'GIT_LOADED',
    'ERROR',
    'FOUND',
    'NOT_FOUND'
  ]
  return function (dispatch, getState) {
    function get () {
      return dispatch({
        url: '/flows/:flowName/env',
        name: Types.pollingEnv,
        params: {
          flowName: flowId,
        },
        indicator: {
          id: flowId,
        }
      })
    }
    function check (response) {
      const envs = response.data
      return finishStatus.includes(envs.FLOW_YML_STATUS)
    }
    return polling(get, check)
  }
}

function getCreateEnv (params) {
  const {
    type,
    source, url,
    deploy, username,
    password
  } = params
  const env = {
    FLOW_GIT_SOURCE: source,
    FLOW_GIT_URL: url,
  }

  if (type === 'SSH') {
    env.FLOW_GIT_CREDENTIAL = deploy
  } else if (type === 'HTTP') {
    env.FLOW_GIT_HTTP_USER = username
    env.FLOW_GIT_HTTP_PASS = password
  }
  return env
}

export const actions = {
  query: function () {
    return {
      url: '/flows',
      name: Types.query,
      transformResponse,
    }
  },
  get: function (flowId) {
    return {
      url: '/flows/:flowName',
      name: Types.get,
      transformResponse,
      params: {
        flowName: flowId,
      },
      indicator: {
        id: flowId,
      }
    }
  },
  create: function (flowId) {
    return {
      url: '/flows/:flowName',
      method: 'post',
      name: Types.create,
      params: {
        flowName: flowId,
      },
      indicator: {
        id: flowId,
      },
      transformResponse,
    }
  },
  changeStatus: function (flowId, status) {
    return {
      url: '/flows/:flowName/status/:status',
      method: 'patch',
      name: Types.changeStatus,
      params: {
        flowName: flowId,
        status
      },
      indicator: {
        id: flowId
      },
      transformResponse,
    }
  },
  remove: function (flowId) {
    return {
      url: '/flows/:flowName',
      method: 'delete',
      name: Types.remove,
      params: {
        flowName: flowId,
      },
      indicator: {
        id: flowId,
      },
      transformResponse,
    }
  },
  updateEnv: function (flowId, env) {
    return {
      url: '/flows/:flowName/env',
      name: Types.updateEnv,
      method: 'patch',
      params: {
        flowName: flowId,
        ...env,
      },
      indicator: {
        id: flowId,
      },
      transformResponse,
    }
  },
  removeEnv: function (flowId, envNames) {
    return {
      url: `/flows/${flowId}/env`,
      name: Types.updateEnv,
      method: 'delete',
      data: envNames,
      indicator: {
        id: flowId,
      },
      transformResponse,
    }
  },
  /**
   * see getCreateEnv params
   */
  doneCreate: function (flowId, params) {
    return actions.updateEnv(flowId, {
      ...getCreateEnv(params)
    })
  },
  doCreateTest: function (flowId, params) {
    return async function (dispatch) {
      await dispatch(actions.updateEnv(flowId, getCreateEnv(params)))
      await dispatch(notifyLoadYml(flowId))
    }
  },
  getTestResult: pollingTestResult,

  setTrigger: function (flowId, trigger) {
    return {
      url: '/flows/:flowName/trigger',
      method: 'post',
      name: Types.updateTrigger,
      params: {
        flowName: flowId,
        ...trigger,
      },
      transformResponse,
    }
  },

  getEditEnvs: function (flowId) {
    return {
      url: '/flows/:flowName/env?editable=true',
      params: {
        flowName: flowId,
      },
      name: Types.getEditEnvs,
      indicator: {
        flowId,
      }
    }
  },
  saveEditEnvs: function (flowId, envs) {
    return {
      url: `/flows/${flowId}/env?verify=true`,
      method: 'post',
      params: envs,
      name: Types.saveEditEnvs,
      indicator: {
        flowId,
        envs: envs,
      }
    }
  },
  removeEditEnvs: function (flowId, name) {
    return {
      url: `/flows/${flowId}/env?verify=true`,
      method: 'delete',
      data: [name],
      name: Types.removeEditEnvs,
      indicator: {
        flowId,
        name
      }
    }
  },
  getYml: function (flowId) {
    return {
      url: '/flows/:flowName/yml',
      params: {
        flowName: flowId,
      },
      name: Types.getYml,
      indicator: {
        flowId,
      }
    }
  },
  saveYml: function (flowId, ymlStr) {
    return {
      url: `/flows/${flowId}/yml`,
      method: 'post',
      data: ymlStr,
      name: Types.saveYml,
      indicator: {
        flowId,
      }
    }
  },
  freedYml: function (flowId) {
    return {
      type: Types.freedYml,
      indicator: { flowId }
    }
  },
  setFilter: function (filter) {
    return {
      type: Types.setFilter,
      payload: filter,
    }
  },
  freedFilter: function () {
    return {
      type: Types.freedFilter,
    }
  },
  freed: function (flowId) {
    return {
      type: Types.freed,
      id: flowId,
    }
  },
}

export default handleActions({
  [Types.query]: handleHttp('QUERY', {
    success: handlers.saveAll,
  }),
  [Types.get]: handleHttp('GET', {
    success: handlers.saveData,
  }),
  [Types.create]: handleHttp('GET', {
    success: handlers.save,
  }),
  [Types.remove]: handleHttp('REMOVE', {
    success: handlers.remove,
  }),
  [Types.updateEnv]: handleHttp('UPDATE', {
    success: handlers.saveData,
  }),

  [Types.loadYml]: handleHttpActions({
    success: handlers.saveData,
  }),
  [Types.pollingEnv]: handleHttpActions({
    success: function (state, { indicator: { id }, payload: envs }) {
      return handlers.saveData(state, { payload: { id, envs } })
    },
  }),

  [Types.updateTrigger]: handleHttpActions({
    success: handlers.saveData,
  }),
  [Types.getYml]: handleHttpActions({
    success: function (state, { indicator, payload }) {
      const { flowId } = indicator
      return state.setIn(['yml', flowId], payload || '')
    }
  }),
  [Types.saveYml]: handleHttpActions({
    success: function (state, { indicator, payload }) {
      const { flowId } = indicator
      return state.setIn(['yml', flowId], payload || '')
    }
  }),
  [Types.freedYml]: function (state, { indicator: { flowId } }) {
    return state.update('yml', (yml) => {
      return yml.remove(flowId)
    })
  },
  [Types.getEditEnvs]: handleHttp('GET_EDIT_ENVS', {
    success: function (state, { indicator, payload }) {
      const { flowId } = indicator
      return state.updateIn(['editEnvs', flowId], (envs) => {
        return envs ? envs.merge(payload) : new OrderedMap(payload)
      })
    }
  }),
  [Types.saveEditEnvs]: handleHttp('SAVE_EDIT_ENVS', {
    success: function (state, { indicator }) {
      const { flowId, envs: payload } = indicator
      return state.updateIn(['editEnvs', flowId], (envs) => {
        const keys = Object.keys(payload)
        let nextEnvs = envs
        let top = {}
        keys.forEach((key) => {
          if (envs.has(key)) {
            nextEnvs = nextEnvs.set(key, payload[key])
          } else {
            top[key] = payload[key]
          }
          return top
        })
        const topOrderedMap = new OrderedMap(top)
        return topOrderedMap.merge(nextEnvs)
      })
    }
  }),
  [Types.removeEditEnvs]: handleHttp('REMOVE_EDIT_ENVS', {
    success: function (state, { indicator, payload }) {
      const { flowId, name } = indicator
      return state.updateIn(['editEnvs', flowId], (envs) => {
        return envs ? envs.delete(name) : envs
      })
    }
  }),
  // UI
  [Types.setFilter]: function (state, { payload }) {
    return state.update('ui', (ui) => ui.set('filter', payload))
  },
  [Types.freedFilter]: function (state) {
    return state.update('ui', (ui) => ui.delete('filter'))
  },
  [Types.freedAll]: function (state) {
    return initialState
  },

  // Job Type
  [JobTypes.queryLatest]: handleHttp('QUERY_LAST_JOBS', {
    success: function (state, { payload: jobs }) {
      const f = jobs.reduce((s, job) => {
        job.id = generatorJobId(job.name, job.key.number)
        s[job.name] = job
        return s
      }, {})
      return state.set('status', fromJS(f))
    }
  }),
}, initialState)
