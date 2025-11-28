'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Language = 'en' | 'zh';

type Translation = typeof translations.en;

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translation;
};

const translations = {
  en: {
    layout: {
      brand: 'Ragify',
      tagline: 'Retrieval-Augmented Knowledge Hub',
      menuLabel: 'Feature directory',
      language: {
        label: 'Language',
        en: 'English',
        zh: '简体中文',
      },
    },
    nav: {
      qa: 'Q&A',
      library: 'Knowledge Library',
      settings: 'Settings',
    },
    qa: {
      title: 'Q&A Console',
      subtitle: 'Ask domain questions backed by your curated knowledge base.',
      placeholder: 'Ask a question about your documents...',
      ask: 'Ask',
      samplesTitle: 'Suggested prompts',
      emptyState: 'No conversations yet. Submit a question to see RAG responses.',
      processing: 'Searching the vector store...',
      answerTitle: 'Synthesized answer',
      answerLoading: 'Generating answer with the selected model...',
      answerEmpty: 'Answer generation is not available right now.',
      answerModelLabel: 'Model',
      resultsTitle: 'Top matches',
      resultsEmpty: 'No indexed chunks matched this query yet.',
      errorFallback: 'Unable to query the knowledge base right now.',
      unknownDocument: 'Untitled document',
      scoreLabel: 'Score',
      chunkLabel: 'Chunk',
      emptyChunk: 'This chunk did not contain any extracted text.',
      quickQuestions: [
        'What onboarding steps should a new customer follow?',
        'Summarize the key clauses in the enterprise agreement.',
        'How can we escalate a P1 support ticket?',
      ],
      historyLabel: 'Conversation history',
      note: 'Tip: tune chunk size and model in Settings after indexing documents.',
    },
    library: {
      title: 'Knowledge Library',
      subtitle: 'Upload, inspect, and index customer knowledge assets.',
      uploadCta: 'Add documents',
      uploading: 'Uploading...',
      uploadError: 'Failed to upload files. Please try again.',
      loadError: 'Unable to load documents right now.',
      operationError: 'Something went wrong. Please try again.',
      loading: 'Loading…',
      invalidType: 'Only supported document types can be uploaded.',
      uploadHint: 'PDF, DOCX, and markdown files are supported.',
      tableHeaders: {
        name: 'Document',
        size: 'Size',
        status: 'Status',
        updated: 'Updated',
        actions: 'Actions',
      },
      status: {
        uploaded: 'Uploaded',
        indexing: 'Indexing...',
        indexed: 'Indexed',
      },
      indexingStages: {
        extracting: 'Extracting text',
        chunking: 'Forming chunks',
        embedding: 'Generating embeddings',
        saving: 'Saving to vector store',
      },
      indexAction: 'Chunk & index',
      deleteAction: 'Delete',
      emptyState: 'No documents yet. Upload files to build your knowledge base.',
      successToast: 'Documents queued for indexing.',
      dropLabel: 'Drag & drop files or click to browse',
      chunkingNote: 'Indexing splits files into embeddings-ready chunks.',
      indexSuccess: 'Indexing complete.',
    },
    settings: {
      title: 'Settings',
      subtitle: 'Configure model access and retrieval preferences.',
      modelLabel: 'Generative model',
      modelPlaceholder: 'Select a model',
      models: {
        llama: 'Llama 3.1 70B Instruct',
        qwen: 'Qwen2.5 32B',
        gemma: 'Gemma 2 27B',
        local: 'Local GGUF runner',
      },
      apiLabel: 'Model API key',
      apiPlaceholder: 'Enter the key provided by your model host',
      chunksLabel: 'Chunk size',
      chunksHelper: 'Recommended 600-1200 tokens depending on document structure.',
      languageLabel: 'Interface language',
      save: 'Save changes',
      saved: 'Settings saved locally.',
      languageOptions: {
        en: 'English',
        zh: '简体中文',
      },
    },
    toasts: {
      deleted: 'Document deleted.',
      indexing: 'Indexing started.',
    },
  },
  zh: {
    layout: {
      brand: 'Ragify',
      tagline: '基于检索增强的知识中枢',
      menuLabel: '功能目录',
      language: {
        label: '界面语言',
        en: 'English',
        zh: '简体中文',
      },
    },
    nav: {
      qa: '问答',
      library: '资料管理',
      settings: '设置',
    },
    qa: {
      title: '问答控制台',
      subtitle: '针对知识库资料提出问题并获取模型回答。',
      placeholder: '请输入与资料库相关的问题...',
      ask: '提问',
      samplesTitle: '示例提问',
      emptyState: '暂时没有会话，请先提交一个问题。',
      processing: '正在检索向量库...',
      answerTitle: '模型回答',
      answerLoading: '正在根据引用内容生成答案...',
      answerEmpty: '暂时无法生成答案。',
      answerModelLabel: '模型',
      resultsTitle: '相似内容',
      resultsEmpty: '暂未找到匹配的索引分片。',
      errorFallback: '目前无法查询知识库，请稍后重试。',
      unknownDocument: '未命名资料',
      scoreLabel: '相似度',
      chunkLabel: '分片',
      emptyChunk: '该分片没有可供展示的文本。',
      quickQuestions: [
        '新客户需要完成哪些上手步骤？',
        '请概述企业协议的关键条款。',
        '如何升级 P1 级别的支持工单？',
      ],
      historyLabel: '会话记录',
      note: '提示：完成资料索引后，可在设置中调整分片大小和模型。',
    },
    library: {
      title: '资料管理',
      subtitle: '上传、查看并索引客户知识资料。',
      uploadCta: '上传资料',
      uploading: '上传中...',
      uploadError: '上传失败，请稍后重试。',
      loadError: '暂时无法加载资料列表。',
      operationError: '操作失败，请稍后重试。',
      loading: '加载中…',
      invalidType: '仅支持上传可转换为文本的文件类型。',
      uploadHint: '支持 PDF、DOCX 和 Markdown 文件。',
      tableHeaders: {
        name: '资料',
        size: '大小',
        status: '状态',
        updated: '更新时间',
        actions: '操作',
      },
      status: {
        uploaded: '已上传',
        indexing: '索引中...',
        indexed: '已索引',
      },
      indexingStages: {
        extracting: '提取文本内容',
        chunking: '切分文本片段',
        embedding: '生成向量嵌入',
        saving: '写入向量库',
      },
      indexAction: '分片并索引',
      deleteAction: '删除',
      emptyState: '还没有资料，请先上传文件构建知识库。',
      successToast: '资料已加入索引队列。',
      dropLabel: '拖拽文件到此处或点击选择',
      chunkingNote: '索引会将文件切分为适合向量化的分片。',
      indexSuccess: '索引完成。',
    },
    settings: {
      title: '系统设置',
      subtitle: '配置模型访问与检索参数。',
      modelLabel: '生成模型',
      modelPlaceholder: '请选择模型',
      models: {
        llama: 'Llama 3.1 70B Instruct',
        qwen: 'Qwen2.5 32B',
        gemma: 'Gemma 2 27B',
        local: '本地 GGUF 运行',
      },
      apiLabel: '模型 API Key',
      apiPlaceholder: '请输入模型服务提供的 key',
      chunksLabel: '分片大小',
      chunksHelper: '建议 600-1200 tokens，请根据文档结构调整。',
      languageLabel: '界面语言',
      save: '保存设置',
      saved: '设置已保存在本地。',
      languageOptions: {
        en: 'English',
        zh: '简体中文',
      },
    },
    toasts: {
      deleted: '资料已删除。',
      indexing: '索引任务已启动。',
    },
  },
} as const;

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);
const STORAGE_KEY = 'ragify.language';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('zh');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const stored = window.localStorage.getItem(STORAGE_KEY) as Language | null;
    if (stored === 'en' || stored === 'zh') {
      setLanguage(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, language);
    }
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: translations[language],
    }),
    [language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
