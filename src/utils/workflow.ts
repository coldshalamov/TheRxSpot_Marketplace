type WorkflowRunResult<TResult = unknown> = {
  errors?: Array<{ error?: unknown } | unknown>
  result?: TResult
}

function toError(value: unknown): Error {
  if (value instanceof Error) return value
  if (value && typeof value === "object" && "message" in value && typeof (value as any).message === "string") {
    return new Error((value as any).message)
  }
  return new Error(String(value))
}

/**
 * Medusa workflows' `.run()` returns `{ errors, result }` and does not always throw even when steps fail.
 * For reliability and correctness, treat any `errors` as a hard failure and throw the first error.
 */
export async function runWorkflowOrThrow<TResult = any>(
  workflow: { run: (args?: any) => Promise<WorkflowRunResult<TResult>> },
  args: any
): Promise<TResult> {
  const res = await workflow.run(args)
  const errors = Array.isArray(res?.errors) ? res.errors : []
  if (errors.length > 0) {
    const first = (errors[0] as any)?.error ?? errors[0]
    throw toError(first)
  }
  return (res as any)?.result as TResult
}

