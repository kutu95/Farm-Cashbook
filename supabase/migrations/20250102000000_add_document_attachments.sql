-- Create document attachments table
-- Supports attachments to both expenses and payments
-- Can store file references (PDFs, images) or rich text content

CREATE TABLE IF NOT EXISTS public.document_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
    
    -- Document type: 'file' for uploaded files, 'richtext' for rich text notes
    document_type TEXT NOT NULL CHECK (document_type IN ('file', 'richtext')),
    
    -- For file uploads: path in storage bucket
    file_path TEXT,
    file_name TEXT,
    file_size BIGINT,
    mime_type TEXT,
    
    -- For rich text: HTML content
    content TEXT,
    
    -- Metadata
    title TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Ensure either expense_id or payment_id is set, but not both
    CONSTRAINT document_attachment_reference_check CHECK (
        (expense_id IS NOT NULL AND payment_id IS NULL) OR
        (expense_id IS NULL AND payment_id IS NOT NULL)
    ),
    
    -- Ensure file_path is set for file type, content for richtext type
    CONSTRAINT document_type_content_check CHECK (
        (document_type = 'file' AND file_path IS NOT NULL) OR
        (document_type = 'richtext' AND content IS NOT NULL)
    )
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_document_attachments_expense_id 
    ON public.document_attachments(expense_id);

CREATE INDEX IF NOT EXISTS idx_document_attachments_payment_id 
    ON public.document_attachments(payment_id);

CREATE INDEX IF NOT EXISTS idx_document_attachments_created_by 
    ON public.document_attachments(created_by);

-- Enable RLS
ALTER TABLE public.document_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "All authenticated users can view document attachments"
    ON public.document_attachments FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "All authenticated users can insert document attachments"
    ON public.document_attachments FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "All authenticated users can update document attachments"
    ON public.document_attachments FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "All authenticated users can delete document attachments"
    ON public.document_attachments FOR DELETE
    TO authenticated
    USING (true);

-- Add comment
COMMENT ON TABLE public.document_attachments IS 'Stores document attachments (files or rich text) for expenses and payments';
