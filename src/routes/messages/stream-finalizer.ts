import type { AnthropicResponse, AnthropicStreamEventData, AnthropicStreamState } from '~/lib/translation/types'

import consola from 'consola'

export interface AnthropicEventWriter {
  writeEvent: (event: AnthropicStreamEventData) => Promise<void>
}

export interface RecoverableAnthropicOutputState {
  hasNonThinkingContent: boolean
  hasThinkingContent: boolean
}

export interface AnthropicStreamFailureOptions {
  completionTerm: string
  error: unknown
  errorLabel: string
  streamLabel: string
  state: RecoverableAnthropicOutputState
  unexpectedErrorMessage: string
  writer: AnthropicEventWriter
  finalizeRecoveredEvents: () => Array<AnthropicStreamEventData>
  canRecoverTermination?: () => boolean
  shouldEmitTerminationError?: () => boolean
  debugTranslatedEvents?: boolean
}

function isTranslatedToolBlockOpen(state: AnthropicStreamState): boolean {
  return state.contentBlockOpen && state.currentBlockType === 'tool_use'
}

function closeTranslatedAnthropicBlock(
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
    closeTranslatedAnthropicBlock(events, state)
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
  state: RecoverableAnthropicOutputState,
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

  if (isTranslatedToolBlockOpen(state)) {
    return events
  }

  if (state.contentBlockOpen) {
    closeTranslatedAnthropicBlock(events, state)
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

export function finalizeTruncatedAnthropicStreamFromState(
  state: AnthropicStreamState,
): Array<AnthropicStreamEventData> {
  const events: Array<AnthropicStreamEventData> = []

  if (!state.messageStartSent || state.messageStopSent) {
    return events
  }

  if (state.contentBlockOpen && !isTranslatedToolBlockOpen(state)) {
    closeTranslatedAnthropicBlock(events, state)
  }

  events.push(translateErrorToAnthropicErrorEvent(
    getUpstreamTerminationErrorMessage(state),
  ))

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

export async function writeAnthropicEvents(
  writer: AnthropicEventWriter,
  events: Array<AnthropicStreamEventData>,
  options?: {
    debugTranslatedEvents?: boolean
  },
): Promise<void> {
  for (const event of events) {
    if (options?.debugTranslatedEvents && consola.level >= 4) {
      consola.debug('Translated Anthropic event:', JSON.stringify(event))
    }
    await writer.writeEvent(event)
  }
}

export async function handleAnthropicStreamFailure(
  options: AnthropicStreamFailureOptions,
): Promise<void> {
  if (options.error instanceof Error && options.error.name === 'AbortError') {
    return
  }

  const upstreamTerminated = isRecoverableUpstreamTermination(options.error)
  const recoveredEvents = upstreamTerminated && (options.canRecoverTermination?.() ?? true)
    ? options.finalizeRecoveredEvents()
    : []

  if (recoveredEvents.length > 0) {
    consola.warn(`${options.streamLabel} terminated without a ${options.completionTerm}; synthesizing Anthropic message_stop.`)
    await writeAnthropicEvents(options.writer, recoveredEvents, {
      debugTranslatedEvents: options.debugTranslatedEvents,
    })
    return
  }

  if (upstreamTerminated && (options.shouldEmitTerminationError?.() ?? true)) {
    consola.warn(`${options.streamLabel} terminated without recoverable assistant output; returning Anthropic error event.`)
    await options.writer.writeEvent(
      translateErrorToAnthropicErrorEvent(
        getUpstreamTerminationErrorMessage(options.state),
      ),
    )
    return
  }

  const message = options.error instanceof Error
    ? options.error.message
    : options.unexpectedErrorMessage
  consola.error(`${options.errorLabel} failed:`, options.error)
  await options.writer.writeEvent(translateErrorToAnthropicErrorEvent(message))
}

export function getUpstreamTerminationErrorMessage(
  state: RecoverableAnthropicOutputState,
): string {
  return state.hasThinkingContent && !state.hasNonThinkingContent
    ? 'Upstream Copilot connection terminated after reasoning output, before any assistant text or tool call was produced.'
    : 'Upstream Copilot connection terminated before the response completed.'
}

function isRecoverableUpstreamTermination(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  if (error.message === 'terminated' || String(error).includes('terminated')) {
    return true
  }

  const cause = error.cause
  if (!cause || typeof cause !== 'object') {
    return false
  }

  const code = 'code' in cause ? cause.code : undefined
  const message = 'message' in cause ? cause.message : undefined

  return code === 'UND_ERR_SOCKET' || message === 'other side closed'
}

type NativeAnthropicBlockType = 'text' | 'thinking' | 'tool_use'

export interface NativeAnthropicPassthroughState extends RecoverableAnthropicOutputState {
  currentBlockIndex: number | null
  currentBlockType: NativeAnthropicBlockType | null
  errorSeen: boolean
  messageDeltaSeen: boolean
  messageStartSeen: boolean
  messageStopSeen: boolean
  outputTokens: number
}

export function createNativeAnthropicPassthroughState(): NativeAnthropicPassthroughState {
  return {
    currentBlockIndex: null,
    currentBlockType: null,
    errorSeen: false,
    hasNonThinkingContent: false,
    hasThinkingContent: false,
    messageDeltaSeen: false,
    messageStartSeen: false,
    messageStopSeen: false,
    outputTokens: 0,
  }
}

export function updateNativeAnthropicPassthroughState(
  state: NativeAnthropicPassthroughState,
  event: AnthropicStreamEventData,
): void {
  switch (event.type) {
    case 'message_start': {
      state.messageStartSeen = true
      state.outputTokens = event.message.usage.output_tokens
      return
    }

    case 'content_block_start': {
      state.currentBlockIndex = event.index
      state.currentBlockType = event.content_block.type

      if (event.content_block.type === 'thinking') {
        state.hasThinkingContent = true
      }
      else {
        state.hasNonThinkingContent = true
      }
      return
    }

    case 'content_block_delta': {
      if (event.delta.type === 'thinking_delta' || event.delta.type === 'signature_delta') {
        state.hasThinkingContent = true
      }
      else {
        state.hasNonThinkingContent = true
      }
      return
    }

    case 'content_block_stop': {
      if (state.currentBlockIndex === event.index) {
        state.currentBlockIndex = null
        state.currentBlockType = null
      }
      return
    }

    case 'message_delta': {
      state.messageDeltaSeen = true
      state.outputTokens = event.usage?.output_tokens ?? state.outputTokens
      return
    }

    case 'message_stop': {
      state.messageStopSeen = true
      return
    }

    case 'error': {
      state.errorSeen = true
      break
    }

    case 'ping': {
      break
    }
  }
}

export function finalizeNativeAnthropicPassthroughState(
  state: NativeAnthropicPassthroughState,
): Array<AnthropicStreamEventData> {
  if (!state.messageStartSeen || state.messageStopSeen || state.errorSeen || !state.hasNonThinkingContent) {
    return []
  }

  if (state.currentBlockType === 'tool_use') {
    return []
  }

  const events: Array<AnthropicStreamEventData> = []

  if (state.currentBlockIndex !== null) {
    events.push({
      type: 'content_block_stop',
      index: state.currentBlockIndex,
    })
    state.currentBlockIndex = null
    state.currentBlockType = null
  }

  if (!state.messageDeltaSeen) {
    events.push({
      type: 'message_delta',
      delta: {
        stop_reason: 'end_turn',
        stop_sequence: null,
      },
      usage: {
        output_tokens: state.outputTokens,
      },
    })
  }

  events.push({ type: 'message_stop' })
  state.messageStopSeen = true
  return events
}

export function shouldEmitNativeAnthropicTerminationError(
  state: NativeAnthropicPassthroughState,
): boolean {
  return state.messageStartSeen && !state.messageStopSeen && !state.errorSeen
}
