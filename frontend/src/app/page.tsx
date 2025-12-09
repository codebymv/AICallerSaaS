'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { 
  Phone, 
  Bot, 
  BarChart3, 
  Zap, 
  ChevronRight,
  Play,
  Home,
  ShoppingCart,
  Stethoscope,
  Check,
  ArrowRight,
  Sparkles,
  Headphones,
  MessageSquare,
  Menu,
  X
} from 'lucide-react';

const stats = [
  { value: '10K+', label: 'Calls Handled', description: 'AI-powered conversations completed successfully' },
  { value: '500+', label: 'Hours Saved', description: 'Time saved on manual call handling' },
  { value: '99.9%', label: 'Uptime', description: 'Reliable service you can count on' },
  { value: '<1s', label: 'Response Time', description: 'Near-instant AI responses' },
];

const features = [
  {
    id: 'agents',
    icon: Bot,
    label: 'AI Agents',
    title: 'Build Intelligent Voice Agents',
    description: 'Create AI agents with natural-sounding voices that can handle complex conversations, answer questions, and take actions on behalf of your business.',
    highlights: ['11 premium voice options', 'Custom personality & tone', 'Multi-turn conversations'],
  },
  {
    id: 'calls',
    icon: Phone,
    label: 'Phone Integration',
    title: 'Connect to Real Phone Numbers',
    description: 'Link your Twilio phone numbers directly to your AI agents. Handle inbound calls 24/7 or make outbound calls at scale.',
    highlights: ['Twilio integration', 'Inbound & outbound calls', 'Call recording & transcripts'],
  },
  {
    id: 'analytics',
    icon: BarChart3,
    label: 'Analytics',
    title: 'Understand Every Conversation',
    description: 'Get detailed insights into call performance, sentiment analysis, and conversation outcomes to continuously improve your agents.',
    highlights: ['Real-time dashboard', 'Call transcripts', 'Performance metrics'],
  },
  {
    id: 'automation',
    icon: Zap,
    label: 'Automation',
    title: 'Automate Your Phone Operations',
    description: 'Set up automated workflows triggered by calls. Transfer to humans when needed, send follow-ups, and integrate with your existing tools.',
    highlights: ['Smart call routing', 'Human handoff', 'Webhook integrations'],
  },
];

const useCases = [
  {
    industry: 'Real Estate',
    icon: Home,
    title: 'Lead Qualification',
    tags: ['#Inbound', '#Qualification'],
    description: 'Qualify leads 24/7, schedule property viewings, and answer common questions about listings automatically.',
    color: 'bg-blue-500',
  },
  {
    industry: 'E-Commerce',
    icon: ShoppingCart,
    title: 'Customer Support',
    tags: ['#Support', '#Orders'],
    description: 'Handle order inquiries, process returns, and provide shipping updates without human intervention.',
    color: 'bg-green-500',
  },
  {
    industry: 'Healthcare',
    icon: Stethoscope,
    title: 'Appointment Scheduling',
    tags: ['#Booking', '#Reminders'],
    description: 'Schedule appointments, send reminders, and handle rescheduling requests automatically.',
    color: 'bg-purple-500',
  },
];

