import { useEffect, useRef, useState, useCallback } from 'react';
import {
  PlayCircle,
  GitFork,
  Clock,
  CheckSquare,
  MessageSquare,
  Globe,
  Scissors,
  Image as ImageIcon,
  Save,
  Trash2,
  Download,
  Upload,
  LayoutGrid,
  X,
  Sliders,
  RotateCcw,
  Sparkles,
  Loader2,
  Check,
  Play,
  HelpCircle,
  Copy,
} from 'lucide-react';
import { autoReplyApi, type AutoReplyRule } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useSessionsQuery } from '../hooks/queries';
import { useToast } from '../hooks/useToast';
import './AutoReply.css';

export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'condition' | 'time_check' | 'mark_read' | 'reply_text' | 'api_call' | 'extract_regex' | 'prompt_input' | 'reply_media';
  data: Record<string, any>;
  x: number;
  y: number;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

const PALETTE_BLOCKS = [
  { type: 'trigger', name: 'Trigger Keyword', sub: 'On message received', icon: PlayCircle },
  { type: 'condition', name: 'If / Else Branch', sub: 'Branch flow path', icon: GitFork },
  { type: 'time_check', name: 'Time / Day Check', sub: 'Check schedule', icon: Clock },
  { type: 'mark_read', name: 'Mark as Read', sub: 'Meta status reader', icon: CheckSquare },
  { type: 'reply_text', name: 'Auto-Reply Text', sub: 'Outbound text reply', icon: MessageSquare },
  { type: 'api_call', name: 'Trigger Webhook', sub: 'GET/POST integration', icon: Globe },
  { type: 'extract_regex', name: 'Extract Regex', sub: 'Pattern regex match', icon: Scissors },
  { type: 'prompt_input', name: 'Ask Question & Wait', sub: 'Interactive 2-step prompt', icon: HelpCircle },
  { type: 'reply_media', name: 'Reply Media', sub: 'Photo, Audio, Doc, Sticker', icon: ImageIcon },
] as const;

const SYSTEM_VARIABLES = [
  {
    category: 'User & Contact Info',
    tokens: [
      { key: '{name}', desc: 'Sender push name or display name' },
      { key: '{sender_name}', desc: 'Sender full name' },
      { key: '{sender_number}', desc: 'Sender phone number without @' },
      { key: '{sender_id}', desc: 'Sender complete WhatsApp JID' },
    ],
  },
  {
    category: 'Chat, Group & Channel IDs',
    tokens: [
      { key: '{chat_id}', desc: 'Current Chat ID / JID' },
      { key: '{group_id}', desc: 'Group ID (@g.us) or empty' },
      { key: '{channel_id}', desc: 'Channel / Newsletter ID (@newsletter)' },
      { key: '{chat_type}', desc: '"group", "channel", or "personal"' },
      { key: '{id}', desc: 'Incoming message ID or Chat ID' },
    ],
  },
  {
    category: 'Quoted / Replied Message Context',
    tokens: [
      { key: '{reply_exists}', desc: '"true" or "false" if replying to a message' },
      { key: '{reply_message_id}', desc: 'ID of quoted/replied message' },
      { key: '{reply_type}', desc: '"text", "image", "document", "audio", "video", "sticker", "view_once"' },
      { key: '{reply_text}', desc: 'Text body of replied message' },
      { key: '{reply_has_media}', desc: '"true" or "false" if quoted message contains media' },
      { key: '{reply_media_url}', desc: 'URL of quoted media' },
      { key: '{reply_media_base64}', desc: 'Base64 data of quoted media' },
      { key: '{reply_mimetype}', desc: 'MIME type of quoted media' },
      { key: '{reply_filename}', desc: 'Filename of quoted document' },
      { key: '{reply_view_once}', desc: '"true" or "false" if view-once media' },
    ],
  },
  {
    category: 'Bot Mentions & Identity',
    tokens: [
      { key: '{mentioned_self}', desc: '"true" or "false" (whether bot account is tagged)' },
      { key: '{mentions}', desc: 'Comma-separated list of tagged JIDs' },
      { key: '{self_id}', desc: 'Connected WhatsApp phone/JID' },
      { key: '{self_lid}', desc: 'Connected WhatsApp LID JID' },
    ],
  },
  {
    category: 'Date & Time',
    tokens: [
      { key: '{date}', desc: 'Current Date (YYYY-MM-DD)' },
      { key: '{time}', desc: 'Current Time (HH:mm:ss)' },
      { key: '{datetime}', desc: 'Full Date & Time string' },
    ],
  },
  {
    category: 'Message Content',
    tokens: [
      { key: '{message}', desc: 'Clean incoming message text' },
      { key: '{message_text}', desc: 'Clean incoming message text' },
      { key: '{raw_message}', desc: 'Raw incoming message' },
    ],
  },
  {
    category: 'API Response & Error Tokens',
    tokens: [
      { key: '{status}', desc: 'HTTP response status (e.g. 200, 400, 500)' },
      { key: '{response_raw}', desc: 'Raw API response text' },
      { key: '{response_error}', desc: 'Network error description if request failed' },
      { key: '{data.<field>}', desc: 'Flattened JSON response property (e.g. {data.message})' },
    ],
  },
];

