'use client';

import type { Tool } from '@/data/tools';
import AiAssistantCore from '@/components/ai/AiAssistantCore';

export default function AiChatRunner({ tool }: { tool: Tool }) {
  return (
    <AiAssistantCore
      layout="page"
      isPdfTool={tool.mode === 'pdf'}
      title={tool.mode === 'pdf' ? 'AI PDF Assistant' : 'AI Chat Assistant'}
    />
  );
}
