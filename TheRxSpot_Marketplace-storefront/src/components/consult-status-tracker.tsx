import { CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react"  
  
export type ConsultStatus = "pending" | "assigned" | "in_progress" | "completed" | "cancelled"  
  
const statusConfig = {  
  pending: { icon: Clock, color: "text-yellow-600", bg: "bg-yellow-100", label: "Pending" },  
  assigned: { icon: CheckCircle2, color: "text-blue-600", bg: "bg-blue-100", label: "Assigned" },  
  in_progress: { icon: AlertCircle, color: "text-purple-600", bg: "bg-purple-100", label: "In Progress" },  
  completed: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-100", label: "Completed" },  
  cancelled: { icon: XCircle, color: "text-red-600", bg: "bg-red-100", label: "Cancelled" }  
}  
  
export function ConsultStatusTracker({ status }: { status: ConsultStatus }) {  
  const config = statusConfig[status]  
  const Icon = config.icon  
  
  return (  
    <div className="flex items-center gap-2">  
      <div className={`p-2 rounded-full ${config.bg}`}>  
        <Icon className={`w-5 h-5 ${config.color}`} />  
      </div>  
      <span className="font-medium">{config.label}</span>  
    </div>  
  )  
}  
  
export function ConsultStatusTimeline({ status }: { status: ConsultStatus }) {  
  const steps = ["pending", "assigned", "in_progress", "completed"] as ConsultStatus[]  
  const currentIndex = steps.indexOf(status)  
  
  return (  
    <div className="flex items-center justify-between">  
      {steps.map((step, index) => {  
        const isComplete = index <= currentIndex  
        const isCurrent = index === currentIndex  
        const config = statusConfig[step]  
        const Icon = config.icon  
  
        return (  
          <div key={step} className="flex items-center">  
            <div className={`p-2 rounded-full ${  
              isCurrent ? config.bg : isComplete ? "bg-green-100" : "bg-gray-100"  
            }`}>  
              <Icon className={`w-5 h-5 ${  
                isCurrent ? config.color : isComplete ? "text-green-600" : "text-gray-400"  
              }`} />  
            </div>  
            {index < steps.length - 1 && (  
              <div className={`w-12 h-1 mx-2 ${  
                isComplete ? "bg-green-500" : "bg-gray-200"  
              }`} />  
            )}  
          </div>  
        )  
      })}  
    </div>  
  )  
} 
