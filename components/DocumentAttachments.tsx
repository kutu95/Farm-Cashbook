"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/context/AuthContext"
import { Paperclip, FileText, Image, X, Download, Edit2, Trash2 } from "lucide-react"

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
  created_by?: string
}

interface DocumentAttachmentsProps {
  expenseId?: string
  paymentId?: string
  onUpdate?: () => void
}

export default function DocumentAttachments({ expenseId, paymentId, onUpdate }: DocumentAttachmentsProps) {
  const { supabase, session } = useAuth()
  const [attachments, setAttachments] = useState<DocumentAttachment[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showRichTextEditor, setShowRichTextEditor] = useState(false)
  const [richTextContent, setRichTextContent] = useState("")
  const [richTextTitle, setRichTextTitle] = useState("")
  const [error, setError] = useState("")
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    if (expenseId || paymentId) {
      loadAttachments()
    }
  }, [expenseId, paymentId])

  useEffect(() => {
    // Load image URLs for image attachments
    const loadImageUrls = async () => {
      const imageAttachments = attachments.filter(
        a => a.document_type === 'file' && a.mime_type?.startsWith('image/') && a.file_path
      )
      
      const urls: Record<string, string> = {}
      for (const attachment of imageAttachments) {
        if (attachment.file_path) {
          try {
            const { data } = await supabase.storage
              .from('document-attachments')
              .createSignedUrl(attachment.file_path, 3600)
            if (data?.signedUrl) {
              urls[attachment.id] = data.signedUrl
            }
          } catch (err) {
            console.error('Error loading image URL:', err)
          }
        }
      }
      setImageUrls(urls)
    }

    if (attachments.length > 0) {
      loadImageUrls()
    }
  }, [attachments, supabase])

  const loadAttachments = async () => {
    try {
      setLoading(true)
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
    } catch (err) {
      console.error('Error loading attachments:', err)
      setError(err instanceof Error ? err.message : 'Failed to load attachments')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Please upload PDF or image files only.')
      return
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB')
      return
    }

    try {
      setUploading(true)
      setError("")

      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
      const folder = expenseId ? 'expenses' : 'payments'
      const recordId = expenseId || paymentId
      const filePath = `${folder}/${recordId}/${fileName}`

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('document-attachments')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // Create database record
      const { error: dbError } = await supabase
        .from('document_attachments')
        .insert({
          expense_id: expenseId,
          payment_id: paymentId,
          document_type: 'file',
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          created_by: session?.user?.id
        })

      if (dbError) throw dbError

      await loadAttachments()
      onUpdate?.()
      
      // Reset file input
      e.target.value = ''
    } catch (err) {
      console.error('Error uploading file:', err)
      setError(err instanceof Error ? err.message : 'Failed to upload file')
    } finally {
      setUploading(false)
    }
  }

  const handleSaveRichText = async () => {
    if (!richTextContent.trim()) {
      setError('Please enter some content')
      return
    }

    try {
      setUploading(true)
      setError("")

      const { error } = await supabase
        .from('document_attachments')
        .insert({
          expense_id: expenseId,
          payment_id: paymentId,
          document_type: 'richtext',
          content: richTextContent,
          title: richTextTitle || 'Note',
          created_by: session?.user?.id
        })

      if (error) throw error

      setRichTextContent("")
      setRichTextTitle("")
      setShowRichTextEditor(false)
      await loadAttachments()
      onUpdate?.()
    } catch (err) {
      console.error('Error saving rich text:', err)
      setError(err instanceof Error ? err.message : 'Failed to save note')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (attachment: DocumentAttachment) => {
    if (!confirm('Are you sure you want to delete this attachment?')) return

    try {
      // Delete file from storage if it's a file attachment
      if (attachment.document_type === 'file' && attachment.file_path) {
        const { error: storageError } = await supabase.storage
          .from('document-attachments')
          .remove([attachment.file_path])

        if (storageError) console.error('Error deleting file:', storageError)
      }

      // Delete database record
      const { error } = await supabase
        .from('document_attachments')
        .delete()
        .eq('id', attachment.id)

      if (error) throw error

      await loadAttachments()
      onUpdate?.()
    } catch (err) {
      console.error('Error deleting attachment:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete attachment')
    }
  }

  const getFileUrl = async (filePath: string): Promise<string | null> => {
    try {
      const { data } = await supabase.storage
        .from('document-attachments')
        .createSignedUrl(filePath, 3600) // 1 hour expiry

      return data?.signedUrl || null
    } catch (err) {
      console.error('Error creating signed URL:', err)
      return null
    }
  }

  const handleDownload = async (attachment: DocumentAttachment) => {
    if (!attachment.file_path) return

    try {
      const url = await getFileUrl(attachment.file_path)
      if (url) {
        window.open(url, '_blank')
      }
    } catch (err) {
      console.error('Error downloading file:', err)
      setError('Failed to download file')
    }
  }

  const isImage = (mimeType?: string) => {
    return mimeType?.startsWith('image/')
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Loading attachments...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Paperclip className="w-5 h-5" />
          Attachments ({attachments.length})
        </h3>
        <div className="flex gap-2">
          <label className="cursor-pointer bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 flex items-center gap-1">
            <FileText className="w-4 h-4" />
            Upload File
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
          <button
            onClick={() => setShowRichTextEditor(!showRichTextEditor)}
            className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 flex items-center gap-1"
          >
            <Edit2 className="w-4 h-4" />
            Add Note
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {showRichTextEditor && (
        <div className="border rounded p-4 bg-gray-50">
          <input
            type="text"
            placeholder="Note title (optional)"
            value={richTextTitle}
            onChange={(e) => setRichTextTitle(e.target.value)}
            className="w-full mb-2 p-2 border rounded"
          />
          <textarea
            placeholder="Enter your note here..."
            value={richTextContent}
            onChange={(e) => setRichTextContent(e.target.value)}
            className="w-full h-32 p-2 border rounded"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleSaveRichText}
              disabled={uploading}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
            >
              Save Note
            </button>
            <button
              onClick={() => {
                setShowRichTextEditor(false)
                setRichTextContent("")
                setRichTextTitle("")
              }}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {uploading && (
        <div className="text-sm text-gray-500">Uploading...</div>
      )}

      {attachments.length === 0 ? (
        <div className="text-sm text-gray-500 italic">No attachments yet</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="border rounded p-4 bg-white">
              {attachment.document_type === 'file' ? (
                <>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {isImage(attachment.mime_type) ? (
                        <Image className="w-5 h-5 text-blue-500" />
                      ) : (
                        <FileText className="w-5 h-5 text-red-500" />
                      )}
                      <span className="font-medium text-sm truncate">
                        {attachment.file_name || 'Untitled'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDelete(attachment)}
                      className="text-red-500 hover:text-red-700"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {attachment.file_size && (
                    <div className="text-xs text-gray-500 mb-2">
                      {(attachment.file_size / 1024).toFixed(1)} KB
                    </div>
                  )}
                  {isImage(attachment.mime_type) && imageUrls[attachment.id] && (
                    <div className="mb-2">
                      <img
                        src={imageUrls[attachment.id]}
                        alt={attachment.file_name}
                        className="w-full h-32 object-cover rounded"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                  )}
                  <button
                    onClick={() => handleDownload(attachment)}
                    className="w-full bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 flex items-center justify-center gap-1"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-medium text-sm">{attachment.title || 'Note'}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(attachment.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(attachment)}
                      className="text-red-500 hover:text-red-700"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div
                    className="text-sm text-gray-700 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: attachment.content || '' }}
                  />
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
