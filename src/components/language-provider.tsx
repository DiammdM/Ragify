"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Language = "en" | "zh";

type Translation = typeof translations.en;

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translation;
};

const translations = {
  en: {
    layout: {
      brand: "Ragify",
      tagline: "Retrieval-Augmented Knowledge Hub",
      menuLabel: "Feature directory",
      language: {
        label: "Language",
        en: "English",
        zh: "简体中文",
      },
      logout: "Log out",
      loggingOut: "Logging out...",
    },
    nav: {
      qa: "Q&A",
      chat: "Chat",
      library: "Knowledge Library",
      settings: "Settings",
      users: "Users",
    },
    qa: {
      title: "Q&A Console",
      subtitle: "Ask domain questions backed by your curated knowledge base.",
      placeholder: "Ask a question about your documents...",
      ask: "Ask",
      samplesTitle: "Suggested prompts",
      emptyState:
        "No conversations yet. Submit a question to see RAG responses.",
      processing: "Generating the answer...",
      answerTitle: "Synthesized answer",
      answerLoading: "Generating answer with the selected model...",
      answerEmpty: "Answer generation is not available right now.",
      answerModelLabel: "Model",
      resultsTitle: "Top matches",
      resultsEmpty: "No indexed chunks matched this query yet.",
      errorFallback: "Unable to query the knowledge base right now.",
      unknownDocument: "Untitled document",
      scoreLabel: "Score",
      chunkLabel: "Chunk",
      emptyChunk: "This chunk did not contain any extracted text.",
      // quickQuestions: [
      //   "What onboarding steps should a new customer follow?",
      //   "Summarize the key clauses in the enterprise agreement.",
      //   "How can we escalate a P1 support ticket?",
      // ],
      historyLabel: "Conversation history",
      note: "Tip: tune chunk size and model in Settings after indexing documents.",
    },
    chat: {
      title: "Chat Console",
      subtitle:
        "Have multi-turn conversations grounded in your indexed knowledge.",
      placeholder: "Ask or follow up using your documents...",
      inputLabel: "Chat input",
      send: "Send",
      sending: "Sending...",
      clear: "Clear chat",
      emptyState: "No messages yet. Start chatting to see contextual answers.",
      answerFallback: "No answer available yet.",
      answerError: "Unable to generate a response right now.",
      referencesTitle: "Sources used",
      referencesHint:
        "The latest assistant reply cites up to three chunks for grounding.",
      referencesEmpty: "Send a message to surface cited sources here.",
      note: "Each reply retrieves with the latest turn and keeps recent context within token limits.",
      quickPrompts: [
        "What changed in the latest policy update?",
        "Summarize recent support escalations.",
        "Draft a response for a customer asking about onboarding.",
      ],
    },
    library: {
      title: "Knowledge Library",
      subtitle: "Upload, inspect, and index customer knowledge assets.",
      uploadCta: "Add documents",
      uploading: "Uploading...",
      uploadError: "Failed to upload files. Please try again.",
      loadError: "Unable to load documents right now.",
      operationError: "Something went wrong. Please try again.",
      loading: "Loading…",
      invalidType: "Only supported document types can be uploaded.",
      uploadHint: "PDF, DOCX, and markdown files are supported.",
      tableHeaders: {
        name: "Document",
        size: "Size",
        status: "Status",
        updated: "Updated",
        actions: "Actions",
      },
      status: {
        uploaded: "Uploaded",
        indexing: "Indexing...",
        indexed: "Indexed",
      },
      indexingStages: {
        extracting: "Extracting text",
        chunking: "Forming chunks",
        embedding: "Generating embeddings",
        saving: "Saving to vector store",
      },
      indexAction: "Chunk & index",
      deleteAction: "Delete",
      emptyState:
        "No documents yet. Upload files to build your knowledge base.",
      successToast: "Documents queued for indexing.",
      dropLabel: "Drag & drop files or click to browse",
      chunkingNote: "Indexing splits files into embeddings-ready chunks.",
      indexSuccess: "Indexing complete.",
      deleteDialog: {
        title: "Delete document",
        description: "This action cannot be undone.",
        confirm: "Delete",
        cancel: "Cancel",
      },
    },
    settings: {
      title: "Settings",
      subtitle: "Configure model access and retrieval preferences.",
      modelLabel: "Generative model",
      modelPlaceholder: "Select a model",
      models: {
        openai: "OpenAI",
        gemini: "Gemini",
        deepseek: "DeepSeek",
        ollama: "Ollama (local runtime)",
      },
      apiLabel: "Model API key",
      apiPlaceholder: "Enter the key provided by your model host",
      chunksLabel: "Chunk size",
      chunksHelper:
        "Recommended 600-1200 tokens depending on document structure.",
      ollamaConfig: {
        title: "Ollama connection",
        hostLabel: "Host / IP",
        hostPlaceholder: "127.0.0.1",
        portLabel: "Port",
        portPlaceholder: "11434",
        modelLabel: "Model name",
        modelPlaceholder: "gpt-oss:20b",
        helper: "Defaults to 127.0.0.1:11434 with gpt-oss:20b.",
      },
      languageLabel: "Interface language",
      save: "Save changes",
      saving: "Saving...",
      saved: "Settings saved.",
      saveError: "Failed to save settings.",
      loadError: "Failed to load settings.",
      languageOptions: {
        en: "English",
        zh: "简体中文",
      },
      quickPrompts: {
        title: "Q&A quick prompts",
        helper:
          "Shown on the Q&A console and stays the same regardless of interface language.",
        placeholders: ["First prompt", "Second prompt", "Third prompt"],
      },
    },
    users: {
      title: "User management",
      subtitle: "Manage accounts and assign roles.",
      table: {
        name: "User",
        role: "Role",
        created: "Created",
        actions: "Actions",
      },
      roles: {
        user: "User",
        admin: "Admin",
      },
      save: "Update role",
      saving: "Saving...",
      loadError: "Unable to load users.",
      updateError: "Failed to update role.",
      success: "Role updated.",
      selfNote: "You cannot change your own role here.",
      delete: "Delete",
      deleteError: "Failed to delete user.",
    },
    toasts: {
      deleted: "Document deleted.",
      indexing: "Indexing started.",
    },
    auth: {
      form: {
        nameLabel: "Username",
        namePlaceholder: "Enter your username",
        passwordLabel: "Password",
        passwordPlaceholder: "Enter your password",
        submitting: "Submitting...",
      },
      login: {
        title: "Log in",
        subtitle: "Access your knowledge workspace.",
        submit: "Log in",
        switchPrompt: "Need an account?",
        switchCta: "Sign up",
      },
      register: {
        title: "Create an account",
        subtitle: "Register to save settings and documents.",
        submit: "Create account",
        switchPrompt: "Already have an account?",
        switchCta: "Log in",
      },
      errors: {
        generic: "Something went wrong. Please try again.",
      },
    },
  },
  zh: {
    layout: {
      brand: "Ragify",
      tagline: "基于检索增强的知识中枢",
      menuLabel: "功能目录",
      language: {
        label: "界面语言",
        en: "English",
        zh: "简体中文",
      },
      logout: "退出登录",
      loggingOut: "正在退出...",
    },
    nav: {
      qa: "问答",
      chat: "聊天",
      library: "资料管理",
      settings: "设置",
      users: "用户管理",
    },
    qa: {
      title: "问答控制台",
      subtitle: "针对知识库资料提出问题并获取模型回答。",
      placeholder: "请输入与资料库相关的问题...",
      ask: "提问",
      samplesTitle: "示例提问",
      emptyState: "暂时没有会话，请先提交一个问题。",
      processing: "正在生成答案...",
      answerTitle: "模型回答",
      answerLoading: "正在根据引用内容生成答案...",
      answerEmpty: "暂时无法生成答案。",
      answerModelLabel: "模型",
      resultsTitle: "相似内容",
      resultsEmpty: "暂未找到匹配的索引分片。",
      errorFallback: "目前无法查询知识库，请稍后重试。",
      unknownDocument: "未命名资料",
      scoreLabel: "相似度",
      chunkLabel: "分片",
      emptyChunk: "该分片没有可供展示的文本。",
      historyLabel: "会话记录",
      note: "提示：完成资料索引后，可在设置中调整分片大小和模型。",
    },
    chat: {
      title: "聊天对话",
      subtitle: "基于已索引的资料进行多轮问答。",
      placeholder: "输入问题或追问，引用知识库内容……",
      inputLabel: "对话输入",
      send: "发送",
      sending: "发送中...",
      clear: "清空对话",
      emptyState: "还没有消息，先说点什么吧。",
      answerFallback: "暂时没有可用的回答。",
      answerError: "生成回答失败，请稍后重试。",
      referencesTitle: "引用来源",
      referencesHint: "助手会在回复中引用最多 3 个分片。",
      referencesEmpty: "发送消息后，会在此看到引用内容。",
      note: "每次回复会用最新一轮检索，并在上下文长度内保留近期对话。",
    },
    library: {
      title: "资料管理",
      subtitle: "上传、查看并索引客户知识资料。",
      uploadCta: "上传资料",
      uploading: "上传中...",
      uploadError: "上传失败，请稍后重试。",
      loadError: "暂时无法加载资料列表。",
      operationError: "操作失败，请稍后重试。",
      loading: "加载中…",
      invalidType: "仅支持上传可转换为文本的文件类型。",
      uploadHint: "支持 PDF、DOCX 和 Markdown 文件。",
      tableHeaders: {
        name: "资料",
        size: "大小",
        status: "状态",
        updated: "更新时间",
        actions: "操作",
      },
      status: {
        uploaded: "已上传",
        indexing: "索引中...",
        indexed: "已索引",
      },
      indexingStages: {
        extracting: "提取文本内容",
        chunking: "切分文本片段",
        embedding: "生成向量嵌入",
        saving: "写入向量库",
      },
      indexAction: "分片并索引",
      deleteAction: "删除",
      emptyState: "还没有资料，请先上传文件构建知识库。",
      successToast: "资料已加入索引队列。",
      dropLabel: "拖拽文件到此处或点击选择",
      chunkingNote: "索引会将文件切分为适合向量化的分片。",
      indexSuccess: "索引完成。",
      deleteDialog: {
        title: "删除资料",
        description: "此操作无法撤销。",
        confirm: "删除",
        cancel: "取消",
      },
    },
    settings: {
      title: "系统设置",
      subtitle: "配置模型访问与检索参数。",
      modelLabel: "生成模型",
      modelPlaceholder: "请选择模型",
      models: {
        openai: "OpenAI",
        gemini: "Gemini",
        deepseek: "DeepSeek",
        ollama: "Ollama 本地模型",
      },
      apiLabel: "模型 API Key",
      apiPlaceholder: "请输入模型服务提供的 key",
      chunksLabel: "分片大小",
      chunksHelper: "建议 600-1200 tokens，请根据文档结构调整。",
      ollamaConfig: {
        title: "Ollama 连接配置",
        hostLabel: "主机 / IP",
        hostPlaceholder: "127.0.0.1",
        portLabel: "端口",
        portPlaceholder: "11434",
        modelLabel: "模型名称",
        modelPlaceholder: "gpt-oss:20b",
        helper: "默认连接 127.0.0.1:11434 并使用 gpt-oss:20b。",
      },
      languageLabel: "界面语言",
      save: "保存设置",
      saving: "保存中...",
      saved: "设置已保存。",
      saveError: "保存失败，请稍后重试。",
      loadError: "加载设置失败，请稍后重试。",
      languageOptions: {
        en: "English",
        zh: "简体中文",
      },
      quickPrompts: {
        title: "问答提示词",
        helper: "用于问答控制台，语言切换时仍显示你输入的内容。",
        placeholders: ["提示词 1", "提示词 2", "提示词 3"],
      },
    },
    users: {
      title: "用户管理",
      subtitle: "管理账号并分配角色。",
      table: {
        name: "用户",
        role: "角色",
        created: "创建时间",
        actions: "操作",
      },
      roles: {
        user: "普通用户",
        admin: "管理员",
      },
      save: "更新角色",
      saving: "保存中...",
      loadError: "无法加载用户列表。",
      updateError: "更新角色失败。",
      success: "已更新角色。",
      selfNote: "不能在此修改自己的角色。",
      delete: "删除",
      deleteError: "删除用户失败。",
    },
    toasts: {
      deleted: "资料已删除。",
      indexing: "索引任务已启动。",
    },
    auth: {
      form: {
        nameLabel: "用户名",
        namePlaceholder: "请输入用户名",
        passwordLabel: "密码",
        passwordPlaceholder: "请输入密码",
        submitting: "提交中...",
      },
      login: {
        title: "登录",
        subtitle: "进入您的知识工作台。",
        submit: "登录",
        switchPrompt: "还没有账号？",
        switchCta: "立即注册",
      },
      register: {
        title: "注册新账号",
        subtitle: "创建账号以保存设置并管理资料。",
        submit: "注册",
        switchPrompt: "已经有账号？",
        switchCta: "去登录",
      },
      errors: {
        generic: "操作失败，请稍后重试。",
      },
    },
  },
} as const;

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined
);
const STORAGE_KEY = "ragify.language";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("zh");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = window.localStorage.getItem(STORAGE_KEY) as Language | null;
    if (stored === "en" || stored === "zh") {
      setLanguage(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
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

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
