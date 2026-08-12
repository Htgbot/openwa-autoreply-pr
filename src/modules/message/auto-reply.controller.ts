import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequireRole } from '../auth/decorators/auth.decorators';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import { AutoReplyService, type CreateAutoReplyDto } from './auto-reply.service';
import { AutoReplyRule } from './entities/auto-reply-rule.entity';

@ApiTags('auto-replies')
@ApiBearerAuth()
@Controller('sessions/:sessionId/auto-replies')
export class AutoReplyController {
  constructor(private readonly service: AutoReplyService) {}

  @Get()
  @ApiOperation({ summary: 'List auto-reply rules for a session' })
  @ApiParam({ name: 'sessionId' })
  @ApiResponse({ status: 200, type: [AutoReplyRule] })
  async list(@Param('sessionId') sessionId: string): Promise<AutoReplyRule[]> {
    return this.service.list(sessionId);
  }

  @Post()
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Create auto-reply rule' })
  @ApiParam({ name: 'sessionId' })
  @ApiResponse({ status: 201, type: AutoReplyRule })
  async create(@Param('sessionId') sessionId: string, @Body() dto: CreateAutoReplyDto): Promise<AutoReplyRule> {
    return this.service.create(sessionId, dto);
  }

  @Put(':id')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Update auto-reply rule' })
  @ApiParam({ name: 'sessionId' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, type: AutoReplyRule })
  async update(@Param('id') id: string, @Body() dto: CreateAutoReplyDto): Promise<AutoReplyRule> {
    return this.service.update(id, dto);
  }

  @Post('test-api')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Test external API call for workflow simulation' })
  @ApiParam({ name: 'sessionId' })
  @ApiResponse({ status: 200 })
  async testApi(@Body() dto: any): Promise<any> {
    return this.service.testApi(dto);
  }

  @Delete(':id')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete auto-reply rule' })
  @ApiParam({ name: 'sessionId' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 204 })
  async remove(@Param('id') id: string): Promise<void> {
    await this.service.delete(id);
  }
}

