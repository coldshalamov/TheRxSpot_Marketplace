import { getPatientConsultations } from "@/lib/data/consultations"  
  
import { ConsultStatusBadge } from "@/components/consult-status-badge"  
  
export default async function ConsultationsPage() {  
  const consultations = await getPatientConsultations()  
  
  return (  
    <div className="container mx-auto py-8">  
      <h1 className="text-3xl font-bold mb-6">Consultations</h1>  
  
      {consultations.length === 0 ? (  
        <div className="text-center py-12">  
          <p className="text-gray-500">No consultations yet</p>  
        </div>  
      ) : (  
        <div className="space-y-4">  
          {consultations.map((consult: any) => (  
            <div key={consult.id} className="border rounded-lg p-4">  
              <div className="flex justify-between items-start">  
                <div>  
                  <h3 className="font-semibold">{consult.product_name}</h3>  
                  <p className="text-sm text-gray-600">  
                    Submitted: {new Date(consult.created_at).toLocaleDateString()}  
                  </p>  
                  <p className="text-sm text-gray-600">  
                    Status: <ConsultStatusBadge status={consult.status} />  
                  </p>  
                </div>  
                <a  
                  href={`/consultations/${consult.id}`}  
                  className="text-blue-600 hover:text-blue-800"  
                >  
                  View Details  
                </a>  
              </div>  
            </div>  
          ))}  
        </div>  
      )}  
    </div>  
  )  
} 
