
import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { cn } from '../lib/utils.ts';
import { BotIcon, UserIcon } from './icons.tsx';

interface Message {
  role: 'user' | 'model';
  content: string;
}

interface ChatMessageProps {
  message: Message;
  isLoading: boolean;
  onSendMessage: (content: string) => void;
}

const CodeBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gray-950 rounded-lg my-4 overflow-hidden border border-gray-700">
      <div className="flex justify-between items-center px-4 py-1 bg-gray-800 text-xs text-gray-400">
        <span>{language || 'code'}</span>
        <button onClick={handleCopy} className="text-gray-400 hover:text-white transition-colors text-sm">
          {copied ? 'Copié!' : 'Copier'}
        </button>
      </div>
      <pre className="p-4 text-sm overflow-x-auto custom-scrollbar">
        <code className={`language-${language}`}>{code}</code>
      </pre>
    </div>
  );
};


const renderContent = (content: string) => {
    const cleanContent = content.replace('[EXERCICE]', '').trim();
    if (!cleanContent) return null;
    const parts = cleanContent.split(/(\`\`\`[\w]*\n[\s\S]*?\n\`\`\`)/g);

    return parts.map((part, index) => {
        if (!part) return null;
        const codeBlockMatch = part.match(/\`\`\`(\w*)\n([\s\S]*?)\n\`\`\`/);
        if (codeBlockMatch) {
            const language = codeBlockMatch[1];
            const code = codeBlockMatch[2];
            return <CodeBlock key={index} language={language} code={code.trim()} />;
        }
        
        return <p key={index} className="whitespace-pre-wrap leading-relaxed">
            {part.split(/(\*\*.*?\*\*)/g).map((textPart, i) => {
                if (!textPart) return null;
                if (textPart.startsWith('**') && textPart.endsWith('**')) {
                    return <strong key={i}>{textPart.slice(2, -2)}</strong>;
                }
                
                const lines = textPart.trim().split('\n');
                const isList = lines.every(line => line.trim().startsWith('* ') || line.trim().startsWith('- '));
                
                if (isList && textPart.trim()) {
                   return (
                        <ul key={i} className="list-disc list-inside space-y-1 my-2">
                            {lines.map((line, li) => (
                                <li key={li}>{line.replace(/^[-*]\s/, '')}</li>
                            ))}
                        </ul>
                    );
                }
                return <span key={i}>{textPart}</span>;
            })}
        </p>;
    });
};

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isLoading, onSendMessage }) => {
  const isModel = message.role === 'model';
  const [isExercise, setIsExercise] = useState(false);
  const [solutionCode, setSolutionCode] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [language, setLanguage] = useState('plaintext');
  
  useEffect(() => {
    if (isModel && message.content.includes('[EXERCICE]')) {
      setIsExercise(true);
      const langMatch = message.content.match(/\`\`\`(\w+)\n/);
      if (langMatch && langMatch[1]) {
        setLanguage(langMatch[1]);
      }
    }
  }, [isModel, message.content]);

  const handleExerciseSubmit = () => {
    if (!solutionCode.trim() || isLoading) return;
    const submission = `Voici ma solution pour l'exercice :\n\`\`\`${language}\n${solutionCode}\n\`\`\``;
    onSendMessage(submission);
    setIsSubmitted(true);
  };

  return (
    <div className={cn('flex flex-col', isModel ? 'items-start' : 'items-end')}>
        <div className={cn('flex items-start gap-4', isModel ? 'justify-start' : 'justify-end', 'w-full')}>
            {isModel && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-emerald-500 flex-shrink-0 flex items-center justify-center text-white">
                    <BotIcon />
                </div>
            )}
            <div
                className={cn(
                'max-w-2xl rounded-xl px-4 py-3',
                isModel
                    ? 'bg-gray-800 text-gray-200'
                    : 'bg-sky-600 text-white'
                )}
            >
                {renderContent(message.content)}
            </div>
            {!isModel && (
                <div className="w-8 h-8 rounded-full bg-gray-600 flex-shrink-0 flex items-center justify-center text-white">
                    <UserIcon />
                </div>
            )}
        </div>

        {isExercise && !isSubmitted && (
            <div className="mt-4 bg-gray-900/50 p-4 rounded-lg border border-gray-700 w-full max-w-2xl self-start ml-12">
                <label className="block text-sm font-medium text-gray-300 mb-2">Votre solution :</label>
                <div className="border border-gray-600 rounded-md overflow-hidden">
                    <Editor
                        height="250px"
                        language={language}
                        value={solutionCode}
                        onChange={(value) => setSolutionCode(value || '')}
                        theme="vs-dark"
                        options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            wordWrap: 'on',
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            padding: { top: 10 },
                        }}
                    />
                </div>
                <div className="flex justify-end items-center mt-2">
                    <button
                        onClick={handleExerciseSubmit}
                        disabled={isLoading || !solutionCode.trim()}
                        className="bg-emerald-600 text-white rounded-md px-4 py-2 disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-emerald-500 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-emerald-500"
                    >
                        Soumettre la correction
                    </button>
                </div>
            </div>
        )}
        {isExercise && isSubmitted && (
            <div className="mt-4 bg-gray-900/50 p-3 rounded-lg border border-gray-700 text-center w-full max-w-2xl self-start ml-12">
                <p className="text-sm text-gray-400">Exercice soumis. En attente de la correction de l'IA...</p>
            </div>
        )}
    </div>
  );
};