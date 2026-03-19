import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Color categories for Outlook
const CATEGORY_COLORS: Record<string, string> = {
  'Planning': 'Blue',
  'Tasting': 'Orange', 
  'BEO': 'Purple',
  'Menu': 'Green',
  'GuestCount': 'Red',
  'ThankYou': 'Pink'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data, error } = await supabase
      .from('csm_events')
      .select('*')
      .eq('id', 'main')
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    const events = data?.data || []

    let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//The Compton//CSM Timeline//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:CSM Deadlines
X-WR-CALDESC:Conference Services Manager deadlines for The Compton
`

    events.forEach((event: any) => {
      if (!event.timeline) return
      
      event.timeline.forEach((item: any) => {
        const date = new Date(item.date)
        const dateStr = date.toISOString().split('T')[0].replace(/-/g, '')
        const uid = `${event.id}-${dateStr}-${item.task.replace(/\s/g, '')}@thecompton.csm`
        const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
        
        // Format: "(task) for [BOOKING]"
        const summary = `${item.task} for ${event.groupName}`
        
        // Description with contact info
        let description = `Event: ${event.groupName}\\n`
        description += `Type: ${event.eventType === 'wedding' ? 'Wedding' : 'Event'}\\n`
        description += `Event Date: ${new Date(event.eventDate).toLocaleDateString()}\\n`
        if (event.contactName) {
          description += `Contact: ${event.contactName}\\n`
        }
        
        // Category for color coding
        const category = item.category || 'Planning'
        
        ics += `BEGIN:VEVENT
DTSTART;VALUE=DATE:${dateStr}
DTSTAMP:${now}
SUMMARY:${summary}
DESCRIPTION:${description}
CATEGORIES:${category}
UID:${uid}
STATUS:CONFIRMED
END:VEVENT
`
      })
    })

    ics += 'END:VCALENDAR'

    return new Response(ics, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="csm-deadlines.ics"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })

  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
