export type RunnerKind =
  | 'image'
  | 'bg-remove'
  | 'ocr'
  | 'pdf'
  | 'pdf-convert'
  | 'pdf-converter'
  | 'ffmpeg'
  | 'speech'
  | 'ai-text'
  | 'ai-chat'
  | 'ai-image'
  | 'resume'
  | 'presentation'
  | 'dev'
  | 'text'
  | 'seo'
  | 'utility'
  | 'security'
  | 'business'
  | 'calculator'
  | 'file-convert'
  | 'social';

export type ToolConfig = Record<string, unknown>;

export interface Tool {
  id: number;
  slug: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  badge?: 'new' | 'ai' | 'popular';
  runner: RunnerKind;
  mode: string;
  accept?: string;
  multiple?: boolean;
  config?: ToolConfig;
  keywords?: string[];
}

const IMG = 'image/*';
const PDF = 'application/pdf';

export const tools: Tool[] = [
  // ─── 🏛 Government Tools (8) ───────────────────────────────────────────
  { id: 1, slug: 'passport-photo-maker', name: 'Passport Photo Maker', description: 'Create compliant passport photos with country presets', category: 'government', icon: 'user-square', runner: 'image', mode: 'gov-photo', accept: IMG, config: { presets: [ { label: 'India Passport (35×45 mm, 2×2 in print)', w: 413, h: 531, kb: 100 }, { label: 'US Passport (2×2 in)', w: 600, h: 600, kb: 240 }, { label: 'UK Passport (35×45 mm)', w: 413, h: 531, kb: 100 }, { label: 'Schengen Visa (35×45 mm)', w: 413, h: 531, kb: 100 } ] }, keywords: ['passport', 'photo', 'visa', 'id'] },
  { id: 2, slug: 'passport-signature-resizer', name: 'Passport Signature Resizer', description: 'Resize signature to passport upload specifications', category: 'government', icon: 'pen', runner: 'image', mode: 'gov-photo', accept: IMG, config: { presets: [ { label: 'Passport Seva Signature (small)', w: 200, h: 100, kb: 20 }, { label: 'Passport Seva Signature (large)', w: 400, h: 200, kb: 50 } ] } },
  { id: 3, slug: 'pan-card-photo-resizer', name: 'PAN Card Photo Resizer', description: 'Resize photo to NSDL / UTIITSL PAN specifications', category: 'government', icon: 'user-square', runner: 'image', mode: 'gov-photo', accept: IMG, config: { presets: [ { label: 'PAN Photo (213×213 px, ≤30KB)', w: 213, h: 213, kb: 30 }, { label: 'PAN Signature (213×71 px, ≤30KB)', w: 213, h: 71, kb: 30 } ] } },
  { id: 4, slug: 'aadhaar-photo-resizer', name: 'Aadhaar Photo Resizer', description: 'Resize photo to UIDAI Aadhaar specifications', category: 'government', icon: 'user-square', runner: 'image', mode: 'gov-photo', accept: IMG, config: { presets: [ { label: 'Aadhaar Photo (300×400 px, ≤100KB)', w: 300, h: 400, kb: 100 } ] } },
  { id: 5, slug: 'aadhaar-pdf-compressor', name: 'Aadhaar PDF Compressor', description: 'Compress Aadhaar PDF to UIDAI upload size limits', category: 'government', icon: 'file-down', runner: 'pdf', mode: 'compress', accept: PDF, config: { targetKB: 200 } },
  { id: 6, slug: 'voter-id-photo-resizer', name: 'Voter ID Photo Resizer', description: 'Resize photo to Voter ID (EPIC) specifications', category: 'government', icon: 'user-square', runner: 'image', mode: 'gov-photo', accept: IMG, config: { presets: [ { label: 'Voter ID Photo (240×320 px, ≤100KB)', w: 240, h: 320, kb: 100 } ] } },
  { id: 7, slug: 'driving-licence-photo-resizer', name: 'Driving Licence Photo Resizer', description: 'Resize photo & signature for DL (Sarathi) uploads', category: 'government', icon: 'user-square', runner: 'image', mode: 'gov-photo', accept: IMG, config: { presets: [ { label: 'DL Photo (420×525 px, ≤200KB)', w: 420, h: 525, kb: 200 }, { label: 'DL Signature (256×64 px, ≤10KB)', w: 256, h: 64, kb: 10 } ] } },
  { id: 8, slug: 'exam-photo-signature-resizer', name: 'Exam Photo & Signature Resizer', description: 'SSC, UPSC, IBPS, NEET compliant photo & signature', category: 'government', icon: 'user-square', runner: 'image', mode: 'gov-photo', accept: IMG, config: { presets: [ { label: 'SSC Photo (100–120KB, 3.5×4.5 cm)', w: 413, h: 531, kb: 110 }, { label: 'SSC Signature (4×2 cm, ≤20KB)', w: 472, h: 236, kb: 20 }, { label: 'UPSC Photo (350×350 px, ≤300KB)', w: 350, h: 350, kb: 300 }, { label: 'IBPS Photo (200×230 px, ≤50KB)', w: 200, h: 230, kb: 50 }, { label: 'IBPS Signature (140×60 px, ≤20KB)', w: 140, h: 60, kb: 20 }, { label: 'NEET Photo (Postcard 4×6 in, ≤200KB)', w: 1200, h: 1800, kb: 200 } ] } },

  // ─── 📄 PDF Tools (12 + 2 aliases) ─────────────────────────────────────
  { id: 9, slug: 'pdf-converter', name: 'PDF Converter', description: 'Convert PDF to Word, Excel, PowerPoint, Images and more — or convert any file to PDF', category: 'pdf', icon: 'file-text', badge: 'popular', runner: 'pdf-converter', mode: 'smart', accept: `${IMG},${PDF},.docx,.xlsx,.xls,.csv,.txt,.md,.html`, multiple: true, keywords: ['convert', 'pdf to word', 'pdf to excel', 'pdf to jpg', 'word to pdf', 'image to pdf', 'pdf to png', 'pdf to text', 'pdf to pptx'] },
  { id: 10, slug: 'pdf-editor', name: 'PDF Editor', description: 'Add text, annotations and page numbers to PDFs', category: 'pdf', icon: 'file-pen', runner: 'pdf', mode: 'edit', accept: PDF },
  { id: 11, slug: 'merge-pdf', name: 'Merge PDF', description: 'Merge multiple PDF files into one document', category: 'pdf', icon: 'merge', badge: 'popular', runner: 'pdf', mode: 'merge', accept: PDF, multiple: true },
  { id: 12, slug: 'split-pdf', name: 'Split PDF', description: 'Split a PDF into separate pages or ranges', category: 'pdf', icon: 'split', runner: 'pdf', mode: 'split', accept: PDF },
  { id: 13, slug: 'compress-pdf', name: 'PDF Compressor', description: 'Reduce PDF file size without quality loss', category: 'pdf', icon: 'file-down', badge: 'popular', runner: 'pdf', mode: 'compress', accept: PDF },
  { id: 14, slug: 'pdf-ocr', name: 'PDF OCR', description: 'Make scanned PDFs searchable with OCR', category: 'pdf', icon: 'scan-text', badge: 'ai', runner: 'ocr', mode: 'pdf', accept: PDF },
  { id: 15, slug: 'pdf-to-word', name: 'PDF to Word', description: 'Convert PDF files to editable Word documents', category: 'pdf', icon: 'file-text', badge: 'popular', runner: 'pdf-convert', mode: 'pdf2word', accept: PDF },
  { id: 16, slug: 'word-to-pdf', name: 'Word to PDF', description: 'Convert Word documents (DOCX) to PDF', category: 'pdf', icon: 'file-text', runner: 'pdf-convert', mode: 'word2pdf', accept: '.docx' },
  { id: 17, slug: 'pdf-to-excel', name: 'PDF to Excel', description: 'Convert PDF files to Excel sheets', category: 'pdf', icon: 'table', badge: 'popular', runner: 'pdf-convert', mode: 'pdf2excel', accept: PDF },
  { id: 18, slug: 'excel-to-pdf', name: 'Excel to PDF', description: 'Convert Excel spreadsheets (XLSX/CSV) to PDF', category: 'pdf', icon: 'table', runner: 'pdf-convert', mode: 'excel2pdf', accept: '.xlsx,.xls,.csv' },
  { id: 19, slug: 'protect-pdf', name: 'Protect PDF', description: 'Add password protection to PDF files', category: 'pdf', icon: 'lock', runner: 'pdf', mode: 'protect', accept: PDF },
  { id: 20, slug: 'sign-pdf', name: 'Sign PDF', description: 'Draw and place your signature on a PDF', category: 'pdf', icon: 'pen', runner: 'pdf', mode: 'sign', accept: PDF },
  { id: 129, slug: 'image-to-pdf', name: 'Image to PDF', description: 'Convert images to PDF documents', category: 'pdf', icon: 'image', badge: 'popular', runner: 'pdf', mode: 'img2pdf', accept: IMG, multiple: true },

  // ─── 🖼 Image Tools (12 + 1 alias) ─────────────────────────────────────
  { id: 21, slug: 'image-converter', name: 'Image Converter', description: 'Convert images between PNG, JPG, WebP and more', category: 'image', icon: 'image', badge: 'popular', runner: 'image', mode: 'convert', accept: IMG },
  { id: 22, slug: 'image-compressor', name: 'Image Compressor', description: 'Compress images without losing quality', category: 'image', icon: 'image-down', badge: 'popular', runner: 'image', mode: 'compress', accept: IMG },
  { id: 23, slug: 'image-resizer', name: 'Image Resizer', description: 'Resize images to exact dimensions', category: 'image', icon: 'scaling', runner: 'image', mode: 'resize', accept: IMG },
  { id: 24, slug: 'crop-image', name: 'Crop Image', description: 'Crop images to any size or aspect ratio', category: 'image', icon: 'crop', runner: 'image', mode: 'crop', accept: IMG },
  { id: 25, slug: 'rotate-flip-image', name: 'Rotate & Flip Image', description: 'Rotate or mirror images in one click', category: 'image', icon: 'rotate', runner: 'image', mode: 'rotate', accept: IMG },
  { id: 26, slug: 'background-remover', name: 'Background Remover', description: 'Remove background from any image with AI', category: 'image', icon: 'eraser', badge: 'ai', runner: 'bg-remove', mode: 'remove', accept: IMG },
  { id: 27, slug: 'background-changer', name: 'Background Changer', description: 'Replace image backgrounds with colors or photos', category: 'image', icon: 'wand', badge: 'ai', runner: 'bg-remove', mode: 'change', accept: IMG },
  { id: 28, slug: 'ai-image-upscaler', name: 'AI Image Upscaler', description: 'Upscale images 2x or 4x with enhanced detail', category: 'image', icon: 'sparkles', badge: 'ai', runner: 'image', mode: 'upscale', accept: IMG },
  { id: 29, slug: 'ai-photo-enhancer', name: 'AI Photo Enhancer', description: 'Auto-enhance brightness, contrast and sharpness', category: 'image', icon: 'sparkles', badge: 'ai', runner: 'image', mode: 'enhance', accept: IMG },
  { id: 30, slug: 'ai-object-remover', name: 'AI Object Remover', description: 'Brush over objects to remove them from photos', category: 'image', icon: 'eraser', badge: 'ai', runner: 'bg-remove', mode: 'object', accept: IMG },
  { id: 31, slug: 'image-ocr', name: 'OCR Image', description: 'Extract text from images', category: 'image', icon: 'scan-text', badge: 'popular', runner: 'ocr', mode: 'image', accept: IMG },
  { id: 32, slug: 'watermark-image', name: 'Watermark Image', description: 'Add text or logo watermarks to images', category: 'image', icon: 'stamp', runner: 'image', mode: 'watermark', accept: IMG },
  { id: 130, slug: 'watermark-remover', name: 'Watermark Remover', description: 'Remove watermarks from images', category: 'image', icon: 'eraser', badge: 'popular', runner: 'bg-remove', mode: 'object', accept: IMG },

  // ─── 🎥 Video Tools (8) ────────────────────────────────────────────────
  { id: 33, slug: 'video-converter', name: 'Video Converter', description: 'Convert videos to any format you need', category: 'video', icon: 'video', badge: 'popular', runner: 'ffmpeg', mode: 'video-convert', accept: 'video/*' },
  { id: 34, slug: 'video-compressor', name: 'Video Compressor', description: 'Compress video files without quality loss', category: 'video', icon: 'video', badge: 'popular', runner: 'ffmpeg', mode: 'video-compress', accept: 'video/*' },
  { id: 35, slug: 'video-trimmer', name: 'Video Trimmer', description: 'Cut and trim video clips precisely', category: 'video', icon: 'scissors', runner: 'ffmpeg', mode: 'video-trim', accept: 'video/*' },
  { id: 36, slug: 'video-merger', name: 'Video Merger', description: 'Join multiple videos into one file', category: 'video', icon: 'merge', runner: 'ffmpeg', mode: 'video-merge', accept: 'video/*', multiple: true },
  { id: 37, slug: 'video-splitter', name: 'Video Splitter', description: 'Split a video into equal parts', category: 'video', icon: 'split', runner: 'ffmpeg', mode: 'video-split', accept: 'video/*' },
  { id: 38, slug: 'video-watermark', name: 'Video Watermark', description: 'Add text watermarks to videos', category: 'video', icon: 'stamp', runner: 'ffmpeg', mode: 'video-watermark', accept: 'video/*' },
  { id: 39, slug: 'video-to-gif', name: 'Video to GIF', description: 'Turn video clips into animated GIFs', category: 'video', icon: 'film', runner: 'ffmpeg', mode: 'video-gif', accept: 'video/*' },
  { id: 40, slug: 'ai-subtitle-generator', name: 'AI Subtitle Generator', description: 'Generate SRT subtitles from video audio with AI', category: 'video', icon: 'captions', badge: 'ai', runner: 'speech', mode: 'subtitle', accept: 'video/*,audio/*' },

  // ─── 🎵 Audio Tools (8) ────────────────────────────────────────────────
  { id: 41, slug: 'audio-converter', name: 'Audio Converter', description: 'Convert audio files to any format', category: 'audio', icon: 'music', badge: 'popular', runner: 'ffmpeg', mode: 'audio-convert', accept: 'audio/*' },
  { id: 42, slug: 'audio-compressor', name: 'Audio Compressor', description: 'Reduce audio file size with bitrate control', category: 'audio', icon: 'music', runner: 'ffmpeg', mode: 'audio-compress', accept: 'audio/*' },
  { id: 43, slug: 'audio-cutter', name: 'Audio Cutter', description: 'Cut and trim audio clips', category: 'audio', icon: 'scissors', runner: 'ffmpeg', mode: 'audio-cut', accept: 'audio/*' },
  { id: 44, slug: 'audio-merger', name: 'Audio Merger', description: 'Join multiple audio files into one', category: 'audio', icon: 'merge', runner: 'ffmpeg', mode: 'audio-merge', accept: 'audio/*', multiple: true },
  { id: 45, slug: 'text-to-speech', name: 'Text to Speech', description: 'Convert text into natural speech', category: 'audio', icon: 'volume', badge: 'ai', runner: 'speech', mode: 'tts' },
  { id: 46, slug: 'speech-to-text', name: 'Speech to Text', description: 'Transcribe speech into text live', category: 'audio', icon: 'mic', badge: 'ai', runner: 'speech', mode: 'stt' },
  { id: 47, slug: 'voice-changer', name: 'Voice Changer', description: 'Change pitch and speed of any voice recording', category: 'audio', icon: 'mic', runner: 'ffmpeg', mode: 'voice-change', accept: 'audio/*' },
  { id: 48, slug: 'ai-noise-remover', name: 'AI Noise Remover', description: 'Clean background noise from audio', category: 'audio', icon: 'sparkles', badge: 'ai', runner: 'ffmpeg', mode: 'denoise', accept: 'audio/*' },

  // ─── 🤖 AI Tools (12) ──────────────────────────────────────────────────
  { id: 49, slug: 'ai-chat', name: 'AI Chat Assistant', description: 'Chat with AI and get instant answers', category: 'ai', icon: 'bot', badge: 'ai', runner: 'ai-chat', mode: 'chat' },
  { id: 50, slug: 'ai-writer', name: 'AI Writer', description: 'AI writer, paraphraser, summarizer', category: 'ai', icon: 'pen', badge: 'new', runner: 'ai-text', mode: 'writer', config: { fields: [ { key: 'topic', label: 'Topic / Brief', type: 'textarea', placeholder: 'Write a blog post about...' }, { key: 'tone', label: 'Tone', type: 'select', options: ['Professional', 'Casual', 'Persuasive', 'Friendly', 'Academic'] }, { key: 'length', label: 'Length', type: 'select', options: ['Short (~150 words)', 'Medium (~400 words)', 'Long (~800 words)'] } ], system: 'You are an expert content writer. Write high-quality content for the given brief in the requested tone and length. Output in Markdown.' } },
  { id: 51, slug: 'ai-image-generator', name: 'AI Image Generator', description: 'Create stunning images with AI', category: 'ai', icon: 'sparkles', badge: 'new', runner: 'ai-image', mode: 'generate' },
  { id: 52, slug: 'ai-resume-builder', name: 'AI Resume Builder', description: 'Build a professional resume PDF with AI polish', category: 'ai', icon: 'file-text', badge: 'ai', runner: 'resume', mode: 'resume' },
  { id: 53, slug: 'ai-translator', name: 'AI Translator', description: 'Translate text between 100+ languages', category: 'ai', icon: 'globe', badge: 'ai', runner: 'ai-text', mode: 'translator', config: { fields: [ { key: 'text', label: 'Text to translate', type: 'textarea', placeholder: 'Enter text...' }, { key: 'target', label: 'Translate to', type: 'select', options: ['English', 'Hindi', 'Bengali', 'Spanish', 'French', 'German', 'Portuguese', 'Arabic', 'Chinese', 'Japanese', 'Russian', 'Urdu', 'Tamil', 'Telugu', 'Marathi'] } ], system: 'You are a professional translator. Translate the given text into the target language. Output only the translation.' } },
  { id: 54, slug: 'ai-summarizer', name: 'AI Summarizer', description: 'Summarize long text into key points', category: 'ai', icon: 'list', badge: 'ai', runner: 'ai-text', mode: 'summarizer', config: { fields: [ { key: 'text', label: 'Text to summarize', type: 'textarea', placeholder: 'Paste long text or an article...' }, { key: 'style', label: 'Summary style', type: 'select', options: ['Bullet points', 'One paragraph', 'TL;DR one-liner', 'Detailed summary'] } ], system: 'You are an expert summarizer. Summarize the text in the requested style, preserving key facts.' } },
  { id: 55, slug: 'ai-email-writer', name: 'AI Email Writer', description: 'Draft professional emails in seconds', category: 'ai', icon: 'mail', badge: 'ai', runner: 'ai-text', mode: 'email', config: { fields: [ { key: 'brief', label: 'What is the email about?', type: 'textarea', placeholder: 'e.g. Follow up with a client about the pending invoice...' }, { key: 'tone', label: 'Tone', type: 'select', options: ['Formal', 'Friendly', 'Apologetic', 'Persuasive', 'Brief & direct'] } ], system: 'You are an expert email writer. Write a complete email (subject line + body) for the given brief in the requested tone.' } },
  { id: 56, slug: 'ai-seo-writer', name: 'AI SEO Writer', description: 'Generate SEO-optimized articles from keywords', category: 'ai', icon: 'search', badge: 'ai', runner: 'ai-text', mode: 'seo-writer', config: { fields: [ { key: 'keyword', label: 'Primary keyword', type: 'text', placeholder: 'e.g. best pdf compressor' }, { key: 'brief', label: 'Article brief (optional)', type: 'textarea', placeholder: 'Audience, angle, points to cover...' } ], system: 'You are an SEO content expert. Write an SEO-optimized article for the primary keyword: include an H1, headings, meta description suggestion, and natural keyword usage. Output in Markdown.' } },
  { id: 57, slug: 'ai-code-generator', name: 'AI Code Generator', description: 'Generate code snippets in any language', category: 'ai', icon: 'code', badge: 'ai', runner: 'ai-text', mode: 'code', config: { fields: [ { key: 'prompt', label: 'What should the code do?', type: 'textarea', placeholder: 'e.g. Python function to merge two sorted lists' }, { key: 'language', label: 'Language', type: 'select', options: ['Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'Go', 'Rust', 'PHP', 'SQL', 'Bash'] } ], system: 'You are an expert programmer. Generate clean, working, commented code for the request in the specified language. Output the code in a Markdown code block with a brief explanation.' } },
  { id: 58, slug: 'ai-research-assistant', name: 'AI Research Assistant', description: 'Get synthesized answers to research questions', category: 'ai', icon: 'search', badge: 'ai', runner: 'ai-text', mode: 'research', config: { fields: [ { key: 'query', label: 'Research question', type: 'textarea', placeholder: 'e.g. Compare solar vs wind energy costs in 2025' } ], system: 'You are a meticulous research assistant. Provide a well-structured, factual answer with headings, key data points, caveats, and suggested further reading topics. Output in Markdown.' } },
  { id: 59, slug: 'ai-presentation-maker', name: 'AI Presentation Maker', description: 'Turn a topic into a downloadable PPTX deck', category: 'ai', icon: 'presentation', badge: 'ai', runner: 'presentation', mode: 'pptx' },
  { id: 60, slug: 'ai-pdf-assistant', name: 'AI PDF Assistant', description: 'Upload a PDF and ask questions about it', category: 'ai', icon: 'file-text', badge: 'ai', runner: 'ai-chat', mode: 'pdf', accept: PDF },

  // ─── 💻 Developer Tools (8) ────────────────────────────────────────────
  { id: 61, slug: 'json-formatter', name: 'JSON Formatter', description: 'Pretty-print and minify JSON', category: 'developer', icon: 'braces', badge: 'popular', runner: 'dev', mode: 'json-format' },
  { id: 62, slug: 'json-validator', name: 'JSON Validator', description: 'Validate JSON and locate syntax errors', category: 'developer', icon: 'braces', runner: 'dev', mode: 'json-validate' },
  { id: 63, slug: 'base64-encoder-decoder', name: 'Base64 Encoder & Decoder', description: 'Encode and decode Base64 text and files', category: 'developer', icon: 'binary', runner: 'dev', mode: 'base64' },
  { id: 64, slug: 'url-encoder-decoder', name: 'URL Encoder & Decoder', description: 'Encode and decode URL components', category: 'developer', icon: 'link', runner: 'dev', mode: 'url' },
  { id: 65, slug: 'jwt-decoder', name: 'JWT Decoder', description: 'Decode JWT header and payload instantly', category: 'developer', icon: 'key', runner: 'dev', mode: 'jwt' },
  { id: 66, slug: 'uuid-generator', name: 'UUID Generator', description: 'Generate v4 UUIDs in bulk', category: 'developer', icon: 'hash', runner: 'dev', mode: 'uuid' },
  { id: 67, slug: 'hash-generator', name: 'Hash Generator', description: 'MD5, SHA-1, SHA-256, SHA-512 from text or files', category: 'developer', icon: 'hash', runner: 'security', mode: 'hash-all' },
  { id: 68, slug: 'api-tester', name: 'API Tester', description: 'Send HTTP requests and inspect responses', category: 'developer', icon: 'send', runner: 'dev', mode: 'api-test' },

  // ─── 📝 Text Tools (8) ─────────────────────────────────────────────────
  { id: 69, slug: 'case-converter', name: 'Case Converter', description: 'UPPER, lower, Title, camelCase, snake_case & more', category: 'text', icon: 'type', badge: 'popular', runner: 'text', mode: 'case' },
  { id: 70, slug: 'word-counter', name: 'Word Counter', description: 'Count words, characters, sentences and reading time', category: 'text', icon: 'type', runner: 'text', mode: 'count' },
  { id: 71, slug: 'character-counter', name: 'Character Counter', description: 'Live character count with and without spaces', category: 'text', icon: 'type', runner: 'text', mode: 'count' },
  { id: 72, slug: 'text-compare', name: 'Text Compare', description: 'Compare two texts and highlight differences', category: 'text', icon: 'split', runner: 'text', mode: 'compare' },
  { id: 73, slug: 'remove-duplicate-lines', name: 'Remove Duplicate Lines', description: 'De-duplicate lines in any text list', category: 'text', icon: 'list', runner: 'text', mode: 'dedupe' },
  { id: 74, slug: 'reverse-text', name: 'Reverse Text', description: 'Reverse text, words or lines', category: 'text', icon: 'repeat', runner: 'text', mode: 'reverse' },
  { id: 75, slug: 'text-sorter', name: 'Text Sorter', description: 'Sort lines A→Z, Z→A, by length or randomly', category: 'text', icon: 'list', runner: 'text', mode: 'sort' },
  { id: 76, slug: 'lorem-ipsum-generator', name: 'Lorem Ipsum Generator', description: 'Generate placeholder text instantly', category: 'text', icon: 'type', runner: 'text', mode: 'lorem' },

  // ─── 🌐 SEO Tools (8) ──────────────────────────────────────────────────
  { id: 77, slug: 'seo-analyzer', name: 'SEO Analyzer', description: 'Audit any URL for on-page SEO issues', category: 'seo', icon: 'search', badge: 'popular', runner: 'seo', mode: 'analyze' },
  { id: 78, slug: 'meta-tag-generator', name: 'Meta Tag Generator', description: 'Generate complete HTML meta tag snippets', category: 'seo', icon: 'code', runner: 'seo', mode: 'meta' },
  { id: 79, slug: 'sitemap-generator', name: 'Sitemap Generator', description: 'Build sitemap.xml from a list of URLs', category: 'seo', icon: 'list', runner: 'seo', mode: 'sitemap' },
  { id: 80, slug: 'robots-txt-generator', name: 'Robots.txt Generator', description: 'Create robots.txt rules visually', category: 'seo', icon: 'bot', runner: 'seo', mode: 'robots' },
  { id: 81, slug: 'open-graph-generator', name: 'Open Graph Generator', description: 'Generate OG tags for social sharing', category: 'seo', icon: 'share', runner: 'seo', mode: 'og' },
  { id: 82, slug: 'schema-markup-generator', name: 'Schema Markup Generator', description: 'Generate JSON-LD structured data', category: 'seo', icon: 'braces', runner: 'seo', mode: 'schema' },
  { id: 83, slug: 'keyword-density-checker', name: 'Keyword Density Checker', description: 'Analyze keyword frequency in content', category: 'seo', icon: 'search', runner: 'seo', mode: 'density' },
  { id: 84, slug: 'canonical-url-generator', name: 'Canonical URL Generator', description: 'Generate canonical link tags', category: 'seo', icon: 'link', runner: 'seo', mode: 'canonical' },

  // ─── ⚙ Utility Tools (8) ───────────────────────────────────────────────
  { id: 85, slug: 'qr-code-generator', name: 'QR Code Generator', description: 'Create QR codes for links, text and Wi-Fi', category: 'utility', icon: 'qr', badge: 'popular', runner: 'utility', mode: 'qr' },
  { id: 86, slug: 'barcode-generator', name: 'Barcode Generator', description: 'Generate CODE128, EAN and UPC barcodes', category: 'utility', icon: 'barcode', runner: 'utility', mode: 'barcode' },
  { id: 87, slug: 'password-generator', name: 'Password Generator', description: 'Generate strong random passwords', category: 'utility', icon: 'key', badge: 'popular', runner: 'utility', mode: 'password' },
  { id: 88, slug: 'password-strength-checker', name: 'Password Strength Checker', description: 'Test password strength and crack time', category: 'utility', icon: 'shield', runner: 'utility', mode: 'password-strength' },
  { id: 89, slug: 'unit-converter', name: 'Unit Converter', description: 'Convert length, weight, temperature and more', category: 'utility', icon: 'repeat', runner: 'utility', mode: 'unit' },
  { id: 90, slug: 'currency-converter', name: 'Currency Converter', description: 'Convert currencies with live exchange rates', category: 'utility', icon: 'globe', runner: 'utility', mode: 'currency' },
  { id: 91, slug: 'timestamp-converter', name: 'Timestamp Converter', description: 'Convert Unix timestamps to human dates', category: 'utility', icon: 'clock', runner: 'utility', mode: 'timestamp' },
  { id: 92, slug: 'random-number-generator', name: 'Random Number Generator', description: 'Generate random numbers in any range', category: 'utility', icon: 'hash', runner: 'utility', mode: 'random' },

  // ─── 🔐 Security Tools (8) ─────────────────────────────────────────────
  { id: 93, slug: 'md5-generator', name: 'MD5 Generator', description: 'Generate MD5 hashes from text or files', category: 'security', icon: 'hash', runner: 'security', mode: 'md5' },
  { id: 94, slug: 'sha1-generator', name: 'SHA1 Generator', description: 'Generate SHA-1 hashes from text or files', category: 'security', icon: 'hash', runner: 'security', mode: 'sha1' },
  { id: 95, slug: 'sha256-generator', name: 'SHA256 Generator', description: 'Generate SHA-256 hashes from text or files', category: 'security', icon: 'hash', runner: 'security', mode: 'sha256' },
  { id: 96, slug: 'sha512-generator', name: 'SHA512 Generator', description: 'Generate SHA-512 hashes from text or files', category: 'security', icon: 'hash', runner: 'security', mode: 'sha512' },
  { id: 97, slug: 'file-checksum-generator', name: 'File Checksum Generator', description: 'Verify file integrity with checksums', category: 'security', icon: 'shield', runner: 'security', mode: 'checksum' },
  { id: 98, slug: 'ssl-checker', name: 'SSL Checker', description: 'Check SSL certificate details of any domain', category: 'security', icon: 'lock', runner: 'security', mode: 'ssl' },
  { id: 99, slug: 'url-scanner', name: 'URL Scanner', description: 'Scan URLs for safety red flags', category: 'security', icon: 'search', runner: 'security', mode: 'url-scan' },
  { id: 100, slug: 'encryption-tool', name: 'Encryption Tool', description: 'AES-256 encrypt and decrypt text with a passphrase', category: 'security', icon: 'lock', runner: 'security', mode: 'encrypt' },

  // ─── 💼 Business Tools (8) ─────────────────────────────────────────────
  { id: 101, slug: 'invoice-generator', name: 'Invoice Generator', description: 'Create professional invoice PDFs', category: 'business', icon: 'file-text', badge: 'popular', runner: 'business', mode: 'invoice' },
  { id: 102, slug: 'gst-calculator', name: 'GST Calculator', description: 'Calculate GST inclusive and exclusive amounts', category: 'business', icon: 'calculator', runner: 'business', mode: 'gst' },
  { id: 103, slug: 'emi-calculator', name: 'EMI Calculator', description: 'Calculate loan EMI with full schedule', category: 'business', icon: 'calculator', runner: 'calculator', mode: 'emi' },
  { id: 104, slug: 'profit-margin-calculator', name: 'Profit Margin Calculator', description: 'Calculate margin, markup and profit', category: 'business', icon: 'calculator', runner: 'business', mode: 'margin' },
  { id: 105, slug: 'salary-calculator', name: 'Salary Calculator', description: 'CTC to in-hand salary breakdown', category: 'business', icon: 'calculator', runner: 'business', mode: 'salary' },
  { id: 106, slug: 'receipt-generator', name: 'Receipt Generator', description: 'Generate payment receipt PDFs', category: 'business', icon: 'file-text', runner: 'business', mode: 'receipt' },
  { id: 107, slug: 'business-card-generator', name: 'Business Card Generator', description: 'Design and download business cards', category: 'business', icon: 'user-square', runner: 'business', mode: 'card' },
  { id: 108, slug: 'quotation-generator', name: 'Quotation Generator', description: 'Create quotation PDFs for clients', category: 'business', icon: 'file-text', runner: 'business', mode: 'quotation' },

  // ─── 📱 Social Media Tools (8) ─────────────────────────────────────────
  { id: 109, slug: 'youtube-thumbnail-downloader', name: 'YouTube Thumbnail Downloader', description: 'Download YouTube thumbnails in HD', category: 'social', icon: 'video', badge: 'popular', runner: 'social', mode: 'yt-thumb' },
  { id: 110, slug: 'instagram-dp-downloader', name: 'Instagram DP Downloader', description: 'View and download Instagram profile photos', category: 'social', icon: 'image', runner: 'social', mode: 'ig-dp' },
  { id: 111, slug: 'instagram-caption-generator', name: 'Instagram Caption Generator', description: 'AI captions for your posts', category: 'social', icon: 'pen', badge: 'ai', runner: 'ai-text', mode: 'ig-caption', config: { fields: [ { key: 'topic', label: 'What is the post about?', type: 'textarea', placeholder: 'e.g. Sunset beach trip with friends' }, { key: 'vibe', label: 'Vibe', type: 'select', options: ['Fun', 'Aesthetic', 'Motivational', 'Minimal', 'Witty'] } ], system: 'You are a social media expert. Generate 5 Instagram captions (with fitting emojis and 5 hashtags each) for the described post in the requested vibe.' } },
  { id: 112, slug: 'hashtag-generator', name: 'Hashtag Generator', description: 'AI hashtag sets for any topic', category: 'social', icon: 'hash', badge: 'ai', runner: 'ai-text', mode: 'hashtags', config: { fields: [ { key: 'topic', label: 'Topic / niche', type: 'text', placeholder: 'e.g. fitness, travel photography' } ], system: 'Generate 30 relevant hashtags for the topic, grouped as: High reach (10), Medium (10), Niche (10). Output as a Markdown list.' } },
  { id: 113, slug: 'youtube-thumbnail-maker', name: 'YouTube Thumbnail Maker', description: 'Design 1280×720 thumbnails in your browser', category: 'social', icon: 'image', runner: 'social', mode: 'thumb-maker' },
  { id: 114, slug: 'youtube-tag-generator', name: 'YouTube Tag Generator', description: 'AI video tags for better reach', category: 'social', icon: 'hash', badge: 'ai', runner: 'ai-text', mode: 'yt-tags', config: { fields: [ { key: 'title', label: 'Video title / topic', type: 'text', placeholder: 'e.g. How to compress PDF files free' } ], system: 'Generate 25 comma-separated YouTube tags (mix of broad and long-tail) for the video topic. Output only the tags, comma-separated.' } },
  { id: 115, slug: 'social-media-post-generator', name: 'Social Media Post Generator', description: 'AI post copy for any platform', category: 'social', icon: 'share', badge: 'ai', runner: 'ai-text', mode: 'post', config: { fields: [ { key: 'brief', label: 'Post brief', type: 'textarea', placeholder: 'e.g. Announce our new product launch...' }, { key: 'platform', label: 'Platform', type: 'select', options: ['Instagram', 'X (Twitter)', 'LinkedIn', 'Facebook', 'Threads'] } ], system: 'You are a social media copywriter. Write 3 post variations optimized for the chosen platform (correct length, tone, hashtags, emojis).' } },
  { id: 116, slug: 'bio-generator', name: 'Bio Generator', description: 'AI bios for Instagram, X and LinkedIn', category: 'social', icon: 'user-square', badge: 'ai', runner: 'ai-text', mode: 'bio', config: { fields: [ { key: 'keywords', label: 'About you (keywords)', type: 'text', placeholder: 'e.g. developer, coffee lover, Kolkata' }, { key: 'platform', label: 'Platform', type: 'select', options: ['Instagram', 'X (Twitter)', 'LinkedIn', 'TikTok'] } ], system: 'Generate 5 bio options for the platform using the keywords. Respect platform character limits.' } },

  // ─── 🧮 Calculator Tools (6) ───────────────────────────────────────────
  { id: 117, slug: 'age-calculator', name: 'Age Calculator', description: 'Exact age in years, months, days', category: 'calculator', icon: 'clock', badge: 'popular', runner: 'calculator', mode: 'age' },
  { id: 118, slug: 'bmi-calculator', name: 'BMI Calculator', description: 'Body mass index with category', category: 'calculator', icon: 'calculator', runner: 'calculator', mode: 'bmi' },
  { id: 119, slug: 'percentage-calculator', name: 'Percentage Calculator', description: 'All percentage calculations in one place', category: 'calculator', icon: 'calculator', runner: 'calculator', mode: 'percentage' },
  { id: 120, slug: 'loan-emi-calculator', name: 'Loan EMI Calculator', description: 'EMI, total interest and payment schedule', category: 'calculator', icon: 'calculator', runner: 'calculator', mode: 'emi' },
  { id: 121, slug: 'discount-calculator', name: 'Discount Calculator', description: 'Final price after discount and savings', category: 'calculator', icon: 'calculator', runner: 'calculator', mode: 'discount' },
  { id: 122, slug: 'scientific-calculator', name: 'Scientific Calculator', description: 'Full scientific calculator in your browser', category: 'calculator', icon: 'calculator', runner: 'calculator', mode: 'scientific' },

  // ─── 📦 File Converter Tools (6) ───────────────────────────────────────
  { id: 123, slug: 'zip-creator', name: 'ZIP Creator', description: 'Compress files into a ZIP archive', category: 'file-converter', icon: 'folder', badge: 'popular', runner: 'file-convert', mode: 'zip-create', accept: '*/*', multiple: true },
  { id: 124, slug: 'zip-extractor', name: 'ZIP Extractor', description: 'Extract files from ZIP archives', category: 'file-converter', icon: 'folder', runner: 'file-convert', mode: 'zip-extract', accept: '.zip' },
  { id: 125, slug: 'csv-to-excel', name: 'CSV to Excel', description: 'Convert CSV files to Excel (XLSX)', category: 'file-converter', icon: 'table', runner: 'file-convert', mode: 'csv2xlsx', accept: '.csv' },
  { id: 126, slug: 'excel-to-csv', name: 'Excel to CSV', description: 'Convert Excel sheets to CSV', category: 'file-converter', icon: 'table', runner: 'file-convert', mode: 'xlsx2csv', accept: '.xlsx,.xls' },
  { id: 127, slug: 'xml-to-json', name: 'XML to JSON', description: 'Convert XML documents to JSON', category: 'file-converter', icon: 'braces', runner: 'file-convert', mode: 'xml2json' },
  { id: 128, slug: 'json-to-xml', name: 'JSON to XML', description: 'Convert JSON data to XML', category: 'file-converter', icon: 'braces', runner: 'file-convert', mode: 'json2xml' },
];

export function getTool(slug: string): Tool | undefined {
  return tools.find((t) => t.slug === slug);
}

export function getToolsByCategory(categorySlug: string): Tool[] {
  return tools.filter((t) => t.category === categorySlug);
}

/** The exact 15 cards shown on the homepage grid, in mockup order. */
export const homepageToolSlugs: string[] = [
  'pdf-to-word', 'image-compressor', 'background-remover', 'ai-chat', 'merge-pdf',
  'compress-pdf', 'image-to-pdf', 'video-converter', 'audio-converter', 'ai-image-generator',
  'image-ocr', 'pdf-to-excel', 'watermark-remover', 'video-compressor', 'ai-writer',
];

export function searchTools(query: string): Tool[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const words = q.split(/\s+/);
  return tools
    .map((t) => {
      const hay = `${t.name} ${t.description} ${t.category} ${(t.keywords || []).join(' ')}`.toLowerCase();
      let score = 0;
      if (t.name.toLowerCase() === q) score += 100;
      if (t.name.toLowerCase().startsWith(q)) score += 50;
      if (t.name.toLowerCase().includes(q)) score += 30;
      for (const w of words) if (hay.includes(w)) score += 10;
      return { t, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.t);
}