export default function LandingPage() {
  const [activeFeature, setActiveFeature] = useState('agents');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const currentFeature = features.find(f => f.id === activeFeature) || features[0];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <Image src="/gleam-logo-icon.png" alt="Gleam" width={32} height={32} />
              <span className="text-xl font-bold text-slate-900">Gleam</span>
            </Link>

            {/* Nav Links - Hidden on mobile */}
            <div className="hidden md:flex items-center gap-8">
              <Link href="#features" className="text-slate-600 hover:text-slate-900 transition-colors">
                Features
              </Link>
              <Link href="#use-cases" className="text-slate-600 hover:text-slate-900 transition-colors">
                Use Cases
              </Link>
              <Link href="#pricing" className="text-slate-600 hover:text-slate-900 transition-colors">
                Pricing
              </Link>
            </div>

            {/* CTA Buttons */}
            <div className="flex items-center gap-3">
              <Link 
                href="/login" 
                className="hidden sm:inline-flex bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-teal-700 transition-colors"
              >
                Try for Free
              </Link>
              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-slate-600 hover:text-slate-900"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-gray-100 bg-white">
              <div className="flex flex-col gap-4">
                <Link 
                  href="#features" 
                  className="text-slate-600 hover:text-slate-900 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Features
                </Link>
                <Link 
                  href="#use-cases" 
                  className="text-slate-600 hover:text-slate-900 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Use Cases
                </Link>
                <Link 
                  href="#pricing" 
                  className="text-slate-600 hover:text-slate-900 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Pricing
                </Link>
                <Link 
                  href="/login" 
                  className="text-slate-600 hover:text-slate-900 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Login
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-teal-50/30 to-slate-100" />
        <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-teal-200/40 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-slate-200/40 to-transparent rounded-full blur-3xl" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left side - Text */}
            <div>
              <div className="inline-flex items-center gap-2 bg-teal-100 text-teal-700 px-3 py-1 rounded-full text-sm font-medium mb-6">
                <Sparkles className="h-4 w-4" />
                AI-Powered Voice Agents
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight mb-6">
                AI Voice Agents for{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-teal-400">
                  Automated Calls
                </span>
              </h1>
              
              <p className="text-lg sm:text-xl text-slate-600 mb-8 max-w-xl">
                Build intelligent voice agents that handle phone calls 24/7. 
                Connect your Twilio numbers, customize your AI, and let it manage 
                customer conversations at scale.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-teal-700 transition-colors"
                >
                  Get Started Free
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <button
                  className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-800 transition-colors"
                >
                  <Play className="h-4 w-4" />
                  Watch Demo
                </button>
              </div>
            </div>

            {/* Right side - Visual */}
            <div className="relative hidden lg:block">
              <div className="relative bg-white rounded-2xl shadow-2xl p-6 border border-gray-100">
                {/* Mock agent card */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative">
                    <Image 
                      src="/rachel.png" 
                      alt="AI Agent" 
                      width={64} 
                      height={64} 
                      className="rounded-full"
                    />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-teal-600 rounded-full border-2 border-white flex items-center justify-center">
                      <Phone className="h-3 w-3 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Rachel - Booking Agent</h3>
                    <p className="text-sm text-slate-500">Places call to qualified leads in just 5 minutes</p>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="flex h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm text-green-600 font-medium">Live</span>
                  </div>
                </div>

                {/* Mock transcript */}
                <div className="space-y-3 bg-gray-50 rounded-lg p-4">
                  <div className="flex gap-3">
                    <div className="relative w-8 h-8">
                      <Image src="/rachel.png" alt="Rachel" fill className="object-cover rounded-full" />
                    </div>
                    <div className="flex-1 bg-teal-50 rounded-lg p-3 text-sm border border-teal-100">
                      Hi, this is Rachel! Thank you for filling out your information, let's schedule a meeting with one of our experts. What days and times work for you?
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs">👤</div>
                    <div className="flex-1 bg-white rounded-lg p-3 text-sm">
                      Sure I&apos;m available this Tuesday and Thursday in the afternoon!
                    </div>
                  </div>
                </div>

                {/* Floating badges */}
                <div className="absolute -top-4 -right-4 bg-white rounded-lg shadow-lg px-3 py-2 border border-gray-100">
                  <div className="flex items-center gap-2">
                    <Headphones className="h-4 w-4 text-teal-600" />
                    <span className="text-sm font-medium">ElevenLabs Voice</span>
                  </div>
                </div>
                <div className="absolute -bottom-4 -left-4 bg-white rounded-lg shadow-lg px-3 py-2 border border-gray-100">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">GPT-4 Powered</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-teal-400 mb-2">
                  {stat.value}
                </div>
                <div className="font-semibold text-slate-900 mb-1">{stat.label}</div>
                <div className="text-sm text-slate-500 hidden sm:block">{stat.description}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Everything You Need to Deploy Voice AI
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              From building agents to analyzing conversations, Gleam provides a complete platform for voice AI automation.
            </p>
          </div>

          {/* Feature Tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {features.map((feature) => (
              <button
                key={feature.id}
                onClick={() => setActiveFeature(feature.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all ${
                  activeFeature === feature.id
                    ? 'bg-slate-900 text-white shadow-lg'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <feature.icon className="h-4 w-4" />
                {feature.label}
              </button>
            ))}
          </div>

          {/* Feature Content */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 lg:p-12">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">
                  {currentFeature.title}
                </h3>
                <p className="text-lg text-slate-600 mb-6">
                  {currentFeature.description}
                </p>
                <ul className="space-y-3">
                  {currentFeature.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-teal-100 flex items-center justify-center">
                        <Check className="h-3 w-3 text-teal-600" />
                      </div>
                      <span className="text-slate-700">{highlight}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 text-teal-600 font-medium mt-6 hover:text-teal-700"
                >
                  Get started with {currentFeature.label}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>

              {/* Feature Visual Placeholder */}
              <div className="bg-gradient-to-br from-slate-100 to-slate-50 rounded-xl aspect-square flex items-center justify-center relative overflow-hidden">
                {activeFeature === 'agents' ? (
                  <Image 
                    src="/diagram1.png" 
                    alt="AI Agents Diagram" 
                    fill 
                    sizes="(min-width: 1024px) 400px, 100vw" 
                    className="object-contain rounded-xl" 
                  />
                ) : activeFeature === 'calls' ? (
                  <Image 
                    src="/diagram2.png" 
                    alt="Phone Integration Diagram" 
                    fill 
                    sizes="(min-width: 1024px) 400px, 100vw" 
                    className="object-contain rounded-xl" 
                  />
                ) : activeFeature === 'analytics' ? (
                  <Image 
                    src="/diagram3.png" 
                    alt="Analytics Diagram" 
                    fill 
                    sizes="(min-width: 1024px) 400px, 100vw" 
                    className="object-contain rounded-xl" 
                  />
                ) : activeFeature === 'automation' ? (
                  <Image 
                    src="/diagram4.png" 
                    alt="Automation Diagram" 
                    fill 
                    sizes="(min-width: 1024px) 400px, 100vw" 
                    className="object-contain rounded-xl" 
                  />
                ) : (
                  <currentFeature.icon className="h-32 w-32 text-slate-300" />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section id="use-cases" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Hear AI Voice Agents in Action
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Choose a use case to see how Gleam AI agents handle real conversations.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {useCases.map((useCase) => (
              <div
                key={useCase.title}
                className="bg-white rounded-xl p-6 border border-slate-200 hover:border-teal-300 hover:shadow-lg transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
                  <useCase.icon className="h-4 w-4" />
                  {useCase.industry}
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg ${useCase.color} flex items-center justify-center`}>
                    <Phone className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{useCase.title}</h3>
                    <div className="flex gap-2 text-xs text-slate-400">
                      {useCase.tags.map(tag => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-slate-600">
                  {useCase.description}
                </p>
              </div>
            ))}
          </div>

          {/* <div className="mt-12 text-center">
                      <p className="text-sm text-slate-500 mb-4">
                                    This is a simplified demo. Full customization is available in the platform.
                                                </p>
                                                            <Link
                                                                          href="/register"
                                                                                        className="inline-flex items-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-teal-700 transition-colors"
                                                                                                    >
                                                                                                                  Try the Full Platform
                                                                                                                                <ArrowRight className="h-4 w-4" />
                                                                                                                                            </Link>
                                                                                                                                                      </div>} */}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-slate-900 to-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Ready to Automate Your Phone Operations?
          </h2>
          <p className="text-lg text-slate-300 mb-8">
            Use Gleam to handle customer calls with AI. 
            Start for free, no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 bg-teal-600 text-white px-8 py-4 rounded-lg font-medium hover:bg-teal-700 transition-colors"
            >
              Get Started Free
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-lg font-medium hover:bg-slate-800 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-slate-900 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <Image src="/logo-icon-transparent-inverted.png" alt="Gleam" width={32} height={32} />
              <span className="text-xl font-bold text-white">Gleam</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <Link href="#" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="#" className="hover:text-white transition-colors">Terms</Link>
              <Link href="#" className="hover:text-white transition-colors">Contact</Link>
            </div>
            <div className="text-sm text-slate-500">
              © 2025 Gleam. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
