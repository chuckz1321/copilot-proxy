import type { AnthropicStreamState } from '~/lib/translation/types'

import { describe, expect, test } from 'bun:test'

import {
  canRecoverUpstreamTerminationAsMessage,
  finalizeAnthropicStreamFromState,
} from '~/routes/messages/stream-translation'

function makeState(overrides: Partial<AnthropicStreamState> = {}): AnthropicStreamState {
  return {
    messageStartSent: true,
    messageStopSent: false,
    contentBlockIndex: 0,
    contentBlockOpen: false,
    currentBlockType: null,
    thinkingSignature: null,
    pendingLeadingText: '',
    hasThinkingContent: false,
    hasNonThinkingContent: false,
    toolCalls: {},
    ...overrides,
  }
}

describe('canRecoverUpstreamTerminationAsMessage', () => {
  test('refuses recovery when only thinking content was streamed', () => {
    const state = makeState({
      hasThinkingContent: true,
      hasNonThinkingContent: false,
    })

    expect(canRecoverUpstreamTerminationAsMessage(state)).toBe(false)
  })

  test('allows recovery once visible (non-thinking) content has been streamed', () => {
    const state = makeState({
      hasThinkingContent: true,
      hasNonThinkingContent: true,
    })

    expect(canRecoverUpstreamTerminationAsMessage(state)).toBe(true)
  })
})

describe('finalizeAnthropicStreamFromState', () => {
  test('synthesizes message_stop when a text block is open and visible content was emitted', () => {
    const state = makeState({
      contentBlockIndex: 0,
      contentBlockOpen: true,
      currentBlockType: 'text',
      hasNonThinkingContent: true,
    })

    const events = finalizeAnthropicStreamFromState(state, { outputTokens: 7 })

    expect(events).toEqual([
      { type: 'content_block_stop', index: 0 },
      {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { output_tokens: 7 },
      },
      { type: 'message_stop' },
    ])
    expect(state.messageStopSent).toBe(true)
    expect(state.contentBlockOpen).toBe(false)
  })

  test('returns no events when a tool_use block is still open (does not fabricate completion mid-tool-call)', () => {
    const state = makeState({
      contentBlockIndex: 0,
      contentBlockOpen: true,
      currentBlockType: 'tool_use',
      hasNonThinkingContent: true,
    })

    const events = finalizeAnthropicStreamFromState(state)

    expect(events).toEqual([])
    expect(state.messageStopSent).toBe(false)
    expect(state.contentBlockOpen).toBe(true)
  })

  test('flushes pending leading text into a text block before closing', () => {
    const state = makeState({
      pendingLeadingText: '  ',
    })

    const events = finalizeAnthropicStreamFromState(state, { stopReason: 'max_tokens', outputTokens: 3 })

    expect(events[0]).toEqual({
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'text', text: '' },
    })
    expect(events[1]).toEqual({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: '  ' },
    })
    expect(events[2]).toEqual({ type: 'content_block_stop', index: 0 })
    expect(events[3]).toEqual({
      type: 'message_delta',
      delta: { stop_reason: 'max_tokens', stop_sequence: null },
      usage: { output_tokens: 3 },
    })
    expect(events[4]).toEqual({ type: 'message_stop' })
  })

  test('returns no events if message_start was never sent or message_stop was already sent', () => {
    const noStart = makeState({ messageStartSent: false, hasNonThinkingContent: true })
    expect(finalizeAnthropicStreamFromState(noStart)).toEqual([])

    const alreadyStopped = makeState({ messageStopSent: true, hasNonThinkingContent: true })
    expect(finalizeAnthropicStreamFromState(alreadyStopped)).toEqual([])
  })
})
