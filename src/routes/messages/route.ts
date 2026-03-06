import { Hono } from 'hono'

import { forwardErrorAnthropic } from '~/lib/error'

import { handleCountTokens } from './count-tokens-handler'
import { handleCompletion } from './handler'

export const messageRoutes = new Hono()

messageRoutes.post('/', async (c) => {
  try {
    return await handleCompletion(c)
  }
  catch (error) {
    return await forwardErrorAnthropic(c, error)
  }
})

messageRoutes.post('/count_tokens', async (c) => {
  try {
    return await handleCountTokens(c)
  }
  catch (error) {
    return await forwardErrorAnthropic(c, error)
  }
})
