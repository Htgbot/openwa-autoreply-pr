import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AutoReplyService } from './auto-reply.service';
import { AutoReplyRule } from './entities/auto-reply-rule.entity';
import { AutoReplyState } from './entities/auto-reply-state.entity';
import { Session } from '../session/entities/session.entity';

describe('AutoReplyService', () => {
  let service: AutoReplyService;

  const mockRuleRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(dto => dto),
    save: jest.fn(rule => Promise.resolve({ id: 'rule-1', ...rule })),
    delete: jest.fn(),
  };

  const mockStateRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn(dto => dto),
    save: jest.fn(),
  };

  const mockSessionRepo = {
    findOne: jest.fn().mockResolvedValue({ id: 'sess-1', phone: '628123456789' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutoReplyService,
        { provide: getRepositoryToken(AutoReplyRule, 'data'), useValue: mockRuleRepo },
        { provide: getRepositoryToken(AutoReplyState, 'data'), useValue: mockStateRepo },
        { provide: getRepositoryToken(Session, 'data'), useValue: mockSessionRepo },
      ],
    }).compile();

    service = module.get<AutoReplyService>(AutoReplyService);
  });

  describe('executeApiRequest (Shared Executor)', () => {
    it('handles HTTP 200 and flattens response JSON correctly', async () => {
      const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ status: 200, success: true, message: 'Update received', user: { name: 'Harry' } })),
      } as any);

      const result = await service.executeApiRequest({
        url: 'http://test.com/api?q={message}',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: '{message}', from: '{sender_number}' }),
        variables: { message: 'Hello', sender_number: '628123' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test.com/api?q=Hello',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: 'Hello', from: '628123' }),
        }),
      );

      expect(result.status).toBe(200);
      expect(result.extractedVariables['data.message']).toBe('Update received');
      expect(result.extractedVariables['data.user.name']).toBe('Harry');
      mockFetch.mockRestore();
    });

    it('handles HTTP 400 non-2xx without throwing and saves error variables', async () => {
      const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({
        status: 400,
        text: () => Promise.resolve(JSON.stringify({ status: 400, success: false, message: 'Missing parameter: q' })),
      } as any);

      const result = await service.executeApiRequest({
        url: 'http://test.com/api',
        method: 'POST',
        variables: { message: 'test' },
      });

      expect(result.status).toBe(400);
      expect(result.response_error).toBe('');
      expect(result.extractedVariables['data.message']).toBe('Missing parameter: q');
      expect(result.extractedVariables['status']).toBe(400);
      mockFetch.mockRestore();
    });

    it('handles network failure by setting status=0 and populating response_error', async () => {
      const mockFetch = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('FetchError: ECONNREFUSED'));

      const result = await service.executeApiRequest({
        url: 'http://unreachable.local/api',
        method: 'GET',
      });

      expect(result.status).toBe(0);
      expect(result.response_error).toBe('FetchError: ECONNREFUSED');
      expect(result.extractedVariables['data.success']).toBe(false);
      mockFetch.mockRestore();
    });
  });

  describe('Quoted Reply Context & Self Mention Triggers', () => {
    it('builds normalized reply context tokens for quoted image', async () => {
      const msg = {
        id: 'msg-1',
        chatId: '628123@c.us',
        body: '.reply',
        quotedMessage: {
          id: 'q-1',
          type: 'image',
          body: 'Check this image',
          hasMedia: true,
          mediaUrl: 'data:image/jpeg;base64,12345',
          mimetype: 'image/jpeg',
        },
      };

      const vars = await (service as any).buildNormalizedVariables('sess-1', msg, '.reply');

      expect(vars.reply_exists).toBe('true');
      expect(vars.reply_message_id).toBe('q-1');
      expect(vars.reply_type).toBe('image');
      expect(vars.reply_text).toBe('Check this image');
      expect(vars.reply_has_media).toBe('true');
      expect(vars.reply_media_url).toBe('data:image/jpeg;base64,12345');
    });

    it('handles requireMentionedSelf and stripSelfMentionBeforeMatch correctly', async () => {
      const msg = {
        id: 'msg-2',
        chatId: '120363@g.us',
        body: '@628123456789 update',
        mentionedIds: ['628123456789@c.us'],
      };

      const vars = await (service as any).buildNormalizedVariables('sess-1', msg, '@628123456789 update');
      expect(vars.mentioned_self).toBe('true');
    });

    it('recognizes LID privacy mentions like @127135947722784 in group chats', async () => {
      const msg = {
        id: 'msg-3',
        chatId: '120363419603401679@g.us',
        body: '@127135947722784 update',
        mentionedIds: ['127135947722784@lid'],
      };

      const vars = await (service as any).buildNormalizedVariables('sess-1', msg, '@127135947722784 update');
      expect(vars.mentioned_self).toBe('true');
    });
  });
});
