import type { AnthropicResponse, AnthropicStreamEventData, AnthropicStreamState } from './anthropic-types'

function isToolBlockOpen(state: AnthropicStreamState): boolean {
  return state.contentBlockOpen && state.currentBlockType === 'tool_use'
}

function closeOpenAnthropicBlock(
  events: Array<AnthropicStreamEventData>,
  state: AnthropicStreamState,
): void {
  if (!state.contentBlockOpen) {
    return
  }

  events.push({
    type: 'content_block_stop',
    index: state.contentBlockIndex,
  })
  state.contentBlockIndex++
  state.contentBlockOpen = false
  state.currentBlockType = null
  state.thinkingSignature = null
}

function flushPendingLeadingText(
  events: Array<AnthropicStreamEventData>,
  state: AnthropicStreamState,
): void {
  if (!state.pendingLeadingText) {
    return
  }

  ensureTextBlockOpen(events, state)
  events.push({
    type: 'content_block_delta',
    index: state.contentBlockIndex,
    delta: {
      type: 'text_delta',
      text: state.pendingLeadingText,
    },
  })
  state.pendingLeadingText = ''
}

function ensureTextBlockOpen(
  events: Array<AnthropicStreamEventData>,
  state: AnthropicStreamState,
): void {
  if (state.contentBlockOpen && state.currentBlockType !== 'text') {
    closeOpenAnthropicBlock(events, state)
  }

  if (!state.contentBlockOpen) {
    events.push({
      type: 'content_block_start',
      index: state.contentBlockIndex,
      content_block: {
        type: 'text',
        text: '',
      },
    })
    state.contentBlockOpen = true
    state.currentBlockType = 'text'
  }
}

export function canRecoverUpstreamTerminationAsMessage(
  state: AnthropicStreamState,
): boolean {
  // Recovering a terminated stream as a successful message is only safe once
  // we have surfaced some non-thinking assistant output. Otherwise Claude Code
  // receives an "end_turn" with no visible content and the turn appears to end
  // silently.
  return state.hasNonThinkingContent
}

export function finalizeAnthropicStreamFromState(
  state: AnthropicStreamState,
  options?: {
    stopReason?: AnthropicResponse['stop_reason']
    outputTokens?: number
  },
): Array<AnthropicStreamEventData> {
  const events: Array<AnthropicStreamEventData> = []

  if (!state.messageStartSent || state.messageStopSent) {
    return events
  }

  if (state.pendingLeadingText) {
    flushPendingLeadingText(events, state)
  }

  if (isToolBlockOpen(state)) {
    return events
  }

  if (state.contentBlockOpen) {
    closeOpenAnthropicBlock(events, state)
  }

  events.push(
    {
      type: 'message_delta',
      delta: {
        stop_reason: options?.stopReason ?? 'end_turn',
        stop_sequence: null,
      },
      usage: {
        output_tokens: options?.outputTokens ?? 0,
      },
    },
    {
      type: 'message_stop',
    },
  )
  state.messageStopSent = true

  return events
}

export function translateErrorToAnthropicErrorEvent(
  message?: string,
): AnthropicStreamEventData {
  return {
    type: 'error',
    error: {
      type: 'api_error',
      message: message ?? 'An unexpected error occurred during streaming.',
    },
  }
}
