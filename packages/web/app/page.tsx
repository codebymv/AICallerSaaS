export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-4">
          AI Caller SaaS
        </h1>
        <p className="text-center text-muted-foreground mb-8">
          Build and deploy AI voice agents for your business
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <div className="p-6 border rounded-lg">
            <h2 className="text-2xl font-semibold mb-2">📞 Voice Agents</h2>
            <p className="text-muted-foreground">
              Create AI agents that can handle inbound and outbound calls naturally
            </p>
          </div>
          
          <div className="p-6 border rounded-lg">
            <h2 className="text-2xl font-semibold mb-2">⚡ Real-time</h2>
            <p className="text-muted-foreground">
              Sub-500ms latency with streaming STT, LLM, and TTS
            </p>
          </div>
          
          <div className="p-6 border rounded-lg">
            <h2 className="text-2xl font-semibold mb-2">🎨 Templates</h2>
            <p className="text-muted-foreground">
              Pre-built templates for appointments, support, surveys, and more
            </p>
          </div>
          
          <div className="p-6 border rounded-lg">
            <h2 className="text-2xl font-semibold mb-2">📊 Analytics</h2>
            <p className="text-muted-foreground">
              Track calls, transcripts, costs, and performance metrics
            </p>
          </div>
        </div>
        
        <div className="flex justify-center gap-4 mt-12">
          <a
            href="/api/auth/register"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90"
          >
            Get Started
          </a>
          <a
            href="/api/templates"
            className="px-6 py-3 border rounded-lg font-semibold hover:bg-accent"
          >
            View Templates
          </a>
        </div>
      </div>
    </main>
  );
}
