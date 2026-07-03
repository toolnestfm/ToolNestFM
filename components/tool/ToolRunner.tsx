'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import type { Tool } from '@/data/tools';
import { recordJob } from '@/lib/jobs';
import { Processing } from './shared';

const loading = () => <Processing label="Loading tool..." />;

const ImageRunner = dynamic(() => import('./runners/ImageRunner'), { ssr: false, loading });
const BgRemoveRunner = dynamic(() => import('./runners/BgRemoveRunner'), { ssr: false, loading });
const OcrRunner = dynamic(() => import('./runners/OcrRunner'), { ssr: false, loading });
const PdfRunner = dynamic(() => import('./runners/PdfRunner'), { ssr: false, loading });
const PdfConvertRunner = dynamic(() => import('./runners/PdfConvertRunner'), { ssr: false, loading });
const FfmpegRunner = dynamic(() => import('./runners/FfmpegRunner'), { ssr: false, loading });
const SpeechRunner = dynamic(() => import('./runners/SpeechRunner'), { ssr: false, loading });
const AiTextRunner = dynamic(() => import('./runners/AiTextRunner'), { ssr: false, loading });
const AiChatRunner = dynamic(() => import('./runners/AiChatRunner'), { ssr: false, loading });
const AiImageRunner = dynamic(() => import('./runners/AiImageRunner'), { ssr: false, loading });
const ResumeRunner = dynamic(() => import('./runners/ResumeRunner'), { ssr: false, loading });
const PresentationRunner = dynamic(() => import('./runners/PresentationRunner'), { ssr: false, loading });
const DevRunner = dynamic(() => import('./runners/DevRunner'), { ssr: false, loading });
const TextRunner = dynamic(() => import('./runners/TextRunner'), { ssr: false, loading });
const SeoRunner = dynamic(() => import('./runners/SeoRunner'), { ssr: false, loading });
const UtilityRunner = dynamic(() => import('./runners/UtilityRunner'), { ssr: false, loading });
const SecurityRunner = dynamic(() => import('./runners/SecurityRunner'), { ssr: false, loading });
const BusinessRunner = dynamic(() => import('./runners/BusinessRunner'), { ssr: false, loading });
const CalculatorRunner = dynamic(() => import('./runners/CalculatorRunner'), { ssr: false, loading });
const FileConvertRunner = dynamic(() => import('./runners/FileConvertRunner'), { ssr: false, loading });
const SocialRunner = dynamic(() => import('./runners/SocialRunner'), { ssr: false, loading });

export default function ToolRunner({ tool }: { tool: Tool }) {
  useEffect(() => {
    recordJob(tool.slug, 'used');
  }, [tool.slug]);

  switch (tool.runner) {
    case 'image': return <ImageRunner tool={tool} />;
    case 'bg-remove': return <BgRemoveRunner tool={tool} />;
    case 'ocr': return <OcrRunner tool={tool} />;
    case 'pdf': return <PdfRunner tool={tool} />;
    case 'pdf-convert': return <PdfConvertRunner tool={tool} />;
    case 'ffmpeg': return <FfmpegRunner tool={tool} />;
    case 'speech': return <SpeechRunner tool={tool} />;
    case 'ai-text': return <AiTextRunner tool={tool} />;
    case 'ai-chat': return <AiChatRunner tool={tool} />;
    case 'ai-image': return <AiImageRunner />;
    case 'resume': return <ResumeRunner />;
    case 'presentation': return <PresentationRunner />;
    case 'dev': return <DevRunner tool={tool} />;
    case 'text': return <TextRunner tool={tool} />;
    case 'seo': return <SeoRunner tool={tool} />;
    case 'utility': return <UtilityRunner tool={tool} />;
    case 'security': return <SecurityRunner tool={tool} />;
    case 'business': return <BusinessRunner tool={tool} />;
    case 'calculator': return <CalculatorRunner tool={tool} />;
    case 'file-convert': return <FileConvertRunner tool={tool} />;
    case 'social': return <SocialRunner tool={tool} />;
    default: return <div className="error-box">This tool is coming soon.</div>;
  }
}
