"use client"

import { useState } from "react"
import { requestConsultation } from "@/lib/data/consultations"
import { toast } from "@medusajs/ui"

interface ConsultFormProps {
  productId: string
  onClose: () => void
  onSubmitted: (consultationId: string) => void
}

export function ConsultForm({ productId, onClose, onSubmitted }: ConsultFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    state: "",
    symptoms: "",
    medicalHistory: "",
    currentMedications: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await requestConsultation({
        product_id: productId,
        customer_email: formData.email.trim(),
        customer_first_name: formData.firstName.trim(),
        customer_last_name: formData.lastName.trim(),
        customer_phone: formData.phone.trim() || null,
        eligibility_answers: {
          state: formData.state.trim().toUpperCase(),
          symptoms: formData.symptoms,
          current_medications: formData.currentMedications,
        },
        notes: formData.symptoms,
        chief_complaint: formData.symptoms,
        medical_history: {
          medicalHistory: formData.medicalHistory,
          currentMedications: formData.currentMedications,
        },
      })

      if (!res.ok) {
        setError(res.message)
        toast.error("Consultation request failed", { description: res.message })
        return
      }

      toast.success("Consultation submitted", {
        description: "We’ll update this page once it’s approved.",
      })
      onSubmitted(res.consultation_id)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      setError(message)
      toast.error("Consultation request failed", { description: message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4">Consultation Request</h2>

        {error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block font-semibold mb-2">First name</label>
              <input
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block font-semibold mb-2">Last name</label>
              <input
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full p-2 border rounded"
                required
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block font-semibold mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full p-2 border rounded"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block font-semibold mb-2">Phone (optional)</label>
              <input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block font-semibold mb-2">State</label>
              <input
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full p-2 border rounded"
                placeholder="NY"
                required
                maxLength={2}
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block font-semibold mb-2">Symptoms</label>
            <textarea
              value={formData.symptoms}
              onChange={(e) => setFormData({ ...formData, symptoms: e.target.value })}
              className="w-full p-2 border rounded"
              rows={3}
              required
            />
          </div>
          <div className="mb-4">
            <label className="block font-semibold mb-2">Medical History</label>
            <textarea
              value={formData.medicalHistory}
              onChange={(e) => setFormData({ ...formData, medicalHistory: e.target.value })}
              className="w-full p-2 border rounded"
              rows={3}
            />
          </div>
          <div className="mb-4">
            <label className="block font-semibold mb-2">Current Medications</label>
            <textarea
              value={formData.currentMedications}
              onChange={(e) => setFormData({ ...formData, currentMedications: e.target.value })}
              className="w-full p-2 border rounded"
              rows={3}
            />
          </div>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 border rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 px-4 bg-teal-600 text-white rounded disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
