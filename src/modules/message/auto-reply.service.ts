import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutoReplyRule } from './entities/auto-reply-rule.entity';
import { AutoReplyState } from './entities/auto-reply-state.entity';
import { Session } from '../session/entities/session.entity';
import type { MessageService } from './message.service';
import type { SessionService } from '../session/session.service';
import { createLogger } from '../../common/services/logger.service';

export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'extract_regex' | 'prompt_input' | 'api_call' | 'condition' | 'reply_text' | 'reply_media' | 'time_check' | 'mark_read';
  data: Record<string, any>;
  position?: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface WorkflowDefinition {
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export type CreateAutoReplyDto = {
  enabled?: boolean;
  matchType?: 'any' | 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'regex';
  matchValue?: string;
  replyType?: 'text' | 'image' | 'audio' | 'document' | 'sticker' | 'contact' | 'location';
  minIntervalSeconds?: number | null;
  perChat?: boolean;
  replyText?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  delayMinSeconds?: number;
  delayMaxSeconds?: number;
  chatScope?: 'all' | 'personal' | 'group' | 'newsletter';
  contactName?: string;
  contactNumber?: string;
  latitude?: number;
  longitude?: number;
  locationDescription?: string;
  locationAddress?: string;
  replyToIncoming?: boolean;
  metadata?: Record<string, unknown>;
  workflow?: WorkflowDefinition;
};

export interface TestApiDto {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  variables?: Record<string, any>;
}

@Injectable()
export class AutoReplyService {
  private readonly logger = createLogger('AutoReplyService');
  private messageService?: MessageService;
  private sessionService?: SessionService;

  constructor(
    @InjectRepository(AutoReplyRule, 'data')
    private readonly repo: Repository<AutoReplyRule>,
    @InjectRepository(AutoReplyState, 'data')
    private readonly stateRepo: Repository<AutoReplyState>,
    @InjectRepository(Session, 'data')
    @Optional()
    private readonly sessionRepo?: Repository<Session>,
    @Optional()
    private readonly moduleRef?: ModuleRef,
  ) {}

  private getMessageService(): MessageService | undefined {
    if (this.messageService) return this.messageService;
    if (!this.moduleRef) return undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { MessageService: token } = require('./message.service') as {
        MessageService: new (...args: never[]) => MessageService;
      };
      this.messageService = this.moduleRef.get(token, { strict: false });
      return this.messageService;
    } catch (err) {
      this.logger.warn('MessageService is not resolvable in AutoReplyService', { error: String(err) });
      return undefined;
    }
  }

  private getSessionService(): SessionService | undefined {
    if (this.sessionService) return this.sessionService;
    if (!this.moduleRef) return undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { SessionService: token } = require('../session/session.service') as {
        SessionService: new (...args: never[]) => SessionService;
      };
      this.sessionService = this.moduleRef.get(token, { strict: false });
      return this.sessionService;
    } catch (err) {
      this.logger.warn('SessionService is not resolvable in AutoReplyService', { error: String(err) });
      return undefined;
    }
  }

  async list(sessionId: string): Promise<AutoReplyRule[]> {
    return this.repo.find({ where: { sessionId }, order: { createdAt: 'DESC' } });
  }

  async create(sessionId: string, dto: CreateAutoReplyDto): Promise<AutoReplyRule> {
    const minDelay = dto.delayMinSeconds !== undefined ? Math.floor(dto.delayMinSeconds) : null;
    const maxDelay = dto.delayMaxSeconds !== undefined ? Math.floor(dto.delayMaxSeconds) : null;
    const hasDelay = minDelay !== null || maxDelay !== null;
    const finalMinDelay = hasDelay ? Math.min(Math.max(minDelay ?? 3, 3), 30) : null;
    const finalMaxDelay = hasDelay ? Math.min(Math.max(maxDelay ?? 8, 3), 30) : null;
    const normalizedMinDelay = hasDelay ? Math.min(finalMinDelay as number, finalMaxDelay as number) : null;
    const normalizedMaxDelay = hasDelay ? Math.max(finalMinDelay as number, finalMaxDelay as number) : null;

    const metadata: Record<string, unknown> = dto.metadata ? { ...dto.metadata } : {};
    if (dto.workflow) metadata.workflow = dto.workflow;
    if (hasDelay) {
      metadata.delayMinSeconds = normalizedMinDelay;
      metadata.delayMaxSeconds = normalizedMaxDelay;
    }
    if (dto.replyToIncoming !== undefined) metadata.replyToIncoming = dto.replyToIncoming;
    if (dto.chatScope) metadata.chatScope = dto.chatScope;
    if (dto.contactName) metadata.contactName = dto.contactName;
    if (dto.contactNumber) metadata.contactNumber = dto.contactNumber;
    if (typeof dto.latitude === 'number') metadata.latitude = dto.latitude;
    if (typeof dto.longitude === 'number') metadata.longitude = dto.longitude;
    if (dto.locationDescription) metadata.locationDescription = dto.locationDescription;
    if (dto.locationAddress) metadata.locationAddress = dto.locationAddress;

    const rule = this.repo.create({
      sessionId,
      enabled: dto.enabled ?? true,
      matchType: (dto.matchType as any) ?? 'contains',
      matchValue: dto.matchValue?.trim() || null,
      replyType: dto.replyType ?? 'text',
      minIntervalSeconds: dto.minIntervalSeconds ?? null,
      perChat: dto.perChat ?? true,
      replyText: dto.replyText ?? null,
      mediaUrl: dto.mediaUrl ?? null,
      mediaMimeType: dto.mediaMimeType ?? null,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
    });

    if (!dto.workflow && rule.matchType !== 'any' && !rule.matchValue) {
      throw new BadRequestException('matchValue is required for this matchType');
    }
    if (rule.minIntervalSeconds !== null && rule.minIntervalSeconds < 0) {
      throw new BadRequestException('minIntervalSeconds must be >= 0');
    }

    return this.repo.save(rule);
  }

  async update(id: string, dto: CreateAutoReplyDto): Promise<AutoReplyRule> {
    const rule = await this.repo.findOne({ where: { id } });
    if (!rule) throw new NotFoundException('Rule not found');
    if (dto.enabled !== undefined) rule.enabled = dto.enabled;
    if (dto.matchType) rule.matchType = dto.matchType as any;
    if (dto.matchValue !== undefined) rule.matchValue = dto.matchValue?.trim() || null;
    if (dto.replyType) rule.replyType = dto.replyType;
    if (dto.minIntervalSeconds !== undefined) rule.minIntervalSeconds = dto.minIntervalSeconds;
    if (dto.perChat !== undefined) rule.perChat = dto.perChat;
    if (dto.replyText !== undefined) rule.replyText = dto.replyText ?? null;
    if (dto.mediaUrl !== undefined) rule.mediaUrl = dto.mediaUrl ?? null;
    if (dto.mediaMimeType !== undefined) rule.mediaMimeType = dto.mediaMimeType ?? null;

    const base = (rule.metadata && typeof rule.metadata === 'object' ? rule.metadata : {}) as Record<string, unknown>;
    if (dto.metadata) Object.assign(base, dto.metadata);
    if (dto.workflow) base.workflow = dto.workflow;
    if (dto.replyToIncoming !== undefined) base.replyToIncoming = dto.replyToIncoming;
    if (dto.chatScope !== undefined) base.chatScope = dto.chatScope;
    if (dto.contactName !== undefined) base.contactName = dto.contactName;
    if (dto.contactNumber !== undefined) base.contactNumber = dto.contactNumber;
    if (dto.latitude !== undefined) base.latitude = dto.latitude;
    if (dto.longitude !== undefined) base.longitude = dto.longitude;
    if (dto.locationDescription !== undefined) base.locationDescription = dto.locationDescription;
    if (dto.locationAddress !== undefined) base.locationAddress = dto.locationAddress;
    if (dto.delayMinSeconds !== undefined || dto.delayMaxSeconds !== undefined) {
      const minDelay = dto.delayMinSeconds !== undefined ? Math.floor(dto.delayMinSeconds) : undefined;
      const maxDelay = dto.delayMaxSeconds !== undefined ? Math.floor(dto.delayMaxSeconds) : undefined;
      const nextMin = minDelay !== undefined ? Math.min(Math.max(minDelay, 3), 30) : (base['delayMinSeconds'] as number | undefined);
      const nextMax = maxDelay !== undefined ? Math.min(Math.max(maxDelay, 3), 30) : (base['delayMaxSeconds'] as number | undefined);
      if (typeof nextMin === 'number' || typeof nextMax === 'number') {
        const a = typeof nextMin === 'number' ? nextMin : 3;
        const b = typeof nextMax === 'number' ? nextMax : 8;
        base.delayMinSeconds = Math.min(a, b);
        base.delayMaxSeconds = Math.max(a, b);
      }
    }
    rule.metadata = Object.keys(base).length > 0 ? base : null;

    return this.repo.save(rule);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  public async executeApiRequest(options: TestApiDto): Promise<{
    effectiveMethod: string;
    effectiveUrl: string;
    effectiveHeaders: Record<string, string>;
    effectiveBody: string;
    status: number;
    response_raw: string;
    response_error: string;
    data: any;
    extractedVariables: Record<string, any>;
  }> {
    const vars = options.variables || {};
    const rawMethod = (options.method || 'GET').trim().toUpperCase();

    // Interpolate URL
    const effectiveUrl = this.interpolate(options.url || '', vars);

    // Interpolate Headers
    const effectiveHeaders: Record<string, string> = {};
    if (options.headers && typeof options.headers === 'object') {
      for (const [k, v] of Object.entries(options.headers)) {
        effectiveHeaders[k] = this.interpolate(String(v), vars);
      }
    }

    const hasContentType = Object.keys(effectiveHeaders).some(k => k.toLowerCase() === 'content-type');
    if (rawMethod !== 'GET' && rawMethod !== 'HEAD' && !hasContentType) {
      effectiveHeaders['Content-Type'] = 'application/json';
    }

    // Interpolate Body
    let effectiveBody = '';
    if (options.body) {
      effectiveBody = this.interpolate(options.body, vars);
    }

    let status = 0;
    let response_raw = '';
    let response_error = '';
    let parsedData: any = {};
    const extractedVariables: Record<string, any> = {};

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const isGetOrHead = rawMethod === 'GET' || rawMethod === 'HEAD';
      const res = await fetch(effectiveUrl, {
        method: rawMethod,
        headers: effectiveHeaders,
        body: !isGetOrHead && effectiveBody ? effectiveBody : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);

      status = res.status;
      response_raw = await res.text();

      try {
        parsedData = JSON.parse(response_raw);
      } catch {
        parsedData = { message: response_raw };
      }
    } catch (err: any) {
      clearTimeout(timer);
      status = 0;
      response_error = err.message || String(err);
      parsedData = {
        success: false,
        message: response_error,
      };
      response_raw = '';
    }

    extractedVariables['status'] = status;
    extractedVariables['response_raw'] = response_raw;
    extractedVariables['response_error'] = response_error;

    this.flattenObject(parsedData, 'data', extractedVariables);
    if (typeof parsedData === 'object' && parsedData !== null && !Array.isArray(parsedData)) {
      this.flattenObject(parsedData, '', extractedVariables);
    }

    return {
      effectiveMethod: rawMethod,
      effectiveUrl,
      effectiveHeaders,
      effectiveBody,
      status,
      response_raw,
      response_error,
      data: parsedData,
      extractedVariables,
    };
  }

  async testApi(dto: TestApiDto): Promise<any> {
    return this.executeApiRequest(dto);
  }

  public flattenObject(obj: any, prefix = 'data', result: Record<string, any> = {}): Record<string, any> {
    if (obj === null || obj === undefined) return result;

    if (typeof obj !== 'object') {
      if (prefix) result[prefix] = obj;
      return result;
    }

    if (Array.isArray(obj)) {
      if (prefix) result[prefix] = obj;
      obj.forEach((item, index) => {
        this.flattenObject(item, `${prefix}[${index}]`, result);
      });
      return result;
    }

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        result[newKey] = value;
        this.flattenObject(value, newKey, result);
      } else {
        result[newKey] = value;
      }
    }
    return result;
  }

  private interpolate(template: string, vars: Record<string, any>): string {
    if (!template) return '';
    return template.replace(/\{([a-zA-Z0-9_.-]+)\}/g, (match, p1) => {
      if (vars[p1] !== undefined && vars[p1] !== null) {
        const val = vars[p1];
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
      }
      return match;
    });
  }

  /**
   * Builds normalized workflow variables for incoming or self-sent message.
   */
  private async buildNormalizedVariables(
    sessionId: string,
    message: any,
    cleanBody: string,
    initialVars?: Record<string, any>,
  ): Promise<Record<string, any>> {
    const chatId = (message.chatId || message.to || message.from || '').toString();
    const now = new Date();
    const pad = (n: number) => (n < 10 ? '0' + n : String(n));
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const datetimeStr = `${dateStr} ${timeStr}`;

    const isGroup = chatId.endsWith('@g.us');
    const isNewsletter = chatId.endsWith('@newsletter');
    const chatType = isGroup ? 'group' : isNewsletter ? 'channel' : 'personal';

    const senderJid = (message.author || message.from || '').toString();
    const senderNumber = senderJid.replace(/@.*$/, '').replace(/\D/g, '');
    const senderName = message.pushName || message.sender?.pushname || message.sender?.name || senderNumber || 'Friend';

    // Retrieve session details for self-identity checks
    const selfIdentifiers = new Set<string>();
    let selfPhone = '';
    try {
      if (this.sessionRepo) {
        const sessionRow = await this.sessionRepo.findOne({ where: { id: sessionId } });
        if (sessionRow?.phone) {
          selfPhone = sessionRow.phone.replace(/\D/g, '');
          if (selfPhone) selfIdentifiers.add(selfPhone);
        }
      }
    } catch {}

    // Check live engine client info for self phone & privacy LID (e.g. 127135947722784)
    try {
      const sessSvc = this.getSessionService();
      if (sessSvc) {
        const engine = sessSvc.getEngine(sessionId) as any;
        if (engine) {
          const client = engine.client || engine.sock;
          const info = client?.info || client?.user;
          if (info) {
            const widDigits = String(info.wid?.user || info.wid?._serialized || info.id || '').replace(/@.*$/, '').replace(/\D/g, '');
            const lidDigits = String(info.lid?.user || info.me?.user || info.lid?._serialized || info.lid || '').replace(/@.*$/, '').replace(/\D/g, '');
            if (widDigits) selfIdentifiers.add(widDigits);
            if (lidDigits) selfIdentifiers.add(lidDigits);
          }
        }
      }
    } catch {}

    if (message.isLidSender && message.to?.endsWith('@lid')) {
      const toDigits = message.to.replace(/@.*$/, '').replace(/\D/g, '');
      if (toDigits) selfIdentifiers.add(toDigits);
    }

    const selfJid = selfPhone ? `${selfPhone}@c.us` : Array.from(selfIdentifiers)[0] ? `${Array.from(selfIdentifiers)[0]}@c.us` : '';
    const foundLid = Array.from(selfIdentifiers).find(id => id.length >= 12 && id !== selfPhone) || Array.from(selfIdentifiers)[0] || '';
    const selfLid = foundLid ? `${foundLid}@lid` : '';

    // Mentions logic
    const mentionedIds: string[] = Array.isArray(message.mentionedIds) ? message.mentionedIds : [];
    const mentionsStr = mentionedIds.join(',');

    let mentionedSelf = false;
    if (message.mentionedSelf === true) {
      mentionedSelf = true;
    } else {
      // 1. Check if mentionedIds contains any self identifier
      for (const id of mentionedIds) {
        const cleanId = String(id).replace(/\D/g, '');
        for (const selfId of selfIdentifiers) {
          if (selfId && cleanId.includes(selfId)) {
            mentionedSelf = true;
            break;
          }
        }
        if (mentionedSelf) break;
      }

      // 2. Check raw body for @<digits> e.g. @127135947722784
      if (!mentionedSelf) {
        const rawBody = message.body || message.text || '';
        const bodyMentions = rawBody.match(/@(\d+)/g) || [];
        for (const m of bodyMentions) {
          const digits = m.replace('@', '');
          for (const selfId of selfIdentifiers) {
            if (selfId && digits === selfId) {
              mentionedSelf = true;
              break;
            }
          }
          if (mentionedSelf) break;
        }

        // 3. Fallback for group tags: if raw body has @tag e.g. @127135947722784 and mentionedIds is present
        if (!mentionedSelf && isGroup && bodyMentions.length > 0 && mentionedIds.length > 0) {
          for (const m of bodyMentions) {
            const digits = m.replace('@', '');
            if (mentionedIds.some(id => String(id).includes(digits))) {
              mentionedSelf = true;
              break;
            }
          }
        }
      }
    }

    // Media extraction on current message
    let extractedMediaUrl =
      message.mediaUrl ||
      message.url ||
      message.mediaPath ||
      message.media?.url ||
      (message.media?.data && message.media?.mimetype ? `data:${message.media.mimetype};base64,${message.media.data}` : '') ||
      message.quotedMessage?.mediaUrl ||
      message.quotedMsg?.mediaUrl ||
      message.quotedMsg?.url ||
      message._data?.deprecatedMms3Url ||
      '';

    // Normalized quoted/replied message context
    const quoted = message.quotedMessage || message.quotedMsg || message._data?.quotedMsg;
    const quotedId = quoted?.id?._serialized || quoted?.id || (message.hasQuotedMsg && message._data?.quotedMsg?.id) || '';

    let reply_exists = 'false';
    let reply_message_id = '';
    let reply_type = '';
    let reply_text = '';
    let reply_has_media = 'false';
    let reply_media_url = '';
    let reply_media_base64 = '';
    let reply_mimetype = '';
    let reply_filename = '';
    let reply_view_once = 'false';

    if (quoted || quotedId) {
      reply_exists = 'true';
      reply_message_id = String(quotedId || '');
      reply_text = String(quoted?.body || quoted?.text || quoted?.caption || '');
      const rawType = String(quoted?.type || '');

      if (quoted?.isViewOnce) {
        reply_view_once = 'true';
        reply_type = 'view_once';
      } else if (rawType === 'chat') {
        reply_type = 'text';
      } else if (rawType) {
        reply_type = rawType;
      } else {
        reply_type = 'unknown';
      }

      if (quoted?.hasMedia || quoted?.mediaUrl || quoted?.mediaBase64 || quoted?.media) {
        reply_has_media = 'true';
        reply_media_url = quoted.mediaUrl || quoted.media?.url || '';
        reply_media_base64 = quoted.mediaBase64 || quoted.media?.data || '';
        reply_mimetype = quoted.mimetype || quoted.media?.mimetype || '';
        reply_filename = quoted.filename || quoted.media?.filename || '';

        if (!reply_media_url && reply_media_base64 && reply_mimetype) {
          reply_media_url = `data:${reply_mimetype};base64,${reply_media_base64}`;
        }
      }

      // Enrich from database if missing media or text
      if (quotedId && (!reply_media_url || !reply_text || reply_type === 'unknown')) {
        try {
          const msgService = this.getMessageService();
          if (msgService) {
            const dbMsg = await msgService.getMessageByWaId(sessionId, quotedId).catch(() => null);
            if (dbMsg) {
              if (!reply_text && dbMsg.body) reply_text = dbMsg.body;
              if (dbMsg.type && (reply_type === 'unknown' || !reply_type)) reply_type = dbMsg.type;
              const meta = (dbMsg.metadata || {}) as Record<string, any>;
              if (!reply_media_url) {
                reply_media_url = dbMsg.mediaPath || meta.mediaUrl || meta.url || (meta.media?.data && meta.media?.mimetype ? `data:${meta.media.mimetype};base64,${meta.media.data}` : '') || '';
              }
              if (!reply_media_base64 && meta.media?.data) {
                reply_media_base64 = meta.media.data;
              }
              if (!reply_mimetype) reply_mimetype = dbMsg.mediaMimetype || meta.media?.mimetype || meta.mimetype || '';
              if (!reply_filename) reply_filename = meta.media?.filename || meta.filename || '';
              if (reply_media_url || reply_media_base64) reply_has_media = 'true';
            }
          }
        } catch (err) {
          this.logger.warn('Failed to resolve quoted message media from DB', { error: String(err) });
        }
      }
    }

    if (!extractedMediaUrl && reply_media_url) {
      extractedMediaUrl = reply_media_url;
    }

    return {
      id: message.id || chatId,
      chat_id: chatId,
      chat_type: chatType,
      scope: chatType,
      group_id: isGroup ? chatId : '',
      channel_id: isNewsletter ? chatId : '',
      newsletter_id: isNewsletter ? chatId : '',
      sender_id: senderJid,
      sender_number: senderNumber,
      sender_name: senderName,
      name: senderName,
      pushname: senderName,
      session_id: sessionId,

      // Quoted Reply Context
      reply_exists,
      reply_message_id,
      reply_type,
      reply_text,
      reply_has_media,
      reply_media_url,
      reply_media_base64,
      reply_mimetype,
      reply_filename,
      reply_view_once,

      // Mentions Metadata
      mentioned_self: mentionedSelf ? 'true' : 'false',
      mentions: mentionsStr,
      self_id: selfPhone || selfJid,
      self_lid: selfLid,

      // Media URLs
      media_url: extractedMediaUrl,
      image_url: extractedMediaUrl,
      quoted_media_url: extractedMediaUrl,

      // Date and Time
      date: dateStr,
      time: timeStr,
      datetime: datetimeStr,
      timestamp: Date.now(),

      // Message Content
      raw_message: message.body || '',
      message_text: cleanBody,
      message: cleanBody,
      body: cleanBody,

      ...(initialVars || {}),
    };
  }

  /**
   * Evaluates incoming message or self-sent message from linked device against all active auto-reply / workflow rules.
   */
  async evaluateMessage(sessionId: string, message: any, isOutgoing = false): Promise<void> {
    if (!message) return;
    const body = (message.body || message.text || '').trim();
    if (!body && message.type !== 'image' && message.type !== 'document') return;

    const chatId = (message.chatId || message.to || message.from || '').toString();
    if (!chatId || chatId === 'status@broadcast') return;

    const isGroup = chatId.endsWith('@g.us');
    const isNewsletter = chatId.endsWith('@newsletter');
    const isPersonal = !isGroup && !isNewsletter;

    // Clean message text of leading mention tag e.g. "@127135947722784 hello" -> "hello"
    let cleanBody = body;
    const tagMatch = cleanBody.match(/^@\d+\s+(.*)$/s);
    if (tagMatch) {
      cleanBody = tagMatch[1].trim();
    }

    // 1. Check for pending multi-step conversation prompts across all states for this chatId
    const pendingStates = await this.stateRepo.find({ where: { chatId } });
    for (const state of pendingStates) {
      if (state.stateData) {
        try {
          const parsed = JSON.parse(state.stateData);
          if (parsed.pendingNodeId && parsed.variableName) {
            // Clear pending state to prevent infinite loops
            state.stateData = null;
            await this.stateRepo.save(state);

            const rule = await this.repo.findOne({ where: { id: state.ruleId, enabled: true } });
            if (rule) {
              const metadata = (rule.metadata || {}) as Record<string, any>;
              const workflow = metadata.workflow as WorkflowDefinition | undefined;
              if (workflow && workflow.nodes && workflow.edges) {
                const savedVars = parsed.savedVars || {};
                savedVars[parsed.variableName] = cleanBody;
                savedVars['message_text'] = cleanBody;
                savedVars['message'] = cleanBody;
                savedVars['body'] = cleanBody;
                savedVars['user_input'] = cleanBody;

                await this.executeWorkflowGraphFromNode(
                  sessionId,
                  chatId,
                  message,
                  cleanBody,
                  workflow,
                  rule,
                  parsed.pendingNodeId,
                  savedVars,
                );
                return;
              }
            }
          }
        } catch (e) {
          this.logger.warn('Failed to parse pending stateData', String(e));
        }
      }
    }

    const rules = await this.repo.find({ where: { sessionId, enabled: true } });
    if (rules.length === 0) return;

    const normalizedVars = await this.buildNormalizedVariables(sessionId, message, cleanBody);

    for (const rule of rules) {
      try {
        const metadata = (rule.metadata || {}) as Record<string, any>;
        const workflow = metadata.workflow as WorkflowDefinition | undefined;

        // Check chat scope
        const chatScope = metadata.chatScope || 'all';
        if (chatScope === 'personal' && !isPersonal) continue;
        if (chatScope === 'group' && !isGroup) continue;
        if (chatScope === 'newsletter' && !isNewsletter) continue;

        // Check outgoing / self-sent flag
        const triggerOnSelfSent = metadata.triggerOnSelfSent === true || workflow?.nodes?.some(n => n.type === 'trigger' && n.data?.triggerOnSelfSent);
        if (isOutgoing && !triggerOnSelfSent) continue;
        if (!isOutgoing && message.fromMe && !triggerOnSelfSent) continue;

        // Evaluate trigger condition
        let matched = false;
        let triggerNode: WorkflowNode | undefined;

        if (workflow && workflow.nodes) {
          triggerNode = workflow.nodes.find(n => n.type === 'trigger');
        }

        // Check requireMentionedSelf
        const requireMentionedSelf = metadata.requireMentionedSelf === true || triggerNode?.data?.requireMentionedSelf === true;
        if (requireMentionedSelf && normalizedVars.mentioned_self !== 'true') {
          continue;
        }

        // Check stripSelfMentionBeforeMatch
        const stripSelfMentionBeforeMatch = metadata.stripSelfMentionBeforeMatch === true || triggerNode?.data?.stripSelfMentionBeforeMatch === true;
        let triggerMatchText = cleanBody;
        if (stripSelfMentionBeforeMatch) {
          triggerMatchText = triggerMatchText.replace(/^@[\w\.\-]+\s*/, '').trim();
        }

        const matchType = triggerNode?.data?.matchType || rule.matchType || 'contains';
        const matchValue = (triggerNode?.data?.matchValue ?? rule.matchValue ?? '').trim().toLowerCase();
        const testText = triggerMatchText.toLowerCase();

        if (matchType === 'any') {
          matched = true;
        } else if (matchType === 'contains' && matchValue) {
          matched = testText.includes(matchValue);
        } else if (matchType === 'starts_with' && matchValue) {
          matched = testText.startsWith(matchValue);
        } else if (matchType === 'ends_with' && matchValue) {
          matched = testText.endsWith(matchValue);
        } else if (matchType === 'equals' && matchValue) {
          matched = testText === matchValue;
        } else if (matchType === 'regex' && matchValue) {
          try {
            matched = new RegExp(matchValue, 'i').test(triggerMatchText);
          } catch {}
        }

        if (!matched) continue;

        // Check restrictToOwner / admin restriction & reaction emoji
        const restrictToOwner = metadata.restrictToOwner === true || triggerNode?.data?.restrictToOwner === true;
        const restrictedEmoji = triggerNode?.data?.restrictedEmoji || metadata.restrictedEmoji || '🎉';
        const reactionEmoji = triggerNode?.data?.reactionEmoji || metadata.reactionEmoji || restrictedEmoji;
        const isOwnerSender = message.fromMe || isOutgoing;

        if (restrictToOwner && !isOwnerSender) {
          continue; // Skip running the main auto-reply action for non-owner senders
        }

        // React with emoji to the owner's trigger message
        if (reactionEmoji && message.id) {
          const msgService = this.getMessageService();
          if (msgService) {
            await msgService.reactToMessage(sessionId, {
              chatId,
              messageId: message.id,
              emoji: reactionEmoji,
            }).catch((err: unknown) => this.logger.warn(`Failed to react with emoji`, { error: String(err) }));
          }
        }

        // Cooldown / interval check
        if (rule.minIntervalSeconds && rule.minIntervalSeconds > 0) {
          const stateKey = rule.perChat ? chatId : 'global';
          const existingState = await this.stateRepo.findOne({ where: { ruleId: rule.id, chatId: stateKey } });
          if (existingState && existingState.lastSentAt) {
            const elapsedSeconds = (Date.now() - existingState.lastSentAt.getTime()) / 1000;
            if (elapsedSeconds < rule.minIntervalSeconds) {
              this.logger.debug(`Auto-reply rule ${rule.id} skipped due to interval limit`);
              continue;
            }
          }
          if (existingState) {
            existingState.lastSentAt = new Date();
            await this.stateRepo.save(existingState);
          } else {
            await this.stateRepo.save(this.stateRepo.create({ ruleId: rule.id, chatId: stateKey, lastSentAt: new Date() }));
          }
        }

        // Random delay simulation if configured
        const delayMin = (metadata.delayMinSeconds as number | undefined) ?? undefined;
        const delayMax = (metadata.delayMaxSeconds as number | undefined) ?? undefined;
        if (delayMin || delayMax) {
          const min = delayMin ?? 3;
          const max = delayMax ?? 8;
          const delaySec = Math.floor(Math.random() * (max - min + 1)) + min;
          this.logger.log(`Simulating typing delay of ${delaySec}s for auto-reply rule ${rule.id}`);
          await new Promise(res => setTimeout(res, delaySec * 1000));
        }

        // Execute visual workflow graph if present, or fallback to single action
        if (workflow && workflow.nodes && workflow.edges && workflow.nodes.length > 0) {
          const startNode = workflow.nodes.find(n => n.type === 'trigger') || workflow.nodes[0];
          await this.executeWorkflowGraphFromNode(
            sessionId,
            chatId,
            message,
            cleanBody,
            workflow,
            rule,
            startNode.id,
            normalizedVars,
          );
        } else {
          await this.executeSingleReply(sessionId, chatId, message, cleanBody, rule);
        }

        return; // Execute only first matching rule per message
      } catch (err) {
        this.logger.error(`Error executing auto-reply rule ${rule.id}`, String(err));
      }
    }
  }

  private async executeWorkflowGraphFromNode(
    sessionId: string,
    chatId: string,
    message: any,
    cleanBody: string,
    workflow: WorkflowDefinition,
    rule: AutoReplyRule,
    startNodeId: string,
    initialVars?: Record<string, any>,
  ): Promise<void> {
    const nodes = workflow.nodes || [];
    const edges = workflow.edges || [];

    const variables: Record<string, any> = initialVars
      ? { ...initialVars }
      : await this.buildNormalizedVariables(sessionId, message, cleanBody);

    let currentNodeId: string | null = startNodeId;
    let selectedBranch: string | null = null;
    const visited = new Set<string>();

    const msgService = this.getMessageService();

    while (currentNodeId && !visited.has(currentNodeId)) {
      visited.add(currentNodeId);
      const node = nodes.find(n => n.id === currentNodeId);
      if (!node) break;

      selectedBranch = null;

      if (node.type === 'extract_regex') {
        const pattern = node.data?.pattern || '';
        const varName = node.data?.variableName || 'extracted';
        if (pattern) {
          try {
            const regex = new RegExp(pattern, 'is');
            const match = cleanBody.match(regex);
            if (match) {
              if (match.groups) {
                Object.assign(variables, match.groups);
              }
              if (match[1]) {
                variables[varName] = match[1];
              } else {
                variables[varName] = match[0];
              }
            }
          } catch {}
        }
      } else if (node.type === 'prompt_input') {
        const promptTemplate = node.data?.promptText || 'Please send your request:';
        const varName = node.data?.variableName || 'user_input';
        const promptText = this.interpolate(promptTemplate, variables);

        if (promptText.trim() && msgService) {
          await msgService.sendText(sessionId, {
            chatId,
            text: promptText,
          }).catch((err: unknown) => this.logger.warn(`Failed to send prompt text`, { error: String(err) }));
        }

        const matchingEdges = edges.filter(e => e.source === currentNodeId);
        const nextTargetId = matchingEdges[0]?.target;

        if (nextTargetId) {
          const stateKey = rule.perChat ? chatId : 'global';
          let state = await this.stateRepo.findOne({ where: { ruleId: rule.id, chatId: stateKey } });
          if (!state) {
            state = this.stateRepo.create({ ruleId: rule.id, chatId: stateKey, lastSentAt: new Date() });
          }
          state.stateData = JSON.stringify({
            pendingNodeId: nextTargetId,
            variableName: varName,
            savedVars: variables,
          });
          await this.stateRepo.save(state);
        }
        return; // Pause execution until user sends next reply
      } else if (node.type === 'api_call') {
        const apiRes = await this.executeApiRequest({
          url: node.data?.url || '',
          method: node.data?.method || 'GET',
          headers: node.data?.headers || {},
          body: node.data?.body || '',
          variables,
        });

        Object.assign(variables, apiRes.extractedVariables);
      } else if (node.type === 'condition') {
        const variable = (node.data?.variable || 'status').trim();
        const operator = node.data?.operator || '==';
        const expectedValue = (node.data?.value ?? '200').toString().trim();
        const actualValue = (variables[variable] ?? '').toString().trim();

        let pass = false;
        if (operator === '==' || operator === 'equals') pass = actualValue === expectedValue;
        else if (operator === '!=' || operator === 'not_equals') pass = actualValue !== expectedValue;
        else if (operator === 'contains') pass = actualValue.includes(expectedValue);
        else if (operator === '>') pass = Number(actualValue) > Number(expectedValue);
        else if (operator === '<') pass = Number(actualValue) < Number(expectedValue);

        selectedBranch = pass ? 'true' : 'false';
      } else if (node.type === 'reply_text') {
        const textTemplate = node.data?.text || '';
        const replyText = this.interpolate(textTemplate, variables);
        if (replyText.trim() && msgService) {
          await msgService.sendText(sessionId, {
            chatId,
            text: replyText,
          }).catch((err: unknown) => this.logger.warn(`Failed to send auto-reply text`, { error: String(err) }));
        }
      } else if (node.type === 'reply_media') {
        const mediaType = node.data?.mediaType || 'image';
        const mediaSource = node.data?.mediaSource || 'default';
        let targetMediaUrl = '';

        if (mediaSource === 'replied_message') {
          targetMediaUrl = variables.reply_media_url || (variables.reply_media_base64 ? `data:${variables.reply_mimetype || 'image/webp'};base64,${variables.reply_media_base64}` : '');
        }

        if (!targetMediaUrl.trim()) {
          targetMediaUrl = this.interpolate(node.data?.mediaUrl || '', variables);
        }

        if (!targetMediaUrl.trim()) {
          targetMediaUrl = variables.media_url || variables.image_url || '';
        }

        const caption = this.interpolate(node.data?.caption || '', variables);

        if (targetMediaUrl.trim() && msgService) {
          if (mediaType === 'sticker') {
            await msgService.sendSticker(sessionId, { chatId, url: targetMediaUrl })
              .catch((err: unknown) => this.logger.warn(`Failed to send auto-reply sticker`, { error: String(err) }));
          } else if (mediaType === 'audio') {
            await msgService.sendAudio(sessionId, { chatId, url: targetMediaUrl })
              .catch((err: unknown) => this.logger.warn(`Failed to send auto-reply audio`, { error: String(err) }));
          } else if (mediaType === 'document') {
            await msgService.sendDocument(sessionId, { chatId, url: targetMediaUrl, caption, filename: variables.reply_filename || 'document' })
              .catch((err: unknown) => this.logger.warn(`Failed to send auto-reply document`, { error: String(err) }));
          } else {
            await msgService.sendImage(sessionId, { chatId, url: targetMediaUrl, caption })
              .catch((err: unknown) => this.logger.warn(`Failed to send auto-reply image`, { error: String(err) }));
          }
        }
      }

      // Find next node to advance along the edge
      const matchingEdges = edges.filter(e => e.source === currentNodeId);

      if (node.type === 'condition') {
        const branchEdge = matchingEdges.find(e => e.sourceHandle === selectedBranch || e.sourceHandle === `${selectedBranch}_branch`);
        currentNodeId = branchEdge ? branchEdge.target : null;
      } else {
        currentNodeId = matchingEdges[0]?.target || null;
      }
    }
  }

  private async executeSingleReply(
    sessionId: string,
    chatId: string,
    _message: any,
    _cleanBody: string,
    rule: AutoReplyRule,
  ): Promise<void> {
    const msgService = this.getMessageService();
    if (!msgService) return;

    if (rule.replyType === 'text' && rule.replyText) {
      await msgService.sendText(sessionId, {
        chatId,
        text: rule.replyText,
      });
    } else if (['image', 'audio', 'document', 'sticker'].includes(rule.replyType) && rule.mediaUrl) {
      if (rule.replyType === 'audio') {
        await msgService.sendAudio(sessionId, { chatId, url: rule.mediaUrl });
      } else if (rule.replyType === 'document') {
        await msgService.sendDocument(sessionId, { chatId, url: rule.mediaUrl, filename: 'document' });
      } else if (rule.replyType === 'sticker') {
        await msgService.sendSticker(sessionId, { chatId, url: rule.mediaUrl });
      } else {
        await msgService.sendImage(sessionId, { chatId, url: rule.mediaUrl });
      }
    }
  }
}
