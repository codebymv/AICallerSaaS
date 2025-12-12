// ============================================
// Campaign Service - Campaign Processing with Bull Queue
// ============================================

import Queue from 'bull';
import { prisma } from '../lib/prisma';
import { TwilioService } from './twilio.service';
import { logger } from '../utils/logger';
import { config } from '../config';
import { broadcastCampaignStarted, broadcastCampaignPaused, broadcastCampaignCompleted, broadcastCampaignLeadCalled, broadcastCampaignStatsUpdated } from '../websocket';

// Initialize Bull queue for campaign processing
const campaignQueue = new Queue('campaigns', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 500, // Keep last 500 failed jobs
  },
});

// Job types
interface ProcessLeadJob {
  campaignId: string;
  leadId: string;
}

interface ScheduleCampaignJob {
  campaignId: string;
}

// Campaign Service
export class CampaignService {
  private twilioService: TwilioService;

  constructor() {
    this.twilioService = new TwilioService();
    this.initializeQueueProcessor();
  }

  // Initialize queue processor
  private initializeQueueProcessor() {
    // Process individual lead calls
    campaignQueue.process('process-lead', async (job) => {
      const { campaignId, leadId } = job.data as ProcessLeadJob;
      return await this.processLead(campaignId, leadId);
    });

    // Schedule next batch of leads
    campaignQueue.process('schedule-next-leads', async (job) => {
      const { campaignId } = job.data as ScheduleCampaignJob;
      return await this.scheduleNextLeads(campaignId);
    });

    // Handle job completion
    campaignQueue.on('completed', (job, result) => {
      logger.info(`Campaign job completed: ${job.id}`, result);
    });

    // Handle job failure
    campaignQueue.on('failed', (job, err) => {
      logger.error(`Campaign job failed: ${job?.id}`, err);
    });

    logger.info('Campaign queue processor initialized');
  }

