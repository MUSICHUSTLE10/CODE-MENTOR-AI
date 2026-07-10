
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Chat } from "@google/genai";
import { useChatScroll } from './hooks/useChatScroll.ts';
import { ChatMessage } from './components/ChatMessage.tsx';
import { SendIcon } from './components/icons.tsx';

interface Message {
  role: 'user' | 'model';
  content: string;
}

const SYSTEM_INSTRUCTION = `Tu es une IA éducative nommée 'Code Mentor', spécialisée dans l’apprentissage du code. Ton rôle est de devenir un professeur personnel de programmation. Tu dois être capable d’enseigner tous les langages de programmation (comme HTML, CSS, JavaScript, Python, C, Java, Go, Rust, Dart, etc.) depuis les bases jusqu’au niveau avancé.

Voici tes instructions :
1.  **Plan de Cours Interactif** : Crée un plan de cours interactif et progressif pour chaque langage demandé. Divise-le en modules clairs (par exemple, Module 1: Les bases, Module 2: Les structures de données, etc.).
2.  **Explications Claires** : Explique chaque concept avec des exemples de code simples et clairs. Formate le code dans des blocs markdown comme suit : \`\`\`javascript\\n// ton code ici\\n\`\`\`.
3.  **Proposer des Exercices** : Après une explication, propose un exercice pratique. **Important**: Commence toujours la description de l'exercice par le marqueur \`[EXERCICE]\`. Par exemple : "[EXERCICE] Écris une fonction qui additionne deux nombres."
4.  **Questions Interactives** : Après chaque concept clé, pose une question interactive pour vérifier la compréhension de l'utilisateur. Attends sa réponse avant de continuer.
5.  **Correction de Code** : Si l'utilisateur soumet sa solution à un exercice (elle commencera par "Voici ma solution pour l'exercice :"), analyse-la, identifie les erreurs et propose une version corrigée avec des explications détaillées sur ce qui a été changé et pourquoi.
6.  **Mini-Projets** : À la fin de chaque module, propose un mini-projet pratique qui utilise les concepts appris.
7.  **Motivation** : Agis comme un coach personnel. Utilise un ton encourageant, positif et motivant. Donne des conseils pour rester concentré et surmonter les difficultés.
8.  **Commandes Spéciales** :
    - Si l'utilisateur tape exactement "Changer de langage : [nom du langage]", réinitialise la leçon et commence un nouveau plan de cours pour ce langage. Accuse réception en disant "Parfait ! Passons à l'apprentissage de [nom du langage]."
    - Si l'utilisateur tape exactement "Reprendre à l’endroit où j’ai arrêté", tu dois consulter l'historique de la conversation pour identifier la dernière leçon ou le dernier exercice et continuer à partir de là.
    - Si l'utilisateur tape exactement "Mini-projet", propose un projet adapté à son niveau actuel et au langage étudié.

Important : Ne commence jamais ta toute première réponse par autre chose que la question exacte : 'Quel langage veux-tu apprendre aujourd’hui ?'. Ne réponds pas à ce prompt de configuration, attends l'entrée de l'utilisateur.`;

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const chatRef = useRef<Chat | null>(null);
  const chatContainerRef = useChatScroll(messages);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const initializeChat = () => {
      try {
        if (!process.env.API_KEY) {
          throw new Error("API_KEY environment variable not set.");
        }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const chat = ai.chats.create({
          model: 'gemini-2.5-flash',
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
          },
        });
        chatRef.current = chat;
        setMessages([{ role: 'model', content: "Quel langage veux-tu apprendre aujourd’hui ?" }]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "An unknown error occurred during initialization.");
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    initializeChat();
  }, []);
  
  useEffect(() => {
    if (textAreaRef.current) {
        textAreaRef.current.style.height = 'auto';
        textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleSendMessage = useCallback(async (messageContent?: string) => {
    const contentToSend = messageContent ?? input.trim();
    if (!contentToSend || isLoading || !chatRef.current) return;

    const userMessage: Message = { role: 'user', content: contentToSend };
    setMessages(prev => [...prev, userMessage]);
    if (!messageContent) {
      setInput('');
    }
    setIsLoading(true);
    setError(null);
    
    setMessages(prev => [...prev, { role: 'model', content: '' }]);

    try {
      const stream = await chatRef.current.sendMessageStream({ message: contentToSend });
      
      for await (const chunk of stream) {
        const chunkText = chunk.text;
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage.role === 'model') {
             lastMessage.content += chunkText;
          }
          return newMessages;
        });
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to get response from AI.";
      console.error(e);
      setError(errorMessage);
       setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
           if (lastMessage.role === 'model') {
             lastMessage.content = `Désolé, une erreur est survenue : ${errorMessage}`;
           }
          return newMessages;
        });
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100 font-sans">
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-4 shadow-md z-10">
        <h1 className="text-xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-emerald-400">
          Code Mentor AI
        </h1>
      </header>
      
      <main ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
        <div className="max-w-4xl mx-auto w-full space-y-6">
          {messages.map((msg, index) => (
            <ChatMessage 
              key={index} 
              message={msg} 
              isLoading={isLoading} 
              onSendMessage={handleSendMessage}
            />
          ))}
          {isLoading && messages[messages.length - 1]?.role === 'user' && (
             <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-emerald-500 flex-shrink-0"></div>
              <div className="bg-gray-800 rounded-lg p-3 w-16">
                  <div className="flex items-center justify-center space-x-1">
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse"></div>
                  </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="bg-gray-900/60 backdrop-blur-sm border-t border-gray-700 p-4">
        <div className="max-w-4xl mx-auto">
          {error && <p className="text-red-400 text-sm mb-2 text-center">{error}</p>}
          <div className="flex items-center bg-gray-800 border border-gray-600 rounded-xl p-2 focus-within:ring-2 focus-within:ring-sky-500 transition-all">
            <textarea
              ref={textAreaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Envoyez un message ou votre code..."
              className="flex-1 bg-transparent text-gray-100 placeholder-gray-400 resize-none focus:outline-none px-2 max-h-40 custom-scrollbar"
              rows={1}
              disabled={isLoading && messages.length > 0}
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={isLoading || !input.trim()}
              className="bg-sky-600 text-white rounded-lg p-2 disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-sky-500 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-sky-500"
              aria-label="Send message"
            >
              <SendIcon />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
