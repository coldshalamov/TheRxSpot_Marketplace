"use client"

import { useState } from "react"

interface ConsultFormProps {
  productId: string
  onClose: () => void
  onApproved: () => void
}

export function ConsultForm({ productId, onClose, onApproved }: ConsultFormProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    symptoms: "",
    medicalHistory: "",
    currentMedications: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Submit consultation request
      const response = await fetch("/api/consultations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
          consult_fee: 0,
          notes: formData.symptoms,
        }),
      })

      if (response.ok) {
        onApproved()
      }
    } catch (error) {
      console.error("Error submitting consultation:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4">Consultation Request</h2>
        <form onSubmit={handleSubmit}>
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
