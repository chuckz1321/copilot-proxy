import type { ResponsesStreamEvent } from '../src/services/copilot/create-responses'

import { describe, expect, test } from 'bun:test'

import {
  createAnthropicFromResponsesStreamState,
  translateResponsesStreamEventToAnthropic,
} from '../src/lib/translation'

describe('Responses stream failure handling', () => {
  test('translateResponsesStreamEventToAnthropic emits error event on response.failed', () => {
    const state = createAnthropicFromResponsesStreamState()

    const events = translateResponsesStreamEventToAnthropic({
      type: 'response.failed',
      response: {
        id: 'resp_1',
        object: 'response',
        model: 'gpt-5.4',
        output: [],
        status: 'failed',
        error: { message: 'stream failed', type: 'server_error' },
      },
    } as ResponsesStreamEvent, state)

    expect(events).toEqual([
      {
        type: 'error',
        error: {
          type: 'api_error',
          message: 'stream failed',
        },
      },
    ])
  })

  test('translateResponsesStreamEventToAnthropic finalizes response.incomplete with mapped stop_reason', () => {
    const state = createAnthropicFromResponsesStreamState()

    const events = translateResponsesStreamEventToAnthropic({
      type: 'response.incomplete',
      response: {
        id: 'resp_1',
        object: 'response',
        model: 'gpt-5.4',
        output: [],
        status: 'incomplete',
        incomplete_details: { reason: 'content_filter' },
        usage: { input_tokens: 3, output_tokens: 1, total_tokens: 4 },
      },
    }, state)

    expect(events).toEqual([
      {
        type: 'message_delta',
        delta: { stop_reason: 'refusal', stop_sequence: null },
        usage: { output_tokens: 1 },
      },
      {
        type: 'message_stop',
      },
    ])
  })

  test('translateResponsesStreamEventToAnthropic maps reasonless response.incomplete to pause_turn', () => {
    const state = createAnthropicFromResponsesStreamState()

    const events = translateResponsesStreamEventToAnthropic({
      type: 'response.incomplete',
      response: {
        id: 'resp_pause',
        object: 'response',
        model: 'gpt-5.4',
        output: [],
        status: 'incomplete',
        incomplete_details: null,
        usage: { input_tokens: 3, output_tokens: 1, total_tokens: 4 },
      },
    }, state)

    expect(events).toEqual([
      {
        type: 'message_delta',
        delta: { stop_reason: 'pause_turn', stop_sequence: null },
        usage: { output_tokens: 1 },
      },
      {
        type: 'message_stop',
      },
    ])
  })

  test('translateResponsesStreamEventToAnthropic ignores output_text.done and function_call_arguments.done helper events', () => {
    const anthropicState = createAnthropicFromResponsesStreamState()

    const outputTextDoneEvent: ResponsesStreamEvent = {
      type: 'response.output_text.done',
      output_index: 0,
      content_index: 0,
      item_id: 'msg_1',
      text: 'done',
    }
    const functionCallDoneEvent: ResponsesStreamEvent = {
      type: 'response.function_call_arguments.done',
      output_index: 1,
      item_id: 'fc_1',
      arguments: '{"ok":true}',
      item: {
        type: 'function_call',
        id: 'fc_1',
        call_id: 'call_1',
        name: 'lookup',
        arguments: '{"ok":true}',
        status: 'completed',
      },
    }

    expect(translateResponsesStreamEventToAnthropic(outputTextDoneEvent, anthropicState)).toEqual([])
    expect(translateResponsesStreamEventToAnthropic(functionCallDoneEvent, anthropicState)).toEqual([])
  })
})