  // Start a campaign
  async startCampaign(campaignId: string, userId: string): Promise<void> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
      include: { agent: true, leads: { where: { status: 'PENDING' }, take: 1 } },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status === 'ACTIVE') {
      throw new Error('Campaign is already active');
    }

    if (campaign.leads.length === 0) {
      throw new Error('No leads to call');
    }

    // Check if agent is active
    if (!campaign.agent.isActive) {
      throw new Error('Agent is not active');
    }

    // Update campaign status
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'ACTIVE' },
    });

    // Schedule first batch of leads
    await campaignQueue.add('schedule-next-leads', { campaignId }, { delay: 0 });

    // Broadcast campaign started event
    broadcastCampaignStarted(campaign.userId, campaignId, campaign.name);

    logger.info(`Campaign ${campaignId} started`);
  }

  // Pause a campaign
  async pauseCampaign(campaignId: string, userId: string): Promise<void> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status !== 'ACTIVE') {
      throw new Error('Campaign is not active');
    }

    // Update campaign status
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'PAUSED' },
    });

    // Remove pending jobs for this campaign
    const jobs = await campaignQueue.getJobs(['waiting', 'delayed']);
    for (const job of jobs) {
      if (job.data.campaignId === campaignId) {
        await job.remove();
      }
    }

    // Broadcast campaign paused event
    broadcastCampaignPaused(campaign.userId, campaignId, campaign.name);

    logger.info(`Campaign ${campaignId} paused`);
  }

  // Cancel a campaign
  async cancelCampaign(campaignId: string, userId: string): Promise<void> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Update campaign status
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'CANCELLED' },
    });

    // Remove all pending jobs for this campaign
    const jobs = await campaignQueue.getJobs(['waiting', 'delayed', 'active']);
    for (const job of jobs) {
      if (job.data.campaignId === campaignId) {
        await job.remove();
      }
    }

    logger.info(`Campaign ${campaignId} cancelled`);
  }

  // Schedule next batch of leads
  private async scheduleNextLeads(campaignId: string): Promise<void> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        agent: true,
        user: true,
      },
    });

    if (!campaign || campaign.status !== 'ACTIVE') {
      logger.info(`Campaign ${campaignId} is not active, stopping scheduler`);
      return;
    }

    // Check if within call window
    if (!this.isWithinCallWindow(campaign.callWindowStart, campaign.callWindowEnd)) {
      logger.info(`Campaign ${campaignId} outside call window, rescheduling`);
      // Reschedule for next hour
      await campaignQueue.add('schedule-next-leads', { campaignId }, { delay: 60 * 60 * 1000 });
      return;
    }

    // Check daily call limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const callsToday = await prisma.campaignLead.count({
      where: {
        campaignId,
        lastAttemptAt: { gte: today },
      },
    });

    if (callsToday >= campaign.dailyCallLimit) {
      logger.info(`Campaign ${campaignId} reached daily call limit, rescheduling for tomorrow`);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0); // Start at 9 AM tomorrow
      const delayMs = tomorrow.getTime() - Date.now();
      await campaignQueue.add('schedule-next-leads', { campaignId }, { delay: delayMs });
      return;
    }

    // Check user quota
    if (campaign.user.minutesUsed >= campaign.user.minutesLimit) {
      logger.warn(`Campaign ${campaignId} user quota exceeded, pausing campaign`);
      await this.pauseCampaign(campaignId, campaign.userId);
      return;
    }

    // Get next pending lead
    const lead = await prisma.campaignLead.findFirst({
      where: {
        campaignId,
        status: 'PENDING',
        OR: [
          { nextAttemptAt: null },
          { nextAttemptAt: { lte: new Date() } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!lead) {
      // No more pending leads, check if campaign is complete
      const remainingLeads = await prisma.campaignLead.count({
        where: {
          campaignId,
          status: { in: ['PENDING', 'SCHEDULED'] },
        },
      });

      if (remainingLeads === 0) {
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { status: 'COMPLETED' },
        });
        
        // Broadcast campaign completed event
        broadcastCampaignCompleted(campaign.userId, campaignId, campaign.name);
        
        logger.info(`Campaign ${campaignId} completed`);
      }
      return;
    }

    // Schedule lead call
    await campaignQueue.add('process-lead', { campaignId, leadId: lead.id }, { delay: 0 });

    // Schedule next lead with rate limiting
    const delayMs = campaign.minCallInterval * 1000;
    await campaignQueue.add('schedule-next-leads', { campaignId }, { delay: delayMs });
  }

  // Process a single lead
  private async processLead(campaignId: string, leadId: string): Promise<void> {
    const lead = await prisma.campaignLead.findUnique({
      where: { id: leadId },
      include: {
        campaign: {
          include: { agent: true, user: true },
        },
      },
    });

    if (!lead || !lead.campaign) {
      throw new Error('Lead or campaign not found');
    }

    const { campaign } = lead;

    // Update lead status to CALLING
    await prisma.campaignLead.update({
      where: { id: leadId },
      data: {
        status: 'CALLING',
        lastAttemptAt: new Date(),
        attempts: { increment: 1 },
      },
    });

    try {
      // Get agent's phone number
      const phoneNumber = await prisma.phoneNumber.findFirst({
        where: { userId: campaign.userId, isActive: true },
      });

      if (!phoneNumber) {
        throw new Error('No active phone number available');
      }

      // Create call record first
      const call = await prisma.call.create({
        data: {
          userId: campaign.userId,
          agentId: campaign.agentId,
          direction: 'outbound',
          from: phoneNumber.phoneNumber,
          to: lead.phoneNumber,
          status: 'initiated',
          campaignId: campaign.id,
          campaignLeadId: lead.id,
          callSid: `pending_${Date.now()}_${leadId}`,
          agentName: campaign.agent.name,
          agentVoice: campaign.agent.voice,
          agentVoiceProvider: campaign.agent.voiceProvider,
          metadata: {
            campaignName: campaign.name,
            leadName: lead.name,
          },
        },
      });

      // Initiate Twilio call
      const result = await this.twilioService.makeCall(
        lead.phoneNumber,
        phoneNumber.phoneNumber,
        `${config.apiUrl}/api/webhooks/twilio/voice?agentId=${campaign.agentId}&callId=${call.id}`
      );

      // Update call with real Twilio SID
      await prisma.call.update({
        where: { id: call.id },
        data: {
          callSid: result.callSid,
          status: 'queued',
        },
      });

      // Update lead with call ID
      await prisma.campaignLead.update({
        where: { id: leadId },
        data: {
          lastCallId: call.id,
        },
      });

      // Broadcast lead called event
      broadcastCampaignLeadCalled(campaign.userId, campaignId, leadId, lead.name, lead.phoneNumber);

      logger.info(`Call initiated for lead ${leadId} in campaign ${campaignId}`);
    } catch (error) {
      logger.error(`Failed to initiate call for lead ${leadId}:`, error);

      // Update lead status based on attempts
      const shouldRetry = lead.attempts < campaign.maxRetryAttempts;

      if (shouldRetry) {
        // Schedule retry
        const nextAttemptAt = new Date(Date.now() + campaign.retryInterval * 1000);
        await prisma.campaignLead.update({
          where: { id: leadId },
          data: {
            status: 'PENDING',
            nextAttemptAt,
            outcome: 'failed',
            notes: `Call failed: ${(error as Error).message}`,
          },
        });
      } else {
        // Mark as failed permanently
        await prisma.campaignLead.update({
          where: { id: leadId },
          data: {
            status: 'FAILED',
            outcome: 'failed',
            notes: `Max retry attempts reached. Last error: ${(error as Error).message}`,
          },
        });

        // Update campaign stats
        await prisma.campaign.update({
          where: { id: campaignId },
          data: {
            callsFailed: { increment: 1 },
          },
        });
      }

      throw error;
    }
  }

  // Handle call completion (called from webhook)
  async handleCallCompleted(callId: string, status: string, duration: number): Promise<void> {
    const call = await prisma.call.findUnique({
      where: { id: callId },
    });

    if (!call || !call.campaignLeadId) {
      return; // Not a campaign call
    }

    const lead = await prisma.campaignLead.findUnique({
      where: { id: call.campaignLeadId },
      include: { campaign: true },
    });

    if (!lead) {
      return;
    }

    // Determine outcome based on call status
    let outcome: string;
    let leadStatus: 'COMPLETED' | 'PENDING' | 'FAILED';

    if (status === 'completed' && duration > 0) {
      outcome = 'answered';
      leadStatus = 'COMPLETED';
    } else if (status === 'no-answer') {
      outcome = 'no-answer';
      leadStatus = lead.attempts >= lead.campaign.maxRetryAttempts ? 'FAILED' : 'PENDING';
    } else if (status === 'busy') {
      outcome = 'busy';
      leadStatus = lead.attempts >= lead.campaign.maxRetryAttempts ? 'FAILED' : 'PENDING';
    } else {
      outcome = 'failed';
      leadStatus = lead.attempts >= lead.campaign.maxRetryAttempts ? 'FAILED' : 'PENDING';
    }

    // Update lead
    const updateData: any = {
      status: leadStatus,
      lastCallDuration: duration,
      lastCallStatus: status,
      outcome,
    };

    // Schedule retry if needed
    if (leadStatus === 'PENDING') {
      updateData.nextAttemptAt = new Date(Date.now() + lead.campaign.retryInterval * 1000);
    }

    await prisma.campaignLead.update({
      where: { id: lead.id },
      data: updateData,
    });

    // Update campaign stats
    const statsUpdate: any = {
      callsCompleted: { increment: 1 },
    };

    if (leadStatus === 'COMPLETED') {
      statsUpdate.callsSuccessful = { increment: 1 };
      statsUpdate.leadsContacted = { increment: 1 };
    } else if (leadStatus === 'FAILED') {
      statsUpdate.callsFailed = { increment: 1 };
    }

    const updatedCampaign = await prisma.campaign.update({
      where: { id: lead.campaignId },
      data: statsUpdate,
    });

    // Broadcast stats update
    broadcastCampaignStatsUpdated(lead.campaign.userId, lead.campaignId, {
      callsCompleted: updatedCampaign.callsCompleted,
      callsSuccessful: updatedCampaign.callsSuccessful,
      callsFailed: updatedCampaign.callsFailed,
      leadsContacted: updatedCampaign.leadsContacted,
    });

    logger.info(`Call completed for lead ${lead.id}, outcome: ${outcome}`);
  }

  // Check if current time is within call window
  private isWithinCallWindow(startTime?: string | null, endTime?: string | null): boolean {
    if (!startTime || !endTime) {
      return true; // No call window restriction
    }

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    return currentTime >= startTime && currentTime <= endTime;
  }

  // Get campaign statistics
  async getCampaignStats(campaignId: string, userId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
      include: {
        agent: { select: { name: true, voice: true, isActive: true } },
        _count: {
          select: {
            leads: true,
          },
        },
      },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Get lead status breakdown
    const leadStatusCounts = await prisma.campaignLead.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: true,
    });

    const statusBreakdown: Record<string, number> = {};
    leadStatusCounts.forEach((item) => {
      statusBreakdown[item.status] = item._count;
    });

    // Calculate success rate
    const successRate = campaign.callsCompleted > 0
      ? (campaign.callsSuccessful / campaign.callsCompleted) * 100
      : 0;

    return {
      ...campaign,
      statusBreakdown,
      successRate: Math.round(successRate * 10) / 10,
    };
  }
}

// Export singleton instance
export const campaignService = new CampaignService();