export function AutoReply() {
  useDocumentTitle('Auto Reply Workflow Builder');
  const toast = useToast();
  const { data: sessions = [] } = useSessionsQuery();
  const [sessionId, setSessionId] = useState('');
  const [showVariablesHelp, setShowVariablesHelp] = useState(false);

  // Rules list for current session
  const [rules, setRules] = useState<AutoReplyRule[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string>('new');
  const [workflowName, setWorkflowName] = useState('Welcome greeting Flow');

  // Nodes & Edges on canvas
  const [nodes, setNodes] = useState<WorkflowNode[]>([
    {
      id: 'node_trigger_1',
      type: 'trigger',
      x: 120,
      y: 180,
      data: {
        matchType: 'contains',
        matchValue: 'hi',
        chatScope: 'all',
        triggerOnMention: true,
        triggerOnSelfSent: false,
      },
    },
    {
      id: 'node_reply_1',
      type: 'reply_text',
      x: 480,
      y: 180,
      data: {
        text: 'How can we help....',
      },
    },
  ]);

  const [edges, setEdges] = useState<WorkflowEdge[]>([
    {
      id: 'edge_1',
      source: 'node_trigger_1',
      target: 'node_reply_1',
    },
  ]);

  // Selected node for editing
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [editNode, setEditNode] = useState<WorkflowNode | null>(null);

  // Dragging state on canvas
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [connectingSource, setConnectingSource] = useState<{ nodeId: string; handle: string | null } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Test mode state for API node
  const [testVariables, setTestVariables] = useState<Record<string, string>>({ orderid: '12345' });
  const [testResult, setTestResult] = useState<any>(null);
  const [testingApi, setTestingApi] = useState(false);

  // Import / Export JSON modal
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [saving, setSaving] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sessionId && sessions.length > 0) {
      setSessionId(sessions[0].id);
    }
  }, [sessions, sessionId]);

  const loadRules = useCallback(async (sid: string) => {
    if (!sid) return;
    try {
      const list = await autoReplyApi.list(sid);
      setRules(list);
    } catch (err) {
      toast.error('Failed to load rules', String(err));
    }
  }, [toast]);

  useEffect(() => {
    if (sessionId) {
      loadRules(sessionId);
    }
  }, [sessionId, loadRules]);

  const handleSelectRule = (ruleId: string) => {
    setSelectedRuleId(ruleId);
    if (ruleId === 'new') {
      setWorkflowName('New Workflow Flow');
      setNodes([
        {
          id: `node_trigger_${Date.now()}`,
          type: 'trigger',
          x: 120,
          y: 180,
          data: { matchType: 'contains', matchValue: 'hi', chatScope: 'all', triggerOnMention: true },
        },
        {
          id: `node_reply_${Date.now() + 1}`,
          type: 'reply_text',
          x: 480,
          y: 180,
          data: { text: 'Hello! How can we assist you today?' },
        },
      ]);
      setEdges([{ id: `edge_${Date.now()}`, source: `node_trigger_${Date.now()}`, target: `node_reply_${Date.now() + 1}` }]);
      return;
    }

    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;

    const metadata = (rule.metadata || {}) as Record<string, any>;
    if (metadata.workflow && metadata.workflow.nodes && metadata.workflow.nodes.length > 0) {
      setWorkflowName(metadata.workflow.name || `Workflow ${rule.matchValue || ''}`);
      setNodes(metadata.workflow.nodes);
      setEdges(metadata.workflow.edges || []);
    } else {
      setWorkflowName(`Auto-Reply: ${rule.matchValue || 'All'}`);
      setNodes([
        {
          id: 'node_trigger_0',
          type: 'trigger',
          x: 120,
          y: 180,
          data: {
            matchType: rule.matchType || 'contains',
            matchValue: rule.matchValue || '',
            chatScope: metadata.chatScope || 'all',
            triggerOnMention: metadata.triggerOnMention ?? true,
            triggerOnSelfSent: metadata.triggerOnSelfSent ?? false,
          },
        },
        {
          id: 'node_reply_0',
          type: rule.replyType === 'text' ? 'reply_text' : 'reply_media',
          x: 480,
          y: 180,
          data: {
            text: rule.replyText || '',
            mediaType: rule.replyType,
            mediaUrl: rule.mediaUrl || '',
          },
        },
      ]);
      setEdges([{ id: 'edge_0', source: 'node_trigger_0', target: 'node_reply_0' }]);
    }
  };

  const handleAddNode = (type: WorkflowNode['type']) => {
    const id = `node_${type}_${Date.now()}`;
    const x = 200 + Math.random() * 200;
    const y = 150 + Math.random() * 150;

    const defaultData: Record<string, any> = {};
    if (type === 'trigger') {
      defaultData.matchType = 'contains';
      defaultData.matchValue = 'keyword';
      defaultData.chatScope = 'all';
      defaultData.triggerOnMention = true;
    } else if (type === 'reply_text') {
      defaultData.text = 'Your order nickname is {data.nickname}';
    } else if (type === 'api_call') {
      defaultData.method = 'GET';
      defaultData.url = 'https://api.testdomain.com/getorder?orderid={orderid}';
      defaultData.headers = {};
      defaultData.body = '';
    } else if (type === 'condition') {
      defaultData.variable = 'status';
      defaultData.operator = '==';
      defaultData.value = '200';
    } else if (type === 'extract_regex') {
      defaultData.pattern = '@\\d+\\s+update\\s+company\\s+(?<orderid>\\w+)';
      defaultData.variableName = 'orderid';
    } else if (type === 'prompt_input') {
      defaultData.promptText = 'Please send your NIC number only:';
      defaultData.variableName = 'nic';
    } else if (type === 'reply_media') {
      defaultData.mediaType = 'image';
      defaultData.mediaUrl = 'https://cdn-gop.garenanow.com/gop/app/0000/100/067/icon.png';
      defaultData.caption = 'Order detail: {data.nickname}';
    }

    const newNode: WorkflowNode = { id, type, x, y, data: defaultData };
    setNodes(prev => [...prev, newNode]);
    setActiveNodeId(id);
    setEditNode(newNode);
  };

  const handleDeleteNode = (nodeId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setEdges(prev => prev.filter(edge => edge.source !== nodeId && edge.target !== nodeId));
    if (activeNodeId === nodeId) {
      setActiveNodeId(null);
      setEditNode(null);
    }
  };

  const handleSaveBlueprint = async () => {
    if (!sessionId) {
      toast.error('No session selected', 'Please select a WhatsApp session first.');
      return;
    }

    const triggerNode = nodes.find(n => n.type === 'trigger') || nodes[0];
    const matchType = triggerNode?.data?.matchType || 'contains';
    const matchValue = triggerNode?.data?.matchValue || '';

    const payload = {
      enabled: true,
      matchType,
      matchValue: matchType === 'any' ? undefined : (matchValue || 'workflow'),
      replyType: 'text',
      replyText: 'Workflow active',
      workflow: {
        name: workflowName.trim() || 'Custom Workflow Flow',
        nodes,
        edges,
      },
      metadata: {
        chatScope: triggerNode?.data?.chatScope || 'all',
        triggerOnMention: triggerNode?.data?.triggerOnMention ?? true,
        triggerOnSelfSent: triggerNode?.data?.triggerOnSelfSent ?? false,
      },
    };

    setSaving(true);
    try {
      if (selectedRuleId !== 'new') {
        await autoReplyApi.update(sessionId, selectedRuleId, payload);
        toast.success('Workflow Blueprint Saved', `Updated ${workflowName}`);
      } else {
        const created = await autoReplyApi.create(sessionId, payload);
        toast.success('Workflow Blueprint Created', `Saved ${workflowName}`);
        setSelectedRuleId(created.id);
      }
      await loadRules(sessionId);
    } catch (err) {
      toast.error('Failed to save workflow', String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async () => {
    if (selectedRuleId === 'new') {
      setNodes([]);
      setEdges([]);
      return;
    }
    try {
      await autoReplyApi.delete(sessionId, selectedRuleId);
      toast.success('Workflow Deleted', 'The workflow has been removed.');
      handleSelectRule('new');
      await loadRules(sessionId);
    } catch (err) {
      toast.error('Failed to delete workflow', String(err));
    }
  };

  const handleAutoArrange = () => {
    const arranged = [...nodes];
    arranged.forEach((n, idx) => {
      n.x = 100 + (idx % 3) * 340;
      n.y = 120 + Math.floor(idx / 3) * 220;
    });
    setNodes(arranged);
  };

  const handleDeleteEdge = (edgeId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEdges(prev => prev.filter(edge => edge.id !== edgeId));
    toast.success('Connection Line Removed', 'Deleted workflow connection wire.');
  };

  // Node Dragging Logic
  const handleMouseDownNode = (node: WorkflowNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveNodeId(node.id);
    setDraggingNodeId(node.id);
    setDragOffset({ x: e.clientX - node.x, y: e.clientY - node.y });
  };

  const handleMouseMoveCanvas = (e: React.MouseEvent) => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }

    if (draggingNodeId) {
      setNodes(prev =>
        prev.map(n => {
          if (n.id === draggingNodeId) {
            return {
              ...n,
              x: Math.max(10, e.clientX - dragOffset.x),
              y: Math.max(10, e.clientY - dragOffset.y),
            };
          }
          return n;
        }),
      );
    }
  };

  const handleMouseUpCanvas = () => {
    setDraggingNodeId(null);
    setConnectingSource(null);
  };

  const handleStartConnect = (nodeId: string, handle: string | null, e: React.MouseEvent) => {
    e.stopPropagation();
    setConnectingSource({ nodeId, handle });
  };

  const handleEndConnect = (targetNodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!connectingSource || connectingSource.nodeId === targetNodeId) {
      setConnectingSource(null);
      return;
    }

    const newEdge: WorkflowEdge = {
      id: `edge_${Date.now()}`,
      source: connectingSource.nodeId,
      target: targetNodeId,
      sourceHandle: connectingSource.handle,
    };

    setEdges(prev => [...prev.filter(edge => !(edge.source === newEdge.source && edge.sourceHandle === newEdge.sourceHandle)), newEdge]);
    setConnectingSource(null);
  };

  // Test Mode simulation for API Node
  const handleRunTestApi = async () => {
    if (!editNode || editNode.type !== 'api_call') return;
    setTestingApi(true);
    setTestResult(null);
    try {
      const res = await autoReplyApi.testApi(sessionId, {
        url: editNode.data.url,
        method: editNode.data.method,
        headers: editNode.data.headers,
        body: editNode.data.body,
        variables: testVariables,
      });
      setTestResult(res);
    } catch (err) {
      toast.error('API Test Error', String(err));
      setTestResult({
        status: 500,
        data: { error: err instanceof Error ? err.message : String(err) },
        raw: String(err),
        extractedVariables: { status: 500, error: String(err) },
      });
    } finally {
      setTestingApi(false);
    }
  };

  return (
    <div className="workflow-container">
      {/* Top Workflow Header Matching Reference Image */}
      <header className="workflow-header">
        <div className="workflow-header-left">
          <div className="workflow-select-group">
            <label>Session:</label>
            <select className="workflow-select" style={{ minWidth: '160px' }} value={sessionId} onChange={e => setSessionId(e.target.value)}>
              {sessions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.status})
                </option>
              ))}
            </select>
          </div>

          <div className="workflow-select-group">
            <label>Workflow Project:</label>
            <select className="workflow-select" value={selectedRuleId} onChange={e => handleSelectRule(e.target.value)}>
              <option value="new">-- Create New Workflow Flow --</option>
              {rules.map(r => (
                <option key={r.id} value={r.id}>
                  {(r.metadata as any)?.workflow?.name || `Rule: ${r.matchValue || 'All'}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="workflow-header-right">
          <div className="workflow-select-group">
            <label>Workflow Name:</label>
            <input
              type="text"
              className="workflow-input"
              value={workflowName}
              onChange={e => setWorkflowName(e.target.value)}
              placeholder="Welcome greeting Flow"
            />
          </div>

          <button className="workflow-btn" onClick={() => setShowVariablesHelp(true)} title="View system and API variable tokens">
            <HelpCircle size={14} color="#38bdf8" /> Variables (?)
          </button>
          <button className="workflow-btn" onClick={() => {
            const tr = nodes.find(n => n.type === 'trigger');
            if (tr) {
              setActiveNodeId(tr.id);
              setEditNode(tr);
            }
          }}>
            <Sliders size={14} /> Set Trigger
          </button>
          <button className="workflow-btn" onClick={() => {
            setJsonText(JSON.stringify({ name: workflowName, nodes, edges }, null, 2));
            setShowJsonModal(true);
          }}>
            <Upload size={14} /> Import JSON
          </button>
          <button className="workflow-btn" onClick={() => {
            const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({ name: workflowName, nodes, edges }, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute('href', dataStr);
            downloadAnchor.setAttribute('download', `${workflowName.replace(/\s+/g, '_')}_blueprint.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
          }}>
            <Download size={14} /> Export JSON
          </button>
          <button className="workflow-btn" onClick={handleAutoArrange}>
            <LayoutGrid size={14} /> Auto Arrange
          </button>
          <button className="workflow-btn" onClick={() => { setNodes([]); setEdges([]); }}>
            <RotateCcw size={14} /> Clear
          </button>
          <button className="workflow-btn danger" onClick={handleDeleteRule}>
            <Trash2 size={14} /> Delete
          </button>
          <button className="workflow-btn primary" onClick={handleSaveBlueprint} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Save Blueprint
          </button>
        </div>
      </header>

      {/* Main Builder Body */}
      <div className="workflow-body">
        {/* Left Palette Sidebar */}
        <aside className="workflow-sidebar">
          <div className="workflow-sidebar-title">Workflow Blocks</div>
          {PALETTE_BLOCKS.map(block => {
            const Icon = block.icon;
            return (
              <div
                key={block.type}
                className="workflow-block-item"
                onClick={() => handleAddNode(block.type)}
                title="Click to add to canvas"
              >
                <div className="workflow-block-icon">
                  <Icon size={18} />
                </div>
                <div className="workflow-block-info">
                  <span className="workflow-block-name">{block.name}</span>
                  <span className="workflow-block-sub">{block.sub}</span>
                </div>
              </div>
            );
          })}
        </aside>

        {/* Interactive Canvas Area */}
        <main
          className="workflow-canvas-container"
          ref={canvasRef}
          onMouseMove={handleMouseMoveCanvas}
          onMouseUp={handleMouseUpCanvas}
        >
          <div className="workflow-canvas">
            {/* SVG Connecting Cables Layer */}
            <svg className="workflow-svg-layer">
              {edges.map(edge => {
                const sourceNode = nodes.find(n => n.id === edge.source);
                const targetNode = nodes.find(n => n.id === edge.target);
                if (!sourceNode || !targetNode) return null;

                const sx = sourceNode.x + 240;
                let sy = sourceNode.y + 55;
                if (sourceNode.type === 'condition') {
                  sy = edge.sourceHandle === 'false' ? sourceNode.y + 75 : sourceNode.y + 35;
                }

                const tx = targetNode.x;
                const ty = targetNode.y + 55;
                const dx = Math.abs(tx - sx) * 0.5;
                const path = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;

                const mx = (sx + tx) / 2;
                const my = (sy + ty) / 2;

                return (
                  <g key={edge.id} className="workflow-wire-group">
                    {/* Invisible wide hitbox for easy clicking */}
                    <path
                      d={path}
                      className="workflow-wire-hitbox"
                      stroke="transparent"
                      strokeWidth={24}
                      fill="none"
                      style={{ cursor: 'pointer', pointerEvents: 'all' }}
                      onClick={e => handleDeleteEdge(edge.id, e)}
                    >
                      <title>Click to disconnect line</title>
                    </path>

                    {/* Visible Wire Path */}
                    <path
                      d={path}
                      className={`workflow-wire ${edge.sourceHandle === 'true' ? 'wire-true' : edge.sourceHandle === 'false' ? 'wire-false' : ''}`}
                      style={{ cursor: 'pointer', pointerEvents: 'all' }}
                      onClick={e => handleDeleteEdge(edge.id, e)}
                    />

                    {/* Interactive Red 'X' Delete Badge in middle of wire */}
                    <g
                      transform={`translate(${mx}, ${my})`}
                      className="workflow-wire-delete-badge"
                      style={{ cursor: 'pointer', pointerEvents: 'all' }}
                      onClick={e => handleDeleteEdge(edge.id, e)}
                    >
                      <circle r="10" fill="#ef4444" stroke="#0f172a" strokeWidth="2" />
                      <text textAnchor="middle" dy="3.5" fill="#ffffff" fontSize="11" fontWeight="bold">
                        ×
                      </text>
                    </g>
                  </g>
                );
              })}

              {connectingSource && (
                <path
                  d={`M ${
                    (nodes.find(n => n.id === connectingSource.nodeId)?.x || 0) + 240
                  } ${
                    (nodes.find(n => n.id === connectingSource.nodeId)?.y || 0) + 55
                  } C ${
                    (nodes.find(n => n.id === connectingSource.nodeId)?.x || 0) + 240 + 50
                  } ${
                    (nodes.find(n => n.id === connectingSource.nodeId)?.y || 0) + 55
                  }, ${mousePos.x - 50} ${mousePos.y}, ${mousePos.x} ${mousePos.y}`}
                  className="workflow-wire"
                  strokeDasharray="4 4"
                />
              )}
            </svg>

            {/* Draggable Nodes on Canvas */}
            {nodes.map(node => {
              const Icon = PALETTE_BLOCKS.find(p => p.type === node.type)?.icon || MessageSquare;
              const isCondition = node.type === 'condition';

              return (
                <div
                  key={node.id}
                  className={`workflow-node ${activeNodeId === node.id ? 'selected' : ''} ${node.type === 'trigger' ? 'active-trigger' : ''}`}
                  style={{ left: `${node.x}px`, top: `${node.y}px` }}
                  onMouseDown={e => handleMouseDownNode(node, e)}
                  onDoubleClick={() => {
                    setActiveNodeId(node.id);
                    setEditNode(node);
                  }}
                >
                  {/* Input Port (on left) */}
                  {node.type !== 'trigger' && (
                    <div
                      className="workflow-port input"
                      onMouseUp={e => handleEndConnect(node.id, e)}
                      title="Connect target here"
                    />
                  )}

                  {/* Node Header */}
                  <div className="workflow-node-header">
                    <div className="workflow-node-title-wrap">
                      <Icon size={16} color="#818cf8" />
                      <span className="workflow-node-title">
                        {PALETTE_BLOCKS.find(p => p.type === node.type)?.name || node.type}
                      </span>
                    </div>
                    <button className="workflow-node-del" onClick={e => handleDeleteNode(node.id, e)}>
                      <X size={14} />
                    </button>
                  </div>

                  {/* Node Body Content */}
                  <div className="workflow-node-body">
                    {node.type === 'trigger' && (
                      <>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          Scope: <strong style={{ color: '#f1f5f9' }}>{node.data.chatScope || 'all'}</strong> | Match: <strong style={{ color: '#f1f5f9' }}>{node.data.matchType || 'contains'}</strong>
                        </div>
                        <div className="workflow-node-preview">
                          {node.data.matchType === 'any' ? '[Matches any message]' : `Keyword: "${node.data.matchValue || ''}"`}
                        </div>
                      </>
                    )}

                    {node.type === 'reply_text' && (
                      <>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Reply Text Message:</div>
                        <div className="workflow-node-preview">{node.data.text || 'Type message...'}</div>
                      </>
                    )}

                    {node.type === 'api_call' && (
                      <>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          Method: <strong style={{ color: '#38bdf8' }}>{node.data.method || 'GET'}</strong>
                        </div>
                        <div className="workflow-node-preview">{node.data.url || 'https://...'}</div>
                      </>
                    )}

                    {node.type === 'condition' && (
                      <>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>If condition:</div>
                        <div className="workflow-node-preview">
                          {node.data.variable || 'status'} {node.data.operator || '=='} {node.data.value || '200'}
                        </div>
                      </>
                    )}

                    {node.type === 'extract_regex' && (
                      <>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Extract: <strong style={{ color: '#a78bfa' }}>{node.data.variableName || 'orderid'}</strong></div>
                        <div className="workflow-node-preview">{node.data.pattern || '@\\d+ ...'}</div>
                      </>
                    )}

                    {node.type === 'reply_media' && (
                      <>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Media: <strong style={{ color: '#34d399' }}>{node.data.mediaType || 'image'}</strong></div>
                        <div className="workflow-node-preview">{node.data.mediaUrl || 'URL...'}</div>
                      </>
                    )}

                    {node.type === 'mark_read' && (
                      <div style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Check size={14} /> Marks conversation as read
                      </div>
                    )}
                  </div>

                  {/* Output Ports (on right) */}
                  {!isCondition ? (
                    <div
                      className="workflow-port output"
                      onMouseDown={e => handleStartConnect(node.id, null, e)}
                      title="Drag to connect"
                    />
                  ) : (
                    <>
                      <span className="workflow-port-label true-label">True</span>
                      <div
                        className="workflow-port output-true"
                        onMouseDown={e => handleStartConnect(node.id, 'true', e)}
                        title="Drag True branch wire"
                      />
                      <span className="workflow-port-label false-label">False</span>
                      <div
                        className="workflow-port output-false"
                        onMouseDown={e => handleStartConnect(node.id, 'false', e)}
                        title="Drag False branch wire"
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </main>
      </div>

      {/* Node Settings Modal & Interactive Test Mode */}
      {editNode && (
        <div className="workflow-modal-backdrop" onClick={() => setEditNode(null)}>
          <div className="workflow-modal-card" onClick={e => e.stopPropagation()}>
            <div className="workflow-modal-header">
              <div className="workflow-modal-title">
                Configure {PALETTE_BLOCKS.find(p => p.type === editNode.type)?.name}
              </div>
              <button className="workflow-node-del" onClick={() => setEditNode(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="workflow-modal-body">
              {/* Trigger Node Form */}
              {editNode.type === 'trigger' && (
                <>
                  <div className="workflow-field-group">
                    <label>Chat Scope:</label>
                    <select
                      className="workflow-field-input"
                      value={editNode.data.chatScope || 'all'}
                      onChange={e => setEditNode({ ...editNode, data: { ...editNode.data, chatScope: e.target.value } })}
                    >
                      <option value="all">All (Groups, Newsletters & 1:1 DMs)</option>
                      <option value="personal">Personal 1:1 DMs Only</option>
                      <option value="group">Groups Only (@g.us)</option>
                      <option value="newsletter">Newsletters / Channels Only (@newsletter)</option>
                    </select>
                  </div>

                  <div className="workflow-field-group">
                    <label>Match Type:</label>
                    <select
                      className="workflow-field-input"
                      value={editNode.data.matchType || 'contains'}
                      onChange={e => setEditNode({ ...editNode, data: { ...editNode.data, matchType: e.target.value } })}
                    >
                      <option value="contains">Contains Keyword</option>
                      <option value="starts_with">Starts With</option>
                      <option value="ends_with">Ends With</option>
                      <option value="equals">Exact Match</option>
                      <option value="regex">Regex Expression</option>
                      <option value="any">Match Any Message</option>
                    </select>
                  </div>

                  {editNode.data.matchType !== 'any' && (
                    <div className="workflow-field-group">
                      <label>Match Keyword / Pattern:</label>
                      <input
                        type="text"
                        className="workflow-field-input"
                        value={editNode.data.matchValue || ''}
                        onChange={e => setEditNode({ ...editNode, data: { ...editNode.data, matchValue: e.target.value } })}
                        placeholder="e.g. order or update company"
                      />
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={editNode.data.requireMentionedSelf ?? false}
                        onChange={e => setEditNode({ ...editNode, data: { ...editNode.data, requireMentionedSelf: e.target.checked } })}
                      />
                      <span>Require Bot / Self Mention (Trigger only when connected account is tagged)</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={editNode.data.stripSelfMentionBeforeMatch ?? false}
                        onChange={e => setEditNode({ ...editNode, data: { ...editNode.data, stripSelfMentionBeforeMatch: e.target.checked } })}
                      />
                      <span>Strip Self Mention Before Matching (e.g. <code>@self update</code> matches <code>update</code>)</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={editNode.data.triggerOnMention ?? true}
                        onChange={e => setEditNode({ ...editNode, data: { ...editNode.data, triggerOnMention: e.target.checked } })}
                      />
                      <span>Recognize group mentions / tag e.g. <code>@127135947722784 update company</code></span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={editNode.data.triggerOnSelfSent ?? false}
                        onChange={e => setEditNode({ ...editNode, data: { ...editNode.data, triggerOnSelfSent: e.target.checked } })}
                      />
                      <span>Trigger when command is sent from linked devices/phones</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={editNode.data.restrictToOwner ?? false}
                        onChange={e => setEditNode({ ...editNode, data: { ...editNode.data, restrictToOwner: e.target.checked } })}
                      />
                      <span>Restrict trigger to Session Owner / Admin (Only run when sent from your account)</span>
                    </label>

                    {editNode.data.restrictToOwner && (
                      <div className="workflow-field-group" style={{ marginLeft: '24px', marginTop: '4px' }}>
                        <label style={{ fontSize: '0.8rem', color: '#38bdf8' }}>Non-Owner Reaction Emoji:</label>
                        <input
                          type="text"
                          className="workflow-field-input"
                          style={{ width: '120px', fontSize: '0.9rem', textAlign: 'center' }}
                          value={editNode.data.restrictedEmoji ?? '🎉'}
                          onChange={e => setEditNode({ ...editNode, data: { ...editNode.data, restrictedEmoji: e.target.value } })}
                          placeholder="e.g. 🎉"
                        />
                        <small style={{ color: '#94a3b8' }}>
                          When a non-owner user sends this trigger, react with this emoji and skip sending auto-reply message.
                        </small>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Extract Regex Node Form */}
              {editNode.type === 'extract_regex' && (
                <>
                  <div className="workflow-field-group">
                    <label>Regex Matching Pattern:</label>
                    <input
                      type="text"
                      className="workflow-field-input"
                      value={editNode.data.pattern || ''}
                      onChange={e => setEditNode({ ...editNode, data: { ...editNode.data, pattern: e.target.value } })}
                      placeholder="e.g. nic\s+(?<nic>\w+) or (?<orderid>\d{6,12})"
                    />
                    <small style={{ color: '#94a3b8' }}>
                      Use named groups <code>(?&lt;nic&gt;\w+)</code> to extract variables e.g. from "nic 200012304567".
                    </small>
                  </div>

                  <div className="workflow-field-group">
                    <label>Default Variable Name:</label>
                    <input
                      type="text"
                      className="workflow-field-input"
                      value={editNode.data.variableName || 'nic'}
                      onChange={e => setEditNode({ ...editNode, data: { ...editNode.data, variableName: e.target.value } })}
                      placeholder="e.g. nic"
                    />
                  </div>
                </>
              )}

              {/* Ask Question & Wait Form */}
              {editNode.type === 'prompt_input' && (
                <>
                  <div className="workflow-field-group">
                    <label>Question Prompt Text:</label>
                    <textarea
                      className="workflow-field-input"
                      rows={3}
                      value={editNode.data.promptText || ''}
                      onChange={e => setEditNode({ ...editNode, data: { ...editNode.data, promptText: e.target.value } })}
                      placeholder="e.g. Please send your NIC number only:"
                    />
                  </div>

                  <div className="workflow-field-group">
                    <label>Save User's Reply Into Variable Name:</label>
                    <input
                      type="text"
                      className="workflow-field-input"
                      value={editNode.data.variableName || 'nic'}
                      onChange={e => setEditNode({ ...editNode, data: { ...editNode.data, variableName: e.target.value } })}
                      placeholder="e.g. nic"
                    />
                    <small style={{ color: '#94a3b8' }}>
                      When the user replies to this question, their message will be saved as <code>{`{${editNode.data.variableName || 'nic'}}`}</code> and passed into the next API call or reply!
                    </small>
                  </div>
                </>
              )}

              {/* Trigger Webhook / API Call Node Form with Test Mode */}
              {editNode.type === 'api_call' && (
                <>
                  <div className="workflow-field-group">
                    <label>HTTP Method:</label>
                    <select
                      className="workflow-field-input"
                      value={editNode.data.method || 'GET'}
                      onChange={e => setEditNode({ ...editNode, data: { ...editNode.data, method: e.target.value } })}
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                    </select>
                  </div>

                  <div className="workflow-field-group">
                    <label>API Endpoint URL:</label>
                    <input
                      type="text"
                      className="workflow-field-input"
                      value={editNode.data.url || ''}
                      onChange={e => setEditNode({ ...editNode, data: { ...editNode.data, url: e.target.value } })}
                      placeholder="e.g. https://api.testdomain.com/getorder?orderid={orderid}&chatid={chat_id}&group={group_id}"
                    />
                    <small style={{ color: '#94a3b8' }}>
                      Click to insert variable into URL or body:
                    </small>
                    <div style={{ marginTop: '4px' }}>
                      {['{chat_id}', '{group_id}', '{channel_id}', '{sender_number}', '{name}', '{date}', '{time}', '{orderid}'].map(v => (
                        <span
                          key={v}
                          className="workflow-variable-pill"
                          onClick={() => {
                            const cur = editNode.data.url || '';
                            setEditNode({ ...editNode, data: { ...editNode.data, url: `${cur}${cur.includes('?') ? '&' : '?'}${v.slice(1, -1)}=${v}` } });
                          }}
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>

                  {editNode.data.method !== 'GET' && (
                    <div className="workflow-field-group">
                      <label>JSON Request Body:</label>
                      <textarea
                        className="workflow-field-input"
                        rows={3}
                        value={editNode.data.body || ''}
                        onChange={e => setEditNode({ ...editNode, data: { ...editNode.data, body: e.target.value } })}
                        placeholder='{"orderId": "{orderid}"}'
                      />
                    </div>
                  )}

                  {/* Interactive Test Mode Panel */}
                  {(() => {
                    const detectedTokens = Array.from(new Set([
                      ...(editNode.data.url?.match(/\{([a-zA-Z0-9_.-]+)\}/g) || []).map((t: string) => t.slice(1, -1)),
                      ...(editNode.data.body?.match(/\{([a-zA-Z0-9_.-]+)\}/g) || []).map((t: string) => t.slice(1, -1)),
                    ]));

                    return (
                      <div style={{ marginTop: '12px', padding: '12px', background: '#0f172a', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Sparkles size={14} /> Interactive Real API Test Mode
                          </span>
                          <button className="workflow-btn primary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={handleRunTestApi} disabled={testingApi}>
                            {testingApi ? <Loader2 className="animate-spin" size={12} /> : <Play size={12} />} Send Test Request
                          </button>
                        </div>

                        {detectedTokens.length > 0 ? (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px', marginBottom: '8px' }}>
                            {detectedTokens.map((tok: string) => (
                              <div key={tok} className="workflow-field-group">
                                <label style={{ fontSize: '0.75rem', color: '#38bdf8' }}>{`{${tok}}`}:</label>
                                <input
                                  type="text"
                                  className="workflow-field-input"
                                  style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                                  placeholder={`Test value for ${tok}...`}
                                  value={testVariables[tok] ?? ''}
                                  onChange={e => setTestVariables({ ...testVariables, [tok]: e.target.value })}
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '8px' }}>
                            Tip: Add variable tokens like <code>{'{nic}'}</code> or <code>{'{orderid}'}</code> into the API URL to test live variable replacement.
                          </div>
                        )}

                        {testResult && (
                          <div style={{ fontSize: '0.75rem', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ padding: '8px', background: '#1e293b', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                              <div style={{ color: '#38bdf8', fontWeight: 600, marginBottom: '4px' }}>Outgoing Request Details:</div>
                              <div><strong>Method:</strong> <span style={{ color: '#fbbf24' }}>{testResult.effectiveMethod || editNode.data.method || 'GET'}</span></div>
                              <div style={{ wordBreak: 'break-all' }}><strong>URL:</strong> <code>{testResult.effectiveUrl || editNode.data.url}</code></div>
                              {testResult.effectiveHeaders && Object.keys(testResult.effectiveHeaders).length > 0 && (
                                <div><strong>Headers:</strong> <code>{JSON.stringify(testResult.effectiveHeaders)}</code></div>
                              )}
                              {testResult.effectiveBody && (
                                <div style={{ marginTop: '4px' }}>
                                  <strong>Body:</strong>
                                  <pre style={{ margin: '2px 0 0 0', padding: '4px', background: '#0f172a', borderRadius: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                    {testResult.effectiveBody}
                                  </pre>
                                </div>
                              )}
                            </div>

                            <div style={{ padding: '8px', background: '#1e293b', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                              <div style={{ color: testResult.status >= 200 && testResult.status < 300 ? '#22c55e' : '#ef4444', fontWeight: 600, marginBottom: '4px' }}>
                                HTTP Status: {testResult.status} {testResult.response_error ? `(${testResult.response_error})` : ''}
                              </div>

                              <div style={{ color: '#94a3b8', marginBottom: '2px' }}>Parsed JSON Response:</div>
                              <div style={{ maxHeight: '140px', overflowY: 'auto', background: '#0f172a', padding: '8px', borderRadius: '4px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                {typeof testResult.data === 'object' ? JSON.stringify(testResult.data, null, 2) : testResult.response_raw || testResult.raw}
                              </div>

                              {testResult.response_raw && (
                                <details style={{ marginTop: '4px' }}>
                                  <summary style={{ cursor: 'pointer', color: '#94a3b8' }}>Raw Response Body</summary>
                                  <pre style={{ margin: '4px 0 0 0', padding: '6px', background: '#0f172a', borderRadius: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '100px', overflowY: 'auto' }}>
                                    {testResult.response_raw}
                                  </pre>
                                </details>
                              )}
                            </div>

                            <div style={{ marginTop: '2px' }}>
                              <span style={{ color: '#94a3b8' }}>Extracted response tokens (click to copy):</span>
                              <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {Object.keys(testResult.extractedVariables || {}).map((k: string) => (
                                  <span
                                    key={k}
                                    className="workflow-variable-pill"
                                    onClick={() => {
                                      navigator.clipboard.writeText(`{${k}}`);
                                      toast.success('Token Copied', `{${k}}`);
                                    }}
                                  >
                                    {`{${k}}`}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}

              {/* If / Else Condition Form */}
              {editNode.type === 'condition' && (
                <>
                  <div className="workflow-field-group">
                    <label>Variable:</label>
                    <input
                      type="text"
                      className="workflow-field-input"
                      value={editNode.data.variable || 'status'}
                      onChange={e => setEditNode({ ...editNode, data: { ...editNode.data, variable: e.target.value } })}
                      placeholder="e.g. status or data.nickname"
                    />
                  </div>

                  <div className="workflow-field-group">
                    <label>Operator:</label>
                    <select
                      className="workflow-field-input"
                      value={editNode.data.operator || '=='}
                      onChange={e => setEditNode({ ...editNode, data: { ...editNode.data, operator: e.target.value } })}
                    >
                      <option value="==">Equals (==)</option>
                      <option value="!=">Not Equals (!=)</option>
                      <option value="contains">Contains</option>
                      <option value=">">Greater Than (&gt;)</option>
                      <option value="<">Less Than (&lt;)</option>
                    </select>
                  </div>

                  <div className="workflow-field-group">
                    <label>Expected Value:</label>
                    <input
                      type="text"
                      className="workflow-field-input"
                      value={editNode.data.value || '200'}
                      onChange={e => setEditNode({ ...editNode, data: { ...editNode.data, value: e.target.value } })}
                      placeholder="e.g. 200"
                    />
                  </div>
                </>
              )}

              {/* Auto-Reply Text Form */}
              {editNode.type === 'reply_text' && (
                <>
                  <div className="workflow-field-group">
                    <label>Reply Text Template:</label>
                    <textarea
                      className="workflow-field-input"
                      rows={5}
                      value={editNode.data.text || ''}
                      onChange={e => setEditNode({ ...editNode, data: { ...editNode.data, text: e.target.value } })}
                      placeholder="Hello {name}! Your order nickname is {data.nickname}..."
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        Click to insert variable token:
                      </label>
                      <button className="workflow-btn" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => setShowVariablesHelp(true)}>
                        <HelpCircle size={12} color="#38bdf8" /> (?) View All Variables
                      </button>
                    </div>
                    {['{name}', '{sender_number}', '{chat_id}', '{group_id}', '{channel_id}', '{date}', '{time}', '{data.nickname}', '{data.open_id}', '{orderid}', '{message_text}', '{status}'].map(v => (
                      <span
                        key={v}
                        className="workflow-variable-pill"
                        onClick={() => {
                          const cur = editNode.data.text || '';
                          setEditNode({ ...editNode, data: { ...editNode.data, text: `${cur} ${v}`.trim() } });
                        }}
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                </>
              )}

              {/* Reply Media Form */}
              {editNode.type === 'reply_media' && (
                <>
                  <div className="workflow-field-group">
                    <label>Media Source:</label>
                    <select
                      className="workflow-field-input"
                      value={editNode.data.mediaSource || 'default'}
                      onChange={e => setEditNode({ ...editNode, data: { ...editNode.data, mediaSource: e.target.value } })}
                    >
                      <option value="default">Default (Specified URL / Incoming Message Media)</option>
                      <option value="replied_message">Replied / Quoted Message (Use quoted media)</option>
                    </select>
                  </div>

                  <div className="workflow-field-group">
                    <label>Media Type:</label>
                    <select
                      className="workflow-field-input"
                      value={editNode.data.mediaType || 'image'}
                      onChange={e => setEditNode({ ...editNode, data: { ...editNode.data, mediaType: e.target.value } })}
                    >
                      <option value="image">Image (Photo)</option>
                      <option value="sticker">Sticker</option>
                      <option value="audio">Voice Note / Audio</option>
                      <option value="document">Document / PDF</option>
                    </select>
                  </div>

                  <div className="workflow-field-group">
                    <label>Media URL (Direct Link):</label>
                    <input
                      type="text"
                      className="workflow-field-input"
                      value={editNode.data.mediaUrl || ''}
                      onChange={e => setEditNode({ ...editNode, data: { ...editNode.data, mediaUrl: e.target.value } })}
                      placeholder="e.g. https://... or {data.img_url}"
                    />
                  </div>

                  <div className="workflow-field-group">
                    <label>Media Caption (Optional):</label>
                    <input
                      type="text"
                      className="workflow-field-input"
                      value={editNode.data.caption || ''}
                      onChange={e => setEditNode({ ...editNode, data: { ...editNode.data, caption: e.target.value } })}
                      placeholder="e.g. Verified by {data.nickname}"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="workflow-modal-footer">
              <button className="workflow-btn" onClick={() => setEditNode(null)}>
                Cancel
              </button>
              <button
                className="workflow-btn primary"
                onClick={() => {
                  setNodes(prev => prev.map(n => (n.id === editNode.id ? editNode : n)));
                  setEditNode(null);
                }}
              >
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JSON Import/Export Modal */}
      {showJsonModal && (
        <div className="workflow-modal-backdrop" onClick={() => setShowJsonModal(false)}>
          <div className="workflow-modal-card" onClick={e => e.stopPropagation()}>
            <div className="workflow-modal-header">
              <div className="workflow-modal-title">Import / Export Blueprint JSON</div>
              <button className="workflow-node-del" onClick={() => setShowJsonModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="workflow-modal-body">
              <textarea
                className="workflow-field-input"
                style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                rows={14}
                value={jsonText}
                onChange={e => setJsonText(e.target.value)}
              />
            </div>

            <div className="workflow-modal-footer">
              <button className="workflow-btn" onClick={() => setShowJsonModal(false)}>
                Cancel
              </button>
              <button
                className="workflow-btn primary"
                onClick={() => {
                  try {
                    const parsed = JSON.parse(jsonText);
                    if (parsed.nodes) setNodes(parsed.nodes);
                    if (parsed.edges) setEdges(parsed.edges);
                    if (parsed.name) setWorkflowName(parsed.name);
                    setShowJsonModal(false);
                    toast.success('Blueprint Imported', 'Nodes loaded successfully onto canvas.');
                  } catch (err) {
                    toast.error('Invalid JSON', String(err));
                  }
                }}
              >
                Load Blueprint
              </button>
            </div>
          </div>
        </div>
      )}
      {/* System Variables Help Modal */}
      {showVariablesHelp && (
        <div className="workflow-modal-backdrop" onClick={() => setShowVariablesHelp(false)}>
          <div className="workflow-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="workflow-modal-header">
              <div className="workflow-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HelpCircle size={20} color="#38bdf8" />
                Available System & API Variables Reference
              </div>
              <button className="workflow-node-del" onClick={() => setShowVariablesHelp(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="workflow-modal-body">
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: 0 }}>
                These variable tokens are automatically populated by the system during message processing. You can use them in <strong>API Request URLs</strong>, <strong>JSON Request Bodies</strong>, <strong>API Headers</strong>, and <strong>Reply Messages</strong>.
              </p>

              {SYSTEM_VARIABLES.map(group => (
                <div key={group.category} style={{ marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '0.85rem', color: '#38bdf8', margin: '0 0 8px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '4px' }}>
                    {group.category}
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px' }}>
                    {group.tokens.map(item => (
                      <div
                        key={item.key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'rgba(255,255,255,0.04)',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <div>
                          <code style={{ color: '#a5b4fc', fontWeight: 600, fontSize: '0.85rem' }}>{item.key}</code>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{item.desc}</div>
                        </div>
                        <button
                          className="workflow-btn"
                          style={{ padding: '3px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => {
                            navigator.clipboard.writeText(item.key);
                            toast.success('Token Copied', item.key);
                          }}
                        >
                          <Copy size={12} /> Copy
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="workflow-modal-footer">
              <button className="workflow-btn primary" onClick={() => setShowVariablesHelp(false)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
