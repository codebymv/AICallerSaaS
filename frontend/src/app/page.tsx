import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Phone, Zap, MessageSquare, BarChart3 } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center px-6 py-24 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-4xl text-center">
          <div className="mb-8 flex justify-center">
            <Image
              src="/gleam-logo-text.png"
              alt="Gleam"
              width={200}
              height={60}
              priority
              className="h-16 w-auto"
            />
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl">
            AI Voice Agents for{' '}
            <span className="text-primary">Modern Business</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            Build, test, and deploy AI callers that handle inbound and outbound calls
            with natural conversation. Sub-500ms latency, real-time transcription,
            and powerful analytics.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link href="/register">
              <Button size="lg" className="px-8">
                Get Started Free
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Everything you need for AI calling
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<Phone className="w-6 h-6" />}
              title="Voice Agents"
              description="Create AI agents that can handle inbound and outbound calls naturally"
            />
            <FeatureCard
              icon={<Zap className="w-6 h-6" />}
              title="Real-time"
              description="Sub-500ms latency with streaming STT, LLM, and TTS"
            />
            <FeatureCard
              icon={<MessageSquare className="w-6 h-6" />}
              title="Templates"
              description="Pre-built templates for appointments, support, surveys, and more"
            />
            <FeatureCard
              icon={<BarChart3 className="w-6 h-6" />}
              title="Analytics"
              description="Track calls, transcripts, costs, and performance metrics"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-6 bg-slate-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to transform your calling?
          </h2>
          <p className="text-slate-400 mb-8">
            Start with 100 free minutes. No credit card required.
          </p>
          <Link href="/register">
            <Button size="lg" variant="secondary">
              Start Building Now
            </Button>
          </Link>
        </div>
      </section>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 border rounded-lg hover:shadow-md transition-shadow">
      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
