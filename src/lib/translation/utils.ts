/**
 * Shared utilities for protocol translation
 */

import type { AnthropicResponse } from './types'
import type {
  ResponsesOutputItem,
  ResponsesResponse,
  ResponsesResponseError,
} from '~/services/copilot/create-responses'

import { JSONResponseError } from '~/lib/error'

/**
 * Map Responses API status + output → Anthropic stop_reason
 */
export function mapResponsesStatusToAnthropicStopReason(
  status: ResponsesResponse['status'],
  output: Array<ResponsesOutputItem>,
  incompleteDetails?: ResponsesResponse['incomplete_details'],
): AnthropicResponse['stop_reason'] {
  if (status === 'failed') {
    throw new Error('Cannot map failed Responses status to Anthropic stop_reason')
  }

  if (status === 'incomplete') {
    if (incompleteDetails?.reason === 'content_filter') {
      return 'refusal'
    }
    if (incompleteDetails?.reason === 'max_output_tokens') {
      return 'max_tokens'
    }
    return 'pause_turn'
  }

  const hasFunctionCall = output.some(item => item.type === 'function_call')
  if (hasFunctionCall) {
    return 'tool_use'
  }

  return 'end_turn'
}

export function createAnthropicErrorPayloadFromResponses(
  responseOrError: ResponsesResponse | ResponsesResponseError,
): {
  type: 'error'
  error: {
    type: string
    message: string
  }
} {
  return {
    type: 'error',
    error: {
      type: 'api_error',
      message: getResponsesErrorMessage(responseOrError),
    },
  }
}

export function throwAnthropicErrorFromFailedResponses(response: ResponsesResponse): never {
  throw new JSONResponseError(
    getResponsesErrorMessage(response),
    502,
    createAnthropicErrorPayloadFromResponses(response),
  )
}

function getResponsesErrorMessage(responseOrError: ResponsesResponse | ResponsesResponseError): string {
  if ('error' in responseOrError && responseOrError.error) {
    const err = responseOrError.error as ResponsesResponseError
    return err.message ?? 'Responses request failed'
  }

  if ('message' in responseOrError && typeof responseOrError.message === 'string') {
    return responseOrError.message
  }

  return 'Responses request failed'
}
