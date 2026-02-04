import { CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react"

export type ConsultStatus = "pending" | "scheduled" | "in_progress" | "completed" | "cancelled" | "no_show"
export type ConsultOutcome = "approved" | "declined" | "prescribed" | "referred" | null

interface ConsultStatusBadgeProps {
  status: ConsultStatus
  outcome?: ConsultOutcome
}

export function ConsultStatusBadge({ status, outcome }: ConsultStatusBadgeProps) {
  const config = {
    pending: { icon: Clock, color: "bg-yellow-100 text-yellow-600" },
    scheduled: { icon: AlertCircle, color: "bg-blue-100 text-blue-600" },
    in_progress: { icon: AlertCircle, color: "bg-purple-100 text-purple-600" },
    completed: { icon: CheckCircle2, color: "bg-green-100 text-green-600" },
    cancelled: { icon: XCircle, color: "bg-red-100 text-red-600" },
    no_show: { icon: XCircle, color: "bg-gray-100 text-gray-600" }
  }

  const { icon: Icon, color } = config[status] || config.pending

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${color}`}>
      <Icon className="w-4 h-4" />
      <span className="text-sm font-medium capitalize">{status.replace(/_/g, " ")}</span>
      {outcome && <span className="text-sm text-gray-600">({outcome})</span>}
    </div>
  )
}
