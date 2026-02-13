import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface Section {
  title: string;
  content?: string;
  parent_id?: number | null;
  order_num: number;
}

interface Chapter {
  title: string;
  content: string;
  order_num: number;
}

serve(async (req) => {
  try {
    const { sections } = await req.json();

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get document_id for ПВП ДАУ
    const { data: doc, error: docError } = await supabase
      .from('guide_documents')
      .select('id')
      .eq('title_short', 'ПВП ДАУ')
      .single();

    if (docError || !doc) {
      return new Response(
        JSON.stringify({ error: 'Document not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const document_id = doc.id;
    const results: any[] = [];

    for (const section of sections) {
      // Insert main section (without content = accordion)
      const { data: mainSection, error: mainError } = await supabase
        .from('guide_sections')
        .insert({
          document_id,
          title: section.title,
          parent_id: null,
          order_num: section.order_num
        })
        .select('id')
        .single();

      if (mainError) {
        return new Response(
          JSON.stringify({ error: mainError.message }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const mainSectionId = mainSection.id;
      results.push({ mainSection: section.title, id: mainSectionId });

      // Insert subsections if they exist
      if (section.chapters && section.chapters.length > 0) {
        for (const chapter of section.chapters) {
          const { data: subsection, error: subError } = await supabase
            .from('guide_sections')
            .insert({
              document_id,
              title: chapter.title,
              content: chapter.content,
              parent_id: mainSectionId,
              order_num: chapter.order_num
            })
            .select('id')
            .single();

          if (subError) {
            return new Response(
              JSON.stringify({ error: subError.message }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
          }

          results.push({ subsection: chapter.title, id: subsection.id });
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
