import { notFound } from "next/navigation"  
  
export default function ConsultationDetailPage({ params }: { params: { id: string } }) {  
  return (  
    <div className="container mx-auto py-8">  
      <div className="max-w-2xl mx-auto">  
        <h1 className="text-3xl font-bold mb-6">Consultation Details</h1>  
        <p>Consultation ID: {params.id}</p>  
      </div>  
    </div>  
  )  
}  
