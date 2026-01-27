import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
// These environment variables need to be set in .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Upload an image file to Supabase Storage
 * @param file - The file to upload
 * @param filename - The filename to use in storage
 * @returns The public URL of the uploaded image
 */
export async function uploadImageToSupabase(
  file: File,
  filename: string
): Promise<string> {
  try {
    // Upload to the 'ai-video-assets' bucket
    const { data, error } = await supabase.storage
      .from('ai-video-assets')
      .upload(`images/${Date.now()}-${filename}`, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('ai-video-assets')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading to Supabase:', error);
    throw error;
  }
}

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
