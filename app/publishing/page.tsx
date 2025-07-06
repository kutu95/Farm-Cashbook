'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Header from '@/components/Header'
import { Save, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'

interface Page {
  id: string
  slug: string
  title: string
  content: string
  meta_description: string
  is_published: boolean
  is_resolution: boolean
  created_at: string
  updated_at: string
}

export default function PublishingPage() {
  const router = useRouter()
  const { session, supabase } = useAuth()
  const [pages, setPages] = useState<Page[]>([])
  const [selectedPage, setSelectedPage] = useState<Page | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    slug: '',
    title: '',
    content: '',
    meta_description: '',
    is_published: false,
    is_resolution: false
  })

  useEffect(() => {
    checkAuthAndLoadPages()
  }, [session])

  const checkAuthAndLoadPages = async () => {
    if (!session?.user) {
      router.push('/login')
      return
    }

    try {
      // Check admin status
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (roleError) {
        console.error('Error checking admin status:', roleError)
        setError('Error checking admin status')
        return
      }

      if (!roleData || roleData.role !== 'admin') {
        router.push('/dashboard')
        return
      }

      setIsAdmin(true)
      await loadPages()
    } catch (err) {
      console.error('Error in auth check:', err)
      setError('Error checking authentication status')
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const loadPages = async () => {
    try {
      const { data, error } = await supabase
        .from('pages')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading pages:', error)
        setError('Error loading pages')
        return
      }

      setPages(data || [])
    } catch (err) {
      console.error('Error loading pages:', err)
      setError('Error loading pages')
    }
  }

  const handleCreateNew = () => {
    setSelectedPage(null)
    setFormData({
      slug: '',
      title: '',
      content: '',
      meta_description: '',
      is_published: false,
      is_resolution: false
    })
    setIsEditing(true)
  }

  const handleEditPage = (page: Page) => {
    setSelectedPage(page)
    setFormData({
      slug: page.slug,
      title: page.title,
      content: page.content || '',
      meta_description: page.meta_description || '',
      is_published: page.is_published,
      is_resolution: page.is_resolution || false
    })
    setIsEditing(true)
  }

  const handleSave = async () => {
    if (!formData.slug || !formData.title) {
      setError('Slug and title are required')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      if (selectedPage) {
        // Update existing page
        const { error } = await supabase
          .from('pages')
          .update({
            slug: formData.slug,
            title: formData.title,
            content: formData.content,
            meta_description: formData.meta_description,
            is_published: formData.is_published,
            is_resolution: formData.is_resolution
          })
          .eq('id', selectedPage.id)

        if (error) {
          console.error('Error updating page:', error)
          setError('Error updating page')
          return
        }
      } else {
        // Create new page
        const { error } = await supabase
          .from('pages')
          .insert({
            slug: formData.slug,
            title: formData.title,
            content: formData.content,
            meta_description: formData.meta_description,
            is_published: formData.is_published,
            is_resolution: formData.is_resolution
          })

        if (error) {
          console.error('Error creating page:', error)
          setError('Error creating page')
          return
        }
      }

      setSuccess(selectedPage ? 'Page updated successfully!' : 'Page created successfully!')
      setIsEditing(false)
      setSelectedPage(null)
      await loadPages()
    } catch (err) {
      console.error('Error saving page:', err)
      setError('Error saving page')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (pageId: string) => {
    if (!confirm('Are you sure you want to delete this page?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('pages')
        .delete()
        .eq('id', pageId)

      if (error) {
        console.error('Error deleting page:', error)
        setError('Error deleting page')
        return
      }

      setSuccess('Page deleted successfully!')
      await loadPages()
    } catch (err) {
      console.error('Error deleting page:', err)
      setError('Error deleting page')
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setSelectedPage(null)
    setFormData({
      slug: '',
      title: '',
      content: '',
      meta_description: '',
      is_published: false,
      is_resolution: false
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-6">
          <Header />
          <div className="flex justify-center items-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6">
        <Header />
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Page Publishing</h1>
            <button
              onClick={handleCreateNew}
              className="flex items-center bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              <Plus className="mr-2" size={16} />
              New Page
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
              {success}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Page List */}
            <div className="lg:col-span-1">
              <h2 className="text-xl font-semibold mb-4">Pages</h2>
              <div className="space-y-2">
                {pages.map((page) => (
                  <div
                    key={page.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedPage?.id === page.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleEditPage(page)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{page.title}</h3>
                        <p className="text-sm text-gray-500">/{page.slug}</p>
                        <div className="flex items-center mt-2">
                          {page.is_published ? (
                            <Eye className="text-green-500" size={14} />
                          ) : (
                            <EyeOff className="text-gray-400" size={14} />
                          )}
                          <span className="text-xs ml-1">
                            {page.is_published ? 'Published' : 'Draft'}
                          </span>
                          {page.is_resolution && (
                            <span className="text-xs ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded">
                              Resolution
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(page.id)
                        }}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {pages.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No pages found. Create your first page!
                  </div>
                )}
              </div>
            </div>

            {/* Editor */}
            <div className="lg:col-span-2">
              {isEditing ? (
                <div className="bg-white border rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">
                    {selectedPage ? 'Edit Page' : 'Create New Page'}
                  </h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Slug (URL path)
                      </label>
                      <input
                        type="text"
                        value={formData.slug}
                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="about-us"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Title
                      </label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Page Title"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Meta Description
                      </label>
                      <textarea
                        value={formData.meta_description}
                        onChange={(e) => setFormData({ ...formData, meta_description: e.target.value })}
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        rows={3}
                        placeholder="Brief description for search engines..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Content
                      </label>
                      <textarea
                        value={formData.content}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        rows={15}
                        placeholder="Enter your page content here..."
                      />
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="is_published"
                        checked={formData.is_published}
                        onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                        className="mr-2"
                      />
                      <label htmlFor="is_published" className="text-sm font-medium text-gray-700">
                        Publish this page
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="is_resolution"
                        checked={formData.is_resolution}
                        onChange={(e) => setFormData({ ...formData, is_resolution: e.target.checked })}
                        className="mr-2"
                      />
                      <label htmlFor="is_resolution" className="text-sm font-medium text-gray-700">
                        Mark as resolution
                      </label>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
                      >
                        <Save className="mr-2" size={16} />
                        {saving ? 'Saving...' : 'Save Page'}
                      </button>
                      <button
                        onClick={handleCancel}
                        className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white border rounded-lg p-6">
                  <div className="text-center py-8 text-gray-500">
                    Select a page to edit or create a new one
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 