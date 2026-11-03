"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/context/AuthContext"
import { X, Download, FileText, Image, File, Zap } from "lucide-react"

interface DocumentAttachment {
  id: string
  expense_id?: string
  payment_id?: string
  document_type: 'file' | 'richtext'
  file_path?: string
  file_name?: string
  file_size?: number
  mime_type?: string
  content?: string
  title?: string
  description?: string
  created_at: string
}

export interface ElectricityBillInfo {
  id: string
  bill_date: string
  bill_date_range_start: string
  bill_date_range_end: string
  total_units_consumed: number
  units_per_day?: number | null
  is_estimated: boolean
  account_number: string
  bill_amount: number
  meter_reading?: number | null
  pdf_file_path?: string | null
}

interface DocumentModalProps {
  isOpen: boolean
  onClose: () => void
  expenseId?: string
  paymentId?: string
  transactionDescription?: string
  electricityBill?: ElectricityBillInfo | null
}

export default function DocumentModal({ 
  isOpen, 
  onClose, 
  expenseId, 
  paymentId,
  transactionDescription,
  electricityBill,
}: DocumentModalProps) {
  const { supabase } = useAuth()
  const [attachments, setAttachments] = useState<DocumentAttachment[]>([])
  const [loading, setLoading] = useState(true)
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [pdfUrls, setPdfUrls] = useState<Record<string, string>>({})
  const [billPdfUrl, setBillPdfUrl] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && (expenseId || paymentId || electricityBill)) {
      loadAttachments()
      loadBillPdf()
    } else {
      setAttachments([])
      setImageUrls({})
      setPdfUrls({})
      setBillPdfUrl(null)
      setLoading(false)
    }
  }, [isOpen, expenseId, paymentId, electricityBill?.id, electricityBill?.pdf_file_path])

  const loadBillPdf = async () => {
    setBillPdfUrl(null)
    if (!electricityBill?.pdf_file_path) return

    try {
      // Prefer dedicated electricity-bills bucket; fall back to document-attachments
      for (const bucket of ['electricity-bills', 'document-attachments']) {
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(electricityBill.pdf_file_path, 3600)

        if (!error && data?.signedUrl) {
          setBillPdfUrl(data.signedUrl)
          return
        }
      }
    } catch (err) {
      console.error('Error loading electricity bill PDF:', err)
    }
  }

  const loadAttachments = async () => {
    try {
      setLoading(true)

      if (!expenseId && !paymentId) {
        setAttachments([])
        setImageUrls({})
        setPdfUrls({})
        return
      }

      let query = supabase
        .from('document_attachments')
        .select('*')
        .order('created_at', { ascending: false })

      if (expenseId) {
        query = query.eq('expense_id', expenseId)
      } else if (paymentId) {
        query = query.eq('payment_id', paymentId)
      }

      const { data, error } = await query

      if (error) throw error
      setAttachments(data || [])

      // Load signed URLs for files
      const fileAttachments = (data || []).filter(a => a.document_type === 'file' && a.file_path)
      const urls: Record<string, string> = {}
      const pdfs: Record<string, string> = {}

      for (const attachment of fileAttachments) {
        if (attachment.file_path) {
          try {
            const { data: urlData } = await supabase.storage
              .from('document-attachments')
              .createSignedUrl(attachment.file_path, 3600)
            
            if (urlData?.signedUrl) {
              if (attachment.mime_type?.startsWith('image/')) {
                urls[attachment.id] = urlData.signedUrl
              } else if (attachment.mime_type === 'application/pdf') {
                pdfs[attachment.id] = urlData.signedUrl
              }
            }
          } catch (err) {
            console.error('Error loading file URL:', err)
          }
        }
      }

      setImageUrls(urls)
      setPdfUrls(pdfs)
    } catch (err) {
      console.error('Error loading attachments:', err)
      setAttachments([])
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = (url: string, fileName: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatCurrency = (amount: number) =>
    amount.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })

  const formatDate = (date: string) =>
    new Date(date + 'T00:00:00').toLocaleDateString('en-AU')

  if (!isOpen) return null

  const hasContent = !!electricityBill || attachments.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-xl font-semibold">Documents</h2>
            {transactionDescription && (
              <p className="text-sm text-gray-500">{transactionDescription}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading documents...</div>
          ) : !hasContent ? (
            <div className="text-center py-8 text-gray-500">No documents attached</div>
          ) : (
            <div className="space-y-4">
              {electricityBill && (
                <div className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-amber-500" />
                      <span className="font-medium">Synergy Electricity Bill</span>
                    </div>
                    {billPdfUrl && (
                      <button
                        onClick={() =>
                          handleDownload(
                            billPdfUrl,
                            `synergy-${electricityBill.account_number}-${electricityBill.bill_date}.pdf`
                          )
                        }
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4">
                    <div>
                      <span className="text-gray-500">Account</span>
                      <div className="font-medium">{electricityBill.account_number}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Bill date</span>
                      <div className="font-medium">{formatDate(electricityBill.bill_date)}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Period</span>
                      <div className="font-medium">
                        {formatDate(electricityBill.bill_date_range_start)} – {formatDate(electricityBill.bill_date_range_end)}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500">Amount</span>
                      <div className="font-medium">{formatCurrency(electricityBill.bill_amount)}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Units used</span>
                      <div className="font-medium">
                        {electricityBill.total_units_consumed.toLocaleString()} kWh
                        {electricityBill.is_estimated ? ' (estimated)' : ''}
                      </div>
                    </div>
                    {electricityBill.units_per_day != null && (
                      <div>
                        <span className="text-gray-500">Units / day</span>
                        <div className="font-medium">{Number(electricityBill.units_per_day).toFixed(2)}</div>
                      </div>
                    )}
                    {electricityBill.meter_reading != null && (
                      <div>
                        <span className="text-gray-500">Meter reading</span>
                        <div className="font-medium">{electricityBill.meter_reading.toLocaleString()}</div>
                      </div>
                    )}
                  </div>

                  {billPdfUrl ? (
                    <div className="mt-2 border rounded">
                      <iframe
                        src={billPdfUrl}
                        className="w-full h-96"
                        title={`Synergy bill ${electricityBill.account_number}`}
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">
                      Bill details loaded. No PDF file is stored for this bill.
                    </p>
                  )}
                </div>
              )}

              {attachments.map((attachment) => (
                <div key={attachment.id} className="border rounded-lg p-4">
                  {attachment.document_type === 'file' ? (
                    <>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {attachment.mime_type === 'application/pdf' ? (
                            <FileText className="w-5 h-5 text-red-500" />
                          ) : attachment.mime_type?.startsWith('image/') ? (
                            <Image className="w-5 h-5 text-blue-500" />
                          ) : (
                            <File className="w-5 h-5 text-gray-500" />
                          )}
                          <span className="font-medium">{attachment.file_name || 'Untitled'}</span>
                          {attachment.file_size && (
                            <span className="text-xs text-gray-500">
                              ({(attachment.file_size / 1024).toFixed(1)} KB)
                            </span>
                          )}
                        </div>
                        {((attachment.mime_type === 'application/pdf' && pdfUrls[attachment.id]) ||
                          (attachment.mime_type?.startsWith('image/') && imageUrls[attachment.id])) && (
                          <button
                            onClick={() => {
                              const url = pdfUrls[attachment.id] || imageUrls[attachment.id]
                              if (url) {
                                handleDownload(url, attachment.file_name || 'document')
                              }
                            }}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                          >
                            <Download className="w-4 h-4" />
                            Download
                          </button>
                        )}
                      </div>

                      {/* PDF Viewer */}
                      {attachment.mime_type === 'application/pdf' && pdfUrls[attachment.id] && (
                        <div className="mt-4 border rounded">
                          <iframe
                            src={pdfUrls[attachment.id]}
                            className="w-full h-96"
                            title={attachment.file_name}
                          />
                        </div>
                      )}

                      {/* Image Viewer */}
                      {attachment.mime_type?.startsWith('image/') && imageUrls[attachment.id] && (
                        <div className="mt-4">
                          <img
                            src={imageUrls[attachment.id]}
                            alt={attachment.file_name}
                            className="max-w-full h-auto rounded border"
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-medium">{attachment.title || 'Note'}</div>
                          <div className="text-xs text-gray-500">
                            {new Date(attachment.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div
                        className="text-sm text-gray-700 prose prose-sm max-w-none mt-2"
                        dangerouslySetInnerHTML={{ __html: attachment.content || '' }}
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t">
          <button
            onClick={onClose}
            className="w-full bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
