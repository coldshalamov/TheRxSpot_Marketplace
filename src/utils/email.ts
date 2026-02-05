type SendEmailInput = {
  to: string | string[]
  subject: string
  text: string
  html?: string
}

function normalizeTo(to: string | string[]): string[] {
  const list = Array.isArray(to) ? to : [to]
  return list.map((v) => v.trim()).filter(Boolean)
}

export async function sendEmail(input: SendEmailInput): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.SENDGRID_API_KEY
  const fromEmail = process.env.FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL
  const fromName = process.env.FROM_NAME || "TheRxSpot"

  const to = normalizeTo(input.to)
  if (!to.length) {
    return { sent: false, error: "No recipients" }
  }

  if (!apiKey || !fromEmail) {
    // Best-effort: in dev or misconfigured environments we don't hard-fail background jobs.
    return { sent: false, error: "SendGrid not configured (missing SENDGRID_API_KEY / FROM_EMAIL)" }
  }

  try {
    // Import lazily so projects without SendGrid configured don't pay startup cost.
    // @sendgrid/mail is present via @medusajs/notification-sendgrid in this repo.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sgMail = require("@sendgrid/mail") as typeof import("@sendgrid/mail")

    sgMail.setApiKey(apiKey)

    await sgMail.send({
      to,
      from: { email: fromEmail, name: fromName },
      subject: input.subject,
      text: input.text,
      html: input.html,
    })

    return { sent: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { sent: false, error: msg }
  }
}
