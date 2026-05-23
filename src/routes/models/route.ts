import { Hono } from 'hono'

import { forwardError } from '~/lib/error'
import { state } from '~/lib/state'
import { cacheModels } from '~/lib/utils'

import { createCodexModelsResponseEtag, isCodexModelsRequest, toCodexModelsResponse } from './codex-compat'

export const modelRoutes = new Hono()

modelRoutes.get('/', async (c) => {
  try {
    if (!state.models) {
      // This should be handled by startup logic, but as a fallback.
      await cacheModels()
    }

    const modelsData = state.models?.data ?? []

    const requestUrl = new URL(c.req.url)
    if (isCodexModelsRequest(requestUrl)) {
      const codexModelsResponse = await toCodexModelsResponse(modelsData, requestUrl)
      c.header('Cache-Control', 'private, max-age=300')
      // Codex stores this value with its on-disk model cache; it does not use HTTP 304 here.
      c.header('ETag', createCodexModelsResponseEtag(codexModelsResponse))
      return c.json(codexModelsResponse)
    }

    const models = modelsData.map(model => ({
      id: model.id,
      object: 'model',
      type: 'model',
      created: 0, // No date available from source
      created_at: new Date(0).toISOString(), // No date available from source
      owned_by: model.vendor,
      display_name: model.name,
    }))

    return c.json({
      object: 'list',
      data: models,
      has_more: false,
    })
  }
  catch (error) {
    return await forwardError(c, error)
  }
})
