import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Server-side Supabase client - use service_role if available, fallback to anon
function getAdminClient() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Try service_role first, fallback to anon key
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log('[positions API] env check:', {
    hasUrl: !!SUPABASE_URL,
    hasKey: !!KEY,
    keyType: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon'
  });

  if (!SUPABASE_URL || !KEY) {
    throw new Error('Missing Supabase config');
  }

  return createClient(SUPABASE_URL, KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// GET - list all positions
export async function GET() {
  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('positions')
      .select('*')
      .order('order_num, name');

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST - create new position
export async function POST(request) {
  console.log('[positions API] POST request received');
  try {
    const body = await request.json();
    console.log('[positions API] POST body:', body);
    const supabase = getAdminClient();
    console.log('[positions API] Admin client created successfully');

    const { data, error } = await supabase
      .from('positions')
      .insert(body)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH - update position
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from('positions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE - delete position
export async function DELETE(request) {
  try {
    const body = await request.json();
    const { id } = body;
    const supabase = getAdminClient();

    const { error } = await supabase
      .from('positions')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT - update user position (add/remove from position)
export async function PUT(request) {
  try {
    const body = await request.json();
    const { userId, positionId } = body;
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from('users')
      .update({ position_id: positionId })
      .eq('id', userId)
      .select('id, name, position_id')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
