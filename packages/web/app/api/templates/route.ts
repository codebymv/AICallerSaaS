import { NextRequest, NextResponse } from 'next/server';
import { getAllTemplates } from '@/lib/templates';

export async function GET(request: NextRequest) {
  try {
    const templates = getAllTemplates();
    return NextResponse.json({ templates });
  } catch (error) {
    console.error('[Templates] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}
