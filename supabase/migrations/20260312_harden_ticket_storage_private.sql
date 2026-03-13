-- Harden ticket storage: private bucket, owner-scoped writes, and path-only references

-- Ensure ticket files are not publicly accessible.
UPDATE storage.buckets
SET public = false
WHERE id = 'tickets';

-- Normalize existing stored URLs to bucket-relative paths.
UPDATE public.tickets
SET pdf_url = regexp_replace(
  split_part(pdf_url, '?', 1),
  '^https?://[^/]+/storage/v1/object/(public|authenticated|sign)/tickets/',
  ''
)
WHERE pdf_url ~ '^https?://[^/]+/storage/v1/object/(public|authenticated|sign)/tickets/.+';

-- Authenticated users can upload files only in their own folder.
DROP POLICY IF EXISTS "tickets_objects_insert_own_folder" ON storage.objects;
CREATE POLICY "tickets_objects_insert_own_folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tickets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can update/delete only their own files in tickets bucket.
DROP POLICY IF EXISTS "tickets_objects_update_own_folder" ON storage.objects;
CREATE POLICY "tickets_objects_update_own_folder"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tickets'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'tickets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "tickets_objects_delete_own_folder" ON storage.objects;
CREATE POLICY "tickets_objects_delete_own_folder"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'tickets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
