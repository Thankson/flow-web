import { handleActions } from 'redux-actions'

import { handleHttp } from '../util'

import { fromJS } from 'immutable'

import Types from './agentType'

const initialState = fromJS({
  data: [],
  ui: {},
})

export const actions = {
  query: function () {
    return {
      url: '/agents',
      name: Types.query,
      // response: [],
      response: [{
        'path': {
          'zone': 'Mac',
          'name': 'Mini'
        },
        'flowName': 'xiaomi_ios_dev',
        'agentStatus': 'BUSY',
        'number': 10,
        'branch': 'master',
      }, {
        'path': {
          'zone': 'Mac',
          'name': 'Mini2'
        },
        'flowName': 'xiaomi_ios_dev',
        'agentStatus': 'BUSY',
        'number': 10,
        'branch': 'master',
      }],
    }
  },
}

export default handleActions({
  [Types.query]: handleHttp('query', {
    success: function (state, { payload }) {
      payload.forEach((agent) => {
        agent.id = agent.path.zone + agent.path.name
      })
      return state.set('data', fromJS(payload))
    },
  }),
  [Types.freedAll]: function (state) {
    return initialState
  }
}, initialState)
