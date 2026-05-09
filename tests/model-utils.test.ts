import { describe, expect, test } from 'bun:test'

import { findModelWithFallback } from '~/lib/model-utils'

describe('findModelWithFallback', () => {
  test('falls back to the longest listed model prefix for future variants', () => {
    const model = findModelWithFallback('gpt-5.2-codex-experimental-latency', [
      makeModel('gpt-5.2'),
      makeModel('gpt-5.2-codex'),
    ])

    expect(model?.id).toBe('gpt-5.2-codex')
  })
})

function makeModel(id: string) {
  return {
    id,
    capabilities: {
      family: 'test',
      limits: {},
      object: 'model_capabilities',
      supports: {},
      tokenizer: 'o200k_base',
      type: 'chat',
    },
    model_picker_enabled: true,
    name: id,
    object: 'model',
    preview: false,
    vendor: 'test',
    version: '1',
  }
}
