exports.id=923,exports.ids=[923],exports.modules={42658:()=>{},97377:()=>{},23367:(e,a,t)=>{Promise.resolve().then(t.bind(t,42302))},42302:(e,a,t)=>{"use strict";t.r(a),t.d(a,{default:()=>w});var i=t(10326),n=t(17577),o=t(46226),s=t(90434),l=t(35047),r=t(24319),c=t(50732),d=t(97937),p=t(24061),u=t(49423),m=t(74603),h=t(40617),g=t(77506),f=t(94019),b=t(90748),y=t(88378),N=t(71810),E=t(91664),I=t(18069);t(31476);var O=t(84097);let v=[{href:"/dashboard",label:"Dashboard",icon:r.Z},{href:"/dashboard/agents",label:"Agents",icon:c.Z},{href:"/dashboard/voices",label:"Voices",icon:d.Z},{href:"/dashboard/contacts",label:"Contacts",icon:p.Z},{href:"/dashboard/dialpad",label:"Dialpad",icon:u.Z},{href:"/dashboard/calls",label:"Call Logs",icon:m.Z},{href:"/dashboard/messaging",label:"Messaging",icon:h.Z}];function w({children:e}){let a=(0,l.useRouter)(),t=(0,l.usePathname)(),[r,c]=(0,n.useState)(null),[d,p]=(0,n.useState)(!0),[u,m]=(0,n.useState)(!1);return(function(e){let{toast:a}=(0,O.pm)(),t=(0,n.useRef)(null);(0,n.useRef)(!1),(0,n.useCallback)(e=>{console.log("[CallEvents] Call started:",e),a({title:"\uD83D\uDCDE Call Connected",description:"Agent is now on the line"})},[a]),(0,n.useCallback)(e=>{console.log("[CallEvents] Call ended:",e),a({title:"\uD83D\uDCF4 Call Ended",description:"The call has been completed"})},[a]),t.current}(r?.id),d)?i.jsx("div",{className:"min-h-screen flex items-center justify-center",children:i.jsx(g.Z,{className:"h-8 w-8 animate-spin text-teal-600"})}):(0,i.jsxs)("div",{className:"bg-slate-50",children:[(0,i.jsxs)("div",{className:"lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b px-4 py-3 flex items-center justify-between",children:[i.jsx(E.z,{variant:"ghost",size:"icon",onClick:()=>m(!u),className:"-ml-2",children:u?i.jsx(f.Z,{className:"h-5 w-5"}):i.jsx(b.Z,{className:"h-5 w-5"})}),(0,i.jsxs)("div",{className:"flex items-center gap-3 absolute left-1/2 transform -translate-x-1/2",children:[i.jsx(o.default,{src:"/gleam-logo-icon.png",alt:"Gleam",width:28,height:28,priority:!0,className:"h-7 w-7"}),i.jsx(o.default,{src:"/gleam-logo-text.png",alt:"Gleam",width:80,height:24,priority:!0,className:"h-6 w-auto"})]})]}),i.jsx("aside",{className:`fixed top-[60px] lg:top-0 bottom-0 left-0 z-40 w-64 bg-slate-50/90 backdrop-blur-xl border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${u?"translate-x-0":"-translate-x-full"}`,children:(0,i.jsxs)("div",{className:"flex flex-col h-full",children:[(0,i.jsxs)("div",{className:"flex items-center gap-3 px-6 py-5 bg-gradient-to-b from-[#0fa693] to-teal-600",children:[i.jsx(o.default,{src:"/logo-icon-transparent-inverted.png",alt:"Gleam Icon",width:32,height:32,priority:!0,className:"h-8 w-8"}),i.jsx(o.default,{src:"/gleam-logo-text-inverted.png",alt:"Gleam",width:100,height:32,priority:!0,className:"h-7 w-auto"})]}),i.jsx("nav",{className:"flex-1 px-4 py-4 space-y-1",children:v.map(e=>{let a=e.icon,n="/dashboard"===e.href?"/dashboard"===t:t.startsWith(e.href);return(0,i.jsxs)(s.default,{href:e.href,className:`group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${n?"bg-gradient-to-b from-[#0fa693] to-teal-600 text-white":"text-slate-600 hover:bg-slate-100"}`,onClick:()=>m(!1),children:[i.jsx(a,{className:`h-5 w-5 transition-colors ${n?"":"group-hover:text-teal-600"}`}),e.label]},e.href)})}),i.jsx("div",{className:"px-4 pb-4",children:(0,i.jsxs)(s.default,{href:"/dashboard/settings",className:`group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${t.startsWith("/dashboard/settings")?"bg-gradient-to-b from-[#0fa693] to-teal-600 text-white":"text-slate-600 hover:bg-slate-100"}`,onClick:()=>m(!1),children:[i.jsx(y.Z,{className:`h-5 w-5 transition-colors ${t.startsWith("/dashboard/settings")?"":"group-hover:text-teal-600"}`}),"Settings"]})}),(0,i.jsxs)("div",{className:"p-4 bg-teal-600",children:[(0,i.jsxs)("div",{className:"flex items-center gap-3 px-3 py-2",children:[i.jsx("div",{className:"w-8 h-8 rounded-full bg-white/20 flex items-center justify-center",children:i.jsx("span",{className:"text-sm font-medium text-white",children:r?.name?.charAt(0)||r?.email?.charAt(0)||"U"})}),(0,i.jsxs)("div",{className:"flex-1 min-w-0",children:[i.jsx("p",{className:"text-sm font-medium text-white truncate",children:r?.name||"User"}),i.jsx("p",{className:"text-xs text-white truncate",children:r?.email})]})]}),(0,i.jsxs)(E.z,{variant:"ghost",className:"w-full justify-start mt-2 text-white/80 hover:bg-white/10 hover:text-white",onClick:()=>{I.h.logout(),a.push("/login")},children:[i.jsx(N.Z,{className:"h-4 w-4 mr-2"}),"Log out"]})]})]})}),(0,i.jsxs)("main",{className:"lg:pl-64 relative min-h-screen",children:[(0,i.jsxs)("div",{className:"fixed inset-0 pointer-events-none overflow-hidden",children:[i.jsx("div",{className:"absolute inset-0 bg-gradient-to-br from-slate-50 via-teal-50/20 to-slate-100/50"}),i.jsx("div",{className:"absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-teal-100/30 to-transparent rounded-full blur-3xl"}),i.jsx("div",{className:"absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-slate-200/30 to-transparent rounded-full blur-3xl"}),i.jsx("div",{className:"absolute top-1/2 left-1/3 w-[300px] h-[300px] bg-gradient-to-r from-teal-50/40 to-transparent rounded-full blur-3xl"})]}),i.jsx("div",{className:"relative p-4 sm:p-6 pt-20 lg:pt-6",children:e})]}),u&&i.jsx("div",{className:"fixed inset-0 bg-black/50 z-30 lg:hidden",onClick:()=>m(!1)})]})}},29752:(e,a,t)=>{"use strict";t.d(a,{Ol:()=>l,SZ:()=>c,Zb:()=>s,aY:()=>d,eW:()=>p,ll:()=>r});var i=t(10326),n=t(17577),o=t(51223);let s=n.forwardRef(({className:e,...a},t)=>i.jsx("div",{ref:t,className:(0,o.cn)("rounded-lg border bg-card text-card-foreground shadow-sm",e),...a}));s.displayName="Card";let l=n.forwardRef(({className:e,...a},t)=>i.jsx("div",{ref:t,className:(0,o.cn)("flex flex-col space-y-1.5 p-6",e),...a}));l.displayName="CardHeader";let r=n.forwardRef(({className:e,...a},t)=>i.jsx("h3",{ref:t,className:(0,o.cn)("text-2xl font-semibold leading-none tracking-tight",e),...a}));r.displayName="CardTitle";let c=n.forwardRef(({className:e,...a},t)=>i.jsx("p",{ref:t,className:(0,o.cn)("text-sm text-muted-foreground",e),...a}));c.displayName="CardDescription";let d=n.forwardRef(({className:e,...a},t)=>i.jsx("div",{ref:t,className:(0,o.cn)("p-6 pt-0",e),...a}));d.displayName="CardContent";let p=n.forwardRef(({className:e,...a},t)=>i.jsx("div",{ref:t,className:(0,o.cn)("flex items-center p-6 pt-0",e),...a}));p.displayName="CardFooter"},53566:(e,a,t)=>{"use strict";t.d(a,{Cy:()=>i,TR:()=>f,Vt:()=>g,Xg:()=>d,fn:()=>h,iA:()=>r,jt:()=>l,mN:()=>p,sR:()=>c,yh:()=>o,zl:()=>s});let i=[{id:"rachel",name:"Rachel",description:"Calm, professional female voice",avatar:"/rachel.png"},{id:"drew",name:"Drew",description:"Confident, articulate male voice",avatar:"/drew.png"},{id:"clyde",name:"Clyde",description:"Warm, friendly male voice",avatar:"/clyde.png"},{id:"paul",name:"Paul",description:"Clear, authoritative male voice",avatar:"/paul.png"},{id:"domi",name:"Domi",description:"Energetic, youthful female voice",avatar:"/domi.png"},{id:"dave",name:"Dave",description:"Conversational male voice",avatar:"/dave.png"},{id:"fin",name:"Fin",description:"Sophisticated Irish male voice",avatar:"/fin.png"},{id:"sarah",name:"Sarah",description:"Soft, friendly female voice",avatar:"/sarah.png"},{id:"antoni",name:"Antoni",description:"Warm, expressive male voice",avatar:"/antoni.png"},{id:"thomas",name:"Thomas",description:"Calm, reassuring male voice",avatar:"/thomas.png"},{id:"charlie",name:"Charlie",description:"Natural Australian male voice",avatar:"/charlie.png"}],n={INVALID_CREDENTIALS:"INVALID_CREDENTIALS",TOKEN_EXPIRED:"TOKEN_EXPIRED",UNAUTHORIZED:"UNAUTHORIZED",VALIDATION_ERROR:"VALIDATION_ERROR",INVALID_INPUT:"INVALID_INPUT",NOT_FOUND:"NOT_FOUND",ALREADY_EXISTS:"ALREADY_EXISTS",RATE_LIMITED:"RATE_LIMITED",INTERNAL_ERROR:"INTERNAL_ERROR",SERVICE_UNAVAILABLE:"SERVICE_UNAVAILABLE",CALL_FAILED:"CALL_FAILED",CALL_IN_PROGRESS:"CALL_IN_PROGRESS"};n.INVALID_CREDENTIALS,n.TOKEN_EXPIRED,n.UNAUTHORIZED,n.VALIDATION_ERROR,n.INVALID_INPUT,n.NOT_FOUND,n.ALREADY_EXISTS,n.RATE_LIMITED,n.INTERNAL_ERROR,n.SERVICE_UNAVAILABLE,n.CALL_FAILED,n.CALL_IN_PROGRESS;let o={completed:"bg-green-100 text-green-700","in-progress":"bg-blue-100 text-blue-700",failed:"bg-red-100 text-red-700",ringing:"bg-yellow-100 text-yellow-700",busy:"bg-orange-100 text-orange-700","no-answer":"bg-slate-100 text-slate-600",queued:"bg-slate-100 text-slate-600",canceled:"bg-slate-100 text-slate-600",default:"bg-slate-100 text-slate-600"},s={inbound:{bg:"bg-teal-100",icon:"text-teal-600"},outbound:{bg:"bg-teal-100",icon:"text-teal-600"}},l={INBOUND:{id:"INBOUND",label:"Inbound",description:"Receive inbound calls only",descriptionMessaging:"Receive messages only",descriptionOmni:"Receive communications only",iconType:"ArrowDownLeft"},OUTBOUND:{id:"OUTBOUND",label:"Outbound",description:"Make outbound calls only",descriptionMessaging:"Send messages only",descriptionOmni:"Send communications only",iconType:"ArrowUpRight"},HYBRID:{id:"HYBRID",label:"Hybrid",description:"Make and receive calls",descriptionMessaging:"Send and receive messages",descriptionOmni:"Send and receive communications",iconType:"ArrowLeftRight"}};function r(e,a){let t=l[e];return"MESSAGING_ONLY"===a?t.descriptionMessaging:"OMNICHANNEL"===a?t.descriptionOmni:t.description}let c={VOICE_ONLY:{id:"VOICE_ONLY",label:"Voice Only",description:"Handle calls with voice AI",iconType:"Phone"},MESSAGING_ONLY:{id:"MESSAGING_ONLY",label:"Messaging Only",description:"Handle SMS/MMS conversations",iconType:"MessageSquare"},OMNICHANNEL:{id:"OMNICHANNEL",label:"Omnichannel",description:"Handle both calls and texts",iconType:"Layers"}},d={IMAGE:{label:"Image",color:"bg-blue-100 text-blue-700"},DOCUMENT:{label:"Document",color:"bg-amber-100 text-amber-700"},VIDEO:{label:"Video",color:"bg-purple-100 text-purple-700"},OTHER:{label:"Other",color:"bg-slate-100 text-slate-600"}},p={SCHEDULE_APPOINTMENTS:{id:"SCHEDULE_APPOINTMENTS",label:"Schedule Appointments",description:"Book meetings and manage calendar",value:"Schedule appointments and manage bookings",iconType:"Calendar"},ANSWER_SUPPORT:{id:"ANSWER_SUPPORT",label:"Answer Support Questions",description:"Handle customer service inquiries",value:"Answer customer support questions and resolve issues",iconType:"HelpCircle"},COLLECT_INFO:{id:"COLLECT_INFO",label:"Collect Information",description:"Surveys and intake forms",value:"Collect information through surveys or intake forms",iconType:"ClipboardList"},SEND_REMINDERS:{id:"SEND_REMINDERS",label:"Send Reminders",description:"Appointment and payment reminders",value:"Send reminders for appointments or payments",iconType:"Bell"},GENERAL_INQUIRIES:{id:"GENERAL_INQUIRIES",label:"General Inquiries",description:"Answer common questions",value:"Handle general inquiries and provide information",iconType:"MessageCircle"},CUSTOM:{id:"CUSTOM",label:"Custom",description:"Define your own purpose",value:"",iconType:"Edit"}},u={INBOUND:{base:`You are a professional and friendly inbound call receptionist. Callers are reaching out to you, so your job is to welcome them warmly and assist with their needs.

CORE BEHAVIORS:
- Answer with a warm, professional greeting
- Listen carefully to understand why they're calling
- Ask clarifying questions when needed
- Provide helpful information or route them appropriately
- Keep responses concise (1-3 sentences at a time)
- Never leave callers waiting without explanation

CONVERSATION STYLE:
- Be patient and attentive - they called you for help
- Use the caller's name once you learn it
- Match your energy to theirs (calm caller = calm response)
- If you can't help with something, explain what you CAN do

HANDLING COMMON SCENARIOS:
- General inquiries: Answer questions clearly, offer to provide more details
- Complaints: Acknowledge their frustration, focus on solutions
- Transfers: Explain who you're connecting them with and why
- Callbacks: Confirm their number and expected timeframe`,withCalendar:`You are a professional and friendly inbound call receptionist with scheduling capabilities. Callers are reaching out to you, so your job is to welcome them warmly and assist with their needs, including booking appointments.

CORE BEHAVIORS:
- Answer with a warm, professional greeting
- Listen carefully to understand why they're calling
- If they want to schedule, check availability immediately using the calendar tools
- Collect required information: name and email address (email is REQUIRED for booking)
- Keep responses concise (1-3 sentences at a time)

SCHEDULING FLOW:
1. When caller mentions scheduling/appointment/meeting, use check_calendar_availability tool
2. Present 2-3 available time options conversationally
3. Once they choose, collect their name and email (email is REQUIRED)
4. Use book_appointment tool to confirm the booking
5. Repeat the confirmed date/time back to them

CONVERSATION STYLE:
- Be patient and attentive - they called you for help
- Use the caller's name once you learn it
- For scheduling, be proactive: "Let me check what times are available"
- Always confirm booking details before ending the call

IMPORTANT: Never guess or make up available times - always use the calendar tool to check real availability.`},OUTBOUND:{base:`You are a professional outbound calling agent. You are initiating this call, so be respectful of the recipient's time and get to the point efficiently.

CORE BEHAVIORS:
- Introduce yourself and your organization immediately
- State the purpose of your call within the first 15 seconds
- Be prepared for rejection and handle it gracefully
- Keep the call focused and time-efficient
- Ask permission before continuing: "Is this a good time?"

CONVERSATION STYLE:
- Confident but not pushy
- Respectful of their time - they didn't initiate this call
- Have a clear goal for the call
- If they're busy, offer to call back at a better time

HANDLING OBJECTIONS:
- "I'm busy": "I understand - when would be a better time to call back?"
- "Not interested": "I appreciate your time. May I ask what would make this more relevant?"
- "How did you get my number?": Be honest and transparent about your source

CALL STRUCTURE:
1. Greeting + introduction (who you are, why calling)
2. Value proposition (what's in it for them)
3. Engagement question (qualify their interest)
4. Next steps or graceful close
5. Thank them regardless of outcome`,withCalendar:`You are a professional outbound calling agent with scheduling capabilities. You are initiating this call to offer valuable appointments or consultations.

CORE BEHAVIORS:
- Introduce yourself and your organization immediately
- State the purpose: you're calling to help them schedule a valuable meeting
- Be prepared for rejection and handle it gracefully
- Ask permission before continuing: "Is this a good time?"

SCHEDULING FLOW:
1. After establishing rapport, mention the appointment opportunity
2. If interested, use check_calendar_availability to find times
3. Present 2-3 options that work for their schedule
4. Collect: name (confirm spelling), email (REQUIRED for confirmation)
5. Use book_appointment to lock in the time
6. Confirm details and explain what happens next

CONVERSATION STYLE:
- Confident but not pushy - you're offering something valuable
- Be efficient with their time
- If they're interested but busy: "Let me quickly check availability and find a time that works"
- Handle scheduling naturally as part of the conversation

HANDLING OBJECTIONS:
- "I'm busy": "I can check availability right now - takes 30 seconds"
- "Send me an email": "Happy to, but I can also confirm a time right now while I have you"
- "Not interested": Thank them and end gracefully

IMPORTANT: The email address is REQUIRED for booking - always collect it before using book_appointment.`},HYBRID:{base:`You are a versatile phone agent capable of handling both incoming and outgoing calls. Adapt your approach based on the call direction.

FOR INBOUND CALLS (they called you):
- Answer with a warm, professional greeting
- Be patient and helpful - they reached out for assistance
- Listen first, then respond to their specific needs
- Take time to understand their situation fully

FOR OUTBOUND CALLS (you called them):
- Introduce yourself and state your purpose immediately
- Be respectful of their time - they didn't expect this call
- Ask "Is this a good time?" early in the conversation
- Have a clear goal and be efficient

CORE BEHAVIORS BOTH MODES:
- Keep responses concise (1-3 sentences)
- Use their name once you learn it
- Be professional but personable
- If you can't help, explain what you CAN do
- End calls on a positive note

CONVERSATION STYLE:
- Match your energy to the caller's tone
- Be adaptable - some calls are quick, others need time
- Stay focused on helping them achieve their goal`,withCalendar:`You are a versatile phone agent with scheduling capabilities, handling both incoming and outgoing calls. Adapt your approach based on the call direction while maintaining booking capabilities.

FOR INBOUND CALLS (they called you):
- Answer with a warm, professional greeting
- If they mention scheduling, check availability immediately
- Be patient and helpful - they reached out for assistance
- Offer convenient appointment options proactively

FOR OUTBOUND CALLS (you called them):
- Introduce yourself and state your purpose immediately
- If offering appointments, have availability ready
- Be respectful of their time
- Ask "Is this a good time?" early in the conversation

SCHEDULING FLOW (BOTH MODES):
1. When scheduling comes up, use check_calendar_availability tool
2. Present 2-3 convenient time options
3. Collect required info: name and email (email is REQUIRED)
4. Use book_appointment to confirm
5. Verify the booking details with them

CORE BEHAVIORS:
- Keep responses concise (1-3 sentences)
- For scheduling: "Let me check what times work" - then use the tool
- Never guess availability - always check the calendar
- Confirm all booking details before ending

IMPORTANT: Email address is REQUIRED for all bookings. Always ask for and verify the email before using book_appointment.`}},m={INBOUND:{base:`You are a professional and friendly text messaging assistant. People are texting you for help, so respond promptly and helpfully.

CORE BEHAVIORS:
- Respond within 1-2 short sentences when possible
- Be clear and concise - texts should be easy to read quickly
- Use friendly but professional language
- Ask one question at a time to keep the conversation flowing
- If something needs explanation, break it into multiple messages

TEXT MESSAGING STYLE:
- Keep messages under 160 characters when possible (SMS limit)
- Use simple, direct language
- It's okay to use common abbreviations (e.g., "appt" for appointment)
- Avoid long paragraphs - bullet points or separate messages work better
- Use emojis sparingly for warmth (1-2 max per message) 👋

HANDLING COMMON SCENARIOS:
- Quick questions: Answer directly and offer to help with more
- Complex topics: Break into multiple shorter messages
- Complaints: Acknowledge, apologize briefly, focus on resolution
- Unclear messages: Ask one clarifying question`,withCalendar:`You are a professional text messaging assistant with scheduling capabilities. Help people book appointments efficiently via text.

CORE BEHAVIORS:
- Respond concisely - texts should be scannable
- When they want to schedule, check availability immediately
- Present time options as a numbered list for easy selection
- Collect name and email (email REQUIRED for booking)

SCHEDULING FLOW:
1. User mentions scheduling → use check_calendar_availability
2. Present options like:
   "I have these times:
   1️⃣ Mon 10am
   2️⃣ Tue 2pm
   3️⃣ Wed 11am
   Reply with a number!"
3. After they choose, get their email
4. Use book_appointment and confirm

TEXT MESSAGING STYLE:
- Keep messages short and scannable
- Use numbered lists for options
- One question at a time
- Confirm bookings with all details

IMPORTANT: Email is REQUIRED for booking. Always collect it before confirming.`},OUTBOUND:{base:`You are a professional outbound text messaging agent. You're reaching out to people, so be respectful and get to the point quickly.

CORE BEHAVIORS:
- Introduce yourself and your purpose in the first message
- Keep texts short and scannable
- Be prepared for no response - that's okay
- Offer value before asking for anything
- Make it easy to opt-out

OUTBOUND TEXT STYLE:
- First message: Who you are + why you're texting + value prop
- Keep under 160 characters per message when possible
- Ask one thing at a time
- Make responses easy (yes/no, numbers, etc.)

MESSAGE STRUCTURE:
1. "Hi [Name]! This is [Agent] from [Company]."
2. Brief value proposition
3. Simple call-to-action or question
4. "Reply STOP to opt out"

HANDLING RESPONSES:
- "Who is this?": Reintroduce yourself clearly
- No response: One follow-up max, then stop
- "Stop/Unsubscribe": Acknowledge and confirm removal immediately`,withCalendar:`You are a professional outbound text messaging agent with scheduling capabilities. You're reaching out to help people book valuable appointments.

CORE BEHAVIORS:
- Introduce yourself and purpose clearly
- Offer appointment booking as a convenience
- Present availability in easy-to-choose format
- Collect name and email for booking (email REQUIRED)

OUTBOUND SCHEDULING FLOW:
1. Introduce: "Hi! This is [Agent] from [Company]. I'm reaching out about scheduling your [appointment type]."
2. If interested, use check_calendar_availability
3. Send numbered options:
   "Available times:
   1️⃣ Mon 10am
   2️⃣ Tue 3pm
   Reply with a number or suggest another time!"
4. Collect email before booking
5. Confirm with book_appointment

TEXT STYLE:
- First message under 160 chars with clear purpose
- Numbered lists for easy selection
- One question at a time
- Include opt-out option: "Reply STOP to opt out"

IMPORTANT: Always collect email before booking. Be respectful - no response after one follow-up means stop.`},HYBRID:{base:`You are a versatile text messaging agent handling both incoming and outgoing conversations. Adapt your style based on who initiated.

FOR INBOUND TEXTS (they texted you):
- They want help - be responsive and helpful
- Answer their questions directly
- Be patient with back-and-forth

FOR OUTBOUND TEXTS (you texted them):
- You're reaching out - respect their time
- State your purpose immediately
- Make it easy to respond or opt-out

CORE TEXT BEHAVIORS:
- Keep messages short (under 160 chars when possible)
- One question or topic at a time
- Use numbered lists for multiple options
- Be professional but warm
- Quick, helpful responses

HANDLING BOTH MODES:
- Inbound: Focus on solving their issue
- Outbound: Focus on delivering value quickly
- Both: Make responding easy with clear options`,withCalendar:`You are a versatile text messaging agent with scheduling capabilities, handling both incoming and outgoing conversations.

FOR INBOUND (they texted you):
- If they mention scheduling, check availability right away
- Be helpful and responsive
- Guide them through booking step by step

FOR OUTBOUND (you texted them):
- Introduce yourself and offer scheduling
- Make booking convenient and quick
- Respect if they don't respond

SCHEDULING FLOW (BOTH):
1. Use check_calendar_availability when scheduling comes up
2. Present options as numbered list:
   "Times available:
   1️⃣ Mon 10am
   2️⃣ Tue 2pm
   3️⃣ Wed 11am
   Reply with a number!"
3. Collect name and email (email REQUIRED)
4. Confirm with book_appointment
5. Send confirmation with all details

TEXT STYLE:
- Short, scannable messages
- Numbered options for easy reply
- One question at a time
- Confirm all booking details

IMPORTANT: Email is REQUIRED for all bookings.`}};function h(e,a,t,i="VOICE_ONLY"){let n=("MESSAGING_ONLY"===i?m:u)[e],o=a?n.withCalendar:n.base;if(t&&(t.organizationName||t.personaName||t.callPurpose)){let e=["=== BUSINESS CONTEXT ==="];t.organizationName&&e.push(`Organization: ${t.organizationName}`),t.industry&&e.push(`Industry: ${t.industry}`),t.businessDescription&&e.push(`About: ${t.businessDescription}`),t.personaName&&e.push(`Your Name: ${t.personaName} (use this when introducing yourself)`),t.callPurpose&&e.push(`Call Purpose: ${t.callPurpose}`),e.push("========================\n"),o=e.join("\n")+o,t.organizationName&&(o=(o=(o=o.replace(/your organization/gi,t.organizationName)).replace(/\[company\]/gi,t.organizationName)).replace(/\[Your Organization\]/gi,t.organizationName))}return o}function g(e){return"VOICE_ONLY"===e||"OMNICHANNEL"===e}function f(e){return"MESSAGING_ONLY"===e||"OMNICHANNEL"===e}},22834:(e,a,t)=>{"use strict";t.r(a),t.d(a,{default:()=>i});let i=(0,t(68570).createProxy)(String.raw`C:\Users\roxas\OneDrive\Desktop\PROJECTS\AICallerSaaS\frontend\src\app\dashboard\layout.tsx#default`)}};